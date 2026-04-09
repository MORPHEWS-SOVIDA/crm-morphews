import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentTenantId } from '@/hooks/useTenant';
import { Sale } from '@/hooks/useSales';
import { startOfDay, addDays, parseISO, isToday, isTomorrow, startOfMonth, endOfMonth, format } from 'date-fns';

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
  payment_confirmed: number; // Vendas online pagas
  carrierNoTracking: number;
  carrierWithTracking: number;
  pickup: number; // Retirada no Balcão pending
  urgentToday: number;
  tomorrowPrep: number;
}

export function useExpeditionSales(dateFrom?: string, dateTo?: string) {
  const organizationId = useOrganizationId();

  return useQuery({
    queryKey: ['expedition-sales', organizationId, dateFrom, dateTo],
    queryFn: async () => {
      if (!organizationId) return [];

      let query = supabase
        .from('sales')
        .select(`
          *,
          lead:leads(id, name, whatsapp, email, street, street_number, complement, neighborhood, city, state, cep, secondary_phone, delivery_notes, google_maps_link),
          items:sale_items(id, sale_id, product_id, product_name, quantity, unit_price_cents, discount_cents, total_cents, notes, requisition_number, created_at),
          delivery_region:delivery_regions!sales_delivery_region_id_fkey(id, name),
          melhor_envio_labels(id, label_pdf_url, tracking_code, status, melhor_envio_order_id),
          shipping_address:lead_addresses!sales_shipping_address_id_fkey(id, label, street, street_number, complement, neighborhood, city, state, cep, delivery_notes, google_maps_link)
        `)
        .eq('organization_id', organizationId)
        .in('status', ['draft', 'pending_expedition', 'dispatched', 'delivered', 'returned', 'cancelled', 'payment_confirmed', 'closed', 'finalized'])
        .order('scheduled_delivery_date', { ascending: true })
        .order('created_at', { ascending: true });

      // Apply date range filter
      if (dateFrom) {
        query = query.gte('created_at', dateFrom);
      }
      if (dateTo) {
        query = query.lte('created_at', dateTo);
      }

      const { data, error } = await query;

      if (error) throw error;

      let sales = (data || []) as unknown as Sale[];

      // Enrich: fetch primary addresses for sales without shipping_address and without lead.street
      const salesNeedingAddress = sales.filter(
        (s: any) => !s.shipping_address && !s.lead?.street && s.lead_id
      );
      
      if (salesNeedingAddress.length > 0) {
        const leadIds = [...new Set(salesNeedingAddress.map(s => s.lead_id).filter(Boolean) as string[])];
        const { data: addresses } = await supabase
          .from('lead_addresses')
          .select('id, lead_id, label, street, street_number, complement, neighborhood, city, state, cep, delivery_notes, google_maps_link, is_primary')
          .in('lead_id', leadIds)
          .order('is_primary', { ascending: false })
          .order('created_at', { ascending: true });

        if (addresses && addresses.length > 0) {
          // Map: lead_id -> first (primary) address
          const addrMap: Record<string, any> = {};
          for (const addr of addresses) {
            if (!addrMap[addr.lead_id]) {
              addrMap[addr.lead_id] = addr;
            }
          }
          sales = sales.map((s: any) => {
            if (!s.shipping_address && !s.lead?.street && s.lead_id && addrMap[s.lead_id]) {
              return { ...s, shipping_address: addrMap[s.lead_id] };
            }
            return s;
          }) as Sale[];
        }
      }

      // Enrich seller names (sales.seller_user_id -> profiles.user_id)
      const sellerIds = Array.from(
        new Set(sales.map(s => s.seller_user_id).filter(Boolean) as string[])
      );

      if (sellerIds.length === 0) return sales;

      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name')
        .in('user_id', sellerIds);

      if (profilesError) throw profilesError;

      const sellerMap = (profiles || []).reduce((acc, p) => {
        acc[p.user_id] = { first_name: p.first_name, last_name: p.last_name };
        return acc;
      }, {} as Record<string, { first_name: string; last_name: string }>);

      return sales.map(s => ({
        ...s,
        seller_profile: s.seller_user_id ? sellerMap[s.seller_user_id] : undefined,
      })) as Sale[];
    },
    enabled: !!organizationId,
    // Keep UI responsive and avoid flicker on refetch/errors
    staleTime: 10_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    refetchInterval: 120_000, // Refresh a cada 2 minutos
    retry: 1,
    placeholderData: (prev) => prev ?? [],
  });
}

export function getDefaultExpeditionDateRange() {
  const now = new Date();
  const from = addDays(startOfDay(now), -15);
  const to = addDays(startOfDay(now), 15);
  return {
    from: format(from, 'yyyy-MM-dd') + 'T00:00:00',
    to: format(to, 'yyyy-MM-dd') + 'T23:59:59',
  };
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
    payment_confirmed: 0,
    carrierNoTracking: 0,
    carrierWithTracking: 0,
    pickup: 0,
    urgentToday: 0,
    tomorrowPrep: 0,
  };

  sales.forEach(sale => {
    const deliveryDate = sale.scheduled_delivery_date 
      ? parseISO(sale.scheduled_delivery_date) 
      : null;

    // Status counts
    const doneStatuses = ['delivered', 'closed', 'finalized', 'cancelled'];
    
    switch (sale.status) {
      case 'draft':
        // Exclui Retirada (pickup) da contagem de rascunhos - ficam no botão Retirada
        if (sale.delivery_type !== 'pickup') {
          stats.draft++;
        }
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
      case 'closed':
      case 'finalized':
        stats.delivered++;
        break;
      case 'cancelled':
        stats.cancelled++;
        break;
      case 'payment_confirmed':
        // Only count payment_confirmed that haven't been delivered yet
        // Exclui Retirada (pickup) da contagem - ficam no botão Retirada
        if (!(sale as any).delivered_at && sale.delivery_type !== 'pickup') {
          stats.payment_confirmed++;
        }
        break;
    }

    // Carrier without tracking - exclude done statuses
    if (sale.delivery_type === 'carrier' && !sale.tracking_code && !doneStatuses.includes(sale.status)) {
      stats.carrierNoTracking++;
    }
    
    // Carrier with tracking (for substatus updates) - exclude done statuses
    if (sale.delivery_type === 'carrier' && sale.tracking_code && !doneStatuses.includes(sale.status)) {
      stats.carrierWithTracking++;
    }

    // Pickup (Retirada no Balcão) - pending delivery - exclude done statuses
    if (sale.delivery_type === 'pickup' && !doneStatuses.includes(sale.status)) {
      stats.pickup++;
    }

    // Urgent today (drafts that should go out today) - exclude done
    if (sale.status === 'draft' && deliveryDate && isToday(deliveryDate)) {
      stats.urgentToday++;
    }

    // Tomorrow prep (need to be ready for tomorrow) - exclude done
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
