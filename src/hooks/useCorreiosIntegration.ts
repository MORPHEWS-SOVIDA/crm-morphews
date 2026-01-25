import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentTenantId } from '@/hooks/useTenant';
import { toast } from 'sonner';

function extractFunctionInvokeError(error: any): string {
  // Supabase functions.invoke pode retornar um erro genérico, mas às vezes o body vem em context
  const fallback = error?.message || 'Erro ao chamar função do backend.';
  const ctx = error?.context;

  // Tentativas comuns: context.body (string), context.response (string), etc.
  const rawBody =
    (typeof ctx?.body === 'string' && ctx.body) ||
    (typeof ctx?.response === 'string' && ctx.response) ||
    (typeof error?.details === 'string' && error.details) ||
    null;

  if (!rawBody) return fallback;

  try {
    const parsed = JSON.parse(rawBody);
    if (typeof parsed?.error === 'string' && parsed.error) return parsed.error;
    if (typeof parsed?.message === 'string' && parsed.message) return parsed.message;
    if (typeof parsed?.mensagem === 'string' && parsed.mensagem) return parsed.mensagem;
    return fallback;
  } catch {
    // Se não for JSON, devolve o texto bruto (quando curto) ou fallback
    return rawBody.length <= 300 ? rawBody : fallback;
  }
}

export interface CorreiosConfig {
  id: string;
  organization_id: string;
  is_active: boolean;
  id_correios: string | null;
  codigo_acesso_encrypted: string | null;
  contrato: string | null;
  cartao_postagem: string | null;
  sender_name: string | null;
  sender_cpf_cnpj: string | null;
  sender_street: string | null;
  sender_number: string | null;
  sender_complement: string | null;
  sender_neighborhood: string | null;
  sender_city: string | null;
  sender_state: string | null;
  sender_cep: string | null;
  sender_phone: string | null;
  sender_email: string | null;
  default_service_code: string;
  default_package_type: string;
  default_weight_grams: number;
  default_height_cm: number;
  default_width_cm: number;
  default_length_cm: number;
  ambiente: 'HOMOLOGACAO' | 'PRODUCAO';
  created_at: string;
  updated_at: string;
}

export interface CorreiosLabel {
  id: string;
  organization_id: string;
  sale_id: string | null;
  tracking_code: string;
  service_code: string;
  service_name: string | null;
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
  declaration_pdf_url: string | null;
  status: string;
  correios_prepostagem_id: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  posted_at: string | null;
  created_by: string | null;
}

export interface CorreiosService {
  code: string;
  name: string;
  description: string;
}

function useOrganizationId() {
  const { profile } = useAuth();
  const { data: tenantId } = useCurrentTenantId();
  return profile?.organization_id ?? tenantId ?? null;
}

export function useCorreiosConfig() {
  const organizationId = useOrganizationId();

  return useQuery({
    queryKey: ['correios-config', organizationId],
    queryFn: async () => {
      if (!organizationId) return null;

      const { data, error } = await (supabase
        .from('correios_config' as any)
        .select('*')
        .eq('organization_id', organizationId)
        .maybeSingle() as any);

      if (error) throw error;
      return data as CorreiosConfig | null;
    },
    enabled: !!organizationId,
  });
}

export function useSaveCorreiosConfig() {
  const queryClient = useQueryClient();
  const organizationId = useOrganizationId();

  return useMutation({
    mutationFn: async (config: Partial<CorreiosConfig> & { codigo_acesso?: string }) => {
      if (!organizationId) throw new Error('Organization ID not found');

      const { data, error } = await supabase.functions.invoke('correios-api', {
        body: {
          action: 'save_config',
          organization_id: organizationId,
          config,
        },
      });

      if (error) throw new Error(extractFunctionInvokeError(error));
      if (!data?.success) throw new Error(data?.error || 'Falha ao salvar configuração.');
      return data.config;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['correios-config'] });
      toast.success('Configuração salva com sucesso!');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao salvar configuração: ${error.message}`);
    },
  });
}

export function useTestCorreiosConnection() {
  const organizationId = useOrganizationId();

  return useMutation({
    mutationFn: async () => {
      if (!organizationId) throw new Error('Organization ID not found');

      const { data, error } = await supabase.functions.invoke('correios-api', {
        body: {
          action: 'test_connection',
          organization_id: organizationId,
        },
      });

      if (error) throw new Error(extractFunctionInvokeError(error));
      if (!data?.success) throw new Error(data?.error || 'Falha ao testar conexão.');
      return data;
    },
    onSuccess: () => {
      toast.success('Conexão com Correios testada com sucesso!');
    },
    onError: (error: Error) => {
      toast.error(`Erro na conexão: ${error.message}`);
    },
  });
}

export function useCorreiosServices() {
  return useQuery({
    queryKey: ['correios-services'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('correios-api', {
        body: { action: 'get_services' },
      });

      if (error) throw new Error(extractFunctionInvokeError(error));
      if (!data?.success) throw new Error(data?.error || 'Falha ao buscar serviços.');
      return data.services as CorreiosService[];
    },
  });
}

export function useCorreiosLabels(filters?: { status?: string; saleId?: string }) {
  const organizationId = useOrganizationId();

  return useQuery({
    queryKey: ['correios-labels', organizationId, filters],
    queryFn: async () => {
      if (!organizationId) return [];

      let query = (supabase
        .from('correios_labels' as any)
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })) as any;

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }

      if (filters?.saleId) {
        query = query.eq('sale_id', filters.saleId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as CorreiosLabel[];
    },
    enabled: !!organizationId,
  });
}

export function useGenerateCorreiosLabel() {
  const queryClient = useQueryClient();
  const organizationId = useOrganizationId();

  return useMutation({
    mutationFn: async (params: {
      sale_id?: string;
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
      service_code?: string;
      invoice_number?: string;
      invoice_key?: string;
    }) => {
      if (!organizationId) throw new Error('Organization ID not found');

      // Try n8n proxy first, fallback to direct API
      let data: any;
      let error: any;

      // First try n8n proxy (more reliable)
      const n8nResult = await supabase.functions.invoke('correios-n8n-proxy', {
        body: {
          action: 'create_label',
          organization_id: organizationId,
          ...params,
        },
      });

      if (n8nResult.error?.message?.includes('N8N_CORREIOS_WEBHOOK_URL não configurado')) {
        // n8n not configured, fallback to direct API
        console.log('n8n proxy not configured, falling back to direct API');
        const directResult = await supabase.functions.invoke('correios-api', {
          body: {
            action: 'generate_label',
            organization_id: organizationId,
            ...params,
          },
        });
        data = directResult.data;
        error = directResult.error;
      } else {
        data = n8nResult.data;
        error = n8nResult.error;
      }

      if (error) throw new Error(extractFunctionInvokeError(error));
      if (!data?.success) throw new Error(data?.error || 'Falha ao gerar etiqueta.');
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['correios-labels'] });
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['expedition-sales'] });
      toast.success(`Etiqueta gerada! Rastreio: ${data.tracking_code}`);
    },
    onError: (error: Error) => {
      toast.error(`Erro ao gerar etiqueta: ${error.message}`);
    },
  });
}

// Helper to get pending sales that need Correios labels
export function usePendingCorreiosSales() {
  const organizationId = useOrganizationId();

  return useQuery({
    queryKey: ['pending-correios-sales', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];

      // Get sales with carrier delivery that don't have tracking codes yet
      // Include shipping_address from lead_addresses for proper address data
      const { data, error } = await supabase
        .from('sales')
        .select(`
          *,
          lead:leads(id, name, whatsapp, email, cpf, cnpj, street, street_number, complement, neighborhood, city, state, cep),
          items:sale_items(id, product_name, quantity),
          shipping_carrier:shipping_carriers(id, name, correios_service_code),
          shipping_address:lead_addresses(id, label, street, street_number, complement, neighborhood, city, state, cep)
        `)
        .eq('organization_id', organizationId)
        .eq('delivery_type', 'carrier')
        .is('tracking_code', null)
        .in('status', ['draft', 'pending_expedition'] as any)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as any[];
    },
    enabled: !!organizationId,
  });
}

// Get label for a specific sale
export function useSaleCorreiosLabel(saleId: string | undefined) {
  const organizationId = useOrganizationId();

  return useQuery({
    queryKey: ['correios-label-sale', saleId],
    queryFn: async () => {
      if (!organizationId || !saleId) return null;

      const { data, error } = await (supabase
        .from('correios_labels' as any)
        .select('*')
        .eq('organization_id', organizationId)
        .eq('sale_id', saleId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()) as any;

      if (error) throw error;
      return data as CorreiosLabel | null;
    },
    enabled: !!organizationId && !!saleId,
  });
}
