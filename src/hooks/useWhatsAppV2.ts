import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useEffect } from 'react';

// =====================================================
// TYPES
// =====================================================

export interface WhatsAppV2Instance {
  id: string;
  created_at: string;
  updated_at: string;
  tenant_id: string;
  name: string;
  api_url: string;
  api_key: string;
  phone_number: string | null;
  status: 'connected' | 'disconnected' | 'qrcode' | 'connecting';
  is_active: boolean;
  last_connected_at: string | null;
  qr_code: string | null;
  session_data: unknown | null;
}

export interface WhatsAppV2Chat {
  id: string;
  created_at: string;
  updated_at: string;
  instance_id: string;
  tenant_id: string;
  whatsapp_id: string;
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
// INSTANCES HOOKS
// =====================================================

export function useWhatsAppV2Instances() {
  const { profile } = useAuth();
  
  return useQuery({
    queryKey: ['whatsapp-v2-instances', profile?.organization_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('whatsapp_v2_instances')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      return data as WhatsAppV2Instance[];
    },
    enabled: !!profile?.organization_id,
  });
}

export function useWhatsAppV2Instance(instanceId: string | null) {
  return useQuery({
    queryKey: ['whatsapp-v2-instance', instanceId],
    queryFn: async () => {
      if (!instanceId) return null;
      
      const { data, error } = await supabase
        .from('whatsapp_v2_instances')
        .select('*')
        .eq('id', instanceId)
        .maybeSingle();
      
      if (error) throw error;
      return data as WhatsAppV2Instance | null;
    },
    enabled: !!instanceId,
  });
}

export function useInitWhatsAppV2Session() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  
  return useMutation({
    mutationFn: async (data: { sessionName: string }) => {
      if (!profile?.organization_id) throw new Error('Organização não encontrada');
      
      const { data: response, error } = await supabase.functions.invoke('whatsapp-init-session', {
        body: {
          sessionName: data.sessionName,
          tenantId: profile.organization_id,
        },
      });
      
      if (error) throw error;
      if (response?.error) throw new Error(response.error);
      
      return response as { qrCode: string; instanceId: string; sessionKey?: string; message: string };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-v2-instances'] });
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
        .from('whatsapp_v2_instances')
        .insert({
          ...data,
          tenant_id: profile.organization_id,
        })
        .select()
        .single();
      
      if (error) throw error;
      return instance as WhatsAppV2Instance;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-v2-instances'] });
    },
  });
}

export function useUpdateWhatsAppV2Instance() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<WhatsAppV2Instance> & { id: string }) => {
      // Remove session_data from the spread to avoid type issues
      const { session_data, ...updateData } = data;
      const { data: instance, error } = await supabase
        .from('whatsapp_v2_instances')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return instance as WhatsAppV2Instance;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-v2-instances'] });
      queryClient.invalidateQueries({ queryKey: ['whatsapp-v2-instance', variables.id] });
    },
  });
}

// =====================================================
// CHATS HOOKS
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
          table: 'whatsapp_v2_chats',
          filter: instanceId ? `instance_id=eq.${instanceId}` : undefined,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['whatsapp-v2-chats', instanceId] });
        }
      )
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [instanceId, profile?.organization_id, queryClient]);
  
  return useQuery({
    queryKey: ['whatsapp-v2-chats', instanceId],
    queryFn: async () => {
      let query = supabase
        .from('whatsapp_v2_chats')
        .select('*')
        .eq('is_archived', false)
        .order('is_pinned', { ascending: false })
        .order('last_message_time', { ascending: false, nullsFirst: false });
      
      if (instanceId) {
        query = query.eq('instance_id', instanceId);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data as WhatsAppV2Chat[];
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
        .from('whatsapp_v2_chats')
        .select('*')
        .eq('id', chatId)
        .maybeSingle();
      
      if (error) throw error;
      return data as WhatsAppV2Chat | null;
    },
    enabled: !!chatId,
  });
}

export function useUpdateWhatsAppV2Chat() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<WhatsAppV2Chat> & { id: string }) => {
      const { data: chat, error } = await supabase
        .from('whatsapp_v2_chats')
        .update(data)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return chat as WhatsAppV2Chat;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-v2-chats'] });
      queryClient.invalidateQueries({ queryKey: ['whatsapp-v2-chat', data.id] });
    },
  });
}

// =====================================================
// MESSAGES HOOKS
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
          table: 'whatsapp_v2_messages',
          filter: `chat_id=eq.${chatId}`,
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
        .from('whatsapp_v2_messages')
        .select('*')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      return data as WhatsAppV2Message[];
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
      const { data: response, error } = await supabase.functions.invoke('whatsapp-send', {
        body: {
          chatId: data.chat_id,
          instanceId: data.instance_id,
          content: data.content,
        },
      });
      
      if (error) throw error;
      if (response?.error) throw new Error(response.error);
      
      return response as WhatsAppV2Message;
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
      let query = supabase
        .from('whatsapp_v2_chats')
        .select('unread_count')
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
        .from('whatsapp_v2_chats')
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
