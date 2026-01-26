import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';
import { startOfMonth, endOfMonth, format } from 'date-fns';

export interface SellerSaleItem {
  id: string;
  romaneio_number: number | null;
  lead_id: string;
  lead_name: string;
  lead_whatsapp: string;
  products: string;
  total_cents: number;
  status: string;
  payment_status: string | null;
  delivery_type: string | null;
  motoboy_tracking_status: string | null;
  carrier_tracking_status: string | null;
  melhor_envio_tracking_status: string | null;
  created_at: string;
  delivered_at: string | null;
}

interface UseSellerSalesListOptions {
  month: Date;
  statusFilter?: string;
}

// Custom sorting: returned (danger) > dispatched > pending_expedition > payment_confirmed > draft > delivered > paid
const statusPriority: Record<string, number> = {
  returned: 1,
  dispatched: 2,
  pending_expedition: 3,
  payment_confirmed: 4,
  draft: 5,
  delivered: 6,
  cancelled: 99,
};

function getStatusPriority(sale: SellerSaleItem): number {
  // For delivered sales, if paid put at end (priority 7), otherwise 6
  if (sale.status === 'delivered') {
    const isPaid = sale.payment_status === 'paid_now' || sale.payment_status === 'paid_in_delivery';
    return isPaid ? 7 : 6;
  }
  return statusPriority[sale.status] ?? 50;
}

export function useSellerSalesList(options: UseSellerSalesListOptions) {
  const { month, statusFilter } = options;
  const { user } = useAuth();
  const { tenantId } = useTenant();
  
  const monthKey = format(month, 'yyyy-MM');
  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  
  return useQuery({
    queryKey: ['seller-sales-list', tenantId, user?.id, monthKey, statusFilter],
    queryFn: async (): Promise<SellerSaleItem[]> => {
      if (!tenantId || !user?.id) {
        throw new Error('Missing tenant or user');
      }

      // Build query
      let query = supabase
        .from('sales')
        .select(`
          id,
          romaneio_number,
          lead_id,
          total_cents,
          status,
          payment_status,
          delivery_type,
          motoboy_tracking_status,
          carrier_tracking_status,
          created_at,
          delivered_at,
          lead:leads!sales_lead_id_fkey(name, whatsapp),
          sale_items(product_name, quantity),
          melhor_envio_labels(tracking_status)
        `)
        .eq('organization_id', tenantId)
        .eq('seller_user_id', user.id)
        .gte('created_at', monthStart.toISOString())
        .lte('created_at', monthEnd.toISOString())
        .order('created_at', { ascending: false });

      // Apply status filter if not "all"
      if (statusFilter && statusFilter !== 'all') {
        if (statusFilter === 'paid') {
          // Special filter: delivered + paid
          query = query
            .eq('status', 'delivered' as any)
            .in('payment_status', ['paid_now', 'paid_in_delivery']);
        } else if (statusFilter === 'separated') {
          // Separated = pending_expedition or payment_confirmed
          query = query.in('status', ['pending_expedition', 'payment_confirmed'] as any);
        } else {
          query = query.eq('status', statusFilter as any);
        }
      }

      const { data, error } = await query;

      if (error) throw error;

      // Map results
      const sales: SellerSaleItem[] = (data || []).map((s: any) => {
        // Concatenate products: "2x Produto A, 1x Produto B"
        const products = (s.sale_items || [])
          .map((item: any) => `${item.quantity}x ${item.product_name}`)
          .join(', ');

        // Get Melhor Envio tracking status if available
        const melhorEnvioLabel = s.melhor_envio_labels?.[0];
        const melhorEnvioTrackingStatus = melhorEnvioLabel?.tracking_status || null;

        return {
          id: s.id,
          romaneio_number: s.romaneio_number,
          lead_id: s.lead_id,
          lead_name: s.lead?.name || 'Lead',
          lead_whatsapp: s.lead?.whatsapp || '',
          products: products || '-',
          total_cents: s.total_cents || 0,
          status: s.status,
          payment_status: s.payment_status,
          delivery_type: s.delivery_type,
          motoboy_tracking_status: s.motoboy_tracking_status,
          carrier_tracking_status: s.carrier_tracking_status,
          melhor_envio_tracking_status: melhorEnvioTrackingStatus,
          created_at: s.created_at,
          delivered_at: s.delivered_at,
        };
      });

      // Sort by custom priority
      sales.sort((a, b) => {
        const priorityA = getStatusPriority(a);
        const priorityB = getStatusPriority(b);
        if (priorityA !== priorityB) return priorityA - priorityB;
        // Within same priority, sort by created_at desc
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      return sales;
    },
    enabled: !!tenantId && !!user?.id,
    staleTime: 1000 * 60 * 2,
  });
}

// Status labels for display
export const sellerSaleStatusLabels: Record<string, string> = {
  draft: 'Rascunho',
  pending_expedition: 'Impresso',
  payment_confirmed: 'Separado',
  dispatched: 'Despachado',
  delivered: 'Entregue',
  returned: 'Voltou',
  cancelled: 'Cancelado',
};

// Status colors for badges
export function getSellerSaleStatusColor(status: string, paymentStatus?: string | null): string {
  if (status === 'returned') return 'bg-red-500 text-white';
  if (status === 'dispatched') return 'bg-blue-500 text-white';
  if (status === 'pending_expedition') return 'bg-amber-500 text-white';
  if (status === 'payment_confirmed') return 'bg-orange-500 text-white';
  if (status === 'draft') return 'bg-gray-500 text-white';
  if (status === 'delivered') {
    const isPaid = paymentStatus === 'paid_now' || paymentStatus === 'paid_in_delivery';
    return isPaid ? 'bg-green-600 text-white' : 'bg-green-500 text-white';
  }
  if (status === 'cancelled') return 'bg-gray-400 text-white';
  return 'bg-gray-500 text-white';
}
