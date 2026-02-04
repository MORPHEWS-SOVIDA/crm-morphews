import { TeamMessage } from '@/hooks/useTeamChat';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface TeamMessageListProps {
  messages: TeamMessage[];
  isLoading: boolean;
}

export function TeamMessageList({ messages, isLoading }: TeamMessageListProps) {
  const { user } = useAuth();

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className={cn("flex gap-2", i % 2 === 0 ? "" : "flex-row-reverse")}>
            <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
            <div className="space-y-1">
              <div className="h-4 w-20 bg-muted rounded animate-pulse" />
              <div className="h-12 w-48 bg-muted rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center h-full">
        <p className="text-muted-foreground text-sm">
          Nenhuma mensagem ainda
        </p>
        <p className="text-muted-foreground/60 text-xs mt-1">
          Seja o primeiro a enviar uma mensagem!
        </p>
      </div>
    );
  }

  // Agrupar mensagens por data
  const groupedMessages: { date: string; messages: TeamMessage[] }[] = [];
  let currentDate = '';

  messages.forEach((msg) => {
    const msgDate = format(new Date(msg.created_at), 'yyyy-MM-dd');
    if (msgDate !== currentDate) {
      currentDate = msgDate;
      groupedMessages.push({ date: msgDate, messages: [msg] });
    } else {
      groupedMessages[groupedMessages.length - 1].messages.push(msg);
    }
  });

  return (
    <div className="p-4 space-y-4">
      {groupedMessages.map(({ date, messages: dayMessages }) => (
        <div key={date}>
          {/* Date separator */}
          <div className="flex items-center justify-center my-4">
            <div className="bg-muted px-3 py-1 rounded-full">
              <span className="text-xs text-muted-foreground">
                {format(new Date(date), "d 'de' MMMM", { locale: ptBR })}
              </span>
            </div>
          </div>

          {/* Messages */}
          <div className="space-y-3">
            {dayMessages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                isOwn={message.sender_id === user?.id}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

interface MessageBubbleProps {
  message: TeamMessage;
  isOwn: boolean;
}

function MessageBubble({ message, isOwn }: MessageBubbleProps) {
  const senderName = message.sender
    ? `${message.sender.first_name || ''} ${message.sender.last_name || ''}`.trim()
    : 'Usuário';

  const time = format(new Date(message.created_at), 'HH:mm');

  // Renderizar conteúdo com menções destacadas
  const renderContent = () => {
    let content = message.content;
    
    // Destacar menções
    if (message.mentions && message.mentions.length > 0) {
      message.mentions.forEach((mention) => {
        const mentionText = `@${mention.display_name}`;
        content = content.replace(
          new RegExp(`@${mention.type}:${mention.id}`, 'g'),
          mentionText
        );
      });
    }

    return content;
  };

  return (
    <div className={cn("flex gap-2", isOwn && "flex-row-reverse")}>
      {!isOwn && (
        <Avatar className="h-8 w-8 shrink-0">
          {message.sender?.avatar_url && (
            <AvatarImage src={message.sender.avatar_url} />
          )}
          <AvatarFallback className="text-xs">
            {senderName.substring(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      )}

      <div className={cn("max-w-[75%]", isOwn && "items-end")}>
        {!isOwn && (
          <p className="text-xs text-muted-foreground mb-1 px-1">
            {senderName}
          </p>
        )}

        <div
          className={cn(
            "px-3 py-2 rounded-2xl text-sm",
            isOwn
              ? "bg-primary text-primary-foreground rounded-tr-sm"
              : "bg-muted rounded-tl-sm"
          )}
        >
          <p className="whitespace-pre-wrap break-words">{renderContent()}</p>
        </div>

        <p className={cn(
          "text-xs text-muted-foreground mt-1 px-1",
          isOwn && "text-right"
        )}>
          {time}
          {message.is_edited && " (editado)"}
        </p>
      </div>
    </div>
  );
}
