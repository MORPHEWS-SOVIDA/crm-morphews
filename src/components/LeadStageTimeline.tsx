import { useState } from 'react';
import { History, ChevronDown, ChevronUp, MessageSquare, Clock, User, Bot, Globe, ShoppingCart, Phone } from 'lucide-react';
import { FUNNEL_STAGES, FunnelStage } from '@/types/lead';
import { useLeadStageHistory } from '@/hooks/useLeadStageHistory';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

interface LeadStageTimelineProps {
  leadId: string;
  currentStage: FunnelStage;
}

export function LeadStageTimeline({ leadId, currentStage }: LeadStageTimelineProps) {
  const { data: history = [], isLoading } = useLeadStageHistory(leadId);
  const [isExpanded, setIsExpanded] = useState(true);

  const getStageDisplay = (entry: typeof history[number], type: 'current' | 'previous') => {
    if (type === 'current') {
      if (entry.funnel_stage_name) {
        return {
          label: entry.funnel_stage_name,
          color: entry.funnel_stage_color || 'bg-muted',
          textColor: entry.funnel_stage_text_color || 'text-foreground',
        };
      }
    } else {
      if (entry.previous_funnel_stage_name) {
        return {
          label: entry.previous_funnel_stage_name,
          color: entry.previous_funnel_stage_color || 'bg-muted',
          textColor: entry.previous_funnel_stage_text_color || 'text-foreground',
        };
      }
      if (!entry.previous_stage) return null;
    }

    const enumVal = type === 'current' ? entry.stage : entry.previous_stage;
    if (!enumVal) return null;

    const staticStage = FUNNEL_STAGES[enumVal as FunnelStage];
    return staticStage || { label: enumVal, color: 'bg-muted', textColor: 'text-foreground' };
  };

  const getSourceIcon = (source: string | null) => {
    switch (source) {
      case 'auto_move':
      case 'automation':
        return <Bot className="w-3 h-3" />;
      case 'webhook':
      case 'ecommerce':
        return <ShoppingCart className="w-3 h-3" />;
      case 'whatsapp':
        return <Phone className="w-3 h-3" />;
      case 'social_selling':
        return <Globe className="w-3 h-3" />;
      default:
        return <User className="w-3 h-3" />;
    }
  };

  const getSourceLabel = (source: string | null) => {
    switch (source) {
      case 'auto_move': return 'Auto-move';
      case 'automation': return 'Automação';
      case 'webhook': return 'Webhook';
      case 'ecommerce': return 'E-commerce';
      case 'whatsapp': return 'WhatsApp';
      case 'social_selling': return 'Social Selling';
      case 'manual': return 'Manual';
      default: return source || 'Manual';
    }
  };

  if (isLoading) {
    return (
      <div className="bg-card rounded-xl p-6 shadow-card">
        <div className="flex items-center gap-2 mb-4">
          <History className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Histórico do Funil</h2>
        </div>
        <div className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      </div>
    );
  }

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: format(date, "dd 'de' MMM 'de' yyyy", { locale: ptBR }),
      time: format(date, "HH:mm", { locale: ptBR }),
    };
  };

  const isHexOrRgb = (color: string) => color.startsWith('#') || color.startsWith('rgb');

  return (
    <div className="bg-card rounded-xl p-6 shadow-card">
      <Button
        variant="ghost"
        className="w-full flex items-center justify-between p-0 h-auto hover:bg-transparent"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Histórico do Funil</h2>
          <span className="text-sm text-muted-foreground">
            ({history.length} {history.length === 1 ? 'registro' : 'registros'})
          </span>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-5 h-5 text-muted-foreground" />
        )}
      </Button>

      {isExpanded && (
        <div className="mt-4">
          {history.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <History className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Nenhum histórico de mudanças ainda.</p>
              <p className="text-sm">As mudanças de etapa serão registradas aqui.</p>
            </div>
          ) : (
            <div className="relative">
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />

              <div className="space-y-4">
                {history.map((entry, index) => {
                  const stageDisplay = getStageDisplay(entry, 'current');
                  const previousDisplay = getStageDisplay(entry, 'previous');
                  const { date, time } = formatDateTime(entry.created_at);
                  const isLatest = index === history.length - 1;

                  return (
                    <div key={entry.id} className="relative pl-10">
                      <div 
                        className={cn(
                          "absolute left-2 w-5 h-5 rounded-full border-2 border-background flex items-center justify-center",
                          !isLatest && "bg-muted",
                          isLatest && stageDisplay && !isHexOrRgb(stageDisplay.color) && stageDisplay.color
                        )}
                        style={isLatest && stageDisplay && isHexOrRgb(stageDisplay.color) ? { backgroundColor: stageDisplay.color } : undefined}
                      >
                        {isLatest && (
                          <div className="w-2 h-2 rounded-full bg-background" />
                        )}
                      </div>

                      <div className={cn(
                        "rounded-lg p-4 border transition-colors",
                        isLatest ? "border-primary/20 bg-primary/5" : "border-border bg-muted/30"
                      )}>
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          {previousDisplay && (
                            <>
                              <span 
                                className={cn(
                                  "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium opacity-60",
                                  !isHexOrRgb(previousDisplay.color) && previousDisplay.color,
                                  !isHexOrRgb(previousDisplay.textColor) && previousDisplay.textColor
                                )}
                                style={{
                                  ...(isHexOrRgb(previousDisplay.color) ? { backgroundColor: previousDisplay.color } : {}),
                                  ...(isHexOrRgb(previousDisplay.textColor) ? { color: previousDisplay.textColor } : {}),
                                }}
                              >
                                {previousDisplay.label}
                              </span>
                              <span className="text-muted-foreground">→</span>
                            </>
                          )}
                          {stageDisplay && (
                            <span 
                              className={cn(
                                "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium",
                                !isHexOrRgb(stageDisplay.color) && stageDisplay.color,
                                !isHexOrRgb(stageDisplay.textColor) && stageDisplay.textColor
                              )}
                              style={{
                                ...(isHexOrRgb(stageDisplay.color) ? { backgroundColor: stageDisplay.color } : {}),
                                ...(isHexOrRgb(stageDisplay.textColor) ? { color: stageDisplay.textColor } : {}),
                              }}
                            >
                              {stageDisplay.label}
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {date}
                          </span>
                          <span className="text-xs">às {time}</span>
                          {entry.changed_by_profile && (
                            <span className="flex items-center gap-1 text-foreground">
                              <User className="w-3.5 h-3.5" />
                              <span className="font-medium">
                                {entry.changed_by_profile.first_name} {entry.changed_by_profile.last_name}
                              </span>
                            </span>
                          )}
                          {entry.source && (
                            <Badge variant="outline" className="text-[10px] gap-1 h-5">
                              {getSourceIcon(entry.source)}
                              {getSourceLabel(entry.source)}
                            </Badge>
                          )}
                        </div>

                        {entry.reason && (
                          <div className="mt-2 pt-2 border-t border-border/50">
                            <div className="flex items-start gap-2">
                              <MessageSquare className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                              <p className="text-sm text-foreground">{entry.reason}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
