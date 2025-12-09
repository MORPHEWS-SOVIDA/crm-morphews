import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { UserCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Conversation {
  id: string;
  phone_number: string;
  contact_name: string | null;
  contact_profile_pic: string | null;
  last_message_at: string | null;
  unread_count: number;
  lead_id: string | null;
  instance_id: string;
}

interface ConversationItemProps {
  conversation: Conversation;
  isSelected: boolean;
  onClick: () => void;
}

export function ConversationItem({ conversation, isSelected, onClick }: ConversationItemProps) {
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

  return (
    <div
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 p-3 cursor-pointer transition-colors border-b border-border/50",
        isSelected 
          ? "bg-accent" 
          : "hover:bg-accent/50"
      )}
    >
      {/* Avatar */}
      <Avatar className="h-12 w-12 flex-shrink-0">
        <AvatarImage src={conversation.contact_profile_pic || undefined} />
        <AvatarFallback className="bg-gradient-to-br from-green-400 to-green-600 text-white font-medium">
          {conversation.contact_name?.[0]?.toUpperCase() || conversation.phone_number.slice(-2)}
        </AvatarFallback>
      </Avatar>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <span className="font-medium truncate">
            {conversation.contact_name || conversation.phone_number}
          </span>
          {conversation.last_message_at && (
            <span className={cn(
              "text-xs flex-shrink-0 ml-2",
              conversation.unread_count > 0 ? "text-green-600 font-medium" : "text-muted-foreground"
            )}>
              {formatTime(conversation.last_message_at)}
            </span>
          )}
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            {conversation.lead_id ? (
              <span className="text-xs text-green-600 flex items-center gap-1 truncate">
                <UserCheck className="h-3 w-3 flex-shrink-0" />
                Lead vinculado
              </span>
            ) : (
              <span className="text-sm text-muted-foreground truncate">
                {conversation.phone_number}
              </span>
            )}
          </div>
          
          {conversation.unread_count > 0 && (
            <Badge className="bg-green-500 text-white h-5 min-w-[20px] flex items-center justify-center rounded-full text-xs font-medium flex-shrink-0">
              {conversation.unread_count > 99 ? '99+' : conversation.unread_count}
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}
