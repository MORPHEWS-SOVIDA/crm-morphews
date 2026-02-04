import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useCurrentTenantId } from './useTenant';
import { useEffect } from 'react';

// =============================================================================
// TYPES
// =============================================================================

export interface TeamConversation {
  id: string;
  organization_id: string;
  conversation_type: 'direct' | 'group' | 'contextual';
  name: string | null;
  description: string | null;
  avatar_url: string | null;
  context_type: 'lead' | 'demand' | 'sac' | 'product' | 'sale' | null;
  context_id: string | null;
  context_name: string | null;
  created_by: string | null;
  last_message_at: string | null;
  last_message_preview: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  // Joined fields
  members?: TeamConversationMember[];
  unread_count?: number;
  unread_mentions?: number;
}

export interface TeamConversationMember {
  id: string;
  conversation_id: string;
  user_id: string;
  organization_id: string;
  role: 'admin' | 'member';
  can_send_messages: boolean;
  joined_at: string;
  last_read_at: string | null;
  is_muted: boolean;
  // Joined profile
  profile?: {
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
  };
}

export interface TeamMessage {
  id: string;
  conversation_id: string;
  organization_id: string;
  sender_id: string;
  content: string;
  content_type: 'text' | 'image' | 'file' | 'audio' | 'system';
  attachments: any[];
  mentions: TeamMentionData[];
  reply_to_id: string | null;
  is_edited: boolean;
  edited_at: string | null;
  is_deleted: boolean;
  deleted_at: string | null;
  created_at: string;
  // Joined fields
  sender?: {
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
  };
  reply_to?: TeamMessage;
}

export interface TeamMentionData {
  type: 'user' | 'lead' | 'demand' | 'product' | 'sac' | 'sale';
  id: string;
  display_name: string;
}

export interface TeamUnreadCount {
  conversation_id: string;
  unread_count: number;
  unread_mentions: number;
}

// =============================================================================
// CONVERSATIONS HOOKS
// =============================================================================

/**
 * Lista todas as conversas do usuário
 */
export function useTeamConversations() {
  const { user } = useAuth();
  const { data: tenantId } = useCurrentTenantId();

  return useQuery({
    queryKey: ['team-conversations', tenantId, user?.id],
    queryFn: async () => {
      if (!tenantId || !user?.id) return [];

      // Buscar conversas onde o usuário é membro
      const { data: memberships, error: memberError } = await supabase
        .from('team_conversation_members')
        .select('conversation_id')
        .eq('user_id', user.id)
        .eq('organization_id', tenantId);

      if (memberError) throw memberError;
      if (!memberships?.length) return [];

      const conversationIds = memberships.map(m => m.conversation_id);

      // Buscar detalhes das conversas
      const { data: conversations, error } = await supabase
        .from('team_conversations')
        .select('*')
        .in('id', conversationIds)
        .eq('is_archived', false)
        .order('last_message_at', { ascending: false, nullsFirst: false });

      if (error) throw error;

      // Buscar contadores de não lidas
      const { data: unreads } = await supabase
        .from('team_unread_counts')
        .select('conversation_id, unread_count, unread_mentions')
        .eq('user_id', user.id)
        .in('conversation_id', conversationIds);

      const unreadMap = new Map(unreads?.map(u => [u.conversation_id, u]) || []);

      return (conversations || []).map(conv => ({
        ...conv,
        unread_count: unreadMap.get(conv.id)?.unread_count || 0,
        unread_mentions: unreadMap.get(conv.id)?.unread_mentions || 0,
      })) as TeamConversation[];
    },
    enabled: !!tenantId && !!user?.id,
    refetchInterval: 30000, // Refresh a cada 30s
  });
}

/**
 * Busca uma conversa específica com membros
 */
export function useTeamConversation(conversationId: string | null) {
  return useQuery({
    queryKey: ['team-conversation', conversationId],
    queryFn: async () => {
      if (!conversationId) return null;

      const { data, error } = await supabase
        .from('team_conversations')
        .select(`
          *,
          members:team_conversation_members(*)
        `)
        .eq('id', conversationId)
        .single();

      if (error) throw error;
      return data as unknown as TeamConversation;
    },
    enabled: !!conversationId,
  });
}

/**
 * Contador total de não lidas para o badge
 */
export function useTeamUnreadTotal() {
  const { user } = useAuth();
  const { data: tenantId } = useCurrentTenantId();

  return useQuery({
    queryKey: ['team-unread-total', tenantId, user?.id],
    queryFn: async () => {
      if (!tenantId || !user?.id) return { total: 0, mentions: 0 };

      const { data, error } = await supabase
        .from('team_unread_counts')
        .select('unread_count, unread_mentions')
        .eq('user_id', user.id)
        .eq('organization_id', tenantId);

      if (error) throw error;

      const total = (data || []).reduce((sum, r) => sum + (r.unread_count || 0), 0);
      const mentions = (data || []).reduce((sum, r) => sum + (r.unread_mentions || 0), 0);

      return { total, mentions };
    },
    enabled: !!tenantId && !!user?.id,
    refetchInterval: 10000, // Refresh a cada 10s
  });
}

// =============================================================================
// MESSAGES HOOKS
// =============================================================================

/**
 * Lista mensagens de uma conversa
 */
export function useTeamMessages(conversationId: string | null, limit = 50) {
  return useQuery({
    queryKey: ['team-messages', conversationId, limit],
    queryFn: async () => {
      if (!conversationId) return [];

      const { data, error } = await supabase
        .from('team_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: true })
        .limit(limit);

      if (error) throw error;
      
      // Map data and fetch sender profiles separately
      const messages = (data || []).map((msg: any) => ({
        ...msg,
        mentions: msg.mentions || [],
        attachments: msg.attachments || [],
      }));
      
      return messages as TeamMessage[];
    },
    enabled: !!conversationId,
  });
}

/**
 * Subscribe to realtime messages
 */
export function useTeamMessagesRealtime(conversationId: string | null) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`team-messages-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'team_messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => {
          // Invalidar queries para recarregar mensagens
          queryClient.invalidateQueries({ queryKey: ['team-messages', conversationId] });
          queryClient.invalidateQueries({ queryKey: ['team-conversations'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, queryClient]);
}

/**
 * Subscribe to unread counts realtime
 */
export function useTeamUnreadRealtime() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`team-unread-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'team_unread_counts',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['team-unread-total'] });
          queryClient.invalidateQueries({ queryKey: ['team-conversations'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);
}

// =============================================================================
// MUTATIONS
// =============================================================================

/**
 * Criar conversa direta (1:1)
 */
export function useCreateDirectConversation() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data: tenantId } = useCurrentTenantId();

  return useMutation({
    mutationFn: async (targetUserId: string) => {
      if (!tenantId || !user?.id) throw new Error('Not authenticated');

      // Verificar se já existe conversa direta entre os dois
      const { data: existingMembers } = await supabase
        .from('team_conversation_members')
        .select('conversation_id')
        .eq('user_id', user.id)
        .eq('organization_id', tenantId);

      if (existingMembers?.length) {
        // Verificar se alguma conversa tem o target user
        for (const member of existingMembers) {
          const { data: conv } = await supabase
            .from('team_conversations')
            .select('id, conversation_type')
            .eq('id', member.conversation_id)
            .eq('conversation_type', 'direct')
            .single();

          if (conv) {
            const { data: targetMember } = await supabase
              .from('team_conversation_members')
              .select('id')
              .eq('conversation_id', conv.id)
              .eq('user_id', targetUserId)
              .single();

            if (targetMember) {
              return conv; // Já existe, retornar
            }
          }
        }
      }

      // Criar nova conversa
      const { data: conversation, error: convError } = await supabase
        .from('team_conversations')
        .insert({
          organization_id: tenantId,
          conversation_type: 'direct',
          created_by: user.id,
        })
        .select()
        .single();

      if (convError) throw convError;

      // Adicionar membros
      const { error: memberError } = await supabase
        .from('team_conversation_members')
        .insert([
          {
            conversation_id: conversation.id,
            user_id: user.id,
            organization_id: tenantId,
            role: 'admin',
          },
          {
            conversation_id: conversation.id,
            user_id: targetUserId,
            organization_id: tenantId,
            role: 'admin',
          },
        ]);

      if (memberError) throw memberError;

      return conversation;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-conversations'] });
    },
  });
}

/**
 * Criar grupo/canal
 */
export function useCreateGroupConversation() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data: tenantId } = useCurrentTenantId();

  return useMutation({
    mutationFn: async ({
      name,
      description,
      memberIds,
    }: {
      name: string;
      description?: string;
      memberIds: string[];
    }) => {
      if (!tenantId || !user?.id) throw new Error('Not authenticated');

      // Criar conversa
      const { data: conversation, error: convError } = await supabase
        .from('team_conversations')
        .insert({
          organization_id: tenantId,
          conversation_type: 'group',
          name,
          description,
          created_by: user.id,
        })
        .select()
        .single();

      if (convError) throw convError;

      // Adicionar criador como admin + membros
      const members = [
        {
          conversation_id: conversation.id,
          user_id: user.id,
          organization_id: tenantId,
          role: 'admin' as const,
        },
        ...memberIds.filter(id => id !== user.id).map(userId => ({
          conversation_id: conversation.id,
          user_id: userId,
          organization_id: tenantId,
          role: 'member' as const,
        })),
      ];

      const { error: memberError } = await supabase
        .from('team_conversation_members')
        .insert(members);

      if (memberError) throw memberError;

      return conversation;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-conversations'] });
    },
  });
}

/**
 * Criar conversa contextual (vinculada a entidade)
 */
export function useCreateContextualConversation() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data: tenantId } = useCurrentTenantId();

  return useMutation({
    mutationFn: async ({
      contextType,
      contextId,
      contextName,
      memberIds,
    }: {
      contextType: 'lead' | 'demand' | 'sac' | 'product' | 'sale';
      contextId: string;
      contextName: string;
      memberIds: string[];
    }) => {
      if (!tenantId || !user?.id) throw new Error('Not authenticated');

      // Verificar se já existe conversa para este contexto
      const { data: existing } = await supabase
        .from('team_conversations')
        .select('id')
        .eq('organization_id', tenantId)
        .eq('context_type', contextType)
        .eq('context_id', contextId)
        .single();

      if (existing) return existing;

      // Criar conversa
      const { data: conversation, error: convError } = await supabase
        .from('team_conversations')
        .insert({
          organization_id: tenantId,
          conversation_type: 'contextual',
          context_type: contextType,
          context_id: contextId,
          context_name: contextName,
          name: `${contextType}: ${contextName}`,
          created_by: user.id,
        })
        .select()
        .single();

      if (convError) throw convError;

      // Adicionar membros
      const members = memberIds.map(userId => ({
        conversation_id: conversation.id,
        user_id: userId,
        organization_id: tenantId,
        role: userId === user.id ? 'admin' as const : 'member' as const,
      }));

      const { error: memberError } = await supabase
        .from('team_conversation_members')
        .insert(members);

      if (memberError) throw memberError;

      return conversation;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-conversations'] });
    },
  });
}

/**
 * Enviar mensagem
 */
export function useSendTeamMessage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data: tenantId } = useCurrentTenantId();

  return useMutation({
    mutationFn: async ({
      conversationId,
      content,
      mentions = [],
      replyToId,
    }: {
      conversationId: string;
      content: string;
      mentions?: TeamMentionData[];
      replyToId?: string;
    }) => {
      if (!tenantId || !user?.id) throw new Error('Not authenticated');

      // Inserir mensagem
      const { data: message, error: msgError } = await supabase
        .from('team_messages')
        .insert([{
          conversation_id: conversationId,
          organization_id: tenantId,
          sender_id: user.id,
          content,
          mentions: mentions as any,
          reply_to_id: replyToId,
        }])
        .select()
        .single();

      if (msgError) throw msgError;

      // Criar registros de menções para notificações
      const userMentions = mentions.filter(m => m.type === 'user');
      if (userMentions.length > 0) {
        await supabase.from('team_mentions').insert(
          userMentions.map(m => ({
            message_id: message.id,
            conversation_id: conversationId,
            organization_id: tenantId,
            mentioned_by: user.id,
            mention_type: 'user',
            mentioned_user_id: m.id,
            entity_name: m.display_name,
          }))
        );
      }

      // Criar registros para menções de entidades
      const entityMentions = mentions.filter(m => m.type !== 'user');
      if (entityMentions.length > 0) {
        await supabase.from('team_mentions').insert(
          entityMentions.map(m => ({
            message_id: message.id,
            conversation_id: conversationId,
            organization_id: tenantId,
            mentioned_by: user.id,
            mention_type: m.type,
            entity_id: m.id,
            entity_name: m.display_name,
          }))
        );
      }

      return message;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['team-messages', variables.conversationId] });
      queryClient.invalidateQueries({ queryKey: ['team-conversations'] });
    },
  });
}

/**
 * Marcar conversa como lida
 */
export function useMarkTeamConversationRead() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (conversationId: string) => {
      if (!user?.id) throw new Error('Not authenticated');

      // Resetar contador
      await supabase
        .from('team_unread_counts')
        .update({ unread_count: 0, unread_mentions: 0, last_updated_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .eq('user_id', user.id);

      // Atualizar last_read_at do membro
      await supabase
        .from('team_conversation_members')
        .update({ last_read_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .eq('user_id', user.id);

      // Marcar menções como lidas
      await supabase
        .from('team_mentions')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .eq('mentioned_user_id', user.id)
        .eq('is_read', false);
    },
    onSuccess: (_, conversationId) => {
      queryClient.invalidateQueries({ queryKey: ['team-unread-total'] });
      queryClient.invalidateQueries({ queryKey: ['team-conversations'] });
      queryClient.invalidateQueries({ queryKey: ['team-conversation', conversationId] });
    },
  });
}
