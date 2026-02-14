import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentTenantId } from '@/hooks/useTenant';
import { toast } from '@/hooks/use-toast';

// =============================================================================
// TIPOS
// =============================================================================

export interface Channel {
  id: string;
  tenant_id: string;
  name: string;
  provider: 'wasenderapi' | 'zapi';
  phone_e164: string | null;
  external_account_id: string | null;
  status: string;
  is_connected: boolean;
  monthly_price_cents: number;
  payment_source: string;
  qr_code_base64: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChannelUser {
  id: string;
  channel_id: string;
  user_id: string;
  can_view: boolean;
  can_send: boolean;
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
 * Hook para listar canais do tenant
 */
export function useChannels() {
  const { data: tenantId } = useCurrentTenantId();

  return useQuery({
    queryKey: ['channels', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];

      const { data, error } = await supabase
        .from('whatsapp_instances')
        .select('*')
        .eq('organization_id', tenantId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching channels:', error);
        throw error;
      }

      return (data || []).map((channel) => ({
        id: channel.id,
        tenant_id: channel.organization_id,
        name: channel.name,
        provider: channel.provider as 'wasenderapi' | 'zapi',
        phone_e164: channel.phone_number,
        external_account_id: channel.wasender_session_id || channel.z_api_instance_id,
        status: channel.status,
        is_connected: channel.is_connected,
        monthly_price_cents: channel.monthly_price_cents,
        payment_source: channel.payment_source,
        qr_code_base64: channel.qr_code_base64,
        created_at: channel.created_at,
        updated_at: channel.updated_at,
      })) as Channel[];
    },
    enabled: !!tenantId,
  });
}

/**
 * Hook para obter um canal específico
 */
export function useChannel(channelId: string | null) {
  return useQuery({
    queryKey: ['channel', channelId],
    queryFn: async () => {
      if (!channelId) return null;

      const { data, error } = await supabase
        .from('whatsapp_instances')
        .select('*')
        .eq('id', channelId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching channel:', error);
        throw error;
      }

      if (!data) return null;

      return {
        id: data.id,
        tenant_id: data.organization_id,
        name: data.name,
        provider: data.provider as 'wasenderapi' | 'zapi',
        phone_e164: data.phone_number,
        external_account_id: data.wasender_session_id || data.z_api_instance_id,
        status: data.status,
        is_connected: data.is_connected,
        monthly_price_cents: data.monthly_price_cents,
        payment_source: data.payment_source,
        qr_code_base64: data.qr_code_base64,
        created_at: data.created_at,
        updated_at: data.updated_at,
      } as Channel;
    },
    enabled: !!channelId,
    refetchInterval: 60000, // QR code refresh a cada 60s
  });
}

/**
 * Hook para listar usuários de um canal
 */
export function useChannelUsers(channelId: string | null) {
  return useQuery({
    queryKey: ['channel-users', channelId],
    queryFn: async () => {
      if (!channelId) return [];

      const { data, error } = await supabase
        .from('whatsapp_instance_users')
        .select(`
          *,
          profiles:user_id (
            first_name,
            last_name,
            email,
            avatar_url
          )
        `)
        .eq('instance_id', channelId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching channel users:', error);
        throw error;
      }

      return (data || []).map((user: any) => ({
        id: user.id,
        channel_id: user.instance_id,
        user_id: user.user_id,
        can_view: user.can_view,
        can_send: user.can_send,
        created_at: user.created_at,
        profile: user.profiles,
      })) as ChannelUser[];
    },
    enabled: !!channelId,
  });
}

/**
 * Hook para contar canais conectados
 */
export function useConnectedChannelsCount() {
  const { data: tenantId } = useCurrentTenantId();

  return useQuery({
    queryKey: ['connected-channels-count', tenantId],
    queryFn: async () => {
      if (!tenantId) return 0;

      const { count, error } = await supabase
        .from('whatsapp_instances')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', tenantId)
        .eq('is_connected', true);

      if (error) {
        console.error('Error counting connected channels:', error);
        return 0;
      }

      return count || 0;
    },
    enabled: !!tenantId,
    refetchInterval: 30000,
  });
}

// =============================================================================
// MUTATIONS
// =============================================================================

/**
 * Hook para adicionar usuário a um canal
 */
export function useAddChannelUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      channelId,
      userId,
      canView = true,
      canSend = true,
    }: {
      channelId: string;
      userId: string;
      canView?: boolean;
      canSend?: boolean;
    }) => {
      const { data, error } = await supabase
        .from('whatsapp_instance_users')
        .insert({
          instance_id: channelId,
          user_id: userId,
          can_view: canView,
          can_send: canSend,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['channel-users', variables.channelId] });
      toast({
        title: 'Usuário adicionado',
        description: 'O usuário agora tem acesso ao canal.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao adicionar usuário',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

/**
 * Hook para remover usuário de um canal
 */
export function useRemoveChannelUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      channelId,
      channelUserId,
    }: {
      channelId: string;
      channelUserId: string;
    }) => {
      const { error } = await supabase
        .from('whatsapp_instance_users')
        .delete()
        .eq('id', channelUserId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['channel-users', variables.channelId] });
      toast({
        title: 'Usuário removido',
        description: 'O usuário não tem mais acesso ao canal.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao remover usuário',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

/**
 * Hook para atualizar permissões de usuário no canal
 */
export function useUpdateChannelUserPermissions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      channelUserId,
      channelId,
      canView,
      canSend,
    }: {
      channelUserId: string;
      channelId: string;
      canView?: boolean;
      canSend?: boolean;
    }) => {
      const updates: any = {};
      if (canView !== undefined) updates.can_view = canView;
      if (canSend !== undefined) updates.can_send = canSend;

      const { data, error } = await supabase
        .from('whatsapp_instance_users')
        .update(updates)
        .eq('id', channelUserId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['channel-users', variables.channelId] });
      toast({
        title: 'Permissões atualizadas',
        description: 'As permissões do usuário foram atualizadas.',
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

/**
 * Hook para atualizar nome do canal
 */
export function useUpdateChannel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      channelId,
      name,
    }: {
      channelId: string;
      name: string;
    }) => {
      const { data, error } = await supabase
        .from('whatsapp_instances')
        .update({ name })
        .eq('id', channelId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['channel', variables.channelId] });
      queryClient.invalidateQueries({ queryKey: ['channels'] });
      toast({
        title: 'Canal atualizado',
        description: 'O nome do canal foi atualizado.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao atualizar canal',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
