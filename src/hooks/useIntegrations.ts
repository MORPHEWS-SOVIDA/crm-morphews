import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/error-message';

export interface TriggerRule {
  id: string;
  type: 'time_since_webhook' | 'has_active_sale' | 'source_match' | 'source_exclude';
  operator?: 'less_than' | 'greater_than' | 'equals' | 'not_equals';
  value?: string | number;
  integration_ids?: string[];
}

export interface Integration {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  type: 'webhook_inbound' | 'webhook_outbound' | 'api' | 'native';
  status: 'active' | 'inactive';
  auth_token: string;
  default_stage: string | null;
  default_responsible_user_ids: string[] | null;
  default_product_id: string | null;
  auto_followup_days: number | null;
  non_purchase_reason_id: string | null;
  settings: Record<string, any>;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  // New fields for sales support
  event_mode: 'lead' | 'sale' | 'both';
  sale_status_on_create: string | null;
  sale_tag: string | null;
  // New fields for seller and trigger rules
  default_seller_id: string | null;
  trigger_rules: TriggerRule[] | null;
  trigger_rules_logic: 'AND' | 'OR';
}

export interface IntegrationFieldMapping {
  id: string;
  integration_id: string;
  organization_id: string;
  source_field: string;
  target_field: string;
  transform_type: string;
  created_at: string;
}

export interface IntegrationEvent {
  id: string;
  integration_id: string;
  organization_id: string;
  event_type: string;
  url: string;
  method: string;
  headers: Record<string, any>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface IntegrationLog {
  id: string;
  integration_id: string;
  organization_id: string;
  direction: 'inbound' | 'outbound';
  event_type: string | null;
  status: 'success' | 'error' | 'pending';
  request_payload: any;
  response_payload: any;
  error_message: string | null;
  processing_time_ms: number | null;
  lead_id: string | null;
  created_at: string;
}

export const EVENT_TYPES = [
  { value: 'lead_created', label: 'Lead criado' },
  { value: 'lead_updated', label: 'Lead atualizado' },
  { value: 'lead_assigned', label: 'Lead atribuído' },
  { value: 'lead_transferred', label: 'Lead transferido' },
  { value: 'lead_stage_changed', label: 'Etapa do lead alterada' },
  { value: 'demand_created', label: 'Demanda criada' },
  { value: 'demand_updated', label: 'Demanda atualizada' },
  { value: 'demand_completed', label: 'Demanda concluída' },
  { value: 'sla_breached', label: 'SLA estourado' },
  { value: 'sale_created', label: 'Venda criada' },
  { value: 'sale_paid', label: 'Venda paga' },
  { value: 'sale_delivered', label: 'Venda entregue' },
];

export const TARGET_FIELDS = [
  // Lead fields (only fields that EXIST in the leads table)
  { value: 'name', label: 'Nome', group: 'lead' },
  { value: 'email', label: 'Email', group: 'lead' },
  { value: 'whatsapp', label: 'WhatsApp', group: 'lead' },
  { value: 'cpf', label: 'CPF/CNPJ', group: 'lead' },
  { value: 'observations', label: 'Observações', group: 'lead' },
  // Address fields (stored in lead_addresses table)
  { value: 'address_street', label: 'Rua', group: 'address' },
  { value: 'address_number', label: 'Número', group: 'address' },
  { value: 'address_complement', label: 'Complemento', group: 'address' },
  { value: 'address_neighborhood', label: 'Bairro', group: 'address' },
  { value: 'address_city', label: 'Cidade', group: 'address' },
  { value: 'address_state', label: 'Estado', group: 'address' },
  { value: 'address_cep', label: 'CEP', group: 'address' },
  // Sale fields (stored in sales/sale_items table)
  { value: 'sale_product_name', label: 'Nome do Produto (Venda)', group: 'sale' },
  { value: 'sale_product_sku', label: 'SKU do Produto (Venda)', group: 'sale' },
  { value: 'sale_quantity', label: 'Quantidade (Venda)', group: 'sale' },
  { value: 'sale_total_cents', label: 'Valor Total (centavos)', group: 'sale' },
  { value: 'sale_payment_method', label: 'Forma de Pagamento', group: 'sale' },
  { value: 'sale_external_id', label: 'ID Pedido Externo', group: 'sale' },
  { value: 'sale_external_url', label: 'Link Pedido Externo', group: 'sale' },
  { value: 'sale_observation_1', label: 'Observação 1 (Venda)', group: 'sale' },
  { value: 'sale_observation_2', label: 'Observação 2 (Venda)', group: 'sale' },
];

export const TRANSFORM_TYPES = [
  { value: 'direct', label: 'Direto' },
  { value: 'phone_normalize', label: 'Normalizar telefone' },
  { value: 'uppercase', label: 'Maiúsculas' },
  { value: 'lowercase', label: 'Minúsculas' },
  { value: 'trim', label: 'Remover espaços' },
];

// Helper to safely parse trigger_rules from JSON
function parseIntegration(data: any): Integration {
  return {
    ...data,
    trigger_rules: Array.isArray(data.trigger_rules) ? data.trigger_rules as TriggerRule[] : [],
    trigger_rules_logic: data.trigger_rules_logic || 'AND',
  };
}

export function useIntegrations() {
  const { tenantId } = useTenant();
  
  return useQuery({
    queryKey: ['integrations', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      
      const { data, error } = await supabase
        .from('integrations')
        .select('*')
        .eq('organization_id', tenantId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return (data || []).map(parseIntegration);
    },
    enabled: !!tenantId,
  });
}

export function useIntegration(id: string | undefined) {
  const { tenantId } = useTenant();
  
  return useQuery({
    queryKey: ['integration', id],
    queryFn: async () => {
      if (!id || !tenantId) return null;
      
      const { data, error } = await supabase
        .from('integrations')
        .select('*')
        .eq('id', id)
        .eq('organization_id', tenantId)
        .single();
      
      if (error) throw error;
      return parseIntegration(data);
    },
    enabled: !!id && !!tenantId,
  });
}

export function useIntegrationFieldMappings(integrationId: string | undefined) {
  return useQuery({
    queryKey: ['integration-field-mappings', integrationId],
    queryFn: async () => {
      if (!integrationId) return [];
      
      const { data, error } = await supabase
        .from('integration_field_mappings')
        .select('*')
        .eq('integration_id', integrationId)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      return data as IntegrationFieldMapping[];
    },
    enabled: !!integrationId,
  });
}

export function useIntegrationEvents(integrationId: string | undefined) {
  return useQuery({
    queryKey: ['integration-events', integrationId],
    queryFn: async () => {
      if (!integrationId) return [];
      
      const { data, error } = await supabase
        .from('integration_events')
        .select('*')
        .eq('integration_id', integrationId)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      return data as IntegrationEvent[];
    },
    enabled: !!integrationId,
  });
}

export function useIntegrationLogs(integrationId?: string, limit = 50) {
  const { tenantId } = useTenant();
  
  return useQuery({
    queryKey: ['integration-logs', integrationId, tenantId, limit],
    queryFn: async () => {
      if (!tenantId) return [];
      
      let query = supabase
        .from('integration_logs')
        .select('*')
        .eq('organization_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(limit);
      
      if (integrationId) {
        query = query.eq('integration_id', integrationId);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data as IntegrationLog[];
    },
    enabled: !!tenantId,
  });
}

// Hook para buscar estatísticas de logs (total de sucesso/erro por integração)
export function useIntegrationLogStats() {
  const { tenantId } = useTenant();
  
  return useQuery({
    queryKey: ['integration-log-stats', tenantId],
    queryFn: async () => {
      if (!tenantId) return {};
      
      // Busca contagem agrupada por integration_id e status
      const { data, error } = await supabase
        .from('integration_logs')
        .select('integration_id, status')
        .eq('organization_id', tenantId);
      
      if (error) throw error;
      
      // Agrupa os resultados por integration_id
      const stats: Record<string, { success: number; error: number; total: number }> = {};
      
      for (const log of data || []) {
        if (!stats[log.integration_id]) {
          stats[log.integration_id] = { success: 0, error: 0, total: 0 };
        }
        stats[log.integration_id].total++;
        if (log.status === 'success') {
          stats[log.integration_id].success++;
        } else if (log.status === 'error') {
          stats[log.integration_id].error++;
        }
      }
      
      return stats;
    },
    enabled: !!tenantId,
    staleTime: 30000, // Cache por 30 segundos
  });
}

export function useCreateIntegration() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();
  
  return useMutation({
    mutationFn: async (data: Partial<Integration>) => {
      if (!tenantId) throw new Error('Organization not found');
      
      const { data: result, error } = await supabase
        .from('integrations')
        .insert([{
          name: data.name || 'Nova Integração',
          type: data.type || 'webhook_inbound',
          status: data.status || 'inactive',
          description: data.description,
          default_stage: data.default_stage,
          default_responsible_user_ids: data.default_responsible_user_ids,
          default_product_id: data.default_product_id,
          auto_followup_days: data.auto_followup_days,
          non_purchase_reason_id: data.non_purchase_reason_id,
          settings: data.settings || {},
          organization_id: tenantId,
        }])
        .select()
        .single();
      
      if (error) throw error;
      return parseIntegration(result);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
      toast.success('Integração criada com sucesso');
    },
    onError: (error) => {
      console.error('Error creating integration:', error);
      toast.error('Erro ao criar integração');
    },
  });
}

export function useUpdateIntegration() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, trigger_rules, ...data }: Partial<Integration> & { id: string }) => {
      // Convert trigger_rules to JSON-compatible format
      const updateData: any = { ...data };
      if (trigger_rules !== undefined) {
        updateData.trigger_rules = trigger_rules as any;
      }
      
      const { error } = await supabase
        .from('integrations')
        .update(updateData)
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
      queryClient.invalidateQueries({ queryKey: ['integration', variables.id] });
      toast.success('Integração atualizada');
    },
    onError: (error) => {
      console.error('Error updating integration:', error);
      toast.error('Erro ao atualizar integração');
    },
  });
}

export function useDeleteIntegration() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('integrations')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
      toast.success('Integração excluída');
    },
    onError: (error) => {
      console.error('Error deleting integration:', error);
      toast.error('Erro ao excluir integração');
    },
  });
}

export function useSaveFieldMappings() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();
  
  return useMutation({
    mutationFn: async ({ 
      integrationId, 
      mappings 
    }: { 
      integrationId: string; 
      mappings: Array<{ source_field: string; target_field: string; transform_type: string }> 
    }) => {
      if (!tenantId) throw new Error('Organization not found');
      
      // Delete existing mappings
      const { error: deleteError } = await supabase
        .from('integration_field_mappings')
        .delete()
        .eq('integration_id', integrationId)
        .eq('organization_id', tenantId);

      if (deleteError) throw deleteError;
      
      // Insert new mappings
      if (mappings.length > 0) {
        const inserts = mappings.map(m => ({
          integration_id: integrationId,
          organization_id: tenantId,
          source_field: m.source_field,
          target_field: m.target_field,
          transform_type: m.transform_type,
        }));
        
        const { error } = await supabase
          .from('integration_field_mappings')
          .insert(inserts);
        
        if (error) throw error;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['integration-field-mappings', variables.integrationId] });
      toast.success('Mapeamentos salvos');
    },
    onError: (error) => {
      console.error('Error saving mappings:', error);
      toast.error('Erro ao salvar mapeamentos', {
        description: getErrorMessage(error),
      });
    },
  });
}

export function useSaveIntegrationEvent() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();
  
  return useMutation({
    mutationFn: async (event: Partial<IntegrationEvent> & { integration_id: string }) => {
      if (!tenantId) throw new Error('Organization not found');
      
      if (event.id) {
        const { error } = await supabase
          .from('integration_events')
          .update({
            event_type: event.event_type,
            url: event.url,
            method: event.method,
            headers: event.headers,
            is_active: event.is_active,
          })
          .eq('id', event.id);
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('integration_events')
          .insert([{
            integration_id: event.integration_id,
            event_type: event.event_type || 'lead_created',
            url: event.url || '',
            method: event.method || 'POST',
            headers: event.headers || {},
            is_active: event.is_active ?? true,
            organization_id: tenantId,
          }]);
        
        if (error) throw error;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['integration-events', variables.integration_id] });
      toast.success('Evento salvo');
    },
    onError: (error) => {
      console.error('Error saving event:', error);
      toast.error('Erro ao salvar evento');
    },
  });
}

export function useDeleteIntegrationEvent() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, integrationId }: { id: string; integrationId: string }) => {
      const { error } = await supabase
        .from('integration_events')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      return integrationId;
    },
    onSuccess: (integrationId) => {
      queryClient.invalidateQueries({ queryKey: ['integration-events', integrationId] });
      toast.success('Evento excluído');
    },
    onError: (error) => {
      console.error('Error deleting event:', error);
      toast.error('Erro ao excluir evento');
    },
  });
}

export function getWebhookUrl(token: string) {
  // URL direta do Supabase para máxima confiabilidade
  return `https://rriizlxqfpfpdflgxjtj.supabase.co/functions/v1/integration-webhook?token=${token}`;
}
