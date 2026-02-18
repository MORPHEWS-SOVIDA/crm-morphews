import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface Voip3cActionLog {
  id: string;
  organization_id: string;
  validation_id: string;
  user_id: string;
  lead_id: string | null;
  lead_name: string | null;
  lead_phone: string | null;
  action_type: string;
  action_details: Record<string, any> | null;
  created_at: string;
  // joined
  user_name?: string;
}

const ACTION_TYPE_LABELS: Record<string, string> = {
  whatsapp_sent: 'Enviou WhatsApp',
  stage_changed: 'Mudou etapa',
  assigned_seller: 'Atribuiu vendedor',
  followup_created: 'Criou follow-up',
};

export function getActionLabel(type: string) {
  return ACTION_TYPE_LABELS[type] || type;
}

export function useVoip3cActionLogs(validationId: string | null) {
  return useQuery({
    queryKey: ['voip-3c-action-logs', validationId],
    queryFn: async () => {
      if (!validationId) return [];

      const { data, error } = await supabase
        .from('voip_3c_action_logs')
        .select('*')
        .eq('validation_id', validationId)
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) throw error;

      // Fetch user names
      const userIds = [...new Set((data || []).map(d => d.user_id))];
      const { data: users } = userIds.length > 0
        ? await supabase.from('profiles').select('user_id, first_name, last_name').in('user_id', userIds)
        : { data: [] };
      const userMap = new Map((users || []).map(u => [u.user_id, `${u.first_name || ''} ${u.last_name || ''}`.trim()]));

      return (data || []).map(item => ({
        ...item,
        action_details: item.action_details as Record<string, any> | null,
        user_name: userMap.get(item.user_id) || 'Desconhecido',
      })) as Voip3cActionLog[];
    },
    enabled: !!validationId,
  });
}

export function useLogVoip3cAction() {
  const queryClient = useQueryClient();
  const { profile, user } = useAuth();

  return useMutation({
    mutationFn: async (params: {
      validation_id: string;
      lead_id?: string | null;
      lead_name?: string | null;
      lead_phone?: string | null;
      action_type: string;
      action_details?: Record<string, any> | null;
    }) => {
      if (!profile?.organization_id || !user?.id) return;

      const { error } = await supabase
        .from('voip_3c_action_logs')
        .insert({
          organization_id: profile.organization_id,
          validation_id: params.validation_id,
          user_id: user.id,
          lead_id: params.lead_id || null,
          lead_name: params.lead_name || null,
          lead_phone: params.lead_phone || null,
          action_type: params.action_type,
          action_details: params.action_details || null,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['voip-3c-action-logs'] });
    },
  });
}
