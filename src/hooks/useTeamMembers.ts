import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface TeamMemberInfo {
  user_id: string;
  team_id: string | null;
  full_name: string;
}

export function useTeamMembers() {
  return useQuery({
    queryKey: ['team-members-info'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organization_members')
        .select(`
          user_id,
          team_id,
          profiles!inner(first_name, last_name)
        `);

      if (error) throw error;

      return (data || []).map((m: any) => ({
        user_id: m.user_id,
        team_id: m.team_id,
        full_name: `${m.profiles?.first_name || ''} ${m.profiles?.last_name || ''}`.trim(),
      })) as TeamMemberInfo[];
    },
  });
}
