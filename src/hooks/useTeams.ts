import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface Team {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  color: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TeamWithMembers extends Team {
  member_count: number;
}

export function useTeams() {
  return useQuery({
    queryKey: ['teams'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('teams')
        .select('*')
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      return data as Team[];
    },
  });
}

export function useTeamsWithMembers() {
  return useQuery({
    queryKey: ['teams-with-members'],
    queryFn: async () => {
      // First get all teams
      const { data: teams, error: teamsError } = await supabase
        .from('teams')
        .select('*')
        .order('name');
      
      if (teamsError) throw teamsError;

      // Then get member counts
      const { data: members, error: membersError } = await supabase
        .from('organization_members')
        .select('team_id');
      
      if (membersError) throw membersError;

      // Count members per team
      const memberCounts: Record<string, number> = {};
      members?.forEach(m => {
        if (m.team_id) {
          memberCounts[m.team_id] = (memberCounts[m.team_id] || 0) + 1;
        }
      });

      return (teams || []).map(team => ({
        ...team,
        member_count: memberCounts[team.id] || 0,
      })) as TeamWithMembers[];
    },
  });
}

export function useCreateTeam() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { name: string; description?: string; color?: string }) => {
      // Get organization_id
      const { data: orgData } = await supabase.rpc('get_user_organization_id');
      
      if (!orgData) throw new Error('Organização não encontrada');

      const { data: team, error } = await supabase
        .from('teams')
        .insert({
          organization_id: orgData,
          name: data.name,
          description: data.description || null,
          color: data.color || '#6366f1',
        })
        .select()
        .single();

      if (error) throw error;
      return team;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      queryClient.invalidateQueries({ queryKey: ['teams-with-members'] });
      toast.success('Time criado com sucesso!');
    },
    onError: (error: any) => {
      if (error.code === '23505') {
        toast.error('Já existe um time com esse nome');
      } else {
        toast.error('Erro ao criar time');
      }
    },
  });
}

export function useUpdateTeam() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; name?: string; description?: string; color?: string; is_active?: boolean }) => {
      const { data: team, error } = await supabase
        .from('teams')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return team;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      queryClient.invalidateQueries({ queryKey: ['teams-with-members'] });
      toast.success('Time atualizado com sucesso!');
    },
    onError: (error: any) => {
      if (error.code === '23505') {
        toast.error('Já existe um time com esse nome');
      } else {
        toast.error('Erro ao atualizar time');
      }
    },
  });
}

export function useDeleteTeam() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('teams')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      queryClient.invalidateQueries({ queryKey: ['teams-with-members'] });
      toast.success('Time excluído com sucesso!');
    },
    onError: () => {
      toast.error('Erro ao excluir time');
    },
  });
}
