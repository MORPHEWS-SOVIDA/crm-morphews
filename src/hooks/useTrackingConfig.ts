import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

// ============================================================
// TRACKING CONFIG HOOKS
// Gerenciamento de configurações de pixel/API por organização
// ============================================================

export interface TrackingConfig {
  id: string;
  organization_id: string;
  // Meta
  meta_pixel_id: string | null;
  meta_access_token: string | null;
  meta_test_event_code: string | null;
  meta_enabled: boolean;
  // Google
  google_ads_customer_id: string | null;
  google_conversion_action_id: string | null;
  google_developer_token: string | null;
  google_enabled: boolean;
  // TikTok
  tiktok_pixel_id: string | null;
  tiktok_access_token: string | null;
  tiktok_enabled: boolean;
  // Timestamps
  created_at: string;
  updated_at: string;
}

export interface ConversionEvent {
  id: string;
  organization_id: string;
  sale_id: string | null;
  lead_id: string | null;
  event_type: string;
  platform: 'meta' | 'google' | 'tiktok';
  event_id: string | null;
  payload: any;
  response: any;
  status: 'pending' | 'sent' | 'failed';
  error_message: string | null;
  created_at: string;
  sent_at: string | null;
}

/**
 * Busca configuração de tracking da organização
 */
export function useTrackingConfig() {
  const { profile } = useAuth();
  
  return useQuery({
    queryKey: ['tracking-config', profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return null;
      
      const { data, error } = await supabase
        .from('tracking_config')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .single();
      
      if (error && error.code !== 'PGRST116') {
        throw error;
      }
      
      return data as TrackingConfig | null;
    },
    enabled: !!profile?.organization_id,
  });
}

/**
 * Cria ou atualiza configuração de tracking
 */
export function useUpdateTrackingConfig() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  
  return useMutation({
    mutationFn: async (config: Partial<TrackingConfig>) => {
      if (!profile?.organization_id) throw new Error('Organização não encontrada');
      
      const { data, error } = await supabase
        .from('tracking_config')
        .upsert(
          {
            organization_id: profile.organization_id,
            ...config,
          },
          { onConflict: 'organization_id' }
        )
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tracking-config'] });
      toast({
        title: 'Configurações salvas',
        description: 'As configurações de tracking foram atualizadas.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao salvar',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

/**
 * Busca eventos de conversão enviados
 */
export function useConversionEvents(options?: { limit?: number; platform?: string }) {
  const { profile } = useAuth();
  
  return useQuery({
    queryKey: ['conversion-events', profile?.organization_id, options],
    queryFn: async () => {
      if (!profile?.organization_id) return [];
      
      let query = supabase
        .from('conversion_events')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .order('created_at', { ascending: false });
      
      if (options?.platform) {
        query = query.eq('platform', options.platform);
      }
      
      if (options?.limit) {
        query = query.limit(options.limit);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data as ConversionEvent[];
    },
    enabled: !!profile?.organization_id,
  });
}

/**
 * Estatísticas de conversões por plataforma
 */
export function useConversionStats() {
  const { profile } = useAuth();
  
  return useQuery({
    queryKey: ['conversion-stats', profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return null;
      
      const { data, error } = await supabase
        .from('conversion_events')
        .select('platform, status')
        .eq('organization_id', profile.organization_id);
      
      if (error) throw error;
      
      // Agregar por plataforma
      const stats = {
        meta: { sent: 0, failed: 0, pending: 0 },
        google: { sent: 0, failed: 0, pending: 0 },
        tiktok: { sent: 0, failed: 0, pending: 0 },
      };
      
      data?.forEach((event) => {
        const platform = event.platform as keyof typeof stats;
        const status = event.status as keyof typeof stats.meta;
        if (stats[platform] && stats[platform][status] !== undefined) {
          stats[platform][status]++;
        }
      });
      
      return stats;
    },
    enabled: !!profile?.organization_id,
  });
}
