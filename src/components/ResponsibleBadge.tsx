import { useState, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface ResponsibleBadgeProps {
  responsible: string | null | undefined;
  currentUserId?: string | null;
  variant?: 'default' | 'inline';
  className?: string;
}

// Cache resolved names in memory for the session
const nameCache = new Map<string, string>();

// Batching system to prevent N+1 queries
let pendingIds = new Set<string>();
let pendingCallbacks = new Map<string, Set<() => void>>();
let batchTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleBatchFetch() {
  if (batchTimer) return;
  batchTimer = setTimeout(async () => {
    const ids = [...pendingIds].filter(id => !nameCache.has(id));
    pendingIds.clear();
    batchTimer = null;

    if (ids.length === 0) {
      // All were cached, still notify
      pendingCallbacks.forEach((cbs) => cbs.forEach(cb => cb()));
      pendingCallbacks.clear();
      return;
    }

    // Fetch in chunks of 50 to stay within URL limits
    for (let i = 0; i < ids.length; i += 50) {
      const chunk = ids.slice(i, i + 50);
      const { data } = await supabase
        .from('profiles')
        .select('first_name, last_name, user_id')
        .in('user_id', chunk);

      if (data) {
        for (const profile of data) {
          const name = `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim() || 'Usuário';
          nameCache.set(profile.user_id, name);
        }
      }
      // Mark missing ones
      for (const id of chunk) {
        if (!nameCache.has(id)) {
          nameCache.set(id, 'Usuário desconhecido');
        }
      }
    }

    // Notify all waiting components
    pendingCallbacks.forEach((cbs) => cbs.forEach(cb => cb()));
    pendingCallbacks.clear();
  }, 50); // 50ms debounce to collect all IDs
}

function requestName(userId: string, callback: () => void): () => void {
  if (nameCache.has(userId)) {
    // Already cached, notify immediately
    queueMicrotask(callback);
    return () => {};
  }

  pendingIds.add(userId);
  if (!pendingCallbacks.has(userId)) {
    pendingCallbacks.set(userId, new Set());
  }
  pendingCallbacks.get(userId)!.add(callback);
  scheduleBatchFetch();

  return () => {
    pendingCallbacks.get(userId)?.delete(callback);
  };
}

function isUUID(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function ResponsibleBadge({
  responsible,
  currentUserId,
  variant = 'default',
  className,
}: ResponsibleBadgeProps) {
  const [displayName, setDisplayName] = useState<string>('—');

  const responsibleValue = responsible ?? '';

  useEffect(() => {
    if (!responsibleValue) {
      setDisplayName('—');
      return;
    }

    if (!isUUID(responsibleValue)) {
      setDisplayName(responsibleValue);
      return;
    }

    if (nameCache.has(responsibleValue)) {
      setDisplayName(nameCache.get(responsibleValue)!);
      return;
    }

    setDisplayName('...');
    const cleanup = requestName(responsibleValue, () => {
      setDisplayName(nameCache.get(responsibleValue) ?? 'Usuário desconhecido');
    });

    return cleanup;
  }, [responsibleValue]);

  const isOtherResponsible =
    currentUserId &&
    responsibleValue &&
    isUUID(responsibleValue) &&
    responsibleValue !== currentUserId;

  if (variant === 'inline') {
    return (
      <span className={cn('text-sm', className)}>
        {displayName}
        {isOtherResponsible && (
          <Tooltip>
            <TooltipTrigger asChild>
              <AlertTriangle className="inline w-3.5 h-3.5 ml-1 text-amber-500" />
            </TooltipTrigger>
            <TooltipContent>Outro vendedor é o responsável preferencial</TooltipContent>
          </Tooltip>
        )}
      </span>
    );
  }

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <span className="text-muted-foreground text-sm truncate">
        {displayName}
      </span>
      {isOtherResponsible && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300 text-[10px] px-1.5">
              <AlertTriangle className="w-3 h-3 mr-0.5" />
              Outro vendedor
            </Badge>
          </TooltipTrigger>
          <TooltipContent>Outro vendedor é o responsável preferencial deste lead</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
