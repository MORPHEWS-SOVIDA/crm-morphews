import { useState, useEffect, useMemo } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useProductConference } from '@/hooks/useProductConference';
import { Loader2, CheckCircle2, User, Plus, Info } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';

interface ProductItem {
  id: string;
  product_name: string;
  quantity: number;
  // Kit tracking fields (optional for backwards compatibility)
  kit_id?: string | null;
  kit_quantity?: number;
  multiplier?: number;
  // Requisition number for manipulated products
  requisition_number?: string | null;
}

// Helper to format item display with kit info
// Example outputs:
// - "LIFE 3.0 (Kit 12) × 1" = 12 frascos
// - "LIFE 3.0 (Kit 6) × 2" = 12 frascos
// - "LIFE 3.0 × 5" = 5 frascos (no kit)
function formatItemWithKit(item: ProductItem): { displayName: string; totalUnits: number } {
  const kitQty = item.kit_quantity || 1;
  const mult = item.multiplier || item.quantity;
  const totalUnits = kitQty * mult;
  
  if (kitQty > 1) {
    // Has kit: "Product (Kit X) × Y"
    return {
      displayName: mult > 1 
        ? `${item.product_name} (Kit ${kitQty}) × ${mult}`
        : `${item.product_name} (Kit ${kitQty})`,
      totalUnits,
    };
  } else {
    // No kit or single unit: "Product × Y"
    return {
      displayName: totalUnits > 1 
        ? `${item.product_name} × ${totalUnits}`
        : item.product_name,
      totalUnits,
    };
  }
}

interface ProductConferenceProps {
  items: ProductItem[];
  saleId: string;
  organizationId: string | null;
  stage?: 'separation' | 'dispatch' | 'return';
  onAllChecked?: (allChecked: boolean) => void;
  showHistory?: boolean;
  readOnly?: boolean;
  allowAdditionalConference?: boolean;
  compactMode?: boolean;
  /** When true, collapses history badges into an info icon with popover */
  collapseHistory?: boolean;
}

const stageLabels: Record<string, string> = {
  separation: 'Separação',
  dispatch: 'Despacho',
  return: 'Devolução',
};

export function ProductConference({ 
  items, 
  saleId, 
  organizationId,
  stage = 'separation',
  onAllChecked,
  showHistory = false,
  readOnly = false,
  allowAdditionalConference = false,
  compactMode = false,
  collapseHistory = false,
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

  // Additional conference when already fully checked
  const handleAdditionalConference = (itemId: string) => {
    if (readOnly || isAdding || isRemoving) return;
    addConference({ saleItemId: itemId, stage });
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

  // Get all conferences for an item (for showing who conferenced)
  const getAllConferencesForItem = (itemId: string) => {
    const allStages = ['separation', 'dispatch', 'return'] as const;
    return allStages.flatMap(s => getConferencesForItem(itemId, s));
  };

  // Get unique conferencing users for summary
  const getConferenceSummary = () => {
    const usersByStage: Record<string, Set<string>> = {};
    
    items.forEach(item => {
      const allStages = ['separation', 'dispatch', 'return'] as const;
      allStages.forEach(s => {
        const conferences = getConferencesForItem(item.id, s);
        if (conferences.length > 0) {
          if (!usersByStage[s]) usersByStage[s] = new Set();
          conferences.forEach(c => usersByStage[s].add(c.user_name || 'Usuário'));
        }
      });
    });
    
    return usersByStage;
  };

  const conferenceSummary = getConferenceSummary();

  return (
    <TooltipProvider>
      <div className={cn("space-y-1.5 bg-muted/50 rounded-md", compactMode ? "p-1.5" : "p-2")}>
        {items.map((item) => {
          const serverCount = getConferenceCountForItem(item.id, stage);
          const effectiveCount = getEffectiveCount(item.id);
          const fullyChecked = effectiveCount >= item.quantity;
          const conferences = getConferencesForItem(item.id, stage);
          const previousConferences = showHistory ? getPreviousStageInfo(item.id) : [];
          const allItemConferences = getAllConferencesForItem(item.id);
          
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
                
                {/* Product name with kit info and requisition */}
                {(() => {
                  const { displayName, totalUnits } = formatItemWithKit(item);
                  return (
                    <div className="flex-1">
                      <span 
                        className={cn(
                          "text-sm",
                          fullyChecked 
                            ? "text-green-700 dark:text-green-400 line-through" 
                            : "text-foreground"
                        )}
                        title={`Total: ${totalUnits} ${totalUnits === 1 ? 'unidade' : 'unidades'}`}
                      >
                        {displayName}
                        <span className="text-xs text-muted-foreground ml-1">
                          ({totalUnits} {totalUnits === 1 ? 'un' : 'uns'})
                        </span>
                      </span>
                      {item.requisition_number && (
                        <span className="block text-xs text-amber-600 dark:text-amber-400 font-medium">
                          📋 Req: {item.requisition_number}
                        </span>
                      )}
                    </div>
                  );
                })()}

                {/* Status indicator + Additional conference button */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  {fullyChecked && (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  )}
                  
                  {allowAdditionalConference && fullyChecked && !readOnly && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => handleAdditionalConference(item.id)}
                          disabled={isAdding}
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <span>Você quer conferir também?</span>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </div>

              {/* Conference history badges per item */}
              {(showHistory || allItemConferences.length > 0) && allItemConferences.length > 0 && (
                collapseHistory ? (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-5 w-5 ml-1 text-muted-foreground hover:text-primary"
                      >
                        <Info className="h-3.5 w-3.5" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-2" side="top">
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground mb-1">Conferências:</p>
                        {allItemConferences.map((conf, idx) => (
                          <div key={idx} className="flex items-center gap-1 text-xs">
                            <CheckCircle2 className="h-3 w-3 text-green-600" />
                            <span>{stageLabels[conf.stage] || conf.stage}:</span>
                            <span className="font-medium">{conf.user_name}</span>
                            <span className="text-muted-foreground">
                              {format(new Date(conf.conferenced_at), "dd/MM", { locale: ptBR })}
                            </span>
                          </div>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                ) : (
                  <div className="ml-2 flex flex-wrap gap-1">
                    {allItemConferences.map((conf, idx) => (
                      <Badge 
                        key={idx} 
                        variant="outline" 
                        className="text-xs py-0 gap-1"
                      >
                        <CheckCircle2 className="h-3 w-3 text-green-600" />
                        {stageLabels[conf.stage] || conf.stage}: {conf.user_name}
                        <span className="text-muted-foreground">
                          {format(new Date(conf.conferenced_at), "dd/MM", { locale: ptBR })}
                        </span>
                      </Badge>
                    ))}
                  </div>
                )
              )}
            </div>
          );
        })}

        {/* Summary when all checked */}
        {allChecked && items.length > 0 && (
          <div className="flex flex-col gap-1 mt-2 pt-2 border-t border-green-200 dark:border-green-800">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span className="text-xs text-green-700 dark:text-green-400 font-medium">
                Todos os itens conferidos
              </span>
              
              {/* Collapsed summary in popover */}
              {collapseHistory && Object.keys(conferenceSummary).length > 0 && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-5 w-5 text-muted-foreground hover:text-primary"
                    >
                      <Info className="h-3.5 w-3.5" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-2" side="top">
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground mb-1">Responsáveis:</p>
                      {Object.entries(conferenceSummary).map(([stageName, users]) => (
                        <div key={stageName} className="flex items-center gap-1 text-xs">
                          <span>{stageLabels[stageName]}:</span>
                          <span className="font-medium">{Array.from(users).join(', ')}</span>
                        </div>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              )}
            </div>
            
            {/* Show who conferenced at each stage - only when not collapsed */}
            {!collapseHistory && Object.keys(conferenceSummary).length > 0 && (
              <div className="flex flex-wrap gap-1 ml-6">
                {Object.entries(conferenceSummary).map(([stageName, users]) => (
                  <Badge key={stageName} variant="secondary" className="text-xs py-0">
                    {stageLabels[stageName]}: {Array.from(users).join(', ')}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}