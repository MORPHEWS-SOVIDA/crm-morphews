import { User, Users, Hash, Link2, MessageSquare } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { TeamConversation } from '@/hooks/useTeamChat';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface TeamConversationListProps {
  conversations: TeamConversation[];
  isLoading: boolean;
  onSelect: (conversation: TeamConversation) => void;
  selectedId?: string;
}

export function TeamConversationList({ conversations, isLoading, onSelect, selectedId }: TeamConversationListProps) {
  if (isLoading) {
    return (
      <div className="p-4 space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 animate-pulse">
            <div className="h-10 w-10 rounded-full bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-24 bg-muted rounded" />
              <div className="h-3 w-40 bg-muted rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <MessageSquare className="h-12 w-12 text-muted-foreground/40 mb-3" />
        <p className="text-muted-foreground text-sm">
          Nenhuma conversa encontrada
        </p>
        <p className="text-muted-foreground/60 text-xs mt-1">
          Clique no + para iniciar uma nova conversa
        </p>
      </div>
    );
  }

  return (
    <div className="py-1">
      {conversations.map((conv) => (
        <ConversationItem
          key={conv.id}
          conversation={conv}
          onClick={() => onSelect(conv)}
          isSelected={selectedId === conv.id}
        />
      ))}
    </div>
  );
}

interface ConversationItemProps {
  conversation: TeamConversation;
  onClick: () => void;
  isSelected?: boolean;
}

function ConversationItem({ conversation, onClick, isSelected }: ConversationItemProps) {
  const hasUnread = (conversation.unread_count || 0) > 0;
  const hasMentions = (conversation.unread_mentions || 0) > 0;

  // Determinar ícone e cor baseado no tipo
  const getTypeIcon = () => {
    switch (conversation.conversation_type) {
      case 'direct':
        return <User className="h-4 w-4" />;
      case 'group':
        return <Hash className="h-4 w-4" />;
      case 'contextual':
        return <Link2 className="h-4 w-4" />;
      default:
        return <Users className="h-4 w-4" />;
    }
  };

  // Determinar nome da conversa
  const getDisplayName = () => {
    if (conversation.name) return conversation.name;
    if (conversation.context_name) return conversation.context_name;
    return 'Conversa Direta';
  };

  // Determinar subtítulo
  const getSubtitle = () => {
    if (conversation.context_type) {
      const contextLabels: Record<string, string> = {
        lead: '📋 Lead',
        demand: '📝 Demanda',
        sac: '🎧 SAC',
        product: '📦 Produto',
        sale: '💰 Venda',
      };
      return contextLabels[conversation.context_type] || conversation.context_type;
    }
    return null;
  };

  const timeAgo = conversation.last_message_at
    ? formatDistanceToNow(new Date(conversation.last_message_at), { addSuffix: true, locale: ptBR })
    : null;

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-start gap-3 p-3 hover:bg-muted/50 transition-colors text-left",
        hasUnread && "bg-primary/5",
        isSelected && "bg-muted"
      )}
    >
      {/* Avatar */}
      <Avatar className="h-10 w-10 shrink-0">
        {conversation.avatar_url ? (
          <AvatarImage src={conversation.avatar_url} />
        ) : null}
        <AvatarFallback className={cn(
          "text-sm",
          conversation.conversation_type === 'contextual' && "bg-accent text-accent-foreground"
        )}>
          {getTypeIcon()}
        </AvatarFallback>
      </Avatar>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className={cn(
            "text-sm truncate",
            hasUnread ? "font-semibold" : "font-medium"
          )}>
            {getDisplayName()}
          </span>
          {timeAgo && (
            <span className="text-xs text-muted-foreground shrink-0">
              {timeAgo}
            </span>
          )}
        </div>

        {/* Subtitle */}
        {getSubtitle() && (
          <p className="text-xs text-muted-foreground mt-0.5">
            {getSubtitle()}
          </p>
        )}

        {/* Preview */}
        {conversation.last_message_preview && (
          <p className={cn(
            "text-xs mt-1 truncate",
            hasUnread ? "text-foreground" : "text-muted-foreground"
          )}>
            {conversation.last_message_preview}
          </p>
        )}
      </div>

      {/* Unread badge */}
      {hasUnread && (
        <Badge
          variant={hasMentions ? "destructive" : "default"}
          className="shrink-0 h-5 min-w-[20px] px-1.5 text-xs"
        >
          {conversation.unread_count}
        </Badge>
      )}
    </button>
  );
}
