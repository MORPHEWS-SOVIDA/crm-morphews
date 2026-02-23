import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface UnmatchedPosTransaction {
  id: string;
  amount_cents: number;
  card_brand: string | null;
  card_last_digits: string | null;
  transaction_type: string;
  nsu: string | null;
  authorization_code: string | null;
  gateway_type: string;
  terminal_name: string | null;
  gateway_timestamp: string | null;
  created_at: string;
}

/**
 * Hook to fetch unmatched POS transactions for the current motoboy
 * These are transactions that haven't been linked to a sale yet
 */
export function useUnmatchedPosTransactions() {
  const { user, profile } = useAuth();
  
  return useQuery({
    queryKey: ['unmatched-pos-transactions', user?.id],
    queryFn: async () => {
      if (!user?.id || !profile?.organization_id) return [];
      
      const { data, error } = await supabase
        .rpc('get_unmatched_pos_transactions_for_user', {
          p_user_id: user.id,
          p_organization_id: profile.organization_id
        });
      
      if (error) {
        console.error('Error fetching unmatched POS transactions:', error);
        return [];
      }
      
      return (data || []) as UnmatchedPosTransaction[];
    },
    enabled: !!user?.id && !!profile?.organization_id,
    refetchInterval: 120000, // Refresh every 2 minutes
  });
}

/**
 * Hook to link a POS transaction to a sale
 */
export function useLinkPosTransactionToSale() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async ({ transactionId, saleId }: { transactionId: string; saleId: string }) => {
      if (!user?.id) throw new Error('User not authenticated');
      
      const { data, error } = await supabase
        .rpc('link_pos_transaction_to_sale', {
          p_transaction_id: transactionId,
          p_sale_id: saleId,
          p_user_id: user.id
        });
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unmatched-pos-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['my-deliveries'] });
      queryClient.invalidateQueries({ queryKey: ['pos-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      toast.success('Pagamento vinculado com sucesso!');
    },
    onError: (error) => {
      console.error('Error linking POS transaction:', error);
      toast.error('Erro ao vincular pagamento');
    }
  });
}

/**
 * Hook to confirm delivery with specific payment type
 */
export function useConfirmDeliveryPayment() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async ({ 
      saleId, 
      paymentType 
    }: { 
      saleId: string; 
      paymentType: 'cash' | 'prepaid' | 'pos_card';
    }) => {
      if (!user?.id) throw new Error('User not authenticated');
      
      const updateData: Record<string, unknown> = {
        delivery_payment_type: paymentType,
        delivery_confirmed_at: new Date().toISOString(),
        delivery_confirmed_by: user.id,
        status: 'delivered',
        delivery_status: 'delivered_normal',
        delivered_at: new Date().toISOString(),
      };
      
      // For cash and prepaid, also update payment status
      if (paymentType === 'cash') {
        updateData.payment_status = 'confirmed';
      } else if (paymentType === 'prepaid') {
        updateData.payment_status = 'confirmed';
      }
      // For pos_card, payment status is updated when linking the transaction
      
      const { error } = await supabase
        .from('sales')
        .update(updateData)
        .eq('id', saleId);
      
      if (error) throw error;

      // Ensure delivered checkpoint is created for "Etapas da Venda" card
      const { ensureDeliveredCheckpoint } = await import('@/utils/ensureDeliveredCheckpoint');
      await ensureDeliveredCheckpoint(saleId, user.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-deliveries'] });
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      toast.success('Entrega confirmada!');
    },
    onError: (error) => {
      console.error('Error confirming delivery:', error);
      toast.error('Erro ao confirmar entrega');
    }
  });
}

/**
 * Format currency helper
 */
export function formatCentsToCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(cents / 100);
}

/**
 * Get card brand icon/label
 */
export function getCardBrandLabel(brand: string | null): string {
  if (!brand) return 'Cartão';
  const labels: Record<string, string> = {
    visa: 'Visa',
    mastercard: 'Mastercard',
    elo: 'Elo',
    amex: 'Amex',
    hipercard: 'Hipercard',
    diners: 'Diners',
  };
  return labels[brand.toLowerCase()] || brand;
}
