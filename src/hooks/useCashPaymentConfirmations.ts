import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface CashPaymentConfirmation {
  id: string;
  organization_id: string;
  sale_id: string;
  confirmed_by: string;
  confirmation_type: 'receipt' | 'handover' | 'final_verification';
  notes: string | null;
  amount_cents: number | null;
  created_at: string;
  // Joined data
  confirmer?: {
    first_name: string;
    last_name: string;
  };
}

export interface CashSaleWithConfirmations {
  id: string;
  romaneio_number: number | null;
  total_cents: number;
  delivered_at: string | null;
  scheduled_delivery_date: string | null;
  delivery_payment_type: string | null;
  delivery_type: string | null; // motoboy, pickup, carrier
  payment_status: string | null;
  status: string;
  delivery_confirmed_by: string | null;
  delivery_confirmed_at: string | null;
  lead?: {
    name: string;
    whatsapp: string | null;
  };
  motoboy_profile?: {
    first_name: string;
    last_name: string;
  };
  confirmations: CashPaymentConfirmation[];
  // Who delivered/received the money initially
  delivery_confirmer?: {
    first_name: string;
    last_name: string;
  };
}

/**
 * Hook to fetch all cash payment sales pending verification
 */
export function useCashPaymentSales(filters?: {
  confirmedBy?: string;
  pendingOnly?: boolean;
}) {
  const { tenantId } = useTenant();

  return useQuery({
    queryKey: ['cash-payment-sales', tenantId, filters],
    queryFn: async (): Promise<CashSaleWithConfirmations[]> => {
      if (!tenantId) return [];

      // Fetch sales paid in cash that are delivered
      const query = supabase
        .from('sales')
        .select(`
          id,
          romaneio_number,
          total_cents,
          delivered_at,
          scheduled_delivery_date,
          delivery_payment_type,
          delivery_type,
          payment_status,
          status,
          delivery_confirmed_by,
          delivery_confirmed_at,
          assigned_delivery_user_id,
          lead:leads!sales_lead_id_fkey(name, whatsapp)
        `)
        .eq('organization_id', tenantId)
        .eq('delivery_payment_type', 'cash')
        .in('status', ['delivered', 'dispatched'])
        .order('delivered_at', { ascending: false, nullsFirst: false });

      const { data: sales, error: salesError } = await query;

      if (salesError) throw salesError;
      if (!sales || sales.length === 0) return [];

      // Fetch confirmations for these sales
      const saleIds = sales.map(s => s.id);
      const { data: confirmations, error: confError } = await supabase
        .from('cash_payment_confirmations')
        .select(`
          id,
          organization_id,
          sale_id,
          confirmed_by,
          confirmation_type,
          notes,
          amount_cents,
          created_at
        `)
        .in('sale_id', saleIds)
        .order('created_at', { ascending: true });

      if (confError) throw confError;

      // Fetch profile info for confirmers and motoboys
      const userIds = new Set<string>();
      (confirmations || []).forEach(c => userIds.add(c.confirmed_by));
      sales.forEach(s => {
        if (s.delivery_confirmed_by) userIds.add(s.delivery_confirmed_by);
        if (s.assigned_delivery_user_id) userIds.add(s.assigned_delivery_user_id);
      });

      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name')
        .in('user_id', Array.from(userIds));

      const profileMap = (profiles || []).reduce((acc, p) => {
        acc[p.user_id] = { first_name: p.first_name, last_name: p.last_name };
        return acc;
      }, {} as Record<string, { first_name: string; last_name: string }>);

      // Build result with confirmations
      const result: CashSaleWithConfirmations[] = sales.map((sale) => {
        const saleConfirmations = (confirmations || [])
          .filter(c => c.sale_id === sale.id)
          .map(c => ({
            ...c,
            confirmation_type: c.confirmation_type as 'receipt' | 'handover' | 'final_verification',
            confirmer: profileMap[c.confirmed_by],
          }));

        return {
          id: sale.id,
          romaneio_number: sale.romaneio_number,
          total_cents: sale.total_cents,
          delivered_at: sale.delivered_at,
          scheduled_delivery_date: sale.scheduled_delivery_date,
          delivery_payment_type: sale.delivery_payment_type,
          delivery_type: sale.delivery_type,
          payment_status: sale.payment_status,
          status: sale.status,
          delivery_confirmed_by: sale.delivery_confirmed_by,
          delivery_confirmed_at: sale.delivery_confirmed_at,
          lead: sale.lead,
          motoboy_profile: sale.assigned_delivery_user_id ? profileMap[sale.assigned_delivery_user_id] : undefined,
          delivery_confirmer: sale.delivery_confirmed_by ? profileMap[sale.delivery_confirmed_by] : undefined,
          confirmations: saleConfirmations,
        };
      });

      // Apply filters
      let filtered = result;

      if (filters?.confirmedBy) {
        // Filter to show sales where this user made a confirmation
        filtered = filtered.filter(s => 
          s.confirmations.some(c => c.confirmed_by === filters.confirmedBy)
        );
      }

      if (filters?.pendingOnly) {
        // Only show sales that don't have a final_verification yet
        filtered = filtered.filter(s => 
          !s.confirmations.some(c => c.confirmation_type === 'final_verification')
        );
      }

      return filtered;
    },
    enabled: !!tenantId,
    refetchInterval: 30000,
  });
}

/**
 * Hook to confirm cash payment receipt
 */
export function useConfirmCashPayment() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { tenantId } = useTenant();

  return useMutation({
    mutationFn: async ({
      saleId,
      confirmationType,
      notes,
      amountCents,
    }: {
      saleId: string;
      confirmationType: 'receipt' | 'handover' | 'final_verification';
      notes?: string;
      amountCents?: number;
    }) => {
      if (!user?.id || !tenantId) throw new Error('Not authenticated');

      // Insert the cash confirmation
      const { error } = await supabase
        .from('cash_payment_confirmations')
        .insert({
          organization_id: tenantId,
          sale_id: saleId,
          confirmed_by: user.id,
          confirmation_type: confirmationType,
          notes: notes || null,
          amount_cents: amountCents || null,
        });

      if (error) throw error;

      // Add to sale changes log for audit trail
      const changeTypeLabel = confirmationTypeLabels[confirmationType] || confirmationType;
      await supabase
        .from('sale_changes_log')
        .insert({
          sale_id: saleId,
          organization_id: tenantId,
          changed_by: user.id,
          change_type: 'payment_changed',
          field_name: 'cash_confirmation',
          old_value: null,
          new_value: changeTypeLabel,
          notes: notes || `Confirmação de dinheiro: ${changeTypeLabel}`,
        });

      return { saleId, confirmationType };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['cash-payment-sales'] });
      queryClient.invalidateQueries({ queryKey: ['sale-changes-log', variables.saleId] });
      toast.success('Confirmação registrada com sucesso!');
    },
    onError: (error) => {
      console.error('Error confirming cash payment:', error);
      toast.error('Erro ao registrar confirmação');
    },
  });
}

/**
 * Labels for confirmation types
 */
export const confirmationTypeLabels: Record<string, string> = {
  receipt: 'Recebimento',
  handover: 'Repasse',
  final_verification: 'Verificação Final',
};

/**
 * Format currency helper
 */
export function formatCents(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}
