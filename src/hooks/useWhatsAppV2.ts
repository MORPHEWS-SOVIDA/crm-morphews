import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useEffect } from 'react';

// =====================================================
// TYPES (adapted from original whatsapp tables)
// =====================================================

export interface WhatsAppV2Instance {
  id: string;
  created_at: string;
  updated_at: string;
  organization_id: string;
  name: string;
  phone_number: string | null;
  status: 'pending' | 'active' | 'connected' | 'disconnected' | 'waiting_qr' | 'logged_out' | 'error';
  is_connected: boolean;
  qr_code_base64: string | null;
  wasender_session_id: string | null;
  wasender_api_key: string | null;
}

export interface WhatsAppV2Chat {
  id: string;
  created_at: string;
  updated_at: string;
  instance_id: string;
  organization_id: string;
  whatsapp_id: string; // maps to phone_number or chat_id
  name: string | null;
  image_url: string | null;
  is_group: boolean;
  last_message: string | null;
  last_message_time: string | null;
  unread_count: number;
  is_archived: boolean;
  is_pinned: boolean;
  lead_id: string | null;
  contact_id: string | null;
}

export interface WhatsAppV2Message {
  id: string;
  created_at: string;
  chat_id: string;
  tenant_id: string;
  content: string | null;
  media_url: string | null;
  media_type: 'text' | 'image' | 'audio' | 'video' | 'document' | 'sticker' | 'location' | 'contact';
  media_mime_type: string | null;
  media_filename: string | null;
  is_from_me: boolean;
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
  wa_message_id: string | null;
  sender_name: string | null;
  sender_phone: string | null;
  quoted_message_id: string | null;
  quoted_content: string | null;
  error_message: string | null;
  metadata: unknown;
}

// =====================================================
// INSTANCES HOOKS - Using whatsapp_instances table
// =====================================================

export function useWhatsAppV2Instances() {
  const { user, profile } = useAuth();

  return useQuery({
    queryKey: ['whatsapp-v2-instances', user?.id, profile?.organization_id],
    queryFn: async () => {
      if (!user) return [];

      // Use the same access rule as the "WhatsApp normal" screen (whatsapp_instance_users)
      // NOTE: do NOT select "*" to avoid permission issues with sensitive columns.
      const { data, error } = await supabase
        .from('whatsapp_instance_users')
        .select(
          `
          instance_id,
          whatsapp_instances!inner (
            id,
            created_at,
            updated_at,
            organization_id,
            name,
            phone_number,
            status,
            is_connected,
            qr_code_base64,
            wasender_session_id
          )
        `
        )
        .eq('user_id', user.id)
        .eq('can_view', true);

      if (error) throw error;

      const instances = (data || []).map((d: any) => d.whatsapp_instances);
      instances.sort(
        (a: any, b: any) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );

      // Map to V2 format
      return (instances || []).map((inst: any) => ({
        id: inst.id,
        created_at: inst.created_at,
        updated_at: inst.updated_at,
        organization_id: inst.organization_id,
        name: inst.name,
        phone_number: inst.phone_number,
        status: inst.status as WhatsAppV2Instance['status'],
        is_connected: inst.is_connected,
        qr_code_base64: inst.qr_code_base64,
        wasender_session_id: inst.wasender_session_id,
        wasender_api_key: null,
      })) as WhatsAppV2Instance[];
    },
    enabled: !!user,
  });
}

export function useWhatsAppV2Instance(instanceId: string | null) {
  return useQuery({
    queryKey: ['whatsapp-v2-instance', instanceId],
    queryFn: async () => {
      if (!instanceId) return null;
      
      const { data, error } = await supabase
        .from('whatsapp_instances')
        .select('*')
        .eq('id', instanceId)
        .maybeSingle();
      
      if (error) throw error;
      if (!data) return null;
      
      return {
        id: data.id,
        created_at: data.created_at,
        updated_at: data.updated_at,
        organization_id: data.organization_id,
        name: data.name,
        phone_number: data.phone_number,
        status: data.status as WhatsAppV2Instance['status'],
        is_connected: data.is_connected,
        qr_code_base64: data.qr_code_base64,
        wasender_session_id: data.wasender_session_id,
        wasender_api_key: data.wasender_api_key,
      } as WhatsAppV2Instance;
    },
    enabled: !!instanceId,
  });
}

export function useInitWhatsAppV2Session() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  
  return useMutation({
    mutationFn: async (data: { sessionName: string; phoneNumber?: string }) => {
      if (!profile?.organization_id) throw new Error('Organização não encontrada');
      
      const { data: response, error } = await supabase.functions.invoke('whatsapp-init-session', {
        body: {
          sessionName: data.sessionName,
          phoneNumber: data.phoneNumber,
          tenantId: profile.organization_id,
        },
      });
      
      if (error) throw error;
      if (response?.error) throw new Error(response.error);
      
      return response as { qrCode: string; instanceId: string; sessionKey?: string; message?: string };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-v2-instances'] });
      queryClient.invalidateQueries({ queryKey: ['whatsapp-instances'] });
    },
  });
}

export function useCreateWhatsAppV2Instance() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  
  return useMutation({
    mutationFn: async (data: { name: string; api_url: string; api_key: string }) => {
      if (!profile?.organization_id) throw new Error('Organização não encontrada');
      
      const { data: instance, error } = await supabase
        .from('whatsapp_instances')
        .insert({
          name: data.name,
          organization_id: profile.organization_id,
          provider: 'wasenderapi',
          status: 'pending',
        })
        .select()
        .single();
      
      if (error) throw error;
      
      return {
        id: instance.id,
        created_at: instance.created_at,
        updated_at: instance.updated_at,
        organization_id: instance.organization_id,
        name: instance.name,
        phone_number: instance.phone_number,
        status: instance.status as WhatsAppV2Instance['status'],
        is_connected: instance.is_connected,
        qr_code_base64: instance.qr_code_base64,
        wasender_session_id: instance.wasender_session_id,
        wasender_api_key: instance.wasender_api_key,
      } as WhatsAppV2Instance;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-v2-instances'] });
      queryClient.invalidateQueries({ queryKey: ['whatsapp-instances'] });
    },
  });
}

export function useUpdateWhatsAppV2Instance() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<WhatsAppV2Instance> & { id: string }) => {
      const { error } = await supabase
        .from('whatsapp_instances')
        .update(data)
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-v2-instances'] });
      queryClient.invalidateQueries({ queryKey: ['whatsapp-instances'] });
      queryClient.invalidateQueries({ queryKey: ['whatsapp-v2-instance', variables.id] });
    },
  });
}

// =====================================================
// CHATS HOOKS - Using whatsapp_conversations table
// =====================================================

export function useWhatsAppV2Chats(instanceId: string | null) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  
  // Realtime subscription
  useEffect(() => {
    if (!profile?.organization_id) return;

    const channel = supabase
      .channel('whatsapp-v2-chats-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'whatsapp_conversations',
        },
        () => {
          // Invalidate the whole list (covers instance changes too)
          queryClient.invalidateQueries({ queryKey: ['whatsapp-v2-chats'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.organization_id, queryClient]);

  return useQuery({
    queryKey: ['whatsapp-v2-chats', instanceId],
    queryFn: async () => {
      if (!profile?.organization_id) return [];

      let query = supabase
        .from('whatsapp_conversations')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .order('last_message_at', { ascending: false, nullsFirst: false });

      // IMPORTANT: same behavior as WhatsApp normal (instance_id OR current_instance_id)
      if (instanceId) {
        query = query.or(`instance_id.eq.${instanceId},current_instance_id.eq.${instanceId}`);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Map to V2 Chat format
      return (data || []).map(conv => ({
        id: conv.id,
        created_at: conv.created_at,
        updated_at: conv.updated_at,
        instance_id: conv.instance_id,
        organization_id: conv.organization_id,
        whatsapp_id: conv.chat_id || conv.phone_number || '',
        name: conv.display_name || conv.contact_name || conv.group_subject,
        image_url: conv.contact_profile_pic,
        is_group: conv.is_group || false,
        last_message: null, // Will be fetched separately if needed
        last_message_time: conv.last_message_at,
        unread_count: conv.unread_count || 0,
        is_archived: false,
        is_pinned: false,
        lead_id: conv.lead_id,
        contact_id: conv.contact_id,
      })) as WhatsAppV2Chat[];
    },
    enabled: !!profile?.organization_id,
  });
}

export function useWhatsAppV2Chat(chatId: string | null) {
  return useQuery({
    queryKey: ['whatsapp-v2-chat', chatId],
    queryFn: async () => {
      if (!chatId) return null;
      
      const { data, error } = await supabase
        .from('whatsapp_conversations')
        .select('*')
        .eq('id', chatId)
        .maybeSingle();
      
      if (error) throw error;
      if (!data) return null;
      
      return {
        id: data.id,
        created_at: data.created_at,
        updated_at: data.updated_at,
        instance_id: data.instance_id,
        organization_id: data.organization_id,
        whatsapp_id: data.chat_id || data.phone_number || '',
        name: data.display_name || data.contact_name || data.group_subject,
        image_url: data.contact_profile_pic,
        is_group: data.is_group || false,
        last_message: null,
        last_message_time: data.last_message_at,
        unread_count: data.unread_count || 0,
        is_archived: false,
        is_pinned: false,
        lead_id: data.lead_id,
        contact_id: data.contact_id,
      } as WhatsAppV2Chat;
    },
    enabled: !!chatId,
  });
}

export function useUpdateWhatsAppV2Chat() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<WhatsAppV2Chat> & { id: string }) => {
      const updateData: Record<string, unknown> = {};
      if (data.name !== undefined) updateData.display_name = data.name;
      if (data.unread_count !== undefined) updateData.unread_count = data.unread_count;
      
      const { error } = await supabase
        .from('whatsapp_conversations')
        .update(updateData)
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-v2-chats'] });
    },
  });
}

// =====================================================
// MESSAGES HOOKS - Using whatsapp_messages table
// =====================================================

export function useWhatsAppV2Messages(chatId: string | null) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  
  // Realtime subscription
  useEffect(() => {
    if (!chatId || !profile?.organization_id) return;
    
    const channel = supabase
      .channel(`whatsapp-v2-messages-${chatId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'whatsapp_messages',
          filter: `conversation_id=eq.${chatId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['whatsapp-v2-messages', chatId] });
        }
      )
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [chatId, profile?.organization_id, queryClient]);
  
  return useQuery({
    queryKey: ['whatsapp-v2-messages', chatId],
    queryFn: async () => {
      if (!chatId) return [];
      
      const { data, error } = await supabase
        .from('whatsapp_messages')
        .select('*')
        .eq('conversation_id', chatId)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      
      // Map to V2 Message format
      return (data || []).map(msg => ({
        id: msg.id,
        created_at: msg.created_at,
        chat_id: msg.conversation_id,
        tenant_id: '',
        content: msg.content,
        media_url: msg.media_url,
        media_type: (msg.message_type || 'text') as WhatsAppV2Message['media_type'],
        media_mime_type: null,
        media_filename: null,
        is_from_me: msg.direction === 'outbound',
        status: (msg.status || 'sent') as WhatsAppV2Message['status'],
        wa_message_id: msg.provider_message_id || msg.z_api_message_id,
        sender_name: null,
        sender_phone: null,
        quoted_message_id: null,
        quoted_content: null,
        error_message: null,
        metadata: null,
      })) as WhatsAppV2Message[];
    },
    enabled: !!chatId,
  });
}

export function useSendWhatsAppV2Message() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: {
      chat_id: string;
      instance_id: string;
      content: string;
    }) => {
      // First get the conversation to find the phone number
      const { data: conversation, error: convError } = await supabase
        .from('whatsapp_conversations')
        .select('phone_number, sendable_phone, chat_id')
        .eq('id', data.chat_id)
        .single();
      
      if (convError) throw convError;
      
      const phone = conversation.sendable_phone || conversation.phone_number;
      const chatIdValue = conversation.chat_id;
      
      // Use whatsapp-send-message edge function
      const { data: response, error } = await supabase.functions.invoke('whatsapp-send-message', {
        body: {
          instanceId: data.instance_id,
          to: phone,
          chatId: chatIdValue,
          content: data.content,
          conversationId: data.chat_id,
        },
      });
      
      if (error) throw error;
      if (response?.error) throw new Error(response.error);
      
      return {
        id: response.messageId || crypto.randomUUID(),
        created_at: new Date().toISOString(),
        chat_id: data.chat_id,
        tenant_id: '',
        content: data.content,
        media_url: null,
        media_type: 'text' as const,
        media_mime_type: null,
        media_filename: null,
        is_from_me: true,
        status: 'sent' as const,
        wa_message_id: response.providerMessageId,
        sender_name: null,
        sender_phone: null,
        quoted_message_id: null,
        quoted_content: null,
        error_message: null,
        metadata: null,
      } as WhatsAppV2Message;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-v2-messages', data.chat_id] });
      queryClient.invalidateQueries({ queryKey: ['whatsapp-v2-chats'] });
    },
  });
}

// =====================================================
// UNREAD COUNT HOOK
// =====================================================

export function useWhatsAppV2UnreadCount(instanceId?: string | null) {
  const { profile } = useAuth();
  
  return useQuery({
    queryKey: ['whatsapp-v2-unread-count', instanceId],
    queryFn: async () => {
      if (!profile?.organization_id) return 0;
      
      let query = supabase
        .from('whatsapp_conversations')
        .select('unread_count')
        .eq('organization_id', profile.organization_id)
        .gt('unread_count', 0);
      
      if (instanceId) {
        query = query.eq('instance_id', instanceId);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      return data.reduce((sum, chat) => sum + (chat.unread_count || 0), 0);
    },
    enabled: !!profile?.organization_id,
  });
}

// =====================================================
// MARK AS READ HOOK
// =====================================================

export function useMarkWhatsAppV2ChatAsRead() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (chatId: string) => {
      const { error } = await supabase
        .from('whatsapp_conversations')
        .update({ unread_count: 0 })
        .eq('id', chatId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-v2-chats'] });
      queryClient.invalidateQueries({ queryKey: ['whatsapp-v2-unread-count'] });
    },
  });
}
