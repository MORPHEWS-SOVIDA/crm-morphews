import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useCurrentTenantId } from './useTenant';
import { useEffect, useCallback, useRef } from 'react';

// =============================================================================
// TYPES
// =============================================================================

export interface MessageReaction {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
}

export interface ReactionSummary {
  emoji: string;
  count: number;
  users: string[];
  reacted_by_me: boolean;
}

export interface UserPresence {
  user_id: string;
  status: 'online' | 'away' | 'busy' | 'offline';
  status_message: string | null;
  last_seen_at: string;
  is_typing_in: string | null;
  typing_started_at: string | null;
}

export interface TeamFile {
  id: string;
  organization_id: string;
  conversation_id: string | null;
  message_id: string | null;
  uploaded_by: string;
  file_name: string;
  file_type: string;
  file_size: number;
  file_url: string;
  thumbnail_url: string | null;
  created_at: string;
}

export interface PinnedMessage {
  id: string;
  message_id: string;
  conversation_id: string;
  pinned_by: string;
  pinned_at: string;
}

export interface ThreadMessage {
  id: string;
  thread_id: string | null;
  thread_reply_count: number;
  thread_last_reply_at: string | null;
}

// =============================================================================
// REACTIONS HOOKS
// =============================================================================

/**
 * Buscar reações de uma mensagem
 */
export function useMessageReactions(messageId: string | null) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['message-reactions', messageId],
    queryFn: async () => {
      if (!messageId) return [];

      const { data, error } = await supabase
        .from('team_message_reactions')
        .select('*')
        .eq('message_id', messageId);

      if (error) throw error;
      
      // Agrupar por emoji
      const grouped = new Map<string, ReactionSummary>();
      (data || []).forEach((r: any) => {
        const existing = grouped.get(r.emoji);
        if (existing) {
          existing.count++;
          existing.users.push(r.user_id);
          if (r.user_id === user?.id) existing.reacted_by_me = true;
        } else {
          grouped.set(r.emoji, {
            emoji: r.emoji,
            count: 1,
            users: [r.user_id],
            reacted_by_me: r.user_id === user?.id,
          });
        }
      });

      return Array.from(grouped.values());
    },
    enabled: !!messageId,
  });
}

/**
 * Buscar todas as reações de várias mensagens de uma vez
 */
export function useConversationReactions(messageIds: string[]) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['conversation-reactions', messageIds.join(',')],
    queryFn: async () => {
      if (!messageIds.length) return new Map<string, ReactionSummary[]>();

      const { data, error } = await supabase
        .from('team_message_reactions')
        .select('*')
        .in('message_id', messageIds);

      if (error) throw error;

      // Agrupar por mensagem e emoji
      const byMessage = new Map<string, Map<string, ReactionSummary>>();
      
      (data || []).forEach((r: any) => {
        if (!byMessage.has(r.message_id)) {
          byMessage.set(r.message_id, new Map());
        }
        const msgReactions = byMessage.get(r.message_id)!;
        
        const existing = msgReactions.get(r.emoji);
        if (existing) {
          existing.count++;
          existing.users.push(r.user_id);
          if (r.user_id === user?.id) existing.reacted_by_me = true;
        } else {
          msgReactions.set(r.emoji, {
            emoji: r.emoji,
            count: 1,
            users: [r.user_id],
            reacted_by_me: r.user_id === user?.id,
          });
        }
      });

      // Converter para resultado final
      const result = new Map<string, ReactionSummary[]>();
      byMessage.forEach((reactions, messageId) => {
        result.set(messageId, Array.from(reactions.values()));
      });

      return result;
    },
    enabled: messageIds.length > 0,
  });
}

/**
 * Toggle reação em mensagem
 */
export function useToggleReaction() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data: tenantId } = useCurrentTenantId();

  return useMutation({
    mutationFn: async ({ messageId, emoji }: { messageId: string; emoji: string }) => {
      if (!tenantId || !user?.id) throw new Error('Not authenticated');

      // Verificar se já existe
      const { data: existing } = await supabase
        .from('team_message_reactions')
        .select('id')
        .eq('message_id', messageId)
        .eq('user_id', user.id)
        .eq('emoji', emoji)
        .single();

      if (existing) {
        // Remover reação
        const { error } = await supabase
          .from('team_message_reactions')
          .delete()
          .eq('id', existing.id);
        if (error) throw error;
        return { action: 'removed' };
      } else {
        // Adicionar reação
        const { error } = await supabase
          .from('team_message_reactions')
          .insert({
            message_id: messageId,
            user_id: user.id,
            organization_id: tenantId,
            emoji,
          });
        if (error) throw error;
        return { action: 'added' };
      }
    },
    onSuccess: (_, { messageId }) => {
      queryClient.invalidateQueries({ queryKey: ['message-reactions', messageId] });
      queryClient.invalidateQueries({ queryKey: ['conversation-reactions'] });
    },
  });
}

/**
 * Subscribe to realtime reactions
 */
export function useReactionsRealtime(conversationId: string | null) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`reactions-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'team_message_reactions',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['conversation-reactions'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, queryClient]);
}

// =============================================================================
// THREADS HOOKS
// =============================================================================

/**
 * Buscar respostas de uma thread
 */
export function useThreadReplies(threadId: string | null) {
  return useQuery({
    queryKey: ['thread-replies', threadId],
    queryFn: async () => {
      if (!threadId) return [];

      const { data, error } = await supabase
        .from('team_messages')
        .select('*')
        .eq('thread_id', threadId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!threadId,
  });
}

/**
 * Responder em thread
 */
export function useReplyToThread() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data: tenantId } = useCurrentTenantId();

  return useMutation({
    mutationFn: async ({
      threadId,
      conversationId,
      content,
      mentions = [],
    }: {
      threadId: string;
      conversationId: string;
      content: string;
      mentions?: any[];
    }) => {
      if (!tenantId || !user?.id) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('team_messages')
        .insert({
          conversation_id: conversationId,
          organization_id: tenantId,
          sender_id: user.id,
          content,
          mentions: mentions as any,
          thread_id: threadId,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, { threadId, conversationId }) => {
      queryClient.invalidateQueries({ queryKey: ['thread-replies', threadId] });
      queryClient.invalidateQueries({ queryKey: ['team-messages', conversationId] });
    },
  });
}

// =============================================================================
// PRESENCE HOOKS
// =============================================================================

/**
 * Buscar presença de usuários da organização
 */
export function useTeamPresence() {
  const { data: tenantId } = useCurrentTenantId();

  return useQuery({
    queryKey: ['team-presence', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];

      const { data, error } = await supabase
        .from('team_presence')
        .select('*')
        .eq('organization_id', tenantId);

      if (error) throw error;
      return (data || []) as UserPresence[];
    },
    enabled: !!tenantId,
    refetchInterval: 30000, // Refresh a cada 30s
  });
}

/**
 * Atualizar própria presença
 */
export function useUpdatePresence() {
  const queryClient = useQueryClient();
  const { data: tenantId } = useCurrentTenantId();

  return useMutation({
    mutationFn: async ({ status, statusMessage }: { status?: string; statusMessage?: string }) => {
      if (!tenantId) throw new Error('No tenant');

      const { error } = await supabase.rpc('update_user_presence', {
        p_organization_id: tenantId,
        p_status: status || 'online',
        p_status_message: statusMessage || null,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-presence'] });
    },
  });
}

/**
 * Hook para manter presença ativa
 */
export function usePresenceHeartbeat() {
  const updatePresence = useUpdatePresence();
  const { user } = useAuth();
  const { data: tenantId } = useCurrentTenantId();

  useEffect(() => {
    if (!user?.id || !tenantId) return;

    // Atualizar presença ao iniciar
    updatePresence.mutate({ status: 'online' });

    // Heartbeat a cada 60s
    const interval = setInterval(() => {
      updatePresence.mutate({ status: 'online' });
    }, 60000);

    // Marcar como offline ao sair
    const handleBeforeUnload = () => {
      updatePresence.mutate({ status: 'offline' });
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      updatePresence.mutate({ status: 'offline' });
    };
  }, [user?.id, tenantId]);
}

/**
 * Subscribe to presence realtime
 */
export function usePresenceRealtime() {
  const queryClient = useQueryClient();
  const { data: tenantId } = useCurrentTenantId();

  useEffect(() => {
    if (!tenantId) return;

    const channel = supabase
      .channel(`presence-${tenantId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'team_presence',
          filter: `organization_id=eq.${tenantId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['team-presence'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId, queryClient]);
}

// =============================================================================
// TYPING INDICATOR HOOKS
// =============================================================================

/**
 * Quem está digitando em uma conversa
 */
export function useTypingIndicator(conversationId: string | null) {
  const { data: tenantId } = useCurrentTenantId();
  const { user } = useAuth();

  return useQuery({
    queryKey: ['typing-indicator', conversationId],
    queryFn: async () => {
      if (!tenantId || !conversationId) return [];

      const { data, error } = await supabase
        .from('team_presence')
        .select('user_id, typing_started_at')
        .eq('organization_id', tenantId)
        .eq('is_typing_in', conversationId)
        .neq('user_id', user?.id || '');

      if (error) throw error;
      
      // Filtrar typing com mais de 10s (stale)
      const now = Date.now();
      return (data || []).filter((t: any) => {
        if (!t.typing_started_at) return false;
        const typingAge = now - new Date(t.typing_started_at).getTime();
        return typingAge < 10000; // 10 segundos
      });
    },
    enabled: !!conversationId && !!tenantId,
    refetchInterval: 5000, // Refresh a cada 5s
  });
}

/**
 * Enviar indicador de digitação
 */
export function useSendTypingIndicator() {
  const { data: tenantId } = useCurrentTenantId();
  const lastSentRef = useRef<number>(0);

  return useCallback(async (conversationId: string, isTyping: boolean) => {
    if (!tenantId) return;

    // Throttle: enviar no máximo a cada 3s
    const now = Date.now();
    if (isTyping && now - lastSentRef.current < 3000) return;
    lastSentRef.current = now;

    try {
      await supabase.rpc('set_typing_indicator', {
        p_organization_id: tenantId,
        p_conversation_id: conversationId,
        p_is_typing: isTyping,
      });
    } catch (error) {
      console.error('Error setting typing indicator:', error);
    }
  }, [tenantId]);
}

// =============================================================================
// CHANNELS (PUBLIC GROUPS) HOOKS
// =============================================================================

/**
 * Listar canais públicos da organização
 */
export function usePublicChannels() {
  const { data: tenantId } = useCurrentTenantId();

  return useQuery({
    queryKey: ['public-channels', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];

      const { data, error } = await supabase
        .from('team_conversations')
        .select('*')
        .eq('organization_id', tenantId)
        .eq('conversation_type', 'group')
        .eq('is_public', true)
        .eq('is_archived', false)
        .order('name');

      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });
}

/**
 * Criar canal público
 */
export function useCreateChannel() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data: tenantId } = useCurrentTenantId();

  return useMutation({
    mutationFn: async ({
      name,
      description,
      topic,
      isPublic = true,
    }: {
      name: string;
      description?: string;
      topic?: string;
      isPublic?: boolean;
    }) => {
      if (!tenantId || !user?.id) throw new Error('Not authenticated');

      // Criar slug a partir do nome
      const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');

      const { data: conversation, error: convError } = await supabase
        .from('team_conversations')
        .insert({
          organization_id: tenantId,
          conversation_type: 'group',
          name,
          description,
          channel_slug: slug,
          channel_topic: topic,
          is_public: isPublic,
          created_by: user.id,
        })
        .select()
        .single();

      if (convError) throw convError;

      // Adicionar criador como admin
      await supabase.from('team_conversation_members').insert({
        conversation_id: conversation.id,
        user_id: user.id,
        organization_id: tenantId,
        role: 'admin',
      });

      return conversation;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['public-channels'] });
      queryClient.invalidateQueries({ queryKey: ['team-conversations'] });
    },
  });
}

/**
 * Entrar em canal público
 */
export function useJoinChannel() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data: tenantId } = useCurrentTenantId();

  return useMutation({
    mutationFn: async (conversationId: string) => {
      if (!tenantId || !user?.id) throw new Error('Not authenticated');

      // Verificar se já é membro
      const { data: existing } = await supabase
        .from('team_conversation_members')
        .select('id')
        .eq('conversation_id', conversationId)
        .eq('user_id', user.id)
        .single();

      if (existing) return existing;

      const { data, error } = await supabase
        .from('team_conversation_members')
        .insert({
          conversation_id: conversationId,
          user_id: user.id,
          organization_id: tenantId,
          role: 'member',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-conversations'] });
    },
  });
}

/**
 * Sair de canal
 */
export function useLeaveChannel() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (conversationId: string) => {
      if (!user?.id) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('team_conversation_members')
        .delete()
        .eq('conversation_id', conversationId)
        .eq('user_id', user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-conversations'] });
    },
  });
}

// =============================================================================
// PINNED MESSAGES HOOKS
// =============================================================================

/**
 * Buscar mensagens fixadas de uma conversa
 */
export function usePinnedMessages(conversationId: string | null) {
  return useQuery({
    queryKey: ['pinned-messages', conversationId],
    queryFn: async () => {
      if (!conversationId) return [];

      const { data, error } = await supabase
        .from('team_pinned_messages')
        .select(`
          *,
          message:team_messages(*)
        `)
        .eq('conversation_id', conversationId)
        .order('pinned_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!conversationId,
  });
}

/**
 * Fixar/desfixar mensagem
 */
export function useTogglePinMessage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data: tenantId } = useCurrentTenantId();

  return useMutation({
    mutationFn: async ({ messageId, conversationId }: { messageId: string; conversationId: string }) => {
      if (!tenantId || !user?.id) throw new Error('Not authenticated');

      // Verificar se já está fixada
      const { data: existing } = await supabase
        .from('team_pinned_messages')
        .select('id')
        .eq('message_id', messageId)
        .single();

      if (existing) {
        // Desfixar
        const { error } = await supabase
          .from('team_pinned_messages')
          .delete()
          .eq('id', existing.id);
        if (error) throw error;
        return { action: 'unpinned' };
      } else {
        // Fixar
        const { error } = await supabase
          .from('team_pinned_messages')
          .insert({
            message_id: messageId,
            conversation_id: conversationId,
            organization_id: tenantId,
            pinned_by: user.id,
          });
        if (error) throw error;
        return { action: 'pinned' };
      }
    },
    onSuccess: (_, { conversationId }) => {
      queryClient.invalidateQueries({ queryKey: ['pinned-messages', conversationId] });
    },
  });
}

// =============================================================================
// FILES HOOKS
// =============================================================================

/**
 * Buscar arquivos de uma conversa
 */
export function useConversationFiles(conversationId: string | null) {
  return useQuery({
    queryKey: ['conversation-files', conversationId],
    queryFn: async () => {
      if (!conversationId) return [];

      const { data, error } = await supabase
        .from('team_files')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as TeamFile[];
    },
    enabled: !!conversationId,
  });
}

/**
 * Upload de arquivo
 */
export function useUploadTeamFile() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data: tenantId } = useCurrentTenantId();

  return useMutation({
    mutationFn: async ({
      file,
      conversationId,
      messageId,
    }: {
      file: File;
      conversationId: string;
      messageId?: string;
    }) => {
      if (!tenantId || !user?.id) throw new Error('Not authenticated');

      // Upload para storage
      const filePath = `${tenantId}/${user.id}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('team-files')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Pegar URL pública
      const { data: urlData } = supabase.storage
        .from('team-files')
        .getPublicUrl(filePath);

      // Registrar no banco
      const { data, error } = await supabase
        .from('team_files')
        .insert({
          organization_id: tenantId,
          conversation_id: conversationId,
          message_id: messageId,
          uploaded_by: user.id,
          file_name: file.name,
          file_type: file.type,
          file_size: file.size,
          file_url: urlData.publicUrl,
        })
        .select()
        .single();

      if (error) throw error;
      return data as TeamFile;
    },
    onSuccess: (_, { conversationId }) => {
      queryClient.invalidateQueries({ queryKey: ['conversation-files', conversationId] });
    },
  });
}

// =============================================================================
// SEARCH HOOKS
// =============================================================================

/**
 * Buscar mensagens
 */
export function useSearchMessages(query: string, conversationId?: string) {
  const { data: tenantId } = useCurrentTenantId();

  return useQuery({
    queryKey: ['search-messages', tenantId, query, conversationId],
    queryFn: async () => {
      if (!tenantId || !query || query.length < 2) return [];

      let queryBuilder = supabase
        .from('team_messages')
        .select(`
          *,
          conversation:team_conversations(id, name, conversation_type)
        `)
        .eq('organization_id', tenantId)
        .eq('is_deleted', false)
        .ilike('content', `%${query}%`)
        .order('created_at', { ascending: false })
        .limit(50);

      if (conversationId) {
        queryBuilder = queryBuilder.eq('conversation_id', conversationId);
      }

      const { data, error } = await queryBuilder;
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId && query.length >= 2,
  });
}
