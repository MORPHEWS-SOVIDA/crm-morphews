import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { notifyDemandAssignment, notifyDemandStatusChange } from '@/lib/demand-notifications';
import type {
  Demand,
  DemandWithRelations,
  CreateDemandInput,
  UpdateDemandInput,
  DemandUrgency
} from '@/types/demand';
import type { DemandsFilters } from '@/types/demands-filters';

type UserProfile = { id: string; user_id: string; first_name: string | null; last_name: string | null; avatar_url: string | null };

// ============================================================================
// DEMANDS QUERIES
// ============================================================================

export function useDemands(boardId: string | null, filters?: DemandsFilters) {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['demands', boardId, filters],
    queryFn: async () => {
      if (!boardId || !profile?.organization_id) return [];

      let query = supabase
        .from('demands')
        .select(`
          *,
          lead:leads(id, name),
          assignees:demand_assignees(id, user_id, role),
          labels:demand_label_assignments(
            label:demand_labels(id, name, color)
          )
        `)
        .eq('board_id', boardId)
        .eq('organization_id', profile.organization_id)
        .order('position', { ascending: true });

      if (filters?.archived !== undefined) {
        query = query.eq('is_archived', filters.archived);
      } else {
        query = query.eq('is_archived', false);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Fetch user data for assignees
      const allUserIds = (data || []).flatMap(d =>
        (d.assignees as { user_id: string }[] | null)?.map(a => a.user_id) || []
      );
      const uniqueUserIds = [...new Set(allUserIds)];

      let userMap = new Map<string, UserProfile>();
      if (uniqueUserIds.length > 0) {
        const { data: users } = await supabase
          .from('profiles')
          .select('id, user_id, first_name, last_name, avatar_url')
          .in('user_id', uniqueUserIds);
        userMap = new Map((users || []).map(u => [u.user_id, u]));
      }

      // Transform data
      let demands: DemandWithRelations[] = (data || []).map(d => ({
        ...d,
        urgency: d.urgency as DemandUrgency,
        labels: (d.labels as { label: { id: string; name: string; color: string } | null }[] | null)
          ?.map(l => l.label)
          .filter((l): l is { id: string; name: string; color: string } => l !== null) || [],
        assignees: (d.assignees as { id: string; user_id: string; role: string }[] | null)
          ?.map(a => ({
            id: a.id,
            user_id: a.user_id,
            role: a.role,
            user: userMap.get(a.user_id) || null,
          })) || [],
      }));

      // Client-side filters (keeps the query simple and supports mixed filters)
      if (filters?.assigneeId) {
        demands = demands.filter(d => d.assignees?.some(a => a.user_id === filters.assigneeId));
      }

      if (filters?.leadId) {
        demands = demands.filter(d => d.lead_id === filters.leadId);
      }

      if (filters?.urgency) {
        demands = demands.filter(d => d.urgency === filters.urgency);
      }

      if (filters?.createdFrom) {
        const from = new Date(`${filters.createdFrom}T00:00:00`);
        demands = demands.filter(d => new Date(d.created_at) >= from);
      }

      if (filters?.createdTo) {
        const to = new Date(`${filters.createdTo}T23:59:59.999`);
        demands = demands.filter(d => new Date(d.created_at) <= to);
      }

      if (filters?.labelIds && filters.labelIds.length > 0) {
        demands = demands.filter(d => {
          const ids = new Set((d.labels || []).map(l => l.id));
          return filters.labelIds!.every(id => ids.has(id));
        });
      }

      return demands;
    },
    enabled: !!boardId && !!profile?.organization_id,
  });
}

export function useDemandsByColumn(boardId: string | null, filters?: Omit<DemandsFilters, 'archived'>) {
  const { data: demands, ...rest } = useDemands(boardId, { ...(filters || {}), archived: false });

  const demandsByColumn = (demands || []).reduce<Record<string, DemandWithRelations[]>>((acc, demand) => {
    if (!acc[demand.column_id]) {
      acc[demand.column_id] = [];
    }
    acc[demand.column_id].push(demand);
    return acc;
  }, {});

  return { data: demandsByColumn, ...rest };
}

export function useDemand(demandId: string | null) {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['demand', demandId],
    queryFn: async () => {
      if (!demandId || !profile?.organization_id) return null;

      const { data, error } = await supabase
        .from('demands')
        .select(`
          *,
          board:demand_boards(id, name, color),
          column:demand_columns(id, name, color, is_final),
          lead:leads(id, name, whatsapp),
          assignees:demand_assignees(id, user_id, role, assigned_at),
          labels:demand_label_assignments(
            label:demand_labels(id, name, color)
          )
        `)
        .eq('id', demandId)
        .eq('organization_id', profile.organization_id)
        .single();

      if (error) throw error;

      // Fetch user data for assignees
      const assigneeUserIds = (data.assignees as { user_id: string }[] | null)?.map(a => a.user_id) || [];
      let userMap = new Map<string, UserProfile>();
      if (assigneeUserIds.length > 0) {
        const { data: users } = await supabase
          .from('profiles')
          .select('id, user_id, first_name, last_name, avatar_url')
          .in('user_id', assigneeUserIds);
        userMap = new Map((users || []).map(u => [u.user_id, u]));
      }

      return {
        ...data,
        urgency: data.urgency as DemandUrgency,
        labels: (data.labels as { label: { id: string; name: string; color: string } | null }[] | null)
          ?.map(l => l.label)
          .filter((l): l is { id: string; name: string; color: string } => l !== null) || [],
        assignees: (data.assignees as { id: string; user_id: string; role: string; assigned_at: string }[] | null)
          ?.map(a => ({
            id: a.id,
            user_id: a.user_id,
            role: a.role,
            assigned_at: a.assigned_at,
            user: userMap.get(a.user_id) || null,
          })) || [],
      } as DemandWithRelations;
    },
    enabled: !!demandId && !!profile?.organization_id,
  });
}

export function useLeadDemands(leadId: string | null) {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['lead-demands', leadId],
    queryFn: async () => {
      if (!leadId || !profile?.organization_id) return [];

      const { data, error } = await supabase
        .from('demands')
        .select(`
          *,
          board:demand_boards(id, name, color),
          column:demand_columns(id, name, color, is_final),
          assignees:demand_assignees(id, user_id, role)
        `)
        .eq('lead_id', leadId)
        .eq('organization_id', profile.organization_id)
        .eq('is_archived', false)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch user data for assignees
      const allUserIds = (data || []).flatMap(d =>
        (d.assignees as { user_id: string }[] | null)?.map(a => a.user_id) || []
      );
      const uniqueUserIds = [...new Set(allUserIds)];

      let userMap = new Map<string, UserProfile>();
      if (uniqueUserIds.length > 0) {
        const { data: users } = await supabase
          .from('profiles')
          .select('id, user_id, first_name, last_name, avatar_url')
          .in('user_id', uniqueUserIds);
        userMap = new Map((users || []).map(u => [u.user_id, u]));
      }

      return data.map(d => ({
        ...d,
        urgency: d.urgency as DemandUrgency,
        assignees: (d.assignees as { id: string; user_id: string; role: string }[] | null)
          ?.map(a => ({
            id: a.id,
            user_id: a.user_id,
            role: a.role,
            user: userMap.get(a.user_id) || null,
          })) || [],
      })) as DemandWithRelations[];
    },
    enabled: !!leadId && !!profile?.organization_id,
  });
}

// ============================================================================
// DEMANDS MUTATIONS
// ============================================================================

export function useCreateDemand() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: CreateDemandInput) => {
      if (!profile?.organization_id || !profile?.user_id) {
        throw new Error('Usuário não autenticado');
      }

      const { data: existing } = await supabase
        .from('demands')
        .select('position')
        .eq('column_id', input.column_id)
        .order('position', { ascending: false })
        .limit(1);

      const position = existing?.[0]?.position ? existing[0].position + 1 : 0;

      const { data: demand, error } = await supabase
        .from('demands')
        .insert({
          organization_id: profile.organization_id,
          created_by: profile.user_id,
          board_id: input.board_id,
          column_id: input.column_id,
          lead_id: input.lead_id || null,
          title: input.title,
          description: input.description || null,
          urgency: input.urgency || 'medium',
          due_at: input.due_at || null,
          estimated_time_seconds: input.estimated_time_seconds || null,
          position,
        })
        .select()
        .single();

      if (error) throw error;

      if (input.assignee_ids?.length) {
        const assignees = input.assignee_ids.map(userId => ({
          demand_id: demand.id,
          user_id: userId,
          organization_id: profile.organization_id,
          role: 'responsible' as const,
          assigned_by: profile.user_id,
        }));

        const { error: assignError } = await supabase
          .from('demand_assignees')
          .insert(assignees);

        if (assignError) console.error('Error adding assignees:', assignError);

        // Send WhatsApp notification to assignees
        notifyDemandAssignment(profile.organization_id, demand.id, input.assignee_ids)
          .catch(err => console.error('Failed to send assignment notification:', err));
      }

      return demand as Demand;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['demands', data.board_id] });
      queryClient.invalidateQueries({ queryKey: ['lead-demands'] });
      toast({ title: 'Demanda criada com sucesso!' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao criar demanda', description: error.message, variant: 'destructive' });
    },
  });
}

export function useUpdateDemand() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateDemandInput & { id: string }) => {
      const { data, error } = await supabase
        .from('demands')
        .update(input)
        .eq('id', id)
        .select('*, board_id')
        .single();

      if (error) throw error;
      return data as Demand;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['demands', data.board_id] });
      queryClient.invalidateQueries({ queryKey: ['demand', data.id] });
      queryClient.invalidateQueries({ queryKey: ['lead-demands'] });
    },
    onError: (error) => {
      toast({ title: 'Erro ao atualizar demanda', description: error.message, variant: 'destructive' });
    },
  });
}

export function useMoveDemand() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      demandId,
      columnId,
      position,
      boardId
    }: {
      demandId: string;
      columnId: string;
      position: number;
      boardId: string;
    }) => {
      const { error } = await supabase
        .from('demands')
        .update({ column_id: columnId, position })
        .eq('id', demandId);

      if (error) throw error;
      return { demandId, boardId };
    },
    onSuccess: ({ boardId }) => {
      queryClient.invalidateQueries({ queryKey: ['demands', boardId] });
    },
  });
}

export function useArchiveDemand() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, archive }: { id: string; archive: boolean }) => {
      const { data, error } = await supabase
        .from('demands')
        .update({ is_archived: archive })
        .eq('id', id)
        .select('*, board_id')
        .single();

      if (error) throw error;
      return data as Demand;
    },
    onSuccess: (data, { archive }) => {
      queryClient.invalidateQueries({ queryKey: ['demands', data.board_id] });
      queryClient.invalidateQueries({ queryKey: ['demand', data.id] });
      toast({ title: archive ? 'Demanda arquivada!' : 'Demanda restaurada!' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao arquivar demanda', description: error.message, variant: 'destructive' });
    },
  });
}

export function useDeleteDemand() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, boardId }: { id: string; boardId: string }) => {
      const { error } = await supabase
        .from('demands')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return boardId;
    },
    onSuccess: (boardId) => {
      queryClient.invalidateQueries({ queryKey: ['demands', boardId] });
      queryClient.invalidateQueries({ queryKey: ['lead-demands'] });
      toast({ title: 'Demanda excluída!' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao excluir demanda', description: error.message, variant: 'destructive' });
    },
  });
}

// ============================================================================
// ASSIGNEES
// ============================================================================

export function useAddDemandAssignee() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ demandId, userId, role = 'responsible' }: { demandId: string; userId: string; role?: string }) => {
      if (!profile?.organization_id || !profile?.user_id) {
        throw new Error('Usuário não autenticado');
      }

      const { data, error } = await supabase
        .from('demand_assignees')
        .insert({
          demand_id: demandId,
          user_id: userId,
          organization_id: profile.organization_id,
          role,
          assigned_by: profile.user_id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, { demandId }) => {
      queryClient.invalidateQueries({ queryKey: ['demand', demandId] });
      queryClient.invalidateQueries({ queryKey: ['demands'] });
    },
  });
}

export function useRemoveDemandAssignee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ assigneeId, demandId }: { assigneeId: string; demandId: string }) => {
      const { error } = await supabase
        .from('demand_assignees')
        .delete()
        .eq('id', assigneeId);

      if (error) throw error;
      return demandId;
    },
    onSuccess: (demandId) => {
      queryClient.invalidateQueries({ queryKey: ['demand', demandId] });
      queryClient.invalidateQueries({ queryKey: ['demands'] });
    },
  });
}
