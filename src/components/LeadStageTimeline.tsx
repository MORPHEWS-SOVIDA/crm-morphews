import { useState } from 'react';
import { History, ChevronDown, ChevronUp, MessageSquare, Clock, User } from 'lucide-react';
import { FUNNEL_STAGES, FunnelStage } from '@/types/lead';
import { useLeadStageHistory } from '@/hooks/useLeadStageHistory';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

interface LeadStageTimelineProps {
  leadId: string;
  currentStage: FunnelStage;
}

export function LeadStageTimeline({ leadId, currentStage }: LeadStageTimelineProps) {
  const { data: history = [], isLoading } = useLeadStageHistory(leadId);
  const [isExpanded, setIsExpanded] = useState(true);

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
              {/* Timeline line */}
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />

              <div className="space-y-4">
                {history.map((entry, index) => {
                  const stageInfo = FUNNEL_STAGES[entry.stage] || { color: 'bg-muted', textColor: 'text-foreground', label: entry.stage };
                  const previousStageInfo = entry.previous_stage 
                    ? (FUNNEL_STAGES[entry.previous_stage] || { color: 'bg-muted', textColor: 'text-foreground', label: entry.previous_stage })
                    : null;
                  const { date, time } = formatDateTime(entry.created_at);
                  const isLatest = index === history.length - 1;

                  return (
                    <div key={entry.id} className="relative pl-10">
                      {/* Timeline dot */}
                      <div 
                        className={cn(
                          "absolute left-2 w-5 h-5 rounded-full border-2 border-background flex items-center justify-center",
                          isLatest ? stageInfo.color : "bg-muted"
                        )}
                      >
                        {isLatest && (
                          <div className="w-2 h-2 rounded-full bg-background" />
                        )}
                      </div>

                      <div className={cn(
                        "rounded-lg p-4 border transition-colors",
                        isLatest ? "border-primary/20 bg-primary/5" : "border-border bg-muted/30"
                      )}>
                        {/* Stage badge */}
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          {previousStageInfo && (
                            <>
                              <span className={cn(
                                "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium",
                                previousStageInfo.color,
                                previousStageInfo.textColor,
                                "opacity-60"
                              )}>
                                {previousStageInfo.label}
                              </span>
                              <span className="text-muted-foreground">→</span>
                            </>
                          )}
                          <span className={cn(
                            "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium",
                            stageInfo.color,
                            stageInfo.textColor
                          )}>
                            {stageInfo.label}
                          </span>
                        </div>

                        {/* Date, time and user */}
                        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mb-2">
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
                        </div>

                        {/* Reason/observation */}
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
