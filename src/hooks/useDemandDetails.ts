import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import type { 
  DemandComment, 
  DemandAttachment, 
  DemandChecklistItem, 
  DemandTimeEntry,
  DemandHistory,
  DemandLabel,
  DemandSlaConfig
} from '@/types/demand';

type UserProfile = { id: string; user_id: string; first_name: string | null; last_name: string | null; avatar_url: string | null };

// ============================================================================
// COMMENTS
// ============================================================================

export function useDemandComments(demandId: string | null) {
  return useQuery({
    queryKey: ['demand-comments', demandId],
    queryFn: async () => {
      if (!demandId) return [];

      const { data, error } = await supabase
        .from('demand_comments')
        .select('*')
        .eq('demand_id', demandId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      if (!data.length) return [];

      const userIds = [...new Set(data.map(c => c.user_id))];
      const { data: users } = await supabase
        .from('profiles')
        .select('id, user_id, first_name, last_name, avatar_url')
        .in('user_id', userIds);

      const userMap = new Map<string, UserProfile>((users || []).map(u => [u.user_id, u]));

      return data.map(comment => ({
        ...comment,
        user: userMap.get(comment.user_id) || null,
      }));
    },
    enabled: !!demandId,
  });
}

export function useAddDemandComment() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ demandId, content }: { demandId: string; content: string }) => {
      if (!profile?.organization_id || !profile?.user_id) {
        throw new Error('Usuário não autenticado');
      }

      const { data, error } = await supabase
        .from('demand_comments')
        .insert({
          demand_id: demandId,
          user_id: profile.user_id,
          organization_id: profile.organization_id,
          content,
        })
        .select()
        .single();

      if (error) throw error;
      return data as DemandComment;
    },
    onSuccess: (_, { demandId }) => {
      queryClient.invalidateQueries({ queryKey: ['demand-comments', demandId] });
    },
    onError: (error) => {
      toast({ title: 'Erro ao adicionar comentário', description: error.message, variant: 'destructive' });
    },
  });
}

export function useDeleteDemandComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, demandId }: { id: string; demandId: string }) => {
      const { error } = await supabase
        .from('demand_comments')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return demandId;
    },
    onSuccess: (demandId) => {
      queryClient.invalidateQueries({ queryKey: ['demand-comments', demandId] });
    },
  });
}

// ============================================================================
// ATTACHMENTS
// ============================================================================

export function useDemandAttachments(demandId: string | null) {
  return useQuery({
    queryKey: ['demand-attachments', demandId],
    queryFn: async () => {
      if (!demandId) return [];

      const { data, error } = await supabase
        .from('demand_attachments')
        .select('*')
        .eq('demand_id', demandId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (!data.length) return [];

      const userIds = [...new Set(data.map(a => a.user_id))];
      const { data: users } = await supabase
        .from('profiles')
        .select('id, user_id, first_name, last_name')
        .in('user_id', userIds);

      const userMap = new Map<string, { id: string; first_name: string | null; last_name: string | null }>((users || []).map(u => [u.user_id, u]));

      return data.map(attachment => ({
        ...attachment,
        user: userMap.get(attachment.user_id) || null,
      }));
    },
    enabled: !!demandId,
  });
}

export function useUploadDemandAttachment() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ demandId, file }: { demandId: string; file: File }) => {
      if (!profile?.organization_id || !profile?.user_id) {
        throw new Error('Usuário não autenticado');
      }

      const fileExt = file.name.split('.').pop();
      const filePath = `${profile.organization_id}/${demandId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('demand-attachments')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data, error } = await supabase
        .from('demand_attachments')
        .insert({
          demand_id: demandId,
          user_id: profile.user_id,
          organization_id: profile.organization_id,
          file_name: file.name,
          file_path: filePath,
          file_type: file.type,
          file_size: file.size,
        })
        .select()
        .single();

      if (error) throw error;
      return data as DemandAttachment;
    },
    onSuccess: (_, { demandId }) => {
      queryClient.invalidateQueries({ queryKey: ['demand-attachments', demandId] });
      toast({ title: 'Arquivo anexado!' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao anexar arquivo', description: error.message, variant: 'destructive' });
    },
  });
}

export function useDeleteDemandAttachment() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, filePath, demandId }: { id: string; filePath: string; demandId: string }) => {
      const { error: storageError } = await supabase.storage
        .from('demand-attachments')
        .remove([filePath]);

      if (storageError) console.error('Storage delete error:', storageError);

      const { error } = await supabase
        .from('demand_attachments')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return demandId;
    },
    onSuccess: (demandId) => {
      queryClient.invalidateQueries({ queryKey: ['demand-attachments', demandId] });
      toast({ title: 'Arquivo removido!' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao remover arquivo', description: error.message, variant: 'destructive' });
    },
  });
}

// ============================================================================
// CHECKLIST
// ============================================================================

export function useDemandChecklist(demandId: string | null) {
  return useQuery({
    queryKey: ['demand-checklist', demandId],
    queryFn: async () => {
      if (!demandId) return [];

      const { data, error } = await supabase
        .from('demand_checklist_items')
        .select('*')
        .eq('demand_id', demandId)
        .order('position', { ascending: true });

      if (error) throw error;
      return data as DemandChecklistItem[];
    },
    enabled: !!demandId,
  });
}

export function useAddChecklistItem() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ demandId, title }: { demandId: string; title: string }) => {
      if (!profile?.organization_id) {
        throw new Error('Usuário não autenticado');
      }

      const { data: existing } = await supabase
        .from('demand_checklist_items')
        .select('position')
        .eq('demand_id', demandId)
        .order('position', { ascending: false })
        .limit(1);

      const position = existing?.[0]?.position ? existing[0].position + 1 : 0;

      const { data, error } = await supabase
        .from('demand_checklist_items')
        .insert({
          demand_id: demandId,
          organization_id: profile.organization_id,
          title,
          position,
        })
        .select()
        .single();

      if (error) throw error;
      return data as DemandChecklistItem;
    },
    onSuccess: (_, { demandId }) => {
      queryClient.invalidateQueries({ queryKey: ['demand-checklist', demandId] });
    },
  });
}

export function useToggleChecklistItem() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, demandId, isCompleted }: { id: string; demandId: string; isCompleted: boolean }) => {
      const { data, error } = await supabase
        .from('demand_checklist_items')
        .update({
          is_completed: isCompleted,
          completed_by: isCompleted ? profile?.user_id : null,
          completed_at: isCompleted ? new Date().toISOString() : null,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return { data, demandId };
    },
    onSuccess: ({ demandId }) => {
      queryClient.invalidateQueries({ queryKey: ['demand-checklist', demandId] });
    },
  });
}

export function useDeleteChecklistItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, demandId }: { id: string; demandId: string }) => {
      const { error } = await supabase
        .from('demand_checklist_items')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return demandId;
    },
    onSuccess: (demandId) => {
      queryClient.invalidateQueries({ queryKey: ['demand-checklist', demandId] });
    },
  });
}

// ============================================================================
// TIME ENTRIES
// ============================================================================

export function useDemandTimeEntries(demandId: string | null) {
  return useQuery({
    queryKey: ['demand-time-entries', demandId],
    queryFn: async () => {
      if (!demandId) return [];

      const { data, error } = await supabase
        .from('demand_time_entries')
        .select('*')
        .eq('demand_id', demandId)
        .order('started_at', { ascending: false });

      if (error) throw error;
      if (!data.length) return [];

      const userIds = [...new Set(data.map(e => e.user_id))];
      const { data: users } = await supabase
        .from('profiles')
        .select('id, user_id, first_name, last_name, avatar_url')
        .in('user_id', userIds);

      const userMap = new Map<string, UserProfile>((users || []).map(u => [u.user_id, u]));

      return data.map(entry => ({
        ...entry,
        user: userMap.get(entry.user_id) || null,
      }));
    },
    enabled: !!demandId,
  });
}

export function useActiveTimeEntry(demandId: string | null) {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['active-time-entry', demandId, profile?.user_id],
    queryFn: async () => {
      if (!demandId || !profile?.user_id) return null;

      const { data, error } = await supabase
        .from('demand_time_entries')
        .select('*')
        .eq('demand_id', demandId)
        .eq('user_id', profile.user_id)
        .is('ended_at', null)
        .maybeSingle();

      if (error) throw error;
      return data as DemandTimeEntry | null;
    },
    enabled: !!demandId && !!profile?.user_id,
  });
}

export function useStartTimeEntry() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (demandId: string) => {
      if (!profile?.organization_id || !profile?.user_id) {
        throw new Error('Usuário não autenticado');
      }

      const { data, error } = await supabase
        .from('demand_time_entries')
        .insert({
          demand_id: demandId,
          user_id: profile.user_id,
          organization_id: profile.organization_id,
        })
        .select()
        .single();

      if (error) throw error;
      return data as DemandTimeEntry;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['demand-time-entries', data.demand_id] });
      queryClient.invalidateQueries({ queryKey: ['active-time-entry', data.demand_id] });
    },
  });
}

export function useStopTimeEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, demandId, notes }: { id: string; demandId: string; notes?: string }) => {
      const { data, error } = await supabase
        .from('demand_time_entries')
        .update({
          ended_at: new Date().toISOString(),
          notes: notes || null,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return { data, demandId };
    },
    onSuccess: ({ demandId }) => {
      queryClient.invalidateQueries({ queryKey: ['demand-time-entries', demandId] });
      queryClient.invalidateQueries({ queryKey: ['active-time-entry', demandId] });
      queryClient.invalidateQueries({ queryKey: ['demand', demandId] });
    },
  });
}

// ============================================================================
// HISTORY
// ============================================================================

export function useDemandHistory(demandId: string | null) {
  return useQuery({
    queryKey: ['demand-history', demandId],
    queryFn: async () => {
      if (!demandId) return [];

      const { data, error } = await supabase
        .from('demand_history')
        .select('*')
        .eq('demand_id', demandId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const userIds = [...new Set(data.filter(h => h.user_id).map(h => h.user_id!))];
      const { data: users } = userIds.length > 0 
        ? await supabase.from('profiles').select('id, user_id, first_name, last_name, avatar_url').in('user_id', userIds)
        : { data: [] };

      const userMap = new Map<string, UserProfile>((users || []).map(u => [u.user_id, u]));

      return data.map(history => ({
        ...history,
        user: history.user_id ? userMap.get(history.user_id) || null : null,
      }));
    },
    enabled: !!demandId,
  });
}

// ============================================================================
// LABELS
// ============================================================================

export function useDemandLabels() {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['demand-labels', profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return [];

      const { data, error } = await supabase
        .from('demand_labels')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .order('name', { ascending: true });

      if (error) throw error;
      return data as DemandLabel[];
    },
    enabled: !!profile?.organization_id,
  });
}

export function useCreateDemandLabel() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ name, color }: { name: string; color: string }) => {
      if (!profile?.organization_id) {
        throw new Error('Usuário não autenticado');
      }

      const { data, error } = await supabase
        .from('demand_labels')
        .insert({
          organization_id: profile.organization_id,
          name,
          color,
        })
        .select()
        .single();

      if (error) throw error;
      return data as DemandLabel;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['demand-labels'] });
    },
  });
}

export function useAssignDemandLabel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ demandId, labelId }: { demandId: string; labelId: string }) => {
      const { data, error } = await supabase
        .from('demand_label_assignments')
        .insert({
          demand_id: demandId,
          label_id: labelId,
        })
        .select()
        .single();

      if (error) throw error;
      return { data, demandId };
    },
    onSuccess: ({ demandId }) => {
      queryClient.invalidateQueries({ queryKey: ['demand', demandId] });
      queryClient.invalidateQueries({ queryKey: ['demands'] });
    },
  });
}

export function useRemoveDemandLabel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ demandId, labelId }: { demandId: string; labelId: string }) => {
      const { error } = await supabase
        .from('demand_label_assignments')
        .delete()
        .eq('demand_id', demandId)
        .eq('label_id', labelId);

      if (error) throw error;
      return demandId;
    },
    onSuccess: (demandId) => {
      queryClient.invalidateQueries({ queryKey: ['demand', demandId] });
      queryClient.invalidateQueries({ queryKey: ['demands'] });
    },
  });
}

// ============================================================================
// SLA CONFIG
// ============================================================================

export function useDemandSlaConfig() {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['demand-sla-config', profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return [];

      const { data, error } = await supabase
        .from('demand_sla_config')
        .select('*')
        .eq('organization_id', profile.organization_id);

      if (error) throw error;
      return data as DemandSlaConfig[];
    },
    enabled: !!profile?.organization_id,
  });
}

export function useUpdateSlaConfig() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ urgency, hours }: { urgency: string; hours: number }) => {
      if (!profile?.organization_id) {
        throw new Error('Usuário não autenticado');
      }

      const { data, error } = await supabase
        .from('demand_sla_config')
        .upsert({
          organization_id: profile.organization_id,
          urgency,
          hours,
        }, {
          onConflict: 'organization_id,urgency',
        })
        .select()
        .single();

      if (error) throw error;
      return data as DemandSlaConfig;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['demand-sla-config'] });
      toast({ title: 'Configuração de SLA atualizada!' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao atualizar SLA', description: error.message, variant: 'destructive' });
    },
  });
}
