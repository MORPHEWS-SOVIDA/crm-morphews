import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { toast } from 'sonner';

export interface CustomFieldDefinition {
  id: string;
  organization_id: string;
  field_name: string;
  field_label: string;
  field_type: 'text' | 'number' | 'date' | 'boolean';
  is_required: boolean;
  position: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CustomFieldValue {
  id: string;
  lead_id: string;
  field_definition_id: string;
  organization_id: string;
  value: string | null;
  created_at: string;
  updated_at: string;
}

// Hook para buscar definições de campos personalizados
export function useCustomFieldDefinitions() {
  const { tenantId } = useTenant();
  
  return useQuery({
    queryKey: ['custom-field-definitions', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      
      const { data, error } = await supabase
        .from('lead_custom_field_definitions')
        .select('*')
        .eq('organization_id', tenantId)
        .eq('is_active', true)
        .order('position', { ascending: true });
      
      if (error) throw error;
      return data as CustomFieldDefinition[];
    },
    enabled: !!tenantId,
  });
}

// Hook para criar campo personalizado
export function useCreateCustomField() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();
  
  return useMutation({
    mutationFn: async (data: {
      field_name: string;
      field_label: string;
      field_type?: 'text' | 'number' | 'date' | 'boolean';
      is_required?: boolean;
    }) => {
      if (!tenantId) throw new Error('Organização não encontrada');
      
      // Check count first
      const { count } = await supabase
        .from('lead_custom_field_definitions')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', tenantId)
        .eq('is_active', true);
      
      if ((count || 0) >= 10) {
        throw new Error('Limite de 10 campos personalizados atingido');
      }
      
      // Get next position
      const { data: lastField } = await supabase
        .from('lead_custom_field_definitions')
        .select('position')
        .eq('organization_id', tenantId)
        .order('position', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      const nextPosition = (lastField?.position || 0) + 1;
      
      const { data: result, error } = await supabase
        .from('lead_custom_field_definitions')
        .insert({
          organization_id: tenantId,
          field_name: data.field_name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''),
          field_label: data.field_label,
          field_type: data.field_type || 'text',
          is_required: data.is_required || false,
          position: nextPosition,
        })
        .select()
        .single();
      
      if (error) throw error;
      return result as CustomFieldDefinition;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-field-definitions'] });
      toast.success('Campo personalizado criado!');
    },
    onError: (error: Error) => {
      console.error('Error creating custom field:', error);
      toast.error(error.message || 'Erro ao criar campo');
    },
  });
}

// Hook para atualizar campo personalizado
export function useUpdateCustomField() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<CustomFieldDefinition> & { id: string }) => {
      const { error } = await supabase
        .from('lead_custom_field_definitions')
        .update(data)
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-field-definitions'] });
      toast.success('Campo atualizado!');
    },
    onError: (error) => {
      console.error('Error updating custom field:', error);
      toast.error('Erro ao atualizar campo');
    },
  });
}

// Hook para deletar (desativar) campo personalizado
export function useDeleteCustomField() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('lead_custom_field_definitions')
        .update({ is_active: false })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-field-definitions'] });
      toast.success('Campo removido!');
    },
    onError: (error) => {
      console.error('Error deleting custom field:', error);
      toast.error('Erro ao remover campo');
    },
  });
}

// Hook para buscar valores de campos personalizados de um lead
export function useLeadCustomFieldValues(leadId: string | undefined) {
  return useQuery({
    queryKey: ['lead-custom-field-values', leadId],
    queryFn: async () => {
      if (!leadId) return [];
      
      const { data, error } = await supabase
        .from('lead_custom_field_values')
        .select(`
          *,
          field_definition:lead_custom_field_definitions(*)
        `)
        .eq('lead_id', leadId);
      
      if (error) throw error;
      return data as (CustomFieldValue & { field_definition: CustomFieldDefinition })[];
    },
    enabled: !!leadId,
  });
}

// Hook para salvar valor de campo personalizado
export function useSaveCustomFieldValue() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();
  
  return useMutation({
    mutationFn: async ({
      leadId,
      fieldDefinitionId,
      value,
    }: {
      leadId: string;
      fieldDefinitionId: string;
      value: string | null;
    }) => {
      if (!tenantId) throw new Error('Organização não encontrada');
      
      // Upsert - update if exists, insert if not
      const { data: existing } = await supabase
        .from('lead_custom_field_values')
        .select('id')
        .eq('lead_id', leadId)
        .eq('field_definition_id', fieldDefinitionId)
        .maybeSingle();
      
      if (existing) {
        const { error } = await supabase
          .from('lead_custom_field_values')
          .update({ value, updated_at: new Date().toISOString() })
          .eq('id', existing.id);
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('lead_custom_field_values')
          .insert({
            lead_id: leadId,
            field_definition_id: fieldDefinitionId,
            organization_id: tenantId,
            value,
          });
        
        if (error) throw error;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['lead-custom-field-values', variables.leadId] });
    },
    onError: (error) => {
      console.error('Error saving custom field value:', error);
      toast.error('Erro ao salvar valor');
    },
  });
}
