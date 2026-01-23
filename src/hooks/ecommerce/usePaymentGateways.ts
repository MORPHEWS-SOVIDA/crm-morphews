import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Types
export type GatewayType = 'stripe' | 'pagarme' | 'appmax' | 'asaas';

export interface PaymentGateway {
  id: string;
  organization_id: string;
  gateway_type: GatewayType;
  name: string;
  api_key_encrypted: string | null;
  api_secret_encrypted: string | null;
  webhook_secret: string | null;
  is_sandbox: boolean;
  is_active: boolean;
  is_default: boolean;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export const GATEWAY_LABELS: Record<GatewayType, string> = {
  stripe: 'Stripe',
  pagarme: 'Pagar.me',
  appmax: 'Appmax',
  asaas: 'Asaas',
};

// Fetch gateways for current org
export function usePaymentGateways() {
  return useQuery({
    queryKey: ['payment-gateways'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payment_gateways')
        .select('*')
        .order('is_default', { ascending: false })
        .order('name');
      
      if (error) throw error;
      return data as PaymentGateway[];
    },
  });
}

// Fetch active gateways
export function useActivePaymentGateways() {
  return useQuery({
    queryKey: ['payment-gateways', 'active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payment_gateways')
        .select('*')
        .eq('is_active', true)
        .order('is_default', { ascending: false });
      
      if (error) throw error;
      return data as PaymentGateway[];
    },
  });
}

// Create gateway
export interface CreateGatewayInput {
  gateway_type: GatewayType;
  name: string;
  api_key: string;
  api_secret?: string;
  webhook_secret?: string;
  is_sandbox?: boolean;
  is_default?: boolean;
}

export function useCreatePaymentGateway() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (input: CreateGatewayInput) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('user_id', user.id)
        .single();
      
      if (!profile?.organization_id) throw new Error('Organização não encontrada');
      
      // If setting as default, unset other defaults first
      if (input.is_default) {
        await supabase
          .from('payment_gateways')
          .update({ is_default: false })
          .eq('organization_id', profile.organization_id);
      }
      
      const { data, error } = await supabase
        .from('payment_gateways')
        .insert({
          organization_id: profile.organization_id,
          gateway_type: input.gateway_type,
          name: input.name,
          api_key_encrypted: input.api_key, // TODO: Encrypt
          api_secret_encrypted: input.api_secret || null,
          webhook_secret: input.webhook_secret || null,
          is_sandbox: input.is_sandbox ?? false,
          is_default: input.is_default ?? false,
          is_active: true,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-gateways'] });
      toast.success('Gateway adicionado!');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

// Update gateway
export function useUpdatePaymentGateway() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<CreateGatewayInput> & { id: string }) => {
      // Get org for default handling
      const { data: gateway } = await supabase
        .from('payment_gateways')
        .select('organization_id')
        .eq('id', id)
        .single();
      
      // If setting as default, unset other defaults first
      if (input.is_default && gateway) {
        await supabase
          .from('payment_gateways')
          .update({ is_default: false })
          .eq('organization_id', gateway.organization_id);
      }
      
      const updateData: Record<string, unknown> = {};
      if (input.name) updateData.name = input.name;
      if (input.api_key) updateData.api_key_encrypted = input.api_key;
      if (input.api_secret !== undefined) updateData.api_secret_encrypted = input.api_secret || null;
      if (input.webhook_secret !== undefined) updateData.webhook_secret = input.webhook_secret || null;
      if (input.is_sandbox !== undefined) updateData.is_sandbox = input.is_sandbox;
      if (input.is_default !== undefined) updateData.is_default = input.is_default;
      
      const { data, error } = await supabase
        .from('payment_gateways')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-gateways'] });
      toast.success('Gateway atualizado!');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

// Toggle gateway active
export function useTogglePaymentGateway() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { data, error } = await supabase
        .from('payment_gateways')
        .update({ is_active })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-gateways'] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

// Delete gateway
export function useDeletePaymentGateway() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('payment_gateways')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-gateways'] });
      toast.success('Gateway removido');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}
