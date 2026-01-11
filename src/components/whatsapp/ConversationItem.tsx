import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { UserCheck, Clock, CheckCircle, Hand, MessageSquareMore, XCircle, Zap, Bot } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export interface OtherInstanceConversation {
  id: string;
  instance_id: string;
  instance_name: string;
  instance_display_name: string | null;
  status: string | null;
}

interface Conversation {
  id: string;
  phone_number: string;
  contact_name: string | null;
  contact_profile_pic: string | null;
  last_message_at: string | null;
  unread_count: number;
  lead_id: string | null;
  instance_id: string;
  status?: string; // 'pending' | 'autodistributed' | 'assigned' | 'closed'
  assigned_user_id?: string | null;
  designated_user_id?: string | null; // Para auto-distribuição
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
  otherInstanceConversations?: OtherInstanceConversation[];
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
  otherInstanceConversations
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
  const hasOtherInstances = otherInstanceConversations && otherInstanceConversations.length > 0;
  
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

  const isAssignedToCurrentUser = conversation.assigned_user_id === currentUserId;
  
  // Mostrar botão ATENDER para: pendente OU autodistribuído (se for o usuário designado) OU with_bot
  const canShowClaimButton = showClaimButton && (
    status === 'pending' || 
    !status || 
    (status === 'autodistributed' && isDesignatedToMe) ||
    status === 'with_bot'
  );
  
  const isWithBot = status === 'with_bot';

  return (
    <div
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 p-3 cursor-pointer transition-colors border-b border-border/50",
        isSelected 
          ? "bg-accent" 
          : "hover:bg-accent/50",
        status === 'closed' && "opacity-60"
      )}
    >
      {/* Avatar with status indicator */}
      <div className="relative flex-shrink-0">
        <Avatar className="h-12 w-12">
          <AvatarImage src={conversation.contact_profile_pic || undefined} />
          <AvatarFallback className="bg-gradient-to-br from-green-400 to-green-600 text-white font-medium">
            {conversation.contact_name?.[0]?.toUpperCase() || conversation.phone_number.slice(-2)}
          </AvatarFallback>
        </Avatar>
        {/* Status dot */}
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
        
        {/* Indicador de conversas em outras instâncias */}
        {hasOtherInstances && (
          <div className="absolute -top-1 -left-1 h-5 w-5 rounded-full bg-blue-500 border-2 border-card flex items-center justify-center">
            <MessageSquareMore className="h-2.5 w-2.5 text-white" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="font-medium truncate">
              {conversation.contact_name || conversation.phone_number}
            </span>
            {getStatusBadge()}
            
            {/* Badge de outras instâncias com tooltip */}
            {hasOtherInstances && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge 
                      variant="outline" 
                      className="h-4 px-1 text-[9px] bg-blue-50 text-blue-700 border-blue-200 cursor-help"
                    >
                      +{otherInstanceConversations.length}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[250px]">
                    <p className="font-medium text-xs mb-1">Conversas em outras instâncias:</p>
                    <ul className="text-xs space-y-0.5">
                      {otherInstanceConversations.map((conv) => (
                        <li key={conv.id} className="flex items-center gap-1">
                          <span className="truncate">
                            {conv.instance_display_name || conv.instance_name}
                          </span>
                          {conv.status && (
                            <span className={cn(
                              "text-[10px] px-1 rounded",
                              conv.status === 'pending' && "bg-yellow-100 text-yellow-700",
                              conv.status === 'autodistributed' && "bg-blue-100 text-blue-700",
                              conv.status === 'assigned' && "bg-green-100 text-green-700",
                              conv.status === 'closed' && "bg-gray-100 text-gray-600"
                            )}>
                              {conv.status === 'pending' ? 'Pendente' : 
                               conv.status === 'autodistributed' ? 'Pra você' :
                               conv.status === 'assigned' ? 'Atribuído' : 'Encerrado'}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
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
          <div className="flex items-center gap-2 min-w-0 flex-1">
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
            {instanceLabel && (
              <span className="text-[10px] text-muted-foreground/60 truncate max-w-[60px]">
                {instanceLabel}
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
