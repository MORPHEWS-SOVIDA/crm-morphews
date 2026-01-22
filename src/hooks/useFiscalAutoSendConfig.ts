import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

export interface FiscalAutoSendConfig {
  id: string;
  organization_id: string;
  created_at: string;
  updated_at: string;
  // Email
  email_enabled: boolean;
  resend_api_key_encrypted?: string;
  email_from_name?: string;
  email_from_address?: string;
  email_subject_template?: string;
  email_body_template?: string;
  email_send_danfe: boolean;
  email_send_xml: boolean;
  // WhatsApp
  whatsapp_enabled: boolean;
  whatsapp_instance_id?: string;
  whatsapp_message_template?: string;
  whatsapp_send_danfe: boolean;
  whatsapp_send_xml: boolean;
}

export function useFiscalAutoSendConfig() {
  const { profile } = useAuth();
  
  return useQuery({
    queryKey: ['fiscal-auto-send-config', profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return null;
      
      const { data, error } = await (supabase as any)
        .from('fiscal_auto_send_config')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .maybeSingle();
      
      if (error) throw error;
      return data as FiscalAutoSendConfig | null;
    },
    enabled: !!profile?.organization_id,
  });
}

export function useUpsertFiscalAutoSendConfig() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  
  return useMutation({
    mutationFn: async (updates: Partial<FiscalAutoSendConfig>) => {
      if (!profile?.organization_id) throw new Error('Organization not found');
      
      // Check if exists
      const { data: existing } = await (supabase as any)
        .from('fiscal_auto_send_config')
        .select('id')
        .eq('organization_id', profile.organization_id)
        .maybeSingle();
      
      if (existing) {
        // Update
        const { data, error } = await (supabase as any)
          .from('fiscal_auto_send_config')
          .update(updates)
          .eq('id', existing.id)
          .select()
          .single();
        
        if (error) throw error;
        return data;
      } else {
        // Insert
        const { data, error } = await (supabase as any)
          .from('fiscal_auto_send_config')
          .insert({
            organization_id: profile.organization_id,
            ...updates,
          })
          .select()
          .single();
        
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fiscal-auto-send-config'] });
      toast({ title: 'Configuração salva com sucesso!' });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao salvar configuração',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// Hook to encrypt and save API key via edge function
export function useSaveResendApiKey() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  
  return useMutation({
    mutationFn: async (apiKey: string) => {
      if (!profile?.organization_id) throw new Error('Organization not found');
      
      const { data, error } = await supabase.functions.invoke('fiscal-save-api-key', {
        body: {
          api_key: apiKey,
          key_type: 'resend',
        },
      });
      
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fiscal-auto-send-config'] });
      toast({ title: 'API Key salva com sucesso!' });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao salvar API Key',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
