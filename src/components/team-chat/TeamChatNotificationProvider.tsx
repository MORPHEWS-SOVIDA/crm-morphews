import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentTenantId } from '@/hooks/useTenant';
import { useQueryClient } from '@tanstack/react-query';
import { TeamChatNotificationPopup, NotificationData } from './TeamChatNotificationPopup';

/**
 * Provider global que escuta novas mensagens em tempo real
 * e mostra popups de notificação quando o usuário recebe uma mensagem
 */
export function TeamChatNotificationProvider() {
  const { user } = useAuth();
  const { data: tenantId } = useCurrentTenantId();
  const queryClient = useQueryClient();
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const processedMessageIds = useRef<Set<string>>(new Set());

  const handleNewMessage = useCallback(async (payload: any) => {
    const message = payload.new;
    
    // Não notificar mensagens próprias
    if (message.sender_id === user?.id) return;
    
    // Evitar notificações duplicadas
    if (processedMessageIds.current.has(message.id)) return;
    processedMessageIds.current.add(message.id);
    
    // Limpar cache de IDs processados (manter últimos 100)
    if (processedMessageIds.current.size > 100) {
      const idsArray = Array.from(processedMessageIds.current);
      processedMessageIds.current = new Set(idsArray.slice(-50));
    }

    try {
      // Verificar se o usuário é membro desta conversa
      const { data: membership } = await supabase
        .from('team_conversation_members')
        .select('id')
        .eq('conversation_id', message.conversation_id)
        .eq('user_id', user?.id)
        .single();

      if (!membership) return; // Não é membro desta conversa

      // Buscar dados da conversa
      const { data: conversation } = await supabase
        .from('team_conversations')
        .select('id, name, conversation_type, context_type, context_name')
        .eq('id', message.conversation_id)
        .single();

      if (!conversation) return;

      // Buscar perfil do remetente
      const { data: senderProfile } = await supabase
        .from('profiles')
        .select('first_name, last_name, avatar_url')
        .eq('user_id', message.sender_id)
        .single();

      const senderName = senderProfile
        ? `${senderProfile.first_name || ''} ${senderProfile.last_name || ''}`.trim() || 'Usuário'
        : 'Usuário';

      // Determinar nome da conversa
      let conversationName = conversation.name;
      if (conversation.conversation_type === 'direct') {
        conversationName = senderName;
      } else if (conversation.conversation_type === 'contextual' && conversation.context_name) {
        conversationName = `${conversation.context_type?.toUpperCase()}: ${conversation.context_name}`;
      }

      const notification: NotificationData = {
        id: message.id,
        conversationId: message.conversation_id,
        conversationName: conversationName || 'Conversa',
        conversationType: conversation.conversation_type as 'direct' | 'group' | 'contextual',
        senderId: message.sender_id,
        senderName,
        senderAvatar: senderProfile?.avatar_url || null,
        content: message.content,
        contentType: message.content_type as 'text' | 'image' | 'file' | 'audio' | 'system',
        createdAt: message.created_at,
      };

      setNotifications(prev => [...prev, notification]);

      // Invalidar queries para atualizar contadores
      queryClient.invalidateQueries({ queryKey: ['team-unread-total'] });
      queryClient.invalidateQueries({ queryKey: ['team-conversations'] });
    } catch (error) {
      console.error('Erro ao processar notificação:', error);
    }
  }, [user?.id, queryClient]);

  const dismissNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  useEffect(() => {
    if (!user?.id || !tenantId) return;

    // Escutar novas mensagens em TODAS as conversas da organização
    const channel = supabase
      .channel(`team-notifications-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'team_messages',
          filter: `organization_id=eq.${tenantId}`,
        },
        handleNewMessage
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, tenantId, handleNewMessage]);

  return (
    <div className="fixed bottom-24 right-6 z-[60] flex flex-col-reverse gap-3 max-h-[60vh] overflow-hidden pointer-events-none">
      {notifications.map((notification, index) => (
        <TeamChatNotificationPopup
          key={notification.id}
          notification={notification}
          onDismiss={() => dismissNotification(notification.id)}
          index={index}
        />
      ))}
    </div>
  );
}
