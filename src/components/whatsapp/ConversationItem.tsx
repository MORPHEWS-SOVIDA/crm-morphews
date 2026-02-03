import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { UserCheck, Clock, CheckCircle, Hand, XCircle, Zap, Bot, MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

// Ícone do Instagram inline
const InstagramIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
  </svg>
);

interface Conversation {
  id: string;
  phone_number: string;
  contact_name: string | null;
  contact_profile_pic: string | null;
  last_message_at: string | null;
  unread_count: number;
  lead_id: string | null;
  instance_id: string;
  status?: string;
  assigned_user_id?: string | null;
  designated_user_id?: string | null;
  has_nps_rating?: boolean;
  channel_type?: 'whatsapp' | 'instagram' | 'facebook' | 'email';
}

interface ConversationItemProps {
  conversation: Conversation;
  isSelected: boolean;
  onClick: () => void;
  instanceLabel?: string | null;
  showClaimButton?: boolean;
  onClaim?: () => void;
  isClaiming?: boolean;
  onClose?: () => void;
  isClosing?: boolean;
  assignedUserName?: string | null;
  currentUserId?: string;
  showCloseWithoutNPS?: boolean;
  onCloseWithoutNPS?: () => void;
  isClosingWithoutNPS?: boolean;
}

export function ConversationItem({ 
  conversation, 
  isSelected, 
  onClick, 
  instanceLabel,
  showClaimButton,
  onClaim,
  isClaiming,
  onClose,
  isClosing,
  assignedUserName,
  currentUserId,
  showCloseWithoutNPS,
  onCloseWithoutNPS,
  isClosingWithoutNPS,
}: ConversationItemProps) {
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    if (isToday) {
      return format(date, 'HH:mm', { locale: ptBR });
    }
    
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return 'Ontem';
    }
    
    return format(date, 'dd/MM', { locale: ptBR });
  };

  const status = conversation.status || 'pending';
  const isAssignedToMe = conversation.assigned_user_id === currentUserId;
  const isDesignatedToMe = conversation.designated_user_id === currentUserId;
  
  const getStatusIcon = () => {
    switch (status) {
      case 'with_bot':
        return <Bot className="h-3 w-3 text-purple-600" />;
      case 'pending':
        return <Clock className="h-3 w-3 text-yellow-600" />;
      case 'autodistributed':
        return <Zap className="h-3 w-3 text-blue-600" />;
      case 'assigned':
        return <UserCheck className="h-3 w-3 text-green-600" />;
      case 'closed':
        return <CheckCircle className="h-3 w-3 text-gray-500" />;
      default:
        return null;
    }
  };

  const getStatusBadge = () => {
    if (status === 'with_bot') {
      return (
        <span className="text-[10px] text-purple-600 truncate max-w-[80px]">
          Com robô
        </span>
      );
    }
    if (status === 'autodistributed' && isDesignatedToMe) {
      return (
        <span className="text-[10px] text-blue-600 truncate max-w-[80px]">
          Pra você
        </span>
      );
    }
    if (status === 'assigned' && assignedUserName) {
      return (
        <span className="text-[10px] text-green-600 truncate max-w-[80px]">
          {isAssignedToMe ? 'Meu' : assignedUserName.split(' ')[0]}
        </span>
      );
    }
    // Badge "N" para conversas encerradas com NPS
    if (status === 'closed' && conversation.has_nps_rating) {
      return (
        <span className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-amber-500 text-white text-[9px] font-bold" title="NPS respondido">
          N
        </span>
      );
    }
    return null;
  };

  const handleClaimClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClaim?.();
  };

  const handleCloseClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClose?.();
  };

  const handleCloseWithoutNPSClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onCloseWithoutNPS?.();
  };

  const isAssignedToCurrentUser = conversation.assigned_user_id === currentUserId;
  
  // Mostrar botão ATENDER para: pendente OU autodistribuído (se for o usuário designado) OU with_bot
  const canShowClaimButton = showClaimButton && (
    status === 'pending' || 
    !status || 
    (status === 'autodistributed' && isDesignatedToMe) ||
    status === 'with_bot'
  );
  
  const isWithBot = status === 'with_bot';

  // Determina se a conversa precisa de resposta urgente
  // (atribuída ao usuário atual e tem mensagens não lidas)
  const needsReply = isAssignedToMe && conversation.unread_count > 0;

  return (
    <div
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 p-3 cursor-pointer transition-all border-b border-border/50",
        isSelected 
          ? "bg-accent" 
          : "hover:bg-accent/50",
        status === 'closed' && "opacity-60",
        // Destaque visual para conversas que precisam de resposta
        needsReply && !isSelected && "bg-orange-50 dark:bg-orange-950/30 border-l-4 border-l-orange-500 animate-pulse"
      )}
    >
      {/* Avatar with status indicator and channel badge */}
      <div className="relative flex-shrink-0">
        <Avatar className={cn(
          "h-12 w-12",
          conversation.channel_type === 'instagram' && "ring-2 ring-pink-500"
        )}>
          <AvatarImage src={conversation.contact_profile_pic || undefined} />
          <AvatarFallback className={cn(
            "text-white font-medium",
            conversation.channel_type === 'instagram' 
              ? "bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400"
              : "bg-gradient-to-br from-green-400 to-green-600"
          )}>
            {conversation.contact_name?.[0]?.toUpperCase() || conversation.phone_number.slice(-2)}
          </AvatarFallback>
        </Avatar>
        {/* Channel icon badge (top-left) */}
        <div className={cn(
          "absolute -top-1 -left-1 h-5 w-5 rounded-full border-2 border-card flex items-center justify-center",
          conversation.channel_type === 'instagram' 
            ? "bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400" 
            : "bg-green-500"
        )}>
          {conversation.channel_type === 'instagram' ? (
            <InstagramIcon className="h-3 w-3 text-white" />
          ) : (
            <MessageCircle className="h-3 w-3 text-white" />
          )}
        </div>
        {/* Status dot (bottom-right) */}
        <div className={cn(
          "absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full border-2 border-card flex items-center justify-center",
          status === 'with_bot' && "bg-purple-100",
          status === 'pending' && "bg-yellow-100",
          status === 'autodistributed' && "bg-blue-100",
          status === 'assigned' && "bg-green-100",
          status === 'closed' && "bg-gray-100"
        )}>
          {getStatusIcon()}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="font-medium truncate">
              {conversation.contact_name || conversation.phone_number}
            </span>
            {getStatusBadge()}
          </div>
          {conversation.last_message_at && (
            <span className={cn(
              "text-xs flex-shrink-0 ml-2",
              conversation.unread_count > 0 ? "text-green-600 font-medium" : "text-muted-foreground"
            )}>
              {formatTime(conversation.last_message_at)}
            </span>
          )}
        </div>
        
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-col gap-0.5 min-w-0 flex-1">
            {/* Número do contato */}
            <div className="flex items-center gap-2">
              {conversation.lead_id ? (
                <span className="text-xs text-green-600 flex items-center gap-1 truncate">
                  <UserCheck className="h-3 w-3 flex-shrink-0" />
                  Lead vinculado
                </span>
              ) : (
                <span className="text-xs text-muted-foreground truncate">
                  {conversation.phone_number}
                </span>
              )}
            </div>

            {/* Instância - "Falando com:" */}
            {instanceLabel && (
              <span className="text-[10px] text-muted-foreground truncate">
                Falando com: <span className="font-medium text-foreground/70">{instanceLabel}</span>
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {/* Botão ATENDER/ASSUMIR para conversas pendentes, autodistribuídas ou com robô */}
            {canShowClaimButton && (
              <Button
                size="sm"
                variant="default"
                className={cn(
                  "h-6 px-2 text-[10px]",
                  isWithBot 
                    ? "bg-purple-600 hover:bg-purple-700" 
                    : "bg-green-600 hover:bg-green-700"
                )}
                onClick={handleClaimClick}
                disabled={isClaiming}
              >
                <Hand className="h-3 w-3 mr-1" />
                {isWithBot ? 'ASSUMIR' : 'ATENDER'}
              </Button>
            )}
            
            {/* Botão ENCERRAR SEM NPS - para Pendentes (spam, gifs, etc) */}
            {showCloseWithoutNPS && onCloseWithoutNPS && (
              <Button
                size="sm"
                variant="outline"
                className="h-6 px-2 text-[10px] border-gray-300 text-gray-600 hover:bg-gray-100"
                onClick={handleCloseWithoutNPSClick}
                disabled={isClosingWithoutNPS}
                title="Encerrar sem pesquisa NPS (spam, gif, etc)"
              >
                <XCircle className="h-3 w-3" />
              </Button>
            )}
            
            {/* Botão FECHAR para conversas atribuídas ao usuário atual */}
            {status === 'assigned' && isAssignedToCurrentUser && onClose && (
              <Button
                size="sm"
                variant="outline"
                className="h-6 px-2 text-[10px] border-orange-300 text-orange-600 hover:bg-orange-50 hover:text-orange-700"
                onClick={handleCloseClick}
                disabled={isClosing}
              >
                <XCircle className="h-3 w-3 mr-1" />
                FECHAR
              </Button>
            )}
            
            {conversation.unread_count > 0 && (
              <Badge className="bg-green-500 text-white h-5 min-w-[20px] flex items-center justify-center rounded-full text-xs font-medium">
                {conversation.unread_count > 99 ? '99+' : conversation.unread_count}
              </Badge>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
