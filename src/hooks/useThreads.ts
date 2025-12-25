import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentTenantId } from '@/hooks/useTenant';
import { toast } from '@/hooks/use-toast';

// =============================================================================
// TIPOS
// =============================================================================

export interface Thread {
  id: string;
  tenant_id: string;
  channel_id: string;
  phone_number: string;
  sendable_phone: string | null;
  customer_phone_e164: string | null;
  contact_name: string | null;
  contact_profile_pic: string | null;
  lead_id: string | null;
  unread_count: number;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
  // Campos de contato (Fase 2)
  contact_id: string | null;
  status: 'open' | 'closed' | 'pending';
  assigned_user_id: string | null;
  // Joins
  channel?: {
    name: string;
    provider: string;
    phone_e164: string | null;
  };
  lead?: {
    id: string;
    name: string;
    stage: string;
  };
  contact?: {
    id: string;
    full_name: string | null;
    email: string | null;
  };
}

export interface Message {
  id: string;
  conversation_id: string;
  instance_id: string;
  content: string | null;
  direction: 'inbound' | 'outbound';
  message_type: string;
  media_url: string | null;
  media_caption: string | null;
  status: string | null;
  is_from_bot: boolean;
  z_api_message_id: string | null;
  created_at: string;
}

export type ThreadFilter = 'all' | 'mine' | 'unassigned' | 'unread';

// =============================================================================
// HOOKS - THREADS
// =============================================================================

/**
 * Hook para listar threads do tenant com filtros
 */
export function useThreads(options?: {
  channelId?: string | null;
  filter?: ThreadFilter;
  status?: 'open' | 'closed' | 'pending';
  limit?: number;
}) {
  const { data: tenantId } = useCurrentTenantId();
  const { channelId, filter = 'all', status, limit = 50 } = options || {};

  return useQuery({
    queryKey: ['threads', tenantId, channelId, filter, status, limit],
    queryFn: async () => {
      if (!tenantId) return [];

      let query = supabase
        .from('whatsapp_conversations')
        .select(`
          *,
          channel:whatsapp_instances!instance_id (
            name,
            provider,
            phone_number
          ),
          lead:leads (
            id,
            name,
            stage
          ),
          contact:contacts (
            id,
            full_name,
            email
          )
        `)
        .eq('organization_id', tenantId)
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .limit(limit);

      // Filtro por canal
      if (channelId) {
        query = query.eq('instance_id', channelId);
      }

      // Filtro por status
      if (status) {
        query = query.eq('status', status);
      }

      // Filtro por não lidas
      if (filter === 'unread') {
        query = query.gt('unread_count', 0);
      }

      // Filtro por não lidas
      if (filter === 'unread') {
        query = query.gt('unread_count', 0);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching threads:', error);
        throw error;
      }

      return (data || []).map((thread: any) => ({
        ...thread,
        tenant_id: thread.organization_id,
        channel_id: thread.instance_id,
        // Usar valores reais agora que existem
        contact_id: thread.contact_id || null,
        customer_phone_e164: thread.customer_phone_e164 || null,
        status: thread.status || 'open',
        assigned_user_id: thread.assigned_user_id || null,
        channel: thread.channel ? {
          name: thread.channel.name,
          provider: thread.channel.provider,
          phone_e164: thread.channel.phone_number,
        } : undefined,
        contact: thread.contact ? {
          id: thread.contact.id,
          full_name: thread.contact.full_name,
          email: thread.contact.email,
        } : undefined,
      })) as Thread[];
    },
    enabled: !!tenantId,
    refetchInterval: 5000, // Polling a cada 5 segundos
  });
}

/**
 * Hook para obter uma thread específica
 */
export function useThread(threadId: string | null) {
  return useQuery({
    queryKey: ['thread', threadId],
    queryFn: async () => {
      if (!threadId) return null;

      const { data, error } = await supabase
        .from('whatsapp_conversations')
        .select(`
          *,
          channel:whatsapp_instances!instance_id (
            name,
            provider,
            phone_number
          ),
          lead:leads (
            id,
            name,
            stage,
            email,
            whatsapp
          ),
          contact:contacts (
            id,
            full_name,
            email
          )
        `)
        .eq('id', threadId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching thread:', error);
        throw error;
      }

      if (!data) return null;

      return {
        ...data,
        tenant_id: data.organization_id,
        channel_id: data.instance_id,
        contact_id: data.contact_id || null,
        customer_phone_e164: data.customer_phone_e164 || null,
        status: data.status || 'open',
        assigned_user_id: data.assigned_user_id || null,
        channel: data.channel ? {
          name: data.channel.name,
          provider: data.channel.provider,
          phone_e164: data.channel.phone_number,
        } : undefined,
        contact: data.contact ? {
          id: data.contact.id,
          full_name: data.contact.full_name,
          email: data.contact.email,
        } : undefined,
      } as Thread;
    },
    enabled: !!threadId,
  });
}

/**
 * Hook para contar threads não lidas
 */
export function useUnreadThreadsCount() {
  const { data: tenantId } = useCurrentTenantId();

  return useQuery({
    queryKey: ['unread-threads-count', tenantId],
    queryFn: async () => {
      if (!tenantId) return 0;

      const { count, error } = await supabase
        .from('whatsapp_conversations')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', tenantId)
        .gt('unread_count', 0);

      if (error) {
        console.error('Error counting unread threads:', error);
        return 0;
      }

      return count || 0;
    },
    enabled: !!tenantId,
    refetchInterval: 10000, // Atualiza a cada 10 segundos
  });
}

// =============================================================================
// HOOKS - MESSAGES
// =============================================================================

/**
 * Hook para listar mensagens de uma thread
 */
export function useMessages(threadId: string | null, limit = 100) {
  return useQuery({
    queryKey: ['messages', threadId, limit],
    queryFn: async () => {
      if (!threadId) return [];

      const { data, error } = await supabase
        .from('whatsapp_messages')
        .select('*')
        .eq('conversation_id', threadId)
        .order('created_at', { ascending: true })
        .limit(limit);

      if (error) {
        console.error('Error fetching messages:', error);
        throw error;
      }

      return (data || []) as Message[];
    },
    enabled: !!threadId,
    refetchInterval: 3000, // Polling a cada 3 segundos
  });
}

// =============================================================================
// MUTATIONS
// =============================================================================

/**
 * Hook para enviar mensagem
 */
export function useSendMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      threadId,
      instanceId,
      content,
      mediaType,
      mediaBase64,
      mediaUrl,
    }: {
      threadId: string;
      instanceId: string;
      content?: string;
      mediaType?: 'image' | 'audio' | 'document' | 'video';
      mediaBase64?: string;
      mediaUrl?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('whatsapp-send-message', {
        body: {
          conversationId: threadId,
          instanceId,
          content,
          mediaType,
          mediaBase64,
          mediaUrl,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['messages', variables.threadId] });
      queryClient.invalidateQueries({ queryKey: ['threads'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao enviar mensagem',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

/**
 * Hook para marcar thread como lida
 */
export function useMarkThreadAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (threadId: string) => {
      const { error } = await supabase
        .from('whatsapp_conversations')
        .update({ unread_count: 0 })
        .eq('id', threadId);

      if (error) throw error;
    },
    onSuccess: (_, threadId) => {
      queryClient.invalidateQueries({ queryKey: ['thread', threadId] });
      queryClient.invalidateQueries({ queryKey: ['threads'] });
      queryClient.invalidateQueries({ queryKey: ['unread-threads-count'] });
    },
  });
}

/**
 * Hook para vincular thread a um lead
 */
export function useLinkThreadToLead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      threadId,
      leadId,
    }: {
      threadId: string;
      leadId: string | null;
    }) => {
      const { data, error } = await supabase
        .from('whatsapp_conversations')
        .update({ lead_id: leadId })
        .eq('id', threadId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['thread', variables.threadId] });
      queryClient.invalidateQueries({ queryKey: ['threads'] });
      toast({
        title: variables.leadId ? 'Lead vinculado' : 'Lead desvinculado',
        description: variables.leadId 
          ? 'A conversa foi vinculada ao lead.' 
          : 'A conversa foi desvinculada do lead.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao vincular lead',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
