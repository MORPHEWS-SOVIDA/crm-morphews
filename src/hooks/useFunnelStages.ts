import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import type { FunnelStage } from '@/types/lead';

export interface FunnelStageCustom {
  id: string;
  organization_id: string;
  name: string;
  position: number;
  color: string;
  text_color: string;
  stage_type: 'funnel' | 'cloud' | 'trash';
  is_default: boolean;
  enum_value: FunnelStage | null; // NEW: maps to lead.stage
  requires_contact: boolean; // Leads in this stage appear in "Clientes sem contato"
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

/**
 * Returns the enum_value for a custom funnel stage.
 * Uses the database enum_value if available, otherwise falls back to position-based mapping.
 */
export function getStageEnumValue(stage: FunnelStageCustom): FunnelStage {
  if (stage.enum_value) {
    return stage.enum_value;
  }
  
  // Fallback for stages without enum_value
  const positionToEnum: Record<number, FunnelStage> = {
    0: 'cloud',
    1: 'prospect',
    2: 'contacted',
    3: 'convincing',
    4: 'scheduled',
    5: 'positive',
    6: 'waiting_payment',
    7: 'success',
    8: 'trash',
  };
  return positionToEnum[stage.position] || 'cloud';
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
      // First, set all positions to negative values to avoid constraint conflicts
      // This works because we're moving them out of the way temporarily
      const tempUpdates = stages.map(({ id }, index) =>
        supabase
          .from('organization_funnel_stages')
          .update({ position: -(index + 1000) })
          .eq('id', id)
      );

      const tempResults = await Promise.all(tempUpdates);
      const tempErrors = tempResults.filter(r => r.error);
      if (tempErrors.length > 0) throw tempErrors[0].error;

      // Now update to the final positions
      const finalUpdates = stages.map(({ id, position }) =>
        supabase
          .from('organization_funnel_stages')
          .update({ position })
          .eq('id', id)
      );

      const finalResults = await Promise.all(finalUpdates);
      const finalErrors = finalResults.filter(r => r.error);
      if (finalErrors.length > 0) throw finalErrors[0].error;
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
