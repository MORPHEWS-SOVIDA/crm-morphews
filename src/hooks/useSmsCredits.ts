import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from './useTenant';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface SmsPackage {
  id: string;
  name: string;
  sms_count: number;
  price_cents: number;
  price_per_sms_cents: number;
  is_active: boolean;
}

export interface SmsBalance {
  id: string;
  organization_id: string;
  current_credits: number;
  total_purchased: number;
  total_used: number;
  updated_at: string;
}

export interface SmsPurchase {
  id: string;
  organization_id: string;
  package_id: string | null;
  credits_amount: number;
  price_cents: number;
  payment_method: string | null;
  payment_reference: string | null;
  purchased_by: string | null;
  created_at: string;
}

export interface SmsUsage {
  id: string;
  organization_id: string;
  lead_id: string | null;
  phone: string;
  message: string;
  facilita_sms_id: string | null;
  external_key: string | null;
  status: string;
  status_code: number | null;
  credits_used: number;
  sent_by: string | null;
  sent_at: string;
  delivered_at: string | null;
  error_message: string | null;
}

export interface SmsProviderConfig {
  id: string;
  organization_id: string;
  provider: string;
  api_user: string | null;
  api_password: string | null;
  is_active: boolean;
}

// Fetch available SMS packages
export function useSmsPackages() {
  return useQuery({
    queryKey: ['sms-packages'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sms_packages')
        .select('*')
        .eq('is_active', true)
        .order('sms_count');

      if (error) throw error;
      return data as SmsPackage[];
    },
  });
}

// Fetch organization's SMS balance
export function useSmsBalance() {
  const { tenantId } = useTenant();

  return useQuery({
    queryKey: ['sms-balance', tenantId],
    queryFn: async () => {
      if (!tenantId) return null;

      const { data, error } = await supabase
        .from('sms_credits_balance')
        .select('*')
        .eq('organization_id', tenantId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data as SmsBalance | null;
    },
    enabled: !!tenantId,
  });
}

// Fetch SMS purchase history
export function useSmsPurchases() {
  const { tenantId } = useTenant();

  return useQuery({
    queryKey: ['sms-purchases', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];

      const { data, error } = await supabase
        .from('sms_credits_purchases')
        .select('*')
        .eq('organization_id', tenantId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as SmsPurchase[];
    },
    enabled: !!tenantId,
  });
}

// Fetch SMS usage history
export function useSmsUsage(limit = 100) {
  const { tenantId } = useTenant();

  return useQuery({
    queryKey: ['sms-usage', tenantId, limit],
    queryFn: async () => {
      if (!tenantId) return [];

      const { data, error } = await supabase
        .from('sms_usage')
        .select('*')
        .eq('organization_id', tenantId)
        .order('sent_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data as SmsUsage[];
    },
    enabled: !!tenantId,
  });
}

// Fetch SMS provider config
export function useSmsProviderConfig() {
  const { tenantId } = useTenant();

  return useQuery({
    queryKey: ['sms-provider-config', tenantId],
    queryFn: async () => {
      if (!tenantId) return null;

      const { data, error } = await supabase
        .from('sms_provider_config')
        .select('*')
        .eq('organization_id', tenantId)
        .eq('provider', 'facilitamovel')
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data as SmsProviderConfig | null;
    },
    enabled: !!tenantId,
  });
}

// Update SMS provider config
export function useUpdateSmsProviderConfig() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();

  return useMutation({
    mutationFn: async (config: { api_user: string; api_password: string; is_active: boolean }) => {
      if (!tenantId) throw new Error('Organização não encontrada');

      const { data, error } = await supabase
        .from('sms_provider_config')
        .upsert({
          organization_id: tenantId,
          provider: 'facilitamovel',
          api_user: config.api_user,
          api_password: config.api_password,
          is_active: config.is_active,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'organization_id,provider' })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sms-provider-config'] });
      toast.success('Configuração salva com sucesso');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao salvar: ${error.message}`);
    },
  });
}

// Send SMS
export function useSendSms() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();

  return useMutation({
    mutationFn: async ({ phone, message, leadId }: { phone: string; message: string; leadId?: string }) => {
      if (!tenantId) throw new Error('Organização não encontrada');

      const { data, error } = await supabase.functions.invoke('facilita-send-sms', {
        body: {
          organizationId: tenantId,
          phone,
          message,
          leadId,
        },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Erro ao enviar SMS');

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sms-balance'] });
      queryClient.invalidateQueries({ queryKey: ['sms-usage'] });
      toast.success('SMS enviado com sucesso');
    },
    onError: (error: Error) => {
      toast.error(`Erro: ${error.message}`);
    },
  });
}

// Add SMS credits (for admin use)
export function useAddSmsCredits() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ 
      packageId, 
      credits, 
      priceCents, 
      paymentMethod, 
      paymentReference 
    }: { 
      packageId?: string;
      credits: number;
      priceCents: number;
      paymentMethod?: string;
      paymentReference?: string;
    }) => {
      if (!tenantId) throw new Error('Organização não encontrada');

      // Create purchase record
      const { error: purchaseError } = await supabase
        .from('sms_credits_purchases')
        .insert({
          organization_id: tenantId,
          package_id: packageId || null,
          credits_amount: credits,
          price_cents: priceCents,
          payment_method: paymentMethod || null,
          payment_reference: paymentReference || null,
          purchased_by: user?.id || null,
        });

      if (purchaseError) throw purchaseError;

      // Add credits using RPC
      const { error: rpcError } = await supabase.rpc('add_sms_credits', {
        p_organization_id: tenantId,
        p_credits_to_add: credits,
      });

      if (rpcError) throw rpcError;

      return { credits };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['sms-balance'] });
      queryClient.invalidateQueries({ queryKey: ['sms-purchases'] });
      toast.success(`${data.credits} créditos SMS adicionados`);
    },
    onError: (error: Error) => {
      toast.error(`Erro ao adicionar créditos: ${error.message}`);
    },
  });
}