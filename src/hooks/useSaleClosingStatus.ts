import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentTenantId } from '@/hooks/useTenant';

// User IDs for the confirmation checks (from auth.users table)
const AUXILIAR_USER_ID = '4f6657bf-7429-4b08-81d2-12aa48167957'; // auxiliar.sovida@gmail.com
const THIAGO_USER_ID = '6fee8f43-5efb-4752-a2ce-a70c8e9e3cd2'; // thiago@sonatura.com.br

export interface SaleClosingStatus {
  saleId: string;
  wasClosed: boolean;
  closingType: 'pickup' | 'motoboy' | 'carrier' | null;
  confirmedByAuxiliar: boolean;
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
          confirmedByAuxiliar: false,
          confirmedByThiago: false,
          closingId: null,
        };
      });

      // Update with actual closing data
      (closingSales || []).forEach(cs => {
        const closing = cs.closing as any;
        if (!closing) return;

        statusMap[cs.sale_id] = {
          saleId: cs.sale_id,
          wasClosed: true,
          closingType: closing.type || null,
          confirmedByAuxiliar: closing.confirmed_by_auxiliar === AUXILIAR_USER_ID,
          confirmedByThiago: closing.confirmed_by_admin === THIAGO_USER_ID,
          closingId: cs.closing_id,
        };
      });

      return statusMap;
    },
    enabled: !!tenantId && saleIds.length > 0,
    staleTime: 30000, // Cache for 30 seconds
  });
}
