import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface EfiPayConfig {
  id: string;
  organization_id: string;
  source: string;
  display_name: string;
  is_active: boolean;
  webhook_secret: string | null;
  pix_key: string | null;
  credentials_encrypted: {
    client_id?: string;
    has_secret?: boolean;
    has_certificate?: boolean;
    pix_keys?: string[];
    environment?: 'sandbox' | 'production';
  } | null;
  created_at: string;
  updated_at: string;
}

// Fetch EfiPay configuration for the organization
export function useEfiPayConfig() {
  const { profile } = useAuth();
  const organizationId = profile?.organization_id;

  return useQuery({
    queryKey: ['efipay-config', organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payment_sources')
        .select('*')
        .eq('organization_id', organizationId!)
        .eq('source', 'efipay')
        .maybeSingle();
      
      if (error) throw error;
      return data as EfiPayConfig | null;
    },
    enabled: !!organizationId,
  });
}

// Upsert EfiPay configuration
export function useUpsertEfiPayConfig() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async (config: {
      client_id: string;
      client_secret?: string;
      pix_keys: string[];
      environment: 'sandbox' | 'production';
      webhook_secret?: string;
      is_active?: boolean;
    }) => {
      if (!profile?.organization_id) {
        throw new Error('Organização não encontrada');
      }

      // Build credentials object (only store non-sensitive info client-side)
      const credentials = {
        client_id: config.client_id,
        has_secret: !!config.client_secret,
        has_certificate: true, // Certificate is stored as a secret
        pix_keys: config.pix_keys,
        environment: config.environment,
      };

      const { data, error } = await supabase
        .from('payment_sources')
        .upsert({
          organization_id: profile.organization_id,
          source: 'efipay',
          display_name: 'EfiPay PIX',
          is_active: config.is_active ?? true,
          webhook_secret: config.webhook_secret,
          pix_key: config.pix_keys[0] || null,
          credentials_encrypted: credentials,
        }, {
          onConflict: 'organization_id,source',
        })
        .select()
        .single();

      if (error) throw error;

      // If client_secret is provided, save it via edge function
      if (config.client_secret) {
        const { error: secretError } = await supabase.functions.invoke('save-efipay-secret', {
          body: {
            organization_id: profile.organization_id,
            client_secret: config.client_secret,
          },
        });
        
        if (secretError) {
          console.error('Error saving EfiPay secret:', secretError);
          // Don't throw - config was saved, secret saving is best-effort
        }
      }

      return data;
    },
    onSuccess: () => {
      toast.success('Configuração EfiPay salva!');
      queryClient.invalidateQueries({ queryKey: ['efipay-config'] });
      queryClient.invalidateQueries({ queryKey: ['payment-sources'] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Erro ao salvar configuração');
    },
  });
}

// Fetch all incoming transactions (with optional filters)
export function useAllIncomingTransactions(options?: {
  source?: string;
  status?: string;
  limit?: number;
}) {
  const { profile } = useAuth();
  const organizationId = profile?.organization_id;

  return useQuery({
    queryKey: ['all-incoming-transactions', organizationId, options],
    queryFn: async () => {
      let query = supabase
        .from('incoming_transactions')
        .select('*')
        .eq('organization_id', organizationId!)
        .order('created_at', { ascending: false })
        .limit(options?.limit || 50);

      if (options?.source) {
        query = query.eq('source', options.source);
      }
      if (options?.status) {
        query = query.eq('status', options.status);
      }

      const { data, error } = await query;
      
      if (error) throw error;
      return data;
    },
    enabled: !!organizationId,
  });
}

// Get webhook URL for EfiPay
export function getEfiPayWebhookUrl(organizationId: string) {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  return `${supabaseUrl}/functions/v1/efipay-webhook?org=${organizationId}`;
}
