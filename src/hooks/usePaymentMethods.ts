import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type PaymentTiming = 'cash' | 'term' | 'installments';

export interface PaymentMethod {
  id: string;
  organization_id: string;
  name: string;
  payment_timing: PaymentTiming;
  max_installments: number;
  min_installment_value_cents: number;
  destination_bank: string | null;
  destination_cnpj: string | null;
  fee_percentage: number;
  settlement_days: number;
  requires_proof: boolean;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreatePaymentMethodInput {
  name: string;
  payment_timing: PaymentTiming;
  max_installments?: number;
  min_installment_value_cents?: number;
  destination_bank?: string | null;
  destination_cnpj?: string | null;
  fee_percentage?: number;
  settlement_days?: number;
  requires_proof?: boolean;
}

export interface UpdatePaymentMethodInput extends Partial<CreatePaymentMethodInput> {
  is_active?: boolean;
  display_order?: number;
}

export function usePaymentMethods() {
  return useQuery({
    queryKey: ['payment-methods'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payment_methods')
        .select('*')
        .order('display_order', { ascending: true })
        .order('name', { ascending: true });

      if (error) throw error;
      return data as PaymentMethod[];
    },
  });
}

export function useActivePaymentMethods() {
  return useQuery({
    queryKey: ['payment-methods', 'active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payment_methods')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true })
        .order('name', { ascending: true });

      if (error) throw error;
      return data as PaymentMethod[];
    },
  });
}

export function useCreatePaymentMethod() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreatePaymentMethodInput) => {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Usuário não autenticado');
      }

      // Get organization_id from user's profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('user_id', user.id)
        .single();

      if (!profile?.organization_id) {
        throw new Error('Organização não encontrada');
      }

      const { data, error } = await supabase
        .from('payment_methods')
        .insert({
          ...input,
          organization_id: profile.organization_id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-methods'] });
      toast.success('Forma de pagamento criada com sucesso');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao criar forma de pagamento: ${error.message}`);
    },
  });
}

export function useUpdatePaymentMethod() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: UpdatePaymentMethodInput & { id: string }) => {
      const { data, error } = await supabase
        .from('payment_methods')
        .update(input)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-methods'] });
      toast.success('Forma de pagamento atualizada');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar: ${error.message}`);
    },
  });
}

export function useDeletePaymentMethod() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('payment_methods')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-methods'] });
      toast.success('Forma de pagamento removida');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao remover: ${error.message}`);
    },
  });
}

export const PAYMENT_TIMING_LABELS: Record<PaymentTiming, string> = {
  cash: 'À Vista',
  term: 'A Prazo',
  installments: 'Parcelado',
};
