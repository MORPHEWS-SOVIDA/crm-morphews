import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from './useTenant';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface ScheduledMessage {
  id: string;
  organization_id: string;
  lead_id: string;
  template_id: string | null;
  whatsapp_instance_id: string | null;
  fallback_instance_ids: string[] | null;
  attempt_count: number;
  current_instance_index: number;
  max_attempts: number;
  last_attempt_at: string | null;
  scheduled_at: string;
  original_scheduled_at: string;
  sent_at: string | null;
  cancelled_at: string | null;
  deleted_at: string | null;
  final_message: string;
  status: 'pending' | 'sent' | 'cancelled' | 'deleted' | 'failed_offline' | 'failed_other';
  failure_reason: string | null;
  cancel_reason: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Media fields
  media_type: 'image' | 'audio' | 'document' | null;
  media_url: string | null;
  media_filename: string | null;
  // Joined data
  lead?: {
    id: string;
    name: string;
    whatsapp: string;
  };
  whatsapp_instance?: {
    id: string;
    name: string;
  };
  template?: {
    id: string;
    non_purchase_reason?: {
      id: string;
      name: string;
    };
  };
}

export function useScheduledMessages(filters?: {
  status?: string;
  onlyMine?: boolean;
  createdBy?: string;
  scheduledFrom?: string;
  scheduledTo?: string;
  createdFrom?: string;
  createdTo?: string;
}) {
  const { tenantId } = useTenant();
  const { user } = useAuth();

  return useQuery({
    queryKey: ['scheduled-messages', tenantId, filters],
    queryFn: async () => {
      if (!tenantId) return [];

      let query = supabase
        .from('lead_scheduled_messages')
        .select(`
          *,
          lead:leads!lead_scheduled_messages_lead_id_fkey(id, name, whatsapp),
          whatsapp_instance:whatsapp_instances!lead_scheduled_messages_whatsapp_instance_id_fkey(id, name),
          template:non_purchase_message_templates!lead_scheduled_messages_template_id_fkey(
            id,
            non_purchase_reason:non_purchase_reasons!non_purchase_message_templates_non_purchase_reason_id_fkey(id, name)
          )
        `)
        .eq('organization_id', tenantId)
        .is('deleted_at', null)
        .order('scheduled_at', { ascending: false });

      // Filter by status
      if (filters?.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }

      // Filter by user (only show messages created by current user)
      if (filters?.onlyMine && user?.id) {
        query = query.eq('created_by', user.id);
      }

      // Filter by specific creator
      if (filters?.createdBy) {
        query = query.eq('created_by', filters.createdBy);
      }

      // Filter by scheduled date range
      if (filters?.scheduledFrom) {
        query = query.gte('scheduled_at', filters.scheduledFrom);
      }
      if (filters?.scheduledTo) {
        query = query.lte('scheduled_at', filters.scheduledTo);
      }

      // Filter by created date range
      if (filters?.createdFrom) {
        query = query.gte('created_at', filters.createdFrom);
      }
      if (filters?.createdTo) {
        query = query.lte('created_at', filters.createdTo);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching scheduled messages:', error);
        throw error;
      }

      return (data || []) as unknown as ScheduledMessage[];
    },
    enabled: !!tenantId,
  });
}

export function useCancelScheduledMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      const { error } = await supabase
        .from('lead_scheduled_messages')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          cancel_reason: reason || 'Cancelado pelo usuário',
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('status', 'pending'); // Only cancel pending messages

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-messages'] });
      toast.success('Mensagem cancelada com sucesso');
    },
    onError: (error: Error) => {
      console.error('Error cancelling message:', error);
      toast.error('Erro ao cancelar mensagem');
    },
  });
}

export function useRescheduleMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, newScheduledAt }: { id: string; newScheduledAt: Date }) => {
      const { error } = await supabase
        .from('lead_scheduled_messages')
        .update({
          scheduled_at: newScheduledAt.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('status', 'pending');

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-messages'] });
      toast.success('Mensagem reagendada com sucesso');
    },
    onError: (error: Error) => {
      console.error('Error rescheduling message:', error);
      toast.error('Erro ao reagendar mensagem');
    },
  });
}

export function useRetryFailedMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, newInstanceId }: { id: string; newInstanceId?: string }) => {
      // Reset to pending with a new scheduled time (now + 1 minute)
      const newScheduledAt = new Date();
      newScheduledAt.setMinutes(newScheduledAt.getMinutes() + 1);

      const updates: Record<string, unknown> = {
        status: 'pending',
        scheduled_at: newScheduledAt.toISOString(),
        failure_reason: null,
        attempt_count: 0,
        current_instance_index: 0,
        updated_at: new Date().toISOString(),
      };

      // If a new instance was specified, update it
      if (newInstanceId) {
        updates.whatsapp_instance_id = newInstanceId;
      }

      const { error } = await supabase
        .from('lead_scheduled_messages')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-messages'] });
      toast.success('Mensagem reagendada para nova tentativa');
    },
    onError: (error: Error) => {
      console.error('Error retrying message:', error);
      toast.error('Erro ao reagendar mensagem');
    },
  });
}

export function useRetryFailedMessagesBulk() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ ids, newInstanceId }: { ids: string[]; newInstanceId?: string }) => {
      const newScheduledAt = new Date();
      newScheduledAt.setMinutes(newScheduledAt.getMinutes() + 1);

      const updates: Record<string, unknown> = {
        status: 'pending',
        scheduled_at: newScheduledAt.toISOString(),
        failure_reason: null,
        attempt_count: 0,
        current_instance_index: 0,
        updated_at: new Date().toISOString(),
      };

      if (newInstanceId) {
        updates.whatsapp_instance_id = newInstanceId;
      }

      const { error } = await supabase
        .from('lead_scheduled_messages')
        .update(updates)
        .in('id', ids);

      if (error) throw error;
      return { count: ids.length };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-messages'] });
      toast.success(`${data.count} mensagens reagendadas`);
    },
    onError: (error: Error) => {
      console.error('Error retrying messages:', error);
      toast.error('Erro ao reagendar mensagens');
    },
  });
}

export function useChangeMessageInstance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ ids, newInstanceId }: { ids: string[]; newInstanceId: string }) => {
      const { error } = await supabase
        .from('lead_scheduled_messages')
        .update({
          whatsapp_instance_id: newInstanceId,
          updated_at: new Date().toISOString(),
        })
        .in('id', ids);

      if (error) throw error;
      return { count: ids.length };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-messages'] });
      toast.success(`${data.count} mensagens atualizadas`);
    },
    onError: (error: Error) => {
      console.error('Error changing instance:', error);
      toast.error('Erro ao trocar instância');
    },
  });
}

export function useUpdateScheduledMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      final_message,
      scheduled_at,
    }: {
      id: string;
      final_message?: string;
      scheduled_at?: string;
    }) => {
      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (final_message !== undefined) updates.final_message = final_message;
      if (scheduled_at !== undefined) updates.scheduled_at = scheduled_at;

      const { error } = await supabase
        .from('lead_scheduled_messages')
        .update(updates)
        .eq('id', id)
        .eq('status', 'pending');

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-messages'] });
      toast.success('Mensagem atualizada com sucesso');
    },
    onError: (error: Error) => {
      console.error('Error updating message:', error);
      toast.error('Erro ao atualizar mensagem');
    },
  });
}

export function useCreateScheduledMessage() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      lead_id,
      final_message,
      scheduled_at,
      whatsapp_instance_id,
      media_type,
      media_url,
      media_filename,
    }: {
      lead_id: string;
      final_message: string;
      scheduled_at: string;
      whatsapp_instance_id?: string;
      media_type?: 'image' | 'audio' | 'document' | null;
      media_url?: string | null;
      media_filename?: string | null;
    }) => {
      if (!tenantId) throw new Error('Organização não encontrada');

      const { data, error } = await supabase
        .from('lead_scheduled_messages')
        .insert({
          organization_id: tenantId,
          lead_id,
          final_message,
          scheduled_at,
          original_scheduled_at: scheduled_at,
          whatsapp_instance_id: whatsapp_instance_id || null,
          template_id: null,
          status: 'pending',
          created_by: user?.id || null,
          media_type: media_type || null,
          media_url: media_url || null,
          media_filename: media_filename || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-messages'] });
      toast.success('Mensagem agendada com sucesso');
    },
    onError: (error: Error) => {
      console.error('Error creating scheduled message:', error);
      toast.error('Erro ao agendar mensagem');
    },
  });
}
