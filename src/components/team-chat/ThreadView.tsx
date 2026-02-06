import { useState, useRef, useEffect } from 'react';
import { X, Send, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/hooks/useAuth';
import { TeamMessage } from '@/hooks/useTeamChat';
import { useThreadReplies, useReplyToThread, useConversationReactions } from '@/hooks/useTeamChatExtended';
import { MessageReactions } from './MessageReactions';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface ThreadViewProps {
  parentMessage: TeamMessage;
  conversationId: string;
  onClose: () => void;
}

export function ThreadView({ parentMessage, conversationId, onClose }: ThreadViewProps) {
  const [replyContent, setReplyContent] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  
  const { data: replies = [], isLoading } = useThreadReplies(parentMessage.id);
  const replyToThread = useReplyToThread();

  // Buscar reações para todas as mensagens da thread
  const allMessageIds = [parentMessage.id, ...replies.map(r => r.id)];
  const { data: reactionsMap = new Map() } = useConversationReactions(allMessageIds);

  // Scroll to bottom on new replies
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [replies.length]);

  const handleSendReply = () => {
    if (!replyContent.trim()) return;

    replyToThread.mutate({
      threadId: parentMessage.id,
      conversationId,
      content: replyContent.trim(),
    });

    setReplyContent('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendReply();
    }
  };

  const parentSenderName = parentMessage.sender
    ? `${parentMessage.sender.first_name || ''} ${parentMessage.sender.last_name || ''}`.trim()
    : 'Usuário';

  return (
    <div className="flex flex-col h-full border-l bg-background">
      {/* Header */}
      <div className="flex items-center gap-2 p-3 border-b bg-muted/30">
        <Button variant="ghost" size="icon" className="h-8 w-8 md:hidden" onClick={onClose}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-sm">Thread</h3>
          <p className="text-xs text-muted-foreground truncate">
            {replies.length} {replies.length === 1 ? 'resposta' : 'respostas'}
          </p>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8 hidden md:flex" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Parent message */}
      <div className="p-4 border-b bg-muted/10">
        <div className="flex gap-2">
          <Avatar className="h-8 w-8 shrink-0">
            {parentMessage.sender?.avatar_url && (
              <AvatarImage src={parentMessage.sender.avatar_url} />
            )}
            <AvatarFallback className="text-xs">
              {parentSenderName.substring(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2">
              <span className="font-medium text-sm">{parentSenderName}</span>
              <span className="text-xs text-muted-foreground">
                {format(new Date(parentMessage.created_at), 'HH:mm')}
              </span>
            </div>
            <p className="text-sm whitespace-pre-wrap break-words mt-1">
              {parentMessage.content}
            </p>
            <div className="mt-2">
              <MessageReactions 
                messageId={parentMessage.id} 
                reactions={reactionsMap.get(parentMessage.id) || []} 
              />
            </div>
          </div>
        </div>
      </div>

      {/* Replies */}
      <ScrollArea ref={scrollRef} className="flex-1">
        <div className="p-4 space-y-4">
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex gap-2 animate-pulse">
                  <div className="h-8 w-8 rounded-full bg-muted" />
                  <div className="space-y-1">
                    <div className="h-4 w-20 bg-muted rounded" />
                    <div className="h-10 w-48 bg-muted rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : replies.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground">Nenhuma resposta ainda</p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Seja o primeiro a responder nesta thread!
              </p>
            </div>
          ) : (
            replies.map((reply: any) => (
              <ThreadReplyBubble
                key={reply.id}
                message={reply}
                isOwn={reply.sender_id === user?.id}
                reactions={reactionsMap.get(reply.id) || []}
              />
            ))
          )}
        </div>
      </ScrollArea>

      {/* Reply input */}
      <div className="p-3 border-t bg-background">
        <div className="flex items-end gap-2">
          <Textarea
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Responder na thread..."
            className="min-h-[40px] max-h-[100px] resize-none text-sm"
            rows={1}
          />
          <Button
            onClick={handleSendReply}
            disabled={!replyContent.trim() || replyToThread.isPending}
            size="icon"
            className="h-10 w-10 shrink-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

interface ThreadReplyBubbleProps {
  message: any;
  isOwn: boolean;
  reactions: any[];
}

function ThreadReplyBubble({ message, isOwn, reactions }: ThreadReplyBubbleProps) {
  const senderName = message.sender
    ? `${message.sender.first_name || ''} ${message.sender.last_name || ''}`.trim()
    : 'Usuário';

  return (
    <div className={cn("flex gap-2 group", isOwn && "flex-row-reverse")}>
      {!isOwn && (
        <Avatar className="h-6 w-6 shrink-0">
          {message.sender?.avatar_url && (
            <AvatarImage src={message.sender.avatar_url} />
          )}
          <AvatarFallback className="text-xs">
            {senderName.substring(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      )}

      <div className={cn("max-w-[80%]", isOwn && "items-end")}>
        {!isOwn && (
          <p className="text-xs text-muted-foreground mb-1 px-1">{senderName}</p>
        )}
        <div
          className={cn(
            "px-3 py-2 rounded-2xl text-sm",
            isOwn
              ? "bg-primary text-primary-foreground rounded-tr-sm"
              : "bg-muted rounded-tl-sm"
          )}
        >
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        </div>
        
        <div className="flex items-center gap-2 mt-1 px-1">
          <span className={cn("text-xs text-muted-foreground", isOwn && "text-right")}>
            {format(new Date(message.created_at), 'HH:mm')}
          </span>
          <MessageReactions messageId={message.id} reactions={reactions} compact />
        </div>
      </div>
    </div>
  );
}
