import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from './useTenant';
import { toast } from 'sonner';

/**
 * Associação de um vendedor a um gerente
 */
export interface UserAssociation {
  id: string;
  manager_user_id: string;
  team_member_user_id: string;
  created_at: string;
  manager?: {
    user_id: string;
    first_name: string | null;
    last_name: string | null;
  };
  member?: {
    user_id: string;
    first_name: string | null;
    last_name: string | null;
  };
}

/**
 * Gerente com seus membros associados
 */
export interface ManagerWithMembers {
  manager_user_id: string;
  manager_name: string;
  member_ids: string[];
}

/**
 * Busca todas as associações gerente→vendedor da organização
 */
export function useUserAssociations() {
  const { tenantId } = useTenant();

  return useQuery({
    queryKey: ['user-associations', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];

      const { data, error } = await supabase
        .from('sales_manager_team_members')
        .select('*')
        .eq('organization_id', tenantId);

      if (error) throw error;

      // Buscar profiles dos managers e membros
      const allUserIds = [
        ...new Set([
          ...(data || []).map(a => a.manager_user_id),
          ...(data || []).map(a => a.team_member_user_id),
        ]),
      ];

      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name')
        .in('user_id', allUserIds);

      const profileMap = (profiles || []).reduce((acc, p) => {
        acc[p.user_id] = p;
        return acc;
      }, {} as Record<string, { user_id: string; first_name: string | null; last_name: string | null }>);

      return (data || []).map(a => ({
        ...a,
        manager: profileMap[a.manager_user_id],
        member: profileMap[a.team_member_user_id],
      })) as UserAssociation[];
    },
    enabled: !!tenantId,
  });
}

/**
 * Retorna lista de gerentes com seus membros associados (para usar no SellerMultiSelect)
 */
export function useManagersWithMembers() {
  const { data: associations = [] } = useUserAssociations();

  const managersWithMembers: ManagerWithMembers[] = [];
  const membersByManager: Record<string, string[]> = {};
  const managerNames: Record<string, string> = {};

  associations.forEach(a => {
    if (!membersByManager[a.manager_user_id]) {
      membersByManager[a.manager_user_id] = [];
      managerNames[a.manager_user_id] = a.manager
        ? `${a.manager.first_name || ''} ${a.manager.last_name || ''}`.trim()
        : 'Gerente';
    }
    membersByManager[a.manager_user_id].push(a.team_member_user_id);
  });

  Object.entries(membersByManager).forEach(([managerId, memberIds]) => {
    managersWithMembers.push({
      manager_user_id: managerId,
      manager_name: managerNames[managerId],
      member_ids: memberIds,
    });
  });

  return managersWithMembers;
}

/**
 * Retorna os IDs dos membros associados a um gerente específico
 */
export function useManagerMembers(managerUserId: string | undefined) {
  const { data: associations = [] } = useUserAssociations();

  if (!managerUserId) return [];

  return associations
    .filter(a => a.manager_user_id === managerUserId)
    .map(a => a.team_member_user_id);
}

/**
 * Mutação para definir os membros de um gerente
 */
export function useSetManagerMembers() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();

  return useMutation({
    mutationFn: async ({
      managerUserId,
      memberUserIds,
    }: {
      managerUserId: string;
      memberUserIds: string[];
    }) => {
      if (!tenantId) throw new Error('Organização não encontrada');

      // Deletar associações existentes deste gerente
      const { error: deleteError } = await supabase
        .from('sales_manager_team_members')
        .delete()
        .eq('organization_id', tenantId)
        .eq('manager_user_id', managerUserId);

      if (deleteError) throw deleteError;

      // Inserir novas associações
      if (memberUserIds.length > 0) {
        const inserts = memberUserIds.map(memberId => ({
          organization_id: tenantId,
          manager_user_id: managerUserId,
          team_member_user_id: memberId,
        }));

        const { error: insertError } = await supabase
          .from('sales_manager_team_members')
          .insert(inserts);

        if (insertError) throw insertError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-associations'] });
      queryClient.invalidateQueries({ queryKey: ['team-members-info'] });
      toast.success('Associações atualizadas com sucesso!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao atualizar associações', { description: error.message });
    },
  });
}

/**
 * Retorna todos os gerentes da organização (is_sales_manager = true)
 */
export function useManagers() {
  const { tenantId } = useTenant();

  return useQuery({
    queryKey: ['managers', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];

      const { data, error } = await supabase
        .from('organization_members')
        .select(`
          user_id,
          is_sales_manager,
          profiles!inner(first_name, last_name)
        `)
        .eq('organization_id', tenantId)
        .eq('is_sales_manager', true);

      if (error) throw error;

      return (data || []).map((m: any) => ({
        user_id: m.user_id,
        full_name: `${m.profiles?.first_name || ''} ${m.profiles?.last_name || ''}`.trim(),
      }));
    },
    enabled: !!tenantId,
  });
}

/**
 * Retorna todos os membros da organização (para associar)
 */
export function useAllOrgMembers() {
  const { tenantId } = useTenant();

  return useQuery({
    queryKey: ['all-org-members', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];

      const { data, error } = await supabase
        .from('organization_members')
        .select(`
          user_id,
          role,
          is_sales_manager,
          profiles!inner(first_name, last_name)
        `)
        .eq('organization_id', tenantId);

      if (error) throw error;

      return (data || []).map((m: any) => ({
        user_id: m.user_id,
        role: m.role,
        is_sales_manager: m.is_sales_manager,
        full_name: `${m.profiles?.first_name || ''} ${m.profiles?.last_name || ''}`.trim(),
      }));
    },
    enabled: !!tenantId,
  });
}
