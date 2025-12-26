import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';

// =============================================================================
// TIPOS
// =============================================================================

// Usar o tipo do banco de dados para garantir consistência
export type OrgRole = Database['public']['Enums']['org_role'];

export interface Tenant {
  tenant_id: string;
  tenant_name: string;
  tenant_slug: string;
  user_role: OrgRole;
  joined_at: string;
}

export interface TenantStats {
  total_channels: number;
  connected_channels: number;
  total_conversations: number;
  unread_conversations: number;
  total_leads: number;
  total_members: number;
}

export interface Channel {
  channel_id: string;
  channel_name: string;
  provider: string;
  phone_e164: string | null;
  status: string;
  is_connected: boolean;
}

export interface TenantMember {
  id: string;
  user_id: string;
  role: OrgRole;
  can_see_all_leads: boolean;
  created_at: string;
  profile?: {
    first_name: string;
    last_name: string;
    email: string | null;
    avatar_url: string | null;
  };
}

// =============================================================================
// HOOKS
// =============================================================================

/**
 * Hook para obter o ID do tenant atual do usuário
 */
export function useCurrentTenantId() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['current-tenant-id', user?.id],
    queryFn: async () => {
      if (!user) return null;

      const { data, error } = await supabase.rpc('get_user_organization_id');

      if (error) {
        console.error('Error fetching tenant ID:', error);
        return null;
      }

      return data as string | null;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutos
  });
}

/**
 * Hook para listar todos os tenants do usuário
 */
export function useUserTenants() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['user-tenants', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase.rpc('get_user_tenants', {
        _user_id: user.id,
      });

      if (error) {
        console.error('Error fetching user tenants:', error);
        throw error;
      }

      return (data as Tenant[]) || [];
    },
    enabled: !!user,
  });
}

/**
 * Hook para obter estatísticas do tenant atual
 */
export function useTenantStats(tenantId?: string | null) {
  const { data: currentTenantId } = useCurrentTenantId();
  const effectiveTenantId = tenantId || currentTenantId;

  return useQuery({
    queryKey: ['tenant-stats', effectiveTenantId],
    queryFn: async () => {
      if (!effectiveTenantId) return null;

      const { data, error } = await supabase.rpc('get_tenant_stats', {
        _tenant_id: effectiveTenantId,
      });

      if (error) {
        console.error('Error fetching tenant stats:', error);
        throw error;
      }

      // RPC retorna array com um elemento
      const stats = Array.isArray(data) ? data[0] : data;
      return stats as TenantStats | null;
    },
    enabled: !!effectiveTenantId,
    refetchInterval: 30000, // Atualiza a cada 30 segundos
  });
}

/**
 * Hook para listar canais do tenant
 */
export function useTenantChannels(tenantId?: string | null) {
  const { data: currentTenantId } = useCurrentTenantId();
  const effectiveTenantId = tenantId || currentTenantId;

  return useQuery({
    queryKey: ['tenant-channels', effectiveTenantId],
    queryFn: async () => {
      if (!effectiveTenantId) return [];

      const { data, error } = await supabase.rpc('get_tenant_channels', {
        _tenant_id: effectiveTenantId,
      });

      if (error) {
        console.error('Error fetching tenant channels:', error);
        throw error;
      }

      return (data as Channel[]) || [];
    },
    enabled: !!effectiveTenantId,
  });
}

/**
 * Hook para listar membros do tenant
 */
export function useTenantMembers(tenantId?: string | null) {
  const { data: currentTenantId } = useCurrentTenantId();
  const effectiveTenantId = tenantId || currentTenantId;

  return useQuery({
    queryKey: ['tenant-members', effectiveTenantId],
    queryFn: async () => {
      if (!effectiveTenantId) return [];

      const { data, error } = await supabase
        .from('organization_members')
        .select(`
          id,
          user_id,
          role,
          can_see_all_leads,
          created_at,
          profiles:user_id (
            first_name,
            last_name,
            email,
            avatar_url
          )
        `)
        .eq('organization_id', effectiveTenantId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching tenant members:', error);
        throw error;
      }

      return (data || []).map((member: any) => ({
        id: member.id,
        user_id: member.user_id,
        role: member.role,
        can_see_all_leads: member.can_see_all_leads,
        created_at: member.created_at,
        profile: member.profiles,
      })) as TenantMember[];
    },
    enabled: !!effectiveTenantId,
  });
}

/**
 * Hook para verificar se o usuário atual é admin do tenant
 */
export function useIsTenantAdmin(tenantId?: string | null) {
  const { user } = useAuth();
  const { data: currentTenantId } = useCurrentTenantId();
  const effectiveTenantId = tenantId || currentTenantId;

  return useQuery({
    queryKey: ['is-tenant-admin', user?.id, effectiveTenantId],
    queryFn: async () => {
      if (!user || !effectiveTenantId) return false;

      const { data, error } = await supabase.rpc('is_tenant_admin', {
        _user_id: user.id,
        _tenant_id: effectiveTenantId,
      });

      if (error) {
        console.error('Error checking tenant admin:', error);
        return false;
      }

      return data as boolean;
    },
    enabled: !!user && !!effectiveTenantId,
  });
}

/**
 * Hook para obter o papel do usuário no tenant
 */
export function useTenantRole(tenantId?: string | null) {
  const { user } = useAuth();
  const { data: currentTenantId } = useCurrentTenantId();
  const effectiveTenantId = tenantId || currentTenantId;

  return useQuery({
    queryKey: ['tenant-role', user?.id, effectiveTenantId],
    queryFn: async () => {
      if (!user || !effectiveTenantId) return null;

      const { data, error } = await supabase.rpc('get_tenant_role', {
        _user_id: user.id,
        _tenant_id: effectiveTenantId,
      });

      if (error) {
        console.error('Error fetching tenant role:', error);
        return null;
      }

      return data as OrgRole | null;
    },
    enabled: !!user && !!effectiveTenantId,
  });
}

/**
 * Hook combinado para contexto completo do tenant
 */
export function useTenant() {
  const { user } = useAuth();
  const { data: tenantId, isLoading: isLoadingTenantId } = useCurrentTenantId();
  const { data: tenants, isLoading: isLoadingTenants } = useUserTenants();
  const { data: stats, isLoading: isLoadingStats } = useTenantStats(tenantId);
  const { data: channels, isLoading: isLoadingChannels } = useTenantChannels(tenantId);
  const { data: isAdmin, isLoading: isLoadingAdmin } = useIsTenantAdmin(tenantId);
  const { data: role, isLoading: isLoadingRole } = useTenantRole(tenantId);

  // Encontrar o tenant atual na lista
  const currentTenant = tenants?.find((t) => t.tenant_id === tenantId) || null;

  return {
    // Estado do usuário
    user,
    isAuthenticated: !!user,

    // Tenant atual
    tenantId,
    tenant: currentTenant,
    
    // Lista de tenants (para switch de empresa)
    tenants: tenants || [],
    hasMutipleTenants: (tenants?.length || 0) > 1,

    // Estatísticas
    stats,

    // Canais
    channels: channels || [],

    // Permissões
    isAdmin: isAdmin || false,
    isOwner: role === 'owner',
    role: role || null,

    // Loading states
    isLoading: isLoadingTenantId || isLoadingTenants,
    isLoadingStats,
    isLoadingChannels,
    isLoadingPermissions: isLoadingAdmin || isLoadingRole,
  };
}

// =============================================================================
// MUTATIONS
// =============================================================================

/**
 * Hook para atualizar configurações do tenant
 */
export function useUpdateTenant() {
  const queryClient = useQueryClient();
  const { data: tenantId } = useCurrentTenantId();

  return useMutation({
    mutationFn: async (updates: { name?: string; phone?: string }) => {
      if (!tenantId) throw new Error('Tenant não encontrado');

      const { data, error } = await supabase
        .from('organizations')
        .update(updates)
        .eq('id', tenantId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-tenants'] });
      toast({
        title: 'Configurações atualizadas',
        description: 'As alterações foram salvas com sucesso.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao atualizar',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

/**
 * Hook para adicionar membro ao tenant
 */
export function useAddTenantMember() {
  const queryClient = useQueryClient();
  const { data: tenantId } = useCurrentTenantId();

  return useMutation({
    mutationFn: async ({
      userId,
      role = 'member',
      canSeeAllLeads = true,
    }: {
      userId: string;
      role?: 'admin' | 'member';
      canSeeAllLeads?: boolean;
    }) => {
      if (!tenantId) throw new Error('Tenant não encontrado');

      const { data, error } = await supabase
        .from('organization_members')
        .insert({
          organization_id: tenantId,
          user_id: userId,
          role,
          can_see_all_leads: canSeeAllLeads,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-members'] });
      queryClient.invalidateQueries({ queryKey: ['tenant-stats'] });
      toast({
        title: 'Membro adicionado',
        description: 'O usuário foi adicionado à equipe.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao adicionar membro',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

/**
 * Hook para remover membro do tenant
 */
export function useRemoveTenantMember() {
  const queryClient = useQueryClient();
  const { data: tenantId } = useCurrentTenantId();

  return useMutation({
    mutationFn: async (memberId: string) => {
      if (!tenantId) throw new Error('Tenant não encontrado');

      const { error } = await supabase
        .from('organization_members')
        .delete()
        .eq('id', memberId)
        .eq('organization_id', tenantId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-members'] });
      queryClient.invalidateQueries({ queryKey: ['tenant-stats'] });
      toast({
        title: 'Membro removido',
        description: 'O usuário foi removido da equipe.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao remover membro',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

/**
 * Hook para atualizar papel de membro
 */
export function useUpdateMemberRole() {
  const queryClient = useQueryClient();
  const { data: tenantId } = useCurrentTenantId();

  return useMutation({
    mutationFn: async ({
      memberId,
      role,
      canSeeAllLeads,
    }: {
      memberId: string;
      role?: 'admin' | 'member';
      canSeeAllLeads?: boolean;
    }) => {
      if (!tenantId) throw new Error('Tenant não encontrado');

      const updates: any = {};
      if (role !== undefined) updates.role = role;
      if (canSeeAllLeads !== undefined) updates.can_see_all_leads = canSeeAllLeads;

      const { data, error } = await supabase
        .from('organization_members')
        .update(updates)
        .eq('id', memberId)
        .eq('organization_id', tenantId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-members'] });
      toast({
        title: 'Permissões atualizadas',
        description: 'As permissões do membro foram atualizadas.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao atualizar permissões',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
