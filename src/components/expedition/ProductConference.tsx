import { useState, useEffect, useMemo } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { useProductConference } from '@/hooks/useProductConference';
import { Loader2, CheckCircle2, User } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';

interface ProductItem {
  id: string;
  product_name: string;
  quantity: number;
}

interface ProductConferenceProps {
  items: ProductItem[];
  saleId: string;
  organizationId: string | null;
  stage?: 'separation' | 'dispatch' | 'return';
  onAllChecked?: (allChecked: boolean) => void;
  showHistory?: boolean;
  readOnly?: boolean;
}

export function ProductConference({ 
  items, 
  saleId, 
  organizationId,
  stage = 'separation',
  onAllChecked,
  showHistory = false,
  readOnly = false,
}: ProductConferenceProps) {
  const {
    conferencesWithUsers,
    isLoading,
    addConference,
    removeConference,
    getConferenceCountForItem,
    getConferencesForItem,
    isAllConferenced,
    isAdding,
    isRemoving,
  } = useProductConference(saleId, organizationId);

  // Track optimistic updates locally
  const [optimisticChecks, setOptimisticChecks] = useState<Record<string, number>>({});

  // Calculate effective counts (server + optimistic)
  const getEffectiveCount = (itemId: string) => {
    const serverCount = getConferenceCountForItem(itemId, stage);
    const optimistic = optimisticChecks[itemId] || 0;
    return serverCount + optimistic;
  };

  // Check if all items are checked
  const allChecked = useMemo(() => {
    return items.every(item => getEffectiveCount(item.id) >= item.quantity);
  }, [items, conferencesWithUsers, optimisticChecks, stage]);

  // Notify parent when all checked
  useEffect(() => {
    onAllChecked?.(allChecked);
  }, [allChecked, onAllChecked]);

  // Reset optimistic state when server data updates
  useEffect(() => {
    setOptimisticChecks({});
  }, [conferencesWithUsers]);

  const handleCheck = (itemId: string, currentCount: number, quantity: number) => {
    if (readOnly || isAdding || isRemoving) return;

    const conferences = getConferencesForItem(itemId, stage);
    
    if (currentCount < quantity) {
      // Add a check - optimistic update
      setOptimisticChecks(prev => ({
        ...prev,
        [itemId]: (prev[itemId] || 0) + 1,
      }));
      addConference({ saleItemId: itemId, stage });
    } else if (currentCount > 0 && conferences.length > 0) {
      // Remove last check (only if we have conferences to remove)
      const lastConference = conferences[conferences.length - 1];
      setOptimisticChecks(prev => ({
        ...prev,
        [itemId]: (prev[itemId] || 0) - 1,
      }));
      removeConference(lastConference.id);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Get previous stage conferences for display
  const getPreviousStageInfo = (itemId: string) => {
    const allStages = ['separation', 'dispatch', 'return'] as const;
    const currentIdx = allStages.indexOf(stage);
    
    const previousConferences = allStages
      .slice(0, currentIdx)
      .flatMap(s => getConferencesForItem(itemId, s));
    
    return previousConferences;
  };

  const stageLabels: Record<string, string> = {
    separation: 'Separação',
    dispatch: 'Despacho',
    return: 'Devolução',
  };

  return (
    <TooltipProvider>
      <div className="space-y-1.5 bg-muted/50 rounded-md p-2">
        {items.map((item) => {
          const serverCount = getConferenceCountForItem(item.id, stage);
          const effectiveCount = getEffectiveCount(item.id);
          const fullyChecked = effectiveCount >= item.quantity;
          const conferences = getConferencesForItem(item.id, stage);
          const previousConferences = showHistory ? getPreviousStageInfo(item.id) : [];
          
          return (
            <div key={item.id} className="space-y-1">
              <div 
                className={cn(
                  "flex items-center gap-2 p-1.5 rounded transition-colors",
                  fullyChecked 
                    ? "bg-green-100 dark:bg-green-900/30" 
                    : "bg-background"
                )}
              >
                {/* Quantity checkboxes */}
                <div className="flex gap-1 flex-wrap">
                  {Array.from({ length: item.quantity }, (_, i) => {
                    const isChecked = i < effectiveCount;
                    const conference = conferences[i];
                    
                    return (
                      <Tooltip key={i}>
                        <TooltipTrigger asChild>
                          <div>
                            <Checkbox
                              checked={isChecked}
                              disabled={readOnly || isAdding || isRemoving}
                              onCheckedChange={() => handleCheck(item.id, effectiveCount, item.quantity)}
                              className={cn(
                                "h-5 w-5 transition-colors cursor-pointer",
                                isChecked 
                                  ? "data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600" 
                                  : "",
                                (isAdding || isRemoving) && "opacity-50"
                              )}
                            />
                          </div>
                        </TooltipTrigger>
                        {conference && (
                          <TooltipContent side="top" className="text-xs">
                            <div className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              <span>{conference.user_name}</span>
                            </div>
                            <div className="text-muted-foreground">
                              {format(new Date(conference.conferenced_at), "dd/MM HH:mm", { locale: ptBR })}
                            </div>
                          </TooltipContent>
                        )}
                      </Tooltip>
                    );
                  })}
                </div>
                
                {/* Product name */}
                <span 
                  className={cn(
                    "text-sm flex-1 truncate",
                    fullyChecked 
                      ? "text-green-700 dark:text-green-400 line-through" 
                      : "text-foreground"
                  )}
                >
                  {item.quantity}x {item.product_name}
                </span>

                {/* Status indicator */}
                {fullyChecked && (
                  <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                )}
              </div>

              {/* Previous stage conferences info */}
              {showHistory && previousConferences.length > 0 && (
                <div className="ml-2 flex flex-wrap gap-1">
                  {previousConferences.map((conf, idx) => (
                    <Badge key={idx} variant="outline" className="text-xs py-0">
                      <CheckCircle2 className="h-3 w-3 mr-1 text-green-600" />
                      {stageLabels[conf.stage] || conf.stage}: {conf.user_name}
                      <span className="text-muted-foreground ml-1">
                        {format(new Date(conf.conferenced_at), "dd/MM", { locale: ptBR })}
                      </span>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* Summary when all checked */}
        {allChecked && items.length > 0 && (
          <div className="flex items-center gap-2 mt-2 pt-2 border-t border-green-200 dark:border-green-800">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <span className="text-xs text-green-700 dark:text-green-400 font-medium">
              Todos os itens conferidos
            </span>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
