import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from './useTenant';

export interface TeamMemberInfo {
  user_id: string;
  team_id: string | null;
  full_name: string;
  manager_user_id: string | null; // ID do gerente associado
}

/**
 * Hook que retorna membros da organização com suas associações a gerentes
 * Prioriza associações (sales_manager_team_members) sobre team_id
 */
export function useTeamMembers() {
  const { tenantId } = useTenant();

  return useQuery({
    queryKey: ['team-members-info', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];

      // Buscar membros da organização
      const { data: members, error: membersError } = await supabase
        .from('organization_members')
        .select(`
          user_id,
          team_id,
          profiles!inner(first_name, last_name)
        `)
        .eq('organization_id', tenantId);

      if (membersError) throw membersError;

      // Buscar associações gerente→vendedor
      const { data: associations, error: assocError } = await supabase
        .from('sales_manager_team_members')
        .select('manager_user_id, team_member_user_id')
        .eq('organization_id', tenantId);

      if (assocError) throw assocError;

      // Criar mapa de vendedor → gerente
      const memberToManager: Record<string, string> = {};
      (associations || []).forEach(a => {
        memberToManager[a.team_member_user_id] = a.manager_user_id;
      });

      return (members || []).map((m: any) => ({
        user_id: m.user_id,
        team_id: m.team_id,
        full_name: `${m.profiles?.first_name || ''} ${m.profiles?.last_name || ''}`.trim(),
        manager_user_id: memberToManager[m.user_id] || null,
      })) as TeamMemberInfo[];
    },
    enabled: !!tenantId,
  });
}
