import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentTenantId } from '@/hooks/useTenant';

// Thiago's User ID for final confirmation check
const THIAGO_USER_ID = '6fee8f43-5efb-4752-a2ce-a70c8e9e3cd2'; // thiago@sonatura.com.br

export interface SaleClosingStatus {
  saleId: string;
  wasClosed: boolean;
  closingType: 'pickup' | 'motoboy' | 'carrier' | null;
  confirmedByFinanceiro: boolean; // Changed from confirmedByAuxiliar
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

      // Get all pickup_closing_sales for the given sale IDs
      const { data: closingSales, error: closingSalesError } = await supabase
        .from('pickup_closing_sales')
        .select(`
          sale_id,
          closing_id,
          closing:pickup_closings(
            id,
            type,
            status,
            confirmed_by_auxiliar,
            confirmed_by_admin
          )
        `)
        .in('sale_id', saleIds);

      if (closingSalesError) {
        console.error('Error fetching closing sales:', closingSalesError);
        throw closingSalesError;
      }

      // Build the status map
      const statusMap: Record<string, SaleClosingStatus> = {};

      // Initialize all sales as not closed
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

      // Update with actual closing data
      (closingSales || []).forEach(cs => {
        const closing = cs.closing as any;
        if (!closing) return;

        // If confirmed_by_auxiliar is set, it was confirmed by financeiro (any user with reports_view permission)
        const confirmedByFinanceiro = !!closing.confirmed_by_auxiliar;
        // Admin confirmation is still Thiago-specific
        const confirmedByThiago = closing.confirmed_by_admin === THIAGO_USER_ID;

        statusMap[cs.sale_id] = {
          saleId: cs.sale_id,
          wasClosed: true,
          closingType: closing.type || null,
          confirmedByFinanceiro,
          confirmedByThiago,
          closingId: cs.closing_id,
        };
      });

      return statusMap;
    },
    enabled: !!tenantId && saleIds.length > 0,
    staleTime: 30000, // Cache for 30 seconds
  });
}
