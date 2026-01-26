import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { UserCheck, Clock, CheckCircle, Zap, Bot, Users, MessageSquareMore } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OtherInstanceConversation {
  id: string;
  instance_id: string;
  instance_name: string;
  instance_display_name: string | null;
  status: string | null;
  unread_count: number;
}

interface Conversation {
  id: string;
  phone_number: string;
  contact_name: string | null;
  contact_profile_pic: string | null;
  last_message_at: string | null;
  unread_count: number;
  lead_id: string | null;
  instance_id: string | null;
  status?: string;
  assigned_user_id?: string | null;
  designated_user_id?: string | null;
  is_group?: boolean;
  display_name?: string;
  group_subject?: string;
}

interface MobileConversationItemProps {
  conversation: Conversation;
  isSelected: boolean;
  onClick: () => void;
  instanceLabel?: string | null;
  assignedUserName?: string | null;
  currentUserId?: string;
  otherInstanceConversations?: OtherInstanceConversation[];
}

export function MobileConversationItem({ 
  conversation, 
  isSelected, 
  onClick, 
  instanceLabel,
  assignedUserName,
  currentUserId,
  otherInstanceConversations
}: MobileConversationItemProps) {
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
  
  const totalUnreadOtherInstances = otherInstanceConversations?.reduce(
    (sum, conv) => sum + (conv.unread_count || 0), 
    0
  ) || 0;

  const getStatusIndicator = () => {
    switch (status) {
      case 'with_bot':
        return { icon: Bot, color: 'bg-purple-500', label: '🤖' };
      case 'pending':
        return { icon: Clock, color: 'bg-yellow-500', label: '⏳' };
      case 'autodistributed':
        return { icon: Zap, color: 'bg-blue-500', label: isDesignatedToMe ? '⚡ Pra você' : '⚡' };
      case 'assigned':
        return { icon: UserCheck, color: 'bg-green-500', label: isAssignedToMe ? '✓ Meu' : assignedUserName?.split(' ')[0] || '✓' };
      case 'closed':
        return { icon: CheckCircle, color: 'bg-gray-400', label: '✔️' };
      default:
        return null;
    }
  };

  const statusIndicator = getStatusIndicator();
  const displayName = conversation.display_name || conversation.contact_name || (conversation.is_group ? (conversation.group_subject || 'Grupo') : conversation.phone_number);

  return (
    <div
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 px-3 py-3 cursor-pointer transition-colors border-b border-border/50 active:bg-accent/70",
        isSelected 
          ? "bg-accent" 
          : "hover:bg-accent/50",
        status === 'closed' && "opacity-60"
      )}
    >
      {/* Avatar com indicadores */}
      <div className="relative flex-shrink-0">
        <Avatar className="h-12 w-12">
          <AvatarImage src={conversation.contact_profile_pic || undefined} />
          <AvatarFallback className={cn(
            "font-medium text-white",
            conversation.is_group ? "bg-blue-500" : "bg-gradient-to-br from-green-400 to-green-600"
          )}>
            {conversation.is_group 
              ? <Users className="h-5 w-5" />
              : (displayName?.[0]?.toUpperCase() || conversation.phone_number.slice(-2))}
          </AvatarFallback>
        </Avatar>
        
        {/* Status dot */}
        {statusIndicator && (
          <div className={cn(
            "absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full border-2 border-card flex items-center justify-center",
            statusIndicator.color
          )}>
            <statusIndicator.icon className="h-2.5 w-2.5 text-white" />
          </div>
        )}
        
        {/* Indicador de outras instâncias */}
        {hasOtherInstances && (
          <div className="absolute -top-1 -left-1 h-4 w-4 rounded-full bg-blue-500 border-2 border-card flex items-center justify-center">
            <MessageSquareMore className="h-2 w-2 text-white" />
          </div>
        )}
        
        {/* Badge de não lidas em outras instâncias */}
        {totalUnreadOtherInstances > 0 && (
          <div className="absolute -top-1.5 left-3 h-4 min-w-[16px] px-0.5 rounded-full bg-amber-500 border border-card flex items-center justify-center animate-pulse">
            <span className="text-[9px] font-bold text-white">
              {totalUnreadOtherInstances > 9 ? '9+' : totalUnreadOtherInstances}
            </span>
          </div>
        )}
      </div>

      {/* Content - duas linhas */}
      <div className="flex-1 min-w-0">
        {/* Linha 1: Nome + Status + Hora */}
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            {conversation.is_group && (
              <span className="text-xs text-blue-500 flex-shrink-0">👥</span>
            )}
            <span className="font-medium text-sm truncate">
              {displayName}
            </span>
            {statusIndicator && status !== 'closed' && (
              <span className={cn(
                "text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0",
                status === 'with_bot' && "bg-purple-100 text-purple-700",
                status === 'pending' && "bg-yellow-100 text-yellow-700",
                status === 'autodistributed' && "bg-blue-100 text-blue-700",
                status === 'assigned' && "bg-green-100 text-green-700"
              )}>
                {statusIndicator.label}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {conversation.last_message_at && (
              <span className={cn(
                "text-xs",
                conversation.unread_count > 0 ? "text-primary font-medium" : "text-muted-foreground"
              )}>
                {formatTime(conversation.last_message_at)}
              </span>
            )}
            {conversation.unread_count > 0 && (
              <Badge className="bg-primary text-primary-foreground h-5 min-w-[20px] flex items-center justify-center rounded-full text-[10px] font-bold px-1.5">
                {conversation.unread_count > 99 ? '99+' : conversation.unread_count}
              </Badge>
            )}
          </div>
        </div>
        
        {/* Linha 2: Info secundária (instância ou lead vinculado) */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {conversation.lead_id ? (
            <span className="text-green-600 flex items-center gap-1">
              <UserCheck className="h-3 w-3" />
              Lead vinculado
            </span>
          ) : (
            <span className="truncate">{conversation.phone_number}</span>
          )}
          {instanceLabel && (
            <>
              <span className="text-muted-foreground/50">•</span>
              <span className="truncate text-muted-foreground/70">{instanceLabel}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
