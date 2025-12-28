import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface NonPurchaseReason {
  id: string;
  organization_id: string;
  name: string;
  target_stage_id: string | null;
  followup_hours: number;
  webhook_url: string | null;
  followup_webhook_url: string | null;
  lead_visibility: 'assigned_only' | 'all_sellers';
  is_active: boolean;
  position: number;
  created_at: string;
  updated_at: string;
}

export function useNonPurchaseReasons() {
  return useQuery({
    queryKey: ['non-purchase-reasons'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('non_purchase_reasons')
        .select('*')
        .eq('is_active', true)
        .order('position', { ascending: true });

      if (error) throw error;
      return data as NonPurchaseReason[];
    },
  });
}

export function useAllNonPurchaseReasons() {
  return useQuery({
    queryKey: ['non-purchase-reasons-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('non_purchase_reasons')
        .select('*')
        .order('position', { ascending: true });

      if (error) throw error;
      return data as NonPurchaseReason[];
    },
  });
}

export function useCreateNonPurchaseReason() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (reason: Omit<NonPurchaseReason, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('non_purchase_reasons')
        .insert(reason)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['non-purchase-reasons'] });
      queryClient.invalidateQueries({ queryKey: ['non-purchase-reasons-all'] });
      toast({ title: 'Motivo criado com sucesso!' });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao criar motivo',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useUpdateNonPurchaseReason() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<NonPurchaseReason> }) => {
      const { data, error } = await supabase
        .from('non_purchase_reasons')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['non-purchase-reasons'] });
      queryClient.invalidateQueries({ queryKey: ['non-purchase-reasons-all'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao atualizar motivo',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useDeleteNonPurchaseReason() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // Soft delete - just set is_active to false
      const { error } = await supabase
        .from('non_purchase_reasons')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['non-purchase-reasons'] });
      queryClient.invalidateQueries({ queryKey: ['non-purchase-reasons-all'] });
      toast({ title: 'Motivo removido!' });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao remover motivo',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useReorderNonPurchaseReasons() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (reasons: { id: string; position: number }[]) => {
      const updates = reasons.map(({ id, position }) =>
        supabase
          .from('non_purchase_reasons')
          .update({ position })
          .eq('id', id)
      );

      const results = await Promise.all(updates);
      const errors = results.filter(r => r.error);
      if (errors.length > 0) throw errors[0].error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['non-purchase-reasons'] });
      queryClient.invalidateQueries({ queryKey: ['non-purchase-reasons-all'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao reordenar motivos',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
