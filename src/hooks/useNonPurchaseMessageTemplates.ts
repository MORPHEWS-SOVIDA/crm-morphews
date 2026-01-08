import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface NonPurchaseMessageTemplate {
  id: string;
  organization_id: string;
  non_purchase_reason_id: string;
  whatsapp_instance_id: string | null;
  delay_minutes: number;
  message_template: string;
  send_start_hour: number | null;
  send_end_hour: number | null;
  position: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface MessageTemplateFormData {
  non_purchase_reason_id: string;
  whatsapp_instance_id?: string | null;
  delay_minutes: number;
  message_template: string;
  send_start_hour?: number | null;
  send_end_hour?: number | null;
  position?: number;
  is_active?: boolean;
}

export function useNonPurchaseMessageTemplates(reasonId?: string) {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['non-purchase-message-templates', reasonId, profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return [];

      let query = supabase
        .from('non_purchase_message_templates')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .eq('is_active', true)
        .order('position');

      if (reasonId) {
        query = query.eq('non_purchase_reason_id', reasonId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as NonPurchaseMessageTemplate[];
    },
    enabled: !!profile?.organization_id,
  });
}

export function useCreateMessageTemplate() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async (data: MessageTemplateFormData) => {
      if (!profile?.organization_id) throw new Error('Organização não encontrada');

      const { data: template, error } = await supabase
        .from('non_purchase_message_templates')
        .insert({
          ...data,
          organization_id: profile.organization_id,
        })
        .select()
        .single();

      if (error) throw error;
      return template;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['non-purchase-message-templates'] });
      toast.success('Template de mensagem criado!');
    },
    onError: (error: Error) => {
      console.error('Erro ao criar template:', error);
      toast.error('Erro ao criar template de mensagem');
    },
  });
}

export function useUpdateMessageTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<MessageTemplateFormData> }) => {
      const { data: template, error } = await supabase
        .from('non_purchase_message_templates')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return template;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['non-purchase-message-templates'] });
      toast.success('Template atualizado!');
    },
    onError: (error: Error) => {
      console.error('Erro ao atualizar template:', error);
      toast.error('Erro ao atualizar template');
    },
  });
}

export function useDeleteMessageTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('non_purchase_message_templates')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['non-purchase-message-templates'] });
      toast.success('Template removido!');
    },
    onError: (error: Error) => {
      console.error('Erro ao remover template:', error);
      toast.error('Erro ao remover template');
    },
  });
}

export function useReorderMessageTemplates() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (templates: { id: string; position: number }[]) => {
      const updates = templates.map(({ id, position }) =>
        supabase
          .from('non_purchase_message_templates')
          .update({ position })
          .eq('id', id)
      );

      await Promise.all(updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['non-purchase-message-templates'] });
    },
    onError: (error: Error) => {
      console.error('Erro ao reordenar templates:', error);
      toast.error('Erro ao reordenar templates');
    },
  });
}
