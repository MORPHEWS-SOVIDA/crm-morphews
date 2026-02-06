import { useTeamPresence } from '@/hooks/useTeamChatExtended';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface UserPresenceIndicatorProps {
  userId: string;
  size?: 'sm' | 'md' | 'lg';
  showTooltip?: boolean;
  className?: string;
}

const STATUS_COLORS = {
  online: 'bg-green-500',
  away: 'bg-yellow-500',
  busy: 'bg-red-500',
  offline: 'bg-gray-400',
};

const STATUS_LABELS = {
  online: 'Online',
  away: 'Ausente',
  busy: 'Ocupado',
  offline: 'Offline',
};

const SIZES = {
  sm: 'h-2 w-2',
  md: 'h-2.5 w-2.5',
  lg: 'h-3 w-3',
};

export function UserPresenceIndicator({ 
  userId, 
  size = 'sm', 
  showTooltip = true,
  className 
}: UserPresenceIndicatorProps) {
  const { data: presenceList = [] } = useTeamPresence();
  
  const userPresence = presenceList.find(p => p.user_id === userId);
  const status = userPresence?.status || 'offline';
  const statusMessage = userPresence?.status_message;

  // Verificar se o last_seen é recente (últimos 2 minutos)
  const isRecentlyActive = userPresence?.last_seen_at 
    ? Date.now() - new Date(userPresence.last_seen_at).getTime() < 120000
    : false;

  const effectiveStatus = isRecentlyActive ? status : 'offline';

  const indicator = (
    <span
      className={cn(
        "inline-block rounded-full ring-2 ring-background",
        STATUS_COLORS[effectiveStatus as keyof typeof STATUS_COLORS],
        SIZES[size],
        className
      )}
    />
  );

  if (!showTooltip) return indicator;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {indicator}
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          <p className="font-medium">{STATUS_LABELS[effectiveStatus as keyof typeof STATUS_LABELS]}</p>
          {statusMessage && (
            <p className="text-muted-foreground">{statusMessage}</p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Componente para mostrar lista de usuários online
interface OnlineUsersListProps {
  className?: string;
}

export function OnlineUsersList({ className }: OnlineUsersListProps) {
  const { data: presenceList = [] } = useTeamPresence();

  const onlineUsers = presenceList.filter(p => {
    if (p.status !== 'online') return false;
    // Verificar se está ativo nos últimos 2 minutos
    const lastSeen = new Date(p.last_seen_at).getTime();
    return Date.now() - lastSeen < 120000;
  });

  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-center gap-2 text-xs text-muted-foreground px-2 py-1">
        <span className="h-2 w-2 bg-green-500 rounded-full" />
        <span>{onlineUsers.length} online</span>
      </div>
    </div>
  );
}
