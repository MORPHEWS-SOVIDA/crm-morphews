import { memo, useMemo } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { User, Clock, MessageSquareMore } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface Conversation {
  id: string;
  phone_number: string;
  contact_name: string | null;
  contact_profile_pic: string | null;
  last_message_at: string | null;
  unread_count: number;
  lead_id: string | null;
  instance_id: string | null;
  channel_name?: string;
  is_group?: boolean;
  group_subject?: string;
  display_name?: string;
  instance_status?: 'connected' | 'disconnected' | 'deleted';
  instance_is_connected?: boolean;
  instance_deleted_at?: string | null;
  original_instance_name?: string | null;
}

interface OtherInstanceInfo {
  id: string;
  instance_name: string;
  instance_display_name: string | null;
  unread_count: number;
}

interface ConversationListItemProps {
  conversation: Conversation;
  isSelected: boolean;
  onClick: () => void;
  instanceLabel: string | null;
  isMobile: boolean;
  otherInstances?: OtherInstanceInfo[];
  scheduledCount?: number;
}

const formatTime = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return format(date, "HH:mm");
  }
  return format(date, "dd/MM", { locale: ptBR });
};

const getInstanceStatusInfo = (conversation: Conversation) => {
  if (!conversation.instance_id) {
    return { status: 'deleted' as const, label: 'Instância Excluída', originalName: conversation.original_instance_name };
  }
  if (conversation.instance_status === 'deleted' || conversation.instance_deleted_at) {
    return { status: 'deleted' as const, label: 'Instância Excluída', originalName: conversation.original_instance_name || conversation.channel_name };
  }
  if (conversation.instance_status === 'disconnected' || conversation.instance_is_connected === false) {
    return { status: 'disconnected' as const, label: 'Instância Desconectada', originalName: conversation.channel_name };
  }
  return { status: 'connected' as const, label: null, originalName: null };
};

export const ConversationListItem = memo(function ConversationListItem({
  conversation,
  isSelected,
  onClick,
  instanceLabel,
  isMobile,
  otherInstances,
  scheduledCount,
}: ConversationListItemProps) {
  const statusInfo = getInstanceStatusInfo(conversation);
  const hasOtherInstances = otherInstances && otherInstances.length > 0;

  const totalUnreadOther = useMemo(() => {
    if (!otherInstances) return 0;
    return otherInstances.reduce((sum, c) => sum + (c.unread_count || 0), 0);
  }, [otherInstances]);

  return (
    <div
      className={cn(
        "flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/50 transition-colors border-b",
        isSelected && "bg-muted"
      )}
      onClick={onClick}
    >
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        <Avatar className="h-12 w-12">
          <AvatarImage src={conversation.contact_profile_pic || undefined} />
          <AvatarFallback className={cn(
            "text-white",
            conversation.is_group ? "bg-blue-500" : "bg-green-500"
          )}>
            {conversation.is_group
              ? "G"
              : (conversation.display_name?.charAt(0) || conversation.contact_name?.charAt(0) || conversation.phone_number.slice(-2))}
          </AvatarFallback>
        </Avatar>

        {/* Other instances indicator */}
        {hasOtherInstances && !isMobile && (
          <>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="absolute -top-1 -left-1 h-5 w-5 rounded-full bg-blue-500 border-2 border-card flex items-center justify-center cursor-help">
                    <MessageSquareMore className="h-2.5 w-2.5 text-white" />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-[280px]">
                  <p className="font-medium text-xs mb-1">Conversas em outras instâncias:</p>
                  <ul className="text-xs space-y-0.5">
                    {otherInstances!.map((conv) => (
                      <li key={conv.id} className="flex items-center gap-1">
                        {conv.unread_count > 0 && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse flex-shrink-0" />}
                        <span className="truncate">{conv.instance_display_name || conv.instance_name}</span>
                        {conv.unread_count > 0 && (
                          <span className="text-[9px] px-1 rounded bg-red-500 text-white">{conv.unread_count}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            {totalUnreadOther > 0 && (
              <div className="absolute -top-1.5 -right-1.5 h-5 min-w-[20px] px-1 rounded-full bg-amber-500 border-2 border-card flex items-center justify-center animate-pulse">
                <span className="text-[10px] font-bold text-white">
                  {totalUnreadOther > 99 ? '99+' : totalUnreadOther}
                </span>
              </div>
            )}
          </>
        )}
        {hasOtherInstances && isMobile && (
          <div className="absolute -top-1 -left-1 h-4 w-4 rounded-full bg-blue-500 border-2 border-card flex items-center justify-center">
            <span className="text-[8px] font-bold text-white">{otherInstances!.length}</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-center">
          <span className="font-medium truncate flex items-center gap-1">
            {conversation.is_group && <span className="text-xs text-blue-500">👥</span>}
            {conversation.display_name || conversation.contact_name || (conversation.is_group ? (conversation.group_subject || "Grupo") : conversation.phone_number)}
          </span>
          {conversation.last_message_at && (
            <span className="text-xs text-muted-foreground">
              {formatTime(conversation.last_message_at)}
            </span>
          )}
        </div>
        <div className="flex justify-between items-center">
          <div className="flex flex-col gap-0.5">
            <div className="text-sm text-muted-foreground truncate flex items-center gap-1">
              {conversation.is_group ? (
                <span className="text-blue-600">Grupo</span>
              ) : conversation.lead_id ? (
                <span className="text-green-600 flex items-center gap-1">
                  <User className="h-3 w-3" /> Lead vinculado
                </span>
              ) : (
                <span>{conversation.phone_number}</span>
              )}
            </div>
            {statusInfo.status === 'deleted' && (
              <span className="text-[10px] text-red-500 truncate flex items-center gap-1">
                ⚠️ {statusInfo.label}
                {statusInfo.originalName && <span className="text-muted-foreground">({statusInfo.originalName})</span>}
              </span>
            )}
            {statusInfo.status === 'disconnected' && (
              <span className="text-[10px] text-amber-500 truncate flex items-center gap-1">
                ⚠️ {statusInfo.label}
                {statusInfo.originalName && <span className="text-muted-foreground">({statusInfo.originalName})</span>}
              </span>
            )}
            {statusInfo.status === 'connected' && instanceLabel && (
              <span className="text-[10px] text-muted-foreground truncate">
                Falando com: <span className="font-medium text-foreground/70">{instanceLabel}</span>
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {scheduledCount && scheduledCount > 0 && (
              <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300 h-5 min-w-5 flex items-center justify-center gap-0.5 px-1">
                <Clock className="h-3 w-3" />
                {scheduledCount}
              </Badge>
            )}
            {conversation.unread_count > 0 && (
              <Badge className="bg-green-500 text-white h-5 min-w-5 flex items-center justify-center">
                {conversation.unread_count}
              </Badge>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});
