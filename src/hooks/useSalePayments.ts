import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface SalePayment {
  id?: string;
  sale_id: string;
  organization_id: string;
  payment_method_id?: string | null;
  payment_method_name: string;
  amount_cents: number;
  notes?: string | null;
  transaction_date?: string | null;
  card_brand?: string | null;
  transaction_type?: string | null;
  nsu_cv?: string | null;
  acquirer_id?: string | null;
  installments?: number;
  created_by?: string | null;
  updated_by?: string | null;
}

export function useSalePayments(saleId?: string) {
  return useQuery({
    queryKey: ['sale-payments', saleId],
    queryFn: async () => {
      if (!saleId) return [];
      const { data, error } = await supabase
        .from('sale_payments')
        .select('*')
        .eq('sale_id', saleId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as SalePayment[];
    },
    enabled: !!saleId,
  });
}

export function useSaveSalePayments() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      saleId,
      organizationId,
      payments,
    }: {
      saleId: string;
      organizationId: string;
      payments: Omit<SalePayment, 'sale_id' | 'organization_id'>[];
    }) => {
      // Delete existing payments for this sale
      await supabase
        .from('sale_payments')
        .delete()
        .eq('sale_id', saleId);

      if (payments.length === 0) return [];

      const rows = payments.map((p) => ({
        sale_id: saleId,
        organization_id: organizationId,
        payment_method_id: p.payment_method_id || null,
        payment_method_name: p.payment_method_name,
        amount_cents: p.amount_cents,
        notes: p.notes || null,
        transaction_date: p.transaction_date || null,
        card_brand: p.card_brand || null,
        transaction_type: p.transaction_type || null,
        nsu_cv: p.nsu_cv || null,
        acquirer_id: p.acquirer_id || null,
        installments: p.installments || 1,
        created_by: user?.id || null,
        updated_by: user?.id || null,
      }));

      const { data, error } = await supabase
        .from('sale_payments')
        .insert(rows)
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['sale-payments', variables.saleId] });
    },
  });
}
