import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from './useTenant';

export interface ManipulatedSaleItem {
  id: string;
  sale_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price_cents: number;
  total_cents: number;
  requisition_number: string;
  cost_cents: number | null;
  created_at: string;
  // From view join
  sale_created_at: string;
  sale_status: string;
  client_name: string;
  seller_name: string;
}

export function useManipulatedSaleItems(filters?: {
  hasCost: 'all' | 'with_cost' | 'without_cost';
  startDate?: Date;
  endDate?: Date;
}, enabled = false) {
  const { tenantId } = useTenant();

  return useQuery({
    queryKey: ['manipulated-sale-items', tenantId, filters],
    queryFn: async () => {
      if (!tenantId) return [];

      // Use the view which already handles all joins
      let query = (supabase as any)
        .from('manipulated_sale_items_view')
        .select('*')
        .eq('organization_id', tenantId)
        .order('created_at', { ascending: false });

      // Apply cost filter at database level
      if (filters?.hasCost === 'with_cost') {
        query = query.not('cost_cents', 'is', null);
      } else if (filters?.hasCost === 'without_cost') {
        query = query.is('cost_cents', null);
      }

      // Apply date filters at database level
      if (filters?.startDate) {
        const startDateStr = filters.startDate.toISOString().split('T')[0];
        query = query.gte('sale_created_at', startDateStr);
      }
      if (filters?.endDate) {
        const endDate = new Date(filters.endDate);
        endDate.setDate(endDate.getDate() + 1);
        const endDateStr = endDate.toISOString().split('T')[0];
        query = query.lt('sale_created_at', endDateStr);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching manipulated items:', error);
        throw error;
      }

      return (data || []) as ManipulatedSaleItem[];
    },
    enabled: !!tenantId && enabled,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}

export function useUpdateItemCost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ itemId, costCents }: { itemId: string; costCents: number | null }) => {
      // Use rpc to update cost_cents (type cast to bypass TS restriction)
      const { error } = await (supabase.rpc as any)('update_sale_item_cost', {
        p_item_id: itemId,
        p_cost_cents: costCents
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manipulated-sale-items'] });
      queryClient.invalidateQueries({ queryKey: ['manipulated-costs-summary'] });
    },
  });
}

// Summary stats for the dashboard
export function useManipulatedCostsSummary() {
  const { tenantId } = useTenant();

  return useQuery({
    queryKey: ['manipulated-costs-summary', tenantId],
    queryFn: async () => {
      if (!tenantId) return null;

      // Type cast to bypass TS restriction until types regenerate
      const { data, error } = await (supabase.rpc as any)('get_manipulated_costs_summary', {
        p_organization_id: tenantId
      });

      if (error) {
        console.error('Error fetching summary:', error);
        throw error;
      }

      const result = data as any;
      return {
        totalItems: result?.total_items || 0,
        itemsWithCost: result?.items_with_cost || 0,
        itemsWithoutCost: result?.items_without_cost || 0,
        totalRevenue: result?.total_revenue || 0,
        totalCost: result?.total_cost || 0,
        margin: result?.margin || 0,
        marginPercent: result?.margin_percent || 0,
      };
    },
    enabled: !!tenantId,
  });
}
