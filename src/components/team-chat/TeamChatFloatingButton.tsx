import { useState } from 'react';
import { MessageCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useTeamUnreadTotal, useTeamUnreadRealtime } from '@/hooks/useTeamChat';
import { TeamChatPanel } from './TeamChatPanel';
import { cn } from '@/lib/utils';

/**
 * Botão flutuante do Conecta Time
 * Fica no canto inferior esquerdo (oposto à Donna)
 */
export function TeamChatFloatingButton() {
  const [isOpen, setIsOpen] = useState(false);
  const { data: unreadData } = useTeamUnreadTotal();
  
  // Subscribe to realtime updates
  useTeamUnreadRealtime();

  const totalUnread = unreadData?.total || 0;
  const hasMentions = (unreadData?.mentions || 0) > 0;

  return (
    <>
      {/* Botão flutuante */}
      <div className="fixed bottom-6 left-6 z-50 lg:bottom-8 lg:left-8">
        <Button
          size="lg"
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "h-14 w-14 rounded-full shadow-lg transition-all duration-200",
            "bg-primary hover:bg-primary/90 text-primary-foreground",
            isOpen && "rotate-90"
          )}
        >
          {isOpen ? (
            <X className="h-6 w-6" />
          ) : (
            <MessageCircle className="h-6 w-6" />
          )}
        </Button>

        {/* Badge de não lidas */}
        {!isOpen && totalUnread > 0 && (
          <Badge
            variant={hasMentions ? "destructive" : "default"}
            className={cn(
              "absolute -top-1 -right-1 min-w-[24px] h-6 px-2",
              "flex items-center justify-center text-xs font-bold",
              "animate-pulse"
            )}
          >
            {totalUnread > 99 ? '99+' : totalUnread}
          </Badge>
        )}
      </div>

      {/* Painel do chat */}
      {isOpen && (
        <TeamChatPanel onClose={() => setIsOpen(false)} />
      )}
    </>
  );
}
