import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

export interface DefaultStageConfig {
  default_stage_new_lead: string | null;
  default_stage_whatsapp: string | null;
  default_stage_receptivo: string | null;
  default_stage_fallback: string | null;
}

export type StageEntrySource = 'new_lead' | 'whatsapp' | 'receptivo' | 'fallback';

/**
 * Hook to fetch the organization's default funnel stage configuration
 */
export function useDefaultStageConfig() {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['default-stage-config', profile?.organization_id],
    queryFn: async (): Promise<DefaultStageConfig | null> => {
      if (!profile?.organization_id) return null;

      const { data, error } = await supabase
        .from('organizations')
        .select('default_stage_new_lead, default_stage_whatsapp, default_stage_receptivo, default_stage_fallback')
        .eq('id', profile.organization_id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!profile?.organization_id,
  });
}

/**
 * Hook to update the organization's default funnel stage configuration
 */
export function useUpdateDefaultStageConfig() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (config: Partial<DefaultStageConfig>) => {
      if (!profile?.organization_id) throw new Error('No organization');

      const { error } = await supabase
        .from('organizations')
        .update(config)
        .eq('id', profile.organization_id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['default-stage-config'] });
      toast({ title: 'Configuração salva!' });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao salvar',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

/**
 * Get the default stage ID for a specific entry source
 * Falls back to: specific source → fallback → first funnel stage
 */
export function useDefaultStageForSource(source: StageEntrySource) {
  const { data: config } = useDefaultStageConfig();

  const getStageId = (): string | null => {
    if (!config) return null;

    // Check specific source first
    switch (source) {
      case 'new_lead':
        if (config.default_stage_new_lead) return config.default_stage_new_lead;
        break;
      case 'whatsapp':
        if (config.default_stage_whatsapp) return config.default_stage_whatsapp;
        break;
      case 'receptivo':
        if (config.default_stage_receptivo) return config.default_stage_receptivo;
        break;
    }

    // Fallback to general default
    return config.default_stage_fallback;
  };

  return getStageId();
}
