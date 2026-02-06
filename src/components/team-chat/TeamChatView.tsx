import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, X, MoreVertical, Users, Hash, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  TeamConversation,
  useTeamMessages,
  useTeamMessagesRealtime,
  useMarkTeamConversationRead,
} from '@/hooks/useTeamChat';
import { TeamMessageList } from './TeamMessageList';
import { TeamMessageInput } from './TeamMessageInput';
import { cn } from '@/lib/utils';

interface TeamChatViewProps {
  conversation: TeamConversation;
  onBack: () => void;
  onClose: () => void;
  isFullPage?: boolean;
}

export function TeamChatView({ conversation, onBack, onClose, isFullPage = false }: TeamChatViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { data: messages = [], isLoading } = useTeamMessages(conversation.id);
  const markAsRead = useMarkTeamConversationRead();
  
  // Subscribe to realtime
  useTeamMessagesRealtime(conversation.id);

  // Marcar como lida ao abrir
  useEffect(() => {
    if (conversation.id && (conversation.unread_count || 0) > 0) {
      markAsRead.mutate(conversation.id);
    }
  }, [conversation.id]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  // Determinar ícone do tipo
  const getTypeIcon = () => {
    switch (conversation.conversation_type) {
      case 'direct':
        return <Users className="h-4 w-4" />;
      case 'group':
        return <Hash className="h-4 w-4" />;
      case 'contextual':
        return <Link2 className="h-4 w-4" />;
    }
  };

  // Nome da conversa
  const displayName = conversation.name || conversation.context_name || 'Conversa';

  return (
    <div className={cn(
      isFullPage 
        ? "flex flex-col h-full w-full bg-background"
        : cn(
            "fixed bottom-24 left-6 z-50",
            "w-[380px] max-h-[600px] h-[calc(100vh-120px)]",
            "bg-background border rounded-xl shadow-2xl",
            "flex flex-col overflow-hidden",
            "lg:bottom-28 lg:left-8"
          )
    )}>
      {/* Header */}
      <div className={cn("flex items-center gap-2 p-3 border-b", !isFullPage && "bg-muted/30")}>
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          className="h-8 w-8 shrink-0"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>

        <Avatar className="h-8 w-8 shrink-0">
          {conversation.avatar_url ? (
            <AvatarImage src={conversation.avatar_url} />
          ) : null}
          <AvatarFallback className="text-xs">
            {getTypeIcon()}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-sm truncate">{displayName}</h3>
          {conversation.context_type && (
            <p className="text-xs text-muted-foreground">
              {conversation.context_type}
            </p>
          )}
        </div>

        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
          <MoreVertical className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-8 w-8 shrink-0"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Messages */}
      <ScrollArea ref={scrollRef} className="flex-1">
        <TeamMessageList 
          messages={messages} 
          isLoading={isLoading} 
          conversationId={conversation.id}
        />
      </ScrollArea>

      {/* Input */}
      <TeamMessageInput conversationId={conversation.id} />
    </div>
  );
}
