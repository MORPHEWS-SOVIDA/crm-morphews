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
 * CRITICAL: Each stage MUST have an explicit enum_value in the database.
 * Falls back to stage_type-based defaults if missing (should not happen in production).
 */
export function getStageEnumValue(stage: FunnelStageCustom): FunnelStage {
  // Use explicit enum_value from database (the correct approach)
  if (stage.enum_value) {
    return stage.enum_value;
  }
  
  // Safe fallback based on stage_type (NOT position - position can change!)
  // This should rarely happen as all stages should have enum_value set
  console.warn(`Stage "${stage.name}" (id: ${stage.id}) is missing enum_value. Using stage_type fallback.`);
  
  switch (stage.stage_type) {
    case 'cloud':
      return 'cloud';
    case 'trash':
      return 'trash';
    case 'funnel':
    default:
      return 'unclassified';
  }
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
      // Usar função RPC atômica para reordenação segura
      // Isso garante que todas as atualizações ocorram em uma única transação
      // Se qualquer parte falhar, tudo é revertido automaticamente
      const { error } = await (supabase.rpc as any)('reorder_funnel_stages', {
        p_stages: stages,
      });

      if (error) {
        console.error('Error reordering stages:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['funnel-stages'] });
      toast({ title: 'Etapas reordenadas com sucesso!' });
    },
    onError: (error: any) => {
      queryClient.invalidateQueries({ queryKey: ['funnel-stages'] });
      toast({
        title: 'Erro ao reordenar etapas',
        description: 'Tente novamente. Se o problema persistir, atualize a página.',
        variant: 'destructive',
      });
    },
  });
}
