import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentTenantId } from '@/hooks/useTenant';
import { Sale } from '@/hooks/useSales';
import { startOfDay, addDays, parseISO, isToday, isTomorrow } from 'date-fns';

function useOrganizationId() {
  const { profile } = useAuth();
  const { data: tenantId } = useCurrentTenantId();
  return profile?.organization_id ?? tenantId ?? null;
}

export interface ExpeditionStats {
  draft: number;
  printed: number;
  separated: number;
  dispatched: number;
  returned: number;
  delivered: number;
  cancelled: number;
  carrierNoTracking: number;
  carrierWithTracking: number;
  urgentToday: number;
  tomorrowPrep: number;
}

export function useExpeditionSales() {
  const organizationId = useOrganizationId();

  return useQuery({
    queryKey: ['expedition-sales', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];

      const { data, error } = await supabase
        .from('sales')
        .select(`
          *,
          lead:leads(id, name, whatsapp, email, street, street_number, complement, neighborhood, city, state, cep, secondary_phone, delivery_notes, google_maps_link),
          items:sale_items(id, sale_id, product_id, product_name, quantity, unit_price_cents, discount_cents, total_cents, notes, requisition_number, created_at)
        `)
        .eq('organization_id', organizationId)
        .in('status', ['draft', 'pending_expedition', 'dispatched', 'delivered', 'returned', 'cancelled'])
        .order('scheduled_delivery_date', { ascending: true })
        .order('created_at', { ascending: true });

      if (error) throw error;

      return (data || []) as unknown as Sale[];
    },
    enabled: !!organizationId,
    refetchInterval: 30000, // Refresh every 30 seconds for real-time feel
  });
}

export function useExpeditionStats(sales: Sale[]) {
  const today = startOfDay(new Date());
  const tomorrow = addDays(today, 1);

  const stats: ExpeditionStats = {
    draft: 0,
    printed: 0,
    separated: 0,
    dispatched: 0,
    returned: 0,
    delivered: 0,
    cancelled: 0,
    carrierNoTracking: 0,
    carrierWithTracking: 0,
    urgentToday: 0,
    tomorrowPrep: 0,
  };

  sales.forEach(sale => {
    const deliveryDate = sale.scheduled_delivery_date 
      ? parseISO(sale.scheduled_delivery_date) 
      : null;

    // Status counts
    switch (sale.status) {
      case 'draft':
        stats.draft++;
        break;
      case 'pending_expedition':
        stats.printed++;
        break;
      case 'dispatched':
        stats.dispatched++;
        break;
      case 'returned':
        stats.returned++;
        break;
      case 'delivered':
        stats.delivered++;
        break;
      case 'cancelled':
        stats.cancelled++;
        break;
    }

    // Carrier without tracking
    if (sale.delivery_type === 'carrier' && !sale.tracking_code && sale.status !== 'cancelled' && sale.status !== 'delivered') {
      stats.carrierNoTracking++;
    }
    
    // Carrier with tracking (for substatus updates)
    if (sale.delivery_type === 'carrier' && sale.tracking_code && sale.status !== 'cancelled' && sale.status !== 'delivered') {
      stats.carrierWithTracking++;
    }

    // Urgent today (drafts that should go out today)
    if (sale.status === 'draft' && deliveryDate && isToday(deliveryDate)) {
      stats.urgentToday++;
    }

    // Tomorrow prep (need to be ready for tomorrow)
    if ((sale.status === 'draft' || sale.status === 'pending_expedition') && deliveryDate && isTomorrow(deliveryDate)) {
      stats.tomorrowPrep++;
    }
  });

  return stats;
}

// Get suggested motoboy based on delivery region
export function getSuggestedMotoboy(
  sale: Sale,
  regions: Array<{
    id: string;
    assigned_users?: Array<{ user_id: string; user?: { first_name: string; last_name: string } }>;
  }>,
  members: Array<{ user_id: string; profile?: { first_name: string; last_name: string } }>
): { user_id: string; name: string } | null {
  if (!sale.delivery_region_id) return null;

  const region = regions.find(r => r.id === sale.delivery_region_id);
  if (!region?.assigned_users?.length) return null;

  const firstAssigned = region.assigned_users[0];
  const member = members.find(m => m.user_id === firstAssigned.user_id);

  if (member) {
    return {
      user_id: firstAssigned.user_id,
      name: `${member.profile?.first_name || ''} ${member.profile?.last_name || ''}`.trim() || 'Motoboy',
    };
  }

  if (firstAssigned.user) {
    return {
      user_id: firstAssigned.user_id,
      name: `${firstAssigned.user.first_name} ${firstAssigned.user.last_name}`.trim(),
    };
  }

  return null;
}
