import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface IncomingTransaction {
  id: string;
  organization_id: string;
  source: string;
  source_transaction_id: string | null;
  amount_cents: number;
  transaction_date: string;
  payer_name: string | null;
  payer_document: string | null;
  payer_bank: string | null;
  end_to_end_id: string | null;
  status: string;
  matched_sale_id: string | null;
  matched_at: string | null;
  created_at: string;
}

export interface PaymentSource {
  id: string;
  organization_id: string;
  source: string;
  display_name: string;
  is_active: boolean;
  pix_key: string | null;
}

// Fetch pending transactions for an organization
export function useIncomingTransactions(source?: string) {
  const { profile } = useAuth();
  const organizationId = profile?.organization_id;

  return useQuery({
    queryKey: ['incoming-transactions', organizationId, source],
    queryFn: async () => {
      let query = supabase
        .from('incoming_transactions')
        .select('*')
        .eq('organization_id', organizationId!)
        .eq('status', 'pending')
        .order('transaction_date', { ascending: false });

      if (source) {
        query = query.eq('source', source);
      }

      const { data, error } = await query;
      
      if (error) throw error;
      return data as IncomingTransaction[];
    },
    enabled: !!organizationId,
  });
}

// Fetch transactions matching a specific amount (for payment matching)
export function useMatchingTransactions(amountCents: number | null) {
  const { profile } = useAuth();
  const organizationId = profile?.organization_id;

  return useQuery({
    queryKey: ['matching-transactions', organizationId, amountCents],
    queryFn: async () => {
      if (!amountCents) return [];
      
      // Allow 1% tolerance for matching
      const tolerance = Math.ceil(amountCents * 0.01);
      const minAmount = amountCents - tolerance;
      const maxAmount = amountCents + tolerance;

      const { data, error } = await supabase
        .from('incoming_transactions')
        .select('*')
        .eq('organization_id', organizationId!)
        .eq('status', 'pending')
        .gte('amount_cents', minAmount)
        .lte('amount_cents', maxAmount)
        .order('transaction_date', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      return data as IncomingTransaction[];
    },
    enabled: !!organizationId && !!amountCents && amountCents > 0,
  });
}

// Match a transaction to a sale
export function useMatchTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ transactionId, saleId }: { transactionId: string; saleId: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase.rpc('match_transaction_to_sale', {
        p_transaction_id: transactionId,
        p_sale_id: saleId,
        p_user_id: user?.id || null,
      });
      
      if (error) throw error;
      
      const result = data as { success: boolean; error?: string; message?: string };
      if (!result.success) {
        throw new Error(result.error || 'Erro ao associar transação');
      }
      
      return result;
    },
    onSuccess: () => {
      toast.success('Pagamento associado com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['incoming-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['matching-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['sale'] });
      queryClient.invalidateQueries({ queryKey: ['sales'] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Erro ao associar pagamento');
    },
  });
}

// Fetch payment sources for the organization
export function usePaymentSources() {
  const { profile } = useAuth();
  const organizationId = profile?.organization_id;

  return useQuery({
    queryKey: ['payment-sources', organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payment_sources')
        .select('*')
        .eq('organization_id', organizationId!)
        .eq('is_active', true);
      
      if (error) throw error;
      return data as PaymentSource[];
    },
    enabled: !!organizationId,
  });
}

// Get count of pending transactions by source
export function usePendingTransactionCounts() {
  const { profile } = useAuth();
  const organizationId = profile?.organization_id;

  return useQuery({
    queryKey: ['pending-transaction-counts', organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('incoming_transactions')
        .select('source')
        .eq('organization_id', organizationId!)
        .eq('status', 'pending');
      
      if (error) throw error;
      
      // Count by source
      const counts: Record<string, number> = {};
      for (const tx of data) {
        counts[tx.source] = (counts[tx.source] || 0) + 1;
      }
      
      return counts;
    },
    enabled: !!organizationId,
  });
}

// Format source name for display
export function getSourceDisplayName(source: string): string {
  const names: Record<string, string> = {
    efipay: 'EfiPay PIX',
    pagarme: 'Pagar.me',
    getnet: 'Getnet TEF',
    banrisul: 'Banrisul/Vero',
    vero: 'Vero',
    manual: 'Manual',
  };
  return names[source] || source;
}

// Format currency
export function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}
