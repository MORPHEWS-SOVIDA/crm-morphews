import { useState } from 'react';
import { MessageCircle, Pin } from 'lucide-react';
import { TeamMessage } from '@/hooks/useTeamChat';
import { useConversationReactions, useTogglePinMessage } from '@/hooks/useTeamChatExtended';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { MessageReactions, QuickReactionBar } from './MessageReactions';
import { ThreadView } from './ThreadView';

interface TeamMessageListProps {
  messages: TeamMessage[];
  isLoading: boolean;
  conversationId?: string;
}

export function TeamMessageList({ messages, isLoading, conversationId }: TeamMessageListProps) {
  const { user } = useAuth();
  const [openThreadId, setOpenThreadId] = useState<string | null>(null);

  // Buscar reações de todas as mensagens
  const messageIds = messages.map(m => m.id);
  const { data: reactionsMap = new Map() } = useConversationReactions(messageIds);

  // Encontrar mensagem da thread aberta
  const threadParentMessage = openThreadId 
    ? messages.find(m => m.id === openThreadId) 
    : null;

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

  // Filtrar mensagens que não são respostas de thread (apenas mensagens principais)
  const mainMessages = messages.filter((msg: any) => !msg.thread_id);

  mainMessages.forEach((msg) => {
    const msgDate = format(new Date(msg.created_at), 'yyyy-MM-dd');
    if (msgDate !== currentDate) {
      currentDate = msgDate;
      groupedMessages.push({ date: msgDate, messages: [msg] });
    } else {
      groupedMessages[groupedMessages.length - 1].messages.push(msg);
    }
  });

  return (
    <div className="flex h-full">
      {/* Main message list */}
      <div className={cn("flex-1 p-4 space-y-4", openThreadId && "hidden md:block")}>
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
              {dayMessages.map((message: any) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  isOwn={message.sender_id === user?.id}
                  reactions={reactionsMap.get(message.id) || []}
                  conversationId={conversationId}
                  onOpenThread={() => setOpenThreadId(message.id)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Thread panel */}
      {threadParentMessage && conversationId && (
        <div className={cn(
          "w-full md:w-[350px] lg:w-[400px] shrink-0",
          !openThreadId && "hidden"
        )}>
          <ThreadView
            parentMessage={threadParentMessage}
            conversationId={conversationId}
            onClose={() => setOpenThreadId(null)}
          />
        </div>
      )}
    </div>
  );
}

interface MessageBubbleProps {
  message: TeamMessage & { thread_reply_count?: number };
  isOwn: boolean;
  reactions: any[];
  conversationId?: string;
  onOpenThread: () => void;
}

function MessageBubble({ message, isOwn, reactions, conversationId, onOpenThread }: MessageBubbleProps) {
  const togglePin = useTogglePinMessage();
  
  const senderName = message.sender
    ? `${message.sender.first_name || ''} ${message.sender.last_name || ''}`.trim()
    : 'Usuário';

  const time = format(new Date(message.created_at), 'HH:mm');
  const hasReplies = (message.thread_reply_count || 0) > 0;

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

  const handlePin = () => {
    if (!conversationId) return;
    togglePin.mutate({ messageId: message.id, conversationId });
  };

  return (
    <div className={cn("flex gap-2 group relative", isOwn && "flex-row-reverse")}>
      {/* Quick reaction bar on hover */}
      <QuickReactionBar
        messageId={message.id}
        onThread={onOpenThread}
        onPin={handlePin}
      />

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

        {/* Reactions */}
        <div className="mt-1 px-1">
          <MessageReactions messageId={message.id} reactions={reactions} compact />
        </div>

        {/* Thread indicator */}
        {hasReplies && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs text-primary hover:text-primary mt-1"
            onClick={onOpenThread}
          >
            <MessageCircle className="h-3 w-3 mr-1" />
            {message.thread_reply_count} {message.thread_reply_count === 1 ? 'resposta' : 'respostas'}
          </Button>
        )}

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
