import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface FunnelStageCustom {
  id: string;
  organization_id: string;
  name: string;
  position: number;
  color: string;
  text_color: string;
  stage_type: 'funnel' | 'cloud' | 'trash';
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export function useFunnelStages() {
  return useQuery({
    queryKey: ['funnel-stages'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organization_funnel_stages')
        .select('*')
        .order('position', { ascending: true });

      if (error) throw error;
      return data as FunnelStageCustom[];
    },
  });
}

export function useUpdateFunnelStage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<FunnelStageCustom> }) => {
      const { data, error } = await supabase
        .from('organization_funnel_stages')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['funnel-stages'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao atualizar etapa',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useCreateFunnelStage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (stage: Omit<FunnelStageCustom, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('organization_funnel_stages')
        .insert(stage)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['funnel-stages'] });
      toast({ title: 'Etapa criada com sucesso!' });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao criar etapa',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useDeleteFunnelStage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('organization_funnel_stages')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['funnel-stages'] });
      toast({ title: 'Etapa removida!' });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao remover etapa',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useReorderFunnelStages() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (stages: { id: string; position: number }[]) => {
      // Update positions in parallel
      const updates = stages.map(({ id, position }) =>
        supabase
          .from('organization_funnel_stages')
          .update({ position })
          .eq('id', id)
      );

      const results = await Promise.all(updates);
      const errors = results.filter(r => r.error);
      if (errors.length > 0) throw errors[0].error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['funnel-stages'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao reordenar etapas',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
