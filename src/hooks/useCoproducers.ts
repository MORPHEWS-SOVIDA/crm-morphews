import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface Coproducer {
  id: string;
  virtual_account_id: string;
  product_id: string;
  commission_type: string;
  commission_percentage: number;
  commission_fixed_1_cents: number;
  commission_fixed_3_cents: number;
  commission_fixed_5_cents: number;
  is_active: boolean;
  created_at: string;
  virtual_account?: {
    id: string;
    holder_name: string;
    holder_email: string;
    user_id: string | null;
  };
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'message' in error && typeof (error as { message: unknown }).message === 'string') {
    return (error as { message: string }).message;
  }
  return fallback;
}

export function useProductCoproducers(productId: string | undefined) {
  return useQuery({
    queryKey: ['coproducers', productId],
    enabled: !!productId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('coproducers')
        .select('*, virtual_account:virtual_accounts(id, holder_name, holder_email, user_id)')
        .eq('product_id', productId!)
        .eq('is_active', true);

      if (error) throw error;
      return (data || []) as Coproducer[];
    },
  });
}

// Fetch coproducers for multiple products at once (for the product list)
export function useBulkProductCoproducers(productIds: string[]) {
  return useQuery({
    queryKey: ['coproducers-bulk', productIds.sort().join(',')],
    enabled: productIds.length > 0,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('coproducers')
        .select('product_id, commission_type, virtual_account:virtual_accounts(holder_name)')
        .in('product_id', productIds)
        .eq('is_active', true);

      if (error) throw error;

      // Group by product_id
      const map: Record<string, { name: string; type: string }[]> = {};
      for (const row of data || []) {
        const pid = row.product_id;
        if (!map[pid]) map[pid] = [];
        const va = row.virtual_account as { holder_name: string } | null;
        map[pid].push({
          name: va?.holder_name || 'Co-produtor',
          type: row.commission_type || 'percentage',
        });
      }
      return map;
    },
  });
}

export function useUpdateCoproducerCommission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      commission_fixed_1_cents,
      commission_fixed_3_cents,
      commission_fixed_5_cents,
    }: {
      id: string;
      commission_fixed_1_cents: number;
      commission_fixed_3_cents: number;
      commission_fixed_5_cents: number;
    }) => {
      const { error } = await supabase
        .from('coproducers')
        .update({
          commission_fixed_1_cents,
          commission_fixed_3_cents,
          commission_fixed_5_cents,
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coproducers'] });
      queryClient.invalidateQueries({ queryKey: ['coproducers-bulk'] });
      queryClient.invalidateQueries({ queryKey: ['storefront-coproducers'] });
      toast.success('Comissão atualizada!');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Erro ao atualizar comissão.'));
    },
  });
}

// Get all virtual accounts of type coproducer for the org (for adding new coproducers)
export function useCoproducerAccounts() {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['coproducer-accounts', profile?.organization_id],
    enabled: !!profile?.organization_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('virtual_accounts')
        .select('id, holder_name, holder_email, user_id')
        .eq('organization_id', profile!.organization_id!)
        .eq('account_type', 'coproducer')
        .eq('is_active', true)
        .order('holder_name');

      if (error) throw error;
      return data || [];
    },
  });
}

export function useCreateCoproducer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      virtual_account_id,
      product_id,
      commission_type,
      commission_fixed_1_cents,
      commission_fixed_3_cents,
      commission_fixed_5_cents,
    }: {
      virtual_account_id: string;
      product_id: string;
      commission_type: string;
      commission_fixed_1_cents?: number;
      commission_fixed_3_cents?: number;
      commission_fixed_5_cents?: number;
    }) => {
      const { data: existing, error: existingError } = await supabase
        .from('coproducers')
        .select('id, is_active')
        .eq('virtual_account_id', virtual_account_id)
        .eq('product_id', product_id)
        .maybeSingle();

      if (existingError && existingError.code !== 'PGRST116') {
        throw existingError;
      }

      if (existing) {
        if (!existing.is_active) {
          const { error: reactivateError } = await supabase
            .from('coproducers')
            .update({ is_active: true })
            .eq('id', existing.id);

          if (reactivateError) throw reactivateError;
        }
        return;
      }

      const { error } = await supabase
        .from('coproducers')
        .insert({
          virtual_account_id,
          product_id,
          commission_type,
          commission_percentage: 0,
          commission_fixed_1_cents: commission_fixed_1_cents || 0,
          commission_fixed_3_cents: commission_fixed_3_cents || 0,
          commission_fixed_5_cents: commission_fixed_5_cents || 0,
          is_active: true,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coproducers'] });
      queryClient.invalidateQueries({ queryKey: ['coproducers-bulk'] });
      queryClient.invalidateQueries({ queryKey: ['storefront-coproducers'] });
      toast.success('Co-produtor adicionado!');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Erro ao adicionar co-produtor.'));
    },
  });
}

export function useRemoveCoproducer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('coproducers')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coproducers'] });
      queryClient.invalidateQueries({ queryKey: ['coproducers-bulk'] });
      queryClient.invalidateQueries({ queryKey: ['storefront-coproducers'] });
      toast.success('Co-produtor removido.');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Erro ao remover co-produtor.'));
    },
  });
}

