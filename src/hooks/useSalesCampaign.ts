import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentTenantId } from '@/hooks/useTenant';
import { startOfDay, endOfDay, parseISO, isWithinInterval } from 'date-fns';

export interface CampaignSeller {
  userId: string;
  name: string;
  avatarUrl: string | null;
  // Metrics
  deliveredValueCents: number;
  totalFrascos: number;
  aggregatedSalesCount: number; // sales with more than 1 distinct product
  deliveredCount: number;
}

function getCurrentFortnight(): { from: Date; to: Date } {
  const now = new Date();
  const day = now.getDate();
  const year = now.getFullYear();
  const month = now.getMonth();

  if (day <= 15) {
    return {
      from: new Date(year, month, 1),
      to: new Date(year, month, 15, 23, 59, 59, 999),
    };
  } else {
    const lastDay = new Date(year, month + 1, 0).getDate();
    return {
      from: new Date(year, month, 16),
      to: new Date(year, month, lastDay, 23, 59, 59, 999),
    };
  }
}

export function getFortnightRange() {
  return getCurrentFortnight();
}

export function useSalesCampaign() {
  const tenantId = useCurrentTenantId();
  const fortnight = getCurrentFortnight();

  return useQuery({
    queryKey: ['sales-campaign', tenantId, fortnight.from.toISOString(), fortnight.to.toISOString()],
    queryFn: async () => {
      if (!tenantId) throw new Error('No tenant');

      // Fetch delivered sales in the fortnight period with items
      const { data: sales, error } = await supabase
        .from('sales')
        .select(`
          id,
          seller_user_id,
          created_by,
          total_cents,
          delivered_at,
          status,
          sale_items(quantity, product_id)
        `)
        .eq('organization_id', tenantId)
        .not('delivered_at', 'is', null)
        .gte('delivered_at', fortnight.from.toISOString())
        .lte('delivered_at', fortnight.to.toISOString());

      if (error) throw error;

      // Fetch profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, avatar_url')
        .eq('organization_id', tenantId);

      if (!profiles) return [];

      const profileMap = new Map(profiles.map(p => [p.user_id, p]));

      // Aggregate by seller
      const sellerMap = new Map<string, CampaignSeller>();

      profiles.forEach(p => {
        sellerMap.set(p.user_id, {
          userId: p.user_id,
          name: `${p.first_name} ${p.last_name}`,
          avatarUrl: p.avatar_url,
          deliveredValueCents: 0,
          totalFrascos: 0,
          aggregatedSalesCount: 0,
          deliveredCount: 0,
        });
      });

      (sales || []).forEach((sale: any) => {
        const sellerId = sale.seller_user_id || sale.created_by;
        if (!sellerId || !sellerMap.has(sellerId)) return;

        const current = sellerMap.get(sellerId)!;
        const items = sale.sale_items || [];

        // Sum quantity (frascos)
        const totalQty = items.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0);

        // Count distinct products - if > 1, it's an aggregated sale
        const distinctProducts = new Set(items.map((item: any) => item.product_id)).size;
        const isAggregated = distinctProducts > 1 || items.length > 1;

        sellerMap.set(sellerId, {
          ...current,
          deliveredValueCents: current.deliveredValueCents + (sale.total_cents || 0),
          totalFrascos: current.totalFrascos + totalQty,
          aggregatedSalesCount: current.aggregatedSalesCount + (isAggregated ? 1 : 0),
          deliveredCount: current.deliveredCount + 1,
        });
      });

      return Array.from(sellerMap.values()).filter(s => s.deliveredCount > 0);
    },
    enabled: !!tenantId,
  });
}
