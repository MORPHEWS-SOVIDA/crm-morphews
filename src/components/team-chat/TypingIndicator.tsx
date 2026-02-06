import { useTypingIndicator } from '@/hooks/useTeamChatExtended';
import { cn } from '@/lib/utils';

interface TypingIndicatorProps {
  conversationId: string;
  className?: string;
}

export function TypingIndicator({ conversationId, className }: TypingIndicatorProps) {
  const { data: typingUsers = [] } = useTypingIndicator(conversationId);

  if (typingUsers.length === 0) return null;

  return (
    <div className={cn("flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground", className)}>
      <TypingDots />
      <span>
        {typingUsers.length === 1
          ? 'Alguém está digitando...'
          : `${typingUsers.length} pessoas estão digitando...`}
      </span>
    </div>
  );
}

function TypingDots() {
  return (
    <div className="flex gap-1">
      <span className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
      <span className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
      <span className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
    </div>
  );
}
