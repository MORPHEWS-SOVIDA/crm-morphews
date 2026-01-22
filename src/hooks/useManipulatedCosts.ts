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
  // From sales join
  sale_created_at: string;
  sale_status: string;
  client_name: string;
  seller_name: string;
}

export function useManipulatedSaleItems(filters?: {
  hasCost: 'all' | 'with_cost' | 'without_cost';
  startDate?: Date;
  endDate?: Date;
}) {
  const { tenantId } = useTenant();

  return useQuery({
    queryKey: ['manipulated-sale-items', tenantId, filters],
    queryFn: async () => {
      if (!tenantId) return [];

      // Build query with organization filter through the sales relation
      let query = supabase
        .from('sale_items')
        .select(`
          id,
          sale_id,
          product_id,
          product_name,
          quantity,
          unit_price_cents,
          total_cents,
          requisition_number,
          cost_cents,
          created_at,
          sales!inner (
            id,
            created_at,
            status,
            organization_id,
            leads (
              name
            ),
            profiles:seller_id (
              first_name,
              last_name
            )
          )
        `)
        .not('requisition_number', 'is', null)
        .eq('sales.organization_id', tenantId)
        .order('created_at', { ascending: false });

      // Apply cost filter at database level
      if (filters?.hasCost === 'with_cost') {
        query = query.not('cost_cents', 'is', null);
      } else if (filters?.hasCost === 'without_cost') {
        query = query.is('cost_cents', null);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching manipulated items:', error);
        throw error;
      }

      // Transform data
      let items = (data || []).map((item: any) => ({
        id: item.id,
        sale_id: item.sale_id,
        product_id: item.product_id,
        product_name: item.product_name,
        quantity: item.quantity,
        unit_price_cents: item.unit_price_cents,
        total_cents: item.total_cents,
        requisition_number: item.requisition_number,
        cost_cents: item.cost_cents,
        created_at: item.created_at,
        sale_created_at: item.sales?.created_at,
        sale_status: item.sales?.status,
        client_name: item.sales?.leads?.name || 'Cliente não identificado',
        seller_name: item.sales?.profiles 
          ? `${item.sales.profiles.first_name} ${item.sales.profiles.last_name}`
          : 'Vendedor não identificado',
      })) as ManipulatedSaleItem[];

      // Apply date filter client-side
      if (filters?.startDate) {
        const startDate = new Date(filters.startDate);
        startDate.setHours(0, 0, 0, 0);
        items = items.filter(item => new Date(item.sale_created_at) >= startDate);
      }
      if (filters?.endDate) {
        const endDate = new Date(filters.endDate);
        endDate.setHours(23, 59, 59, 999);
        items = items.filter(item => new Date(item.sale_created_at) <= endDate);
      }

      return items;
    },
    enabled: !!tenantId,
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
