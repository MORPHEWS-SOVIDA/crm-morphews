import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { toast } from 'sonner';

export interface MelhorEnvioConfig {
  id: string;
  organization_id: string;
  is_active: boolean;
  ambiente: 'sandbox' | 'production';
  token_encrypted: string | null;
  sender_name: string | null;
  sender_cpf_cnpj: string | null;
  sender_cnpj: string | null;
  sender_ie: string | null;
  sender_street: string | null;
  sender_number: string | null;
  sender_complement: string | null;
  sender_neighborhood: string | null;
  sender_city: string | null;
  sender_state: string | null;
  sender_cep: string | null;
  sender_phone: string | null;
  sender_email: string | null;
  default_weight_grams: number;
  default_height_cm: number;
  default_width_cm: number;
  default_length_cm: number;
  default_agency_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface MelhorEnvioLabel {
  id: string;
  organization_id: string;
  sale_id: string | null;
  melhor_envio_order_id: string;
  tracking_code: string;
  service_id: number;
  service_name: string | null;
  company_name: string | null;
  recipient_name: string;
  recipient_cpf_cnpj: string | null;
  recipient_street: string | null;
  recipient_number: string | null;
  recipient_complement: string | null;
  recipient_neighborhood: string | null;
  recipient_city: string | null;
  recipient_state: string | null;
  recipient_cep: string;
  recipient_phone: string | null;
  weight_grams: number | null;
  height_cm: number | null;
  width_cm: number | null;
  length_cm: number | null;
  declared_value_cents: number | null;
  label_pdf_url: string | null;
  status: string;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  posted_at: string | null;
}

export interface MelhorEnvioQuote {
  service_id: number;
  service_code: string;
  service_name: string;
  company_name: string;
  company_picture: string;
  price_cents: number;
  delivery_days: number;
  delivery_range: { min: number; max: number };
  error?: string;
}

export interface MelhorEnvioService {
  id: number;
  name: string;
  company: { id: number; name: string; picture: string };
}

// Hook to get Melhor Envio config
export function useMelhorEnvioConfig() {
  const { tenantId } = useTenant();

  return useQuery({
    queryKey: ['melhor-envio-config', tenantId],
    queryFn: async () => {
      if (!tenantId) return null;

      const { data, error } = await supabase
        .from('melhor_envio_config')
        .select('*')
        .eq('organization_id', tenantId)
        .maybeSingle();

      if (error) throw error;
      return data as MelhorEnvioConfig | null;
    },
    enabled: !!tenantId,
  });
}

// Hook to save config
export function useSaveMelhorEnvioConfig() {
  const { tenantId } = useTenant();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (config: Partial<MelhorEnvioConfig>) => {
      if (!tenantId) throw new Error('Organização não identificada');

      const { data, error } = await supabase
        .from('melhor_envio_config')
        .upsert({
          organization_id: tenantId,
          ...config,
        }, { onConflict: 'organization_id' })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['melhor-envio-config'] });
      toast.success('Configuração salva!');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao salvar: ${error.message}`);
    },
  });
}

// Hook to get shipping quotes
export function useMelhorEnvioQuote() {
  const { tenantId } = useTenant();

  const getQuotes = async (request: {
    destination_cep: string;
    weight_grams?: number;
    height_cm?: number;
    width_cm?: number;
    length_cm?: number;
    declared_value_cents?: number;
  }): Promise<MelhorEnvioQuote[]> => {
    if (!tenantId) {
      throw new Error('Organização não identificada');
    }

    const { data, error } = await supabase.functions.invoke('melhor-envio-quote', {
      body: {
        organization_id: tenantId,
        ...request,
      },
    });

    if (error) {
      throw new Error(error.message || 'Erro ao consultar frete');
    }

    if (!data.success) {
      throw new Error(data.error || 'Falha na consulta de frete');
    }

    return data.quotes || [];
  };

  return { getQuotes };
}

// Hook to get available services
export function useMelhorEnvioServices() {
  const { tenantId } = useTenant();

  return useQuery({
    queryKey: ['melhor-envio-services', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];

      const { data, error } = await supabase.functions.invoke('melhor-envio-label', {
        body: {
          action: 'get_services',
          organization_id: tenantId,
        },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      return data.services as MelhorEnvioService[];
    },
    enabled: !!tenantId,
  });
}

// Hook to generate label
export function useGenerateMelhorEnvioLabel() {
  const { tenantId } = useTenant();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      sale_id?: string;
      service_id: number;
      recipient: {
        name: string;
        cpf_cnpj?: string;
        street: string;
        number: string;
        complement?: string;
        neighborhood: string;
        city: string;
        state: string;
        cep: string;
        phone?: string;
        email?: string;
      };
      package?: {
        weight_grams?: number;
        height_cm?: number;
        width_cm?: number;
        length_cm?: number;
        declared_value_cents?: number;
      };
      invoice?: {
        number?: string;
        key?: string;
      };
      products?: Array<{
        name: string;
        quantity: number;
        unitary_value_cents: number;
      }>;
    }) => {
      if (!tenantId) throw new Error('Organização não identificada');

      const { data, error } = await supabase.functions.invoke('melhor-envio-label', {
        body: {
          action: 'create_label',
          organization_id: tenantId,
          ...params,
        },
      });

      if (error) throw new Error(error.message || 'Erro ao gerar etiqueta');
      if (!data.success) throw new Error(data.error || 'Falha ao gerar etiqueta');
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['melhor-envio-labels'] });
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['expedition-sales'] });
      toast.success(`Etiqueta gerada! Rastreio: ${data.tracking_code}`);
    },
    onError: (error: Error) => {
      toast.error(`Erro ao gerar etiqueta: ${error.message}`);
    },
  });
}

// Hook to get labels
export function useMelhorEnvioLabels(filters?: { status?: string; saleId?: string }) {
  const { tenantId } = useTenant();

  return useQuery({
    queryKey: ['melhor-envio-labels', tenantId, filters],
    queryFn: async () => {
      if (!tenantId) return [];

      let query = supabase
        .from('melhor_envio_labels')
        .select('*')
        .eq('organization_id', tenantId)
        .order('created_at', { ascending: false });

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }

      if (filters?.saleId) {
        query = query.eq('sale_id', filters.saleId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as MelhorEnvioLabel[];
    },
    enabled: !!tenantId,
  });
}

// Hook to get label for specific sale
export function useSaleMelhorEnvioLabel(saleId: string | undefined) {
  const { tenantId } = useTenant();

  return useQuery({
    queryKey: ['melhor-envio-label-sale', saleId],
    queryFn: async () => {
      if (!tenantId || !saleId) return null;

      const { data, error } = await supabase
        .from('melhor_envio_labels')
        .select('*')
        .eq('organization_id', tenantId)
        .eq('sale_id', saleId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as MelhorEnvioLabel | null;
    },
    enabled: !!tenantId && !!saleId,
  });
}

// Enabled services management
export interface EnabledMelhorEnvioService {
  id: string;
  organization_id: string;
  service_id: number;
  service_name: string;
  company_name: string | null;
  is_enabled: boolean;
  position: number;
  picking_cost_cents: number;
  extra_handling_days: number;
}

export function useEnabledMelhorEnvioServices() {
  const { tenantId } = useTenant();

  return useQuery({
    queryKey: ['melhor-envio-enabled-services', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];

      const { data, error } = await supabase
        .from('melhor_envio_enabled_services')
        .select('*')
        .eq('organization_id', tenantId)
        .order('position');

      if (error) throw error;
      return (data || []) as EnabledMelhorEnvioService[];
    },
    enabled: !!tenantId,
  });
}

export function useToggleMelhorEnvioService() {
  const { tenantId } = useTenant();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ serviceId, serviceName, companyName, isEnabled }: { 
      serviceId: number; 
      serviceName: string; 
      companyName?: string;
      isEnabled: boolean 
    }) => {
      if (!tenantId) throw new Error('Organização não identificada');

      const { error } = await supabase
        .from('melhor_envio_enabled_services')
        .upsert({
          organization_id: tenantId,
          service_id: serviceId,
          service_name: serviceName,
          company_name: companyName,
          is_enabled: isEnabled,
        }, {
          onConflict: 'organization_id,service_id',
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['melhor-envio-enabled-services'] });
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar serviço: ${error.message}`);
    },
  });
}

export function useUpdateMelhorEnvioServiceConfig() {
  const { tenantId } = useTenant();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      serviceId, 
      serviceName,
      companyName,
      pickingCostCents, 
      extraHandlingDays 
    }: { 
      serviceId: number; 
      serviceName: string;
      companyName?: string;
      pickingCostCents: number; 
      extraHandlingDays: number;
    }) => {
      if (!tenantId) throw new Error('Organização não identificada');

      const { error } = await supabase
        .from('melhor_envio_enabled_services')
        .upsert({
          organization_id: tenantId,
          service_id: serviceId,
          service_name: serviceName,
          company_name: companyName,
          picking_cost_cents: pickingCostCents,
          extra_handling_days: extraHandlingDays,
        }, {
          onConflict: 'organization_id,service_id',
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['melhor-envio-enabled-services'] });
      toast.success('Configuração salva!');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao salvar: ${error.message}`);
    },
  });
}

export function formatShippingPrice(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}
