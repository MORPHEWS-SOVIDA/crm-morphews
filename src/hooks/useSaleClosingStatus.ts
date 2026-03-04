import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentTenantId } from '@/hooks/useTenant';

// Thiago's User ID for final confirmation check
const THIAGO_USER_ID = '6fee8f43-5efb-4752-a2ce-a70c8e9e3cd2'; // thiago@sonatura.com.br

export interface SaleClosingStatus {
  saleId: string;
  wasClosed: boolean;
  closingType: 'pickup' | 'motoboy' | 'carrier' | null;
  confirmedByFinanceiro: boolean;
  confirmedByThiago: boolean;
  closingId: string | null;
}

export function useSaleClosingStatus(saleIds: string[]) {
  const { data: tenantId } = useCurrentTenantId();

  return useQuery({
    queryKey: ['sale-closing-status', tenantId, saleIds.join(',')],
    queryFn: async (): Promise<Record<string, SaleClosingStatus>> => {
      if (!tenantId || saleIds.length === 0) {
        return {};
      }

      // Query sales directly for closed_at/finalized_at/finalized_by - this is the source of truth
      // set by ALL closing flows (balcão, motoboy, transportadora)
      const { data: salesData, error: salesError } = await supabase
        .from('sales')
        .select('id, closed_at, closed_by, finalized_at, finalized_by, delivery_type')
        .in('id', saleIds)
        .eq('organization_id', tenantId);

      if (salesError) {
        console.error('Error fetching sales closing data:', salesError);
        throw salesError;
      }

      // Also get closing type info from pickup_closing_sales for backward compat
      const { data: closingSales } = await supabase
        .from('pickup_closing_sales')
        .select(`
          sale_id,
          closing_id,
          closing:pickup_closings(id, type)
        `)
        .in('sale_id', saleIds);

      // Build closing type map
      const closingInfoMap: Record<string, { closingType: string | null; closingId: string | null }> = {};
      (closingSales || []).forEach(cs => {
        const closing = cs.closing as any;
        closingInfoMap[cs.sale_id] = {
          closingType: closing?.type || null,
          closingId: cs.closing_id,
        };
      });

      // Build the status map using sale's own fields as source of truth
      const statusMap: Record<string, SaleClosingStatus> = {};

      saleIds.forEach(saleId => {
        statusMap[saleId] = {
          saleId,
          wasClosed: false,
          closingType: null,
          confirmedByFinanceiro: false,
          confirmedByThiago: false,
          closingId: null,
        };
      });

      (salesData || []).forEach(sale => {
        const closingInfo = closingInfoMap[sale.id];
        const wasClosed = !!sale.closed_at || !!sale.finalized_at;
        const confirmedByFinanceiro = !!sale.closed_at;
        const confirmedByThiago = sale.finalized_by === THIAGO_USER_ID;

        // Derive closing type from closing table or from sale's delivery_type
        let closingType: 'pickup' | 'motoboy' | 'carrier' | null = null;
        if (closingInfo?.closingType) {
          closingType = closingInfo.closingType as any;
        } else if (wasClosed && sale.delivery_type) {
          closingType = sale.delivery_type as any;
        }

        statusMap[sale.id] = {
          saleId: sale.id,
          wasClosed,
          closingType,
          confirmedByFinanceiro,
          confirmedByThiago,
          closingId: closingInfo?.closingId || null,
        };
      });

      return statusMap;
    },
    enabled: !!tenantId && saleIds.length > 0,
    staleTime: 30000,
  });
}
