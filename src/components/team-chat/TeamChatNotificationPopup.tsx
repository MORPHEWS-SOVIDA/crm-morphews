import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, MessageCircle, Send, ExternalLink, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useSendTeamMessage } from '@/hooks/useTeamChat';
import { toast } from 'sonner';

export interface NotificationData {
  id: string;
  conversationId: string;
  conversationName: string;
  conversationType: 'direct' | 'group' | 'contextual';
  senderId: string;
  senderName: string;
  senderAvatar: string | null;
  content: string;
  contentType: 'text' | 'image' | 'file' | 'audio' | 'system';
  createdAt: string;
}

interface TeamChatNotificationPopupProps {
  notification: NotificationData;
  onDismiss: () => void;
  index: number;
}

export function TeamChatNotificationPopup({
  notification,
  onDismiss,
  index,
}: TeamChatNotificationPopupProps) {
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [isVisible, setIsVisible] = useState(false);
  const sendMessage = useSendTeamMessage();

  // Animação de entrada
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  // Auto-dismiss após 15 segundos (se não expandido)
  useEffect(() => {
    if (isExpanded) return;
    
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onDismiss, 300);
    }, 15000);

    return () => clearTimeout(timer);
  }, [isExpanded, onDismiss]);

  const handleReply = async () => {
    if (!replyText.trim()) return;

    try {
      await sendMessage.mutateAsync({
        conversationId: notification.conversationId,
        content: replyText.trim(),
      });
      
      setReplyText('');
      setIsExpanded(false);
      toast.success('Mensagem enviada!');
      
      // Fechar após enviar
      setIsVisible(false);
      setTimeout(onDismiss, 300);
    } catch (error) {
      toast.error('Erro ao enviar mensagem');
    }
  };

  const handleGoToChat = () => {
    navigate('/conecta-time', { state: { conversationId: notification.conversationId } });
    onDismiss();
  };

  const handleDismiss = () => {
    setIsVisible(false);
    setTimeout(onDismiss, 300);
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getContextIcon = () => {
    switch (notification.conversationType) {
      case 'direct':
        return <User className="h-3 w-3" />;
      case 'group':
        return <MessageCircle className="h-3 w-3" />;
      case 'contextual':
        return <ExternalLink className="h-3 w-3" />;
      default:
        return <MessageCircle className="h-3 w-3" />;
    }
  };

  const truncateContent = (content: string, maxLength = 100) => {
    if (content.length <= maxLength) return content;
    return content.slice(0, maxLength) + '...';
  };

  return (
    <div
      className={cn(
        "pointer-events-auto w-80 md:w-96 bg-card border rounded-xl shadow-2xl overflow-hidden",
        "transform transition-all duration-300 ease-out",
        isVisible
          ? "translate-x-0 opacity-100"
          : "translate-x-full opacity-0"
      )}
      style={{
        transitionDelay: `${index * 50}ms`,
      }}
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-primary/10 to-primary/5 px-4 py-3 flex items-center gap-3">
        <Avatar className="h-10 w-10 ring-2 ring-primary/20">
          <AvatarImage src={notification.senderAvatar || undefined} />
          <AvatarFallback className="bg-primary/20 text-primary text-sm font-medium">
            {getInitials(notification.senderName)}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-foreground truncate">
              {notification.senderName}
            </span>
            {notification.conversationType !== 'direct' && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
                {getContextIcon()}
                <span className="truncate max-w-[100px]">
                  {notification.conversationName}
                </span>
              </div>
            )}
          </div>
          <span className="text-xs text-muted-foreground">
            Conecta Time • Agora
          </span>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 hover:bg-destructive/10 hover:text-destructive"
          onClick={handleDismiss}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Content */}
      <div className="px-4 py-3">
        <p className="text-sm text-foreground leading-relaxed">
          {notification.contentType === 'text'
            ? truncateContent(notification.content, isExpanded ? 500 : 150)
            : notification.contentType === 'image'
            ? '📷 Imagem'
            : notification.contentType === 'file'
            ? '📎 Arquivo'
            : notification.contentType === 'audio'
            ? '🎵 Áudio'
            : notification.content}
        </p>
      </div>

      {/* Reply area (expanded) */}
      {isExpanded && (
        <div className="px-4 pb-3 border-t bg-muted/30">
          <Textarea
            placeholder="Digite sua resposta..."
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            className="mt-3 min-h-[60px] resize-none text-sm"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleReply();
              }
            }}
          />
          <div className="flex justify-end gap-2 mt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(false)}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleReply}
              disabled={!replyText.trim() || sendMessage.isPending}
              className="gap-1"
            >
              <Send className="h-3 w-3" />
              Enviar
            </Button>
          </div>
        </div>
      )}

      {/* Actions */}
      {!isExpanded && (
        <div className="px-4 pb-3 flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => setIsExpanded(true)}
          >
            <MessageCircle className="h-4 w-4 mr-2" />
            Responder
          </Button>
          <Button
            size="sm"
            className="flex-1"
            onClick={handleGoToChat}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Abrir Chat
          </Button>
        </div>
      )}
    </div>
  );
}
