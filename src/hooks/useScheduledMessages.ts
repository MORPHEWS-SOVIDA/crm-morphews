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
        .order('scheduled_at', { ascending: true });

      // Filter by status
      if (filters?.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }

      // Filter by user (only show messages created by current user)
      if (filters?.onlyMine && user?.id) {
        query = query.eq('created_by', user.id);
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
    mutationFn: async (id: string) => {
      // Reset to pending with a new scheduled time (now + 1 minute)
      const newScheduledAt = new Date();
      newScheduledAt.setMinutes(newScheduledAt.getMinutes() + 1);

      const { error } = await supabase
        .from('lead_scheduled_messages')
        .update({
          status: 'pending',
          scheduled_at: newScheduledAt.toISOString(),
          failure_reason: null,
          updated_at: new Date().toISOString(),
        })
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
