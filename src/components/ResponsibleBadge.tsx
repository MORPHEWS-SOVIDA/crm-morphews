import { useState, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface ResponsibleBadgeProps {
  /**
   * The responsible value – may be user ID (UUID) or a name string (legacy).
   */
  responsible: string | null | undefined;
  /**
   * The current authenticated user ID. If provided and different from
   * the lead's responsible, shows a warning indicator.
   */
  currentUserId?: string | null;
  /**
   * Variant for display.
   */
  variant?: 'default' | 'inline';
  className?: string;
}

// Cache resolved names in memory for the session
const nameCache = new Map<string, string>();

function isUUID(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

/**
 * Displays the responsible person's name, resolving UUIDs to names automatically.
 * Shows a warning badge when the current user is not the lead's responsible.
 */
export function ResponsibleBadge({
  responsible,
  currentUserId,
  variant = 'default',
  className,
}: ResponsibleBadgeProps) {
  const [displayName, setDisplayName] = useState<string>('—');
  const [loading, setLoading] = useState(false);

  const responsibleValue = responsible ?? '';

  useEffect(() => {
    let cancelled = false;

    async function resolveName() {
      // Empty or null
      if (!responsibleValue) {
        setDisplayName('—');
        return;
      }

      // Already a name (not a UUID)
      if (!isUUID(responsibleValue)) {
        setDisplayName(responsibleValue);
        return;
      }

      // Check cache
      if (nameCache.has(responsibleValue)) {
        setDisplayName(nameCache.get(responsibleValue)!);
        return;
      }

      // Fetch from DB
      setLoading(true);
      const { data } = await supabase
        .from('profiles')
        .select('first_name, last_name')
        .eq('user_id', responsibleValue)
        .maybeSingle();

      if (cancelled) return;

      if (data) {
        const name = `${data.first_name ?? ''} ${data.last_name ?? ''}`.trim() || 'Usuário';
        nameCache.set(responsibleValue, name);
        setDisplayName(name);
      } else {
        // Fallback – unknown user
        setDisplayName('Usuário desconhecido');
      }
      setLoading(false);
    }

    resolveName();

    return () => {
      cancelled = true;
    };
  }, [responsibleValue]);

  // Determine if current user is NOT the responsible
  const isOtherResponsible =
    currentUserId &&
    responsibleValue &&
    isUUID(responsibleValue) &&
    responsibleValue !== currentUserId;

  if (variant === 'inline') {
    return (
      <span className={cn('text-sm', className)}>
        {loading ? '...' : displayName}
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
        {loading ? '...' : displayName}
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
