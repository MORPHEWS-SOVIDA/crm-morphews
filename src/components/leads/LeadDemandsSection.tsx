import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useLeadDemands } from '@/hooks/useDemands';
import { CreateDemandDialog } from '@/components/demands/CreateDemandDialog';
import { DemandDetailDialog } from '@/components/demands/DemandDetailDialog';
import { useDemandBoards } from '@/hooks/useDemandBoards';
import { URGENCY_CONFIG } from '@/types/demand';
import { Plus, ClipboardList, Clock, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { formatDistanceToNow, isPast } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface LeadDemandsSectionProps {
  leadId: string;
  leadName: string;
}

export function LeadDemandsSection({ leadId, leadName }: LeadDemandsSectionProps) {
  const { data: demands, isLoading } = useLeadDemands(leadId);
  const { data: boards } = useDemandBoards();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedDemand, setSelectedDemand] = useState<{ id: string; boardId: string } | null>(null);

  const firstBoard = boards?.[0];

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardList className="h-4 w-4" />
            Demandas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[1, 2].map(i => <Skeleton key={i} className="h-16 w-full" />)}
          </div>
        </CardContent>
      </Card>
    );
  }

  const openDemands = demands?.filter(d => !d.column?.is_final && !d.completed_at) || [];
  const completedDemands = demands?.filter(d => d.column?.is_final || d.completed_at) || [];

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardList className="h-4 w-4" />
            Demandas ({demands?.length || 0})
          </CardTitle>
          {firstBoard && (
            <Button size="sm" variant="outline" onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Nova
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {!demands?.length ? (
            <div className="text-center py-6 text-muted-foreground">
              <ClipboardList className="h-10 w-10 mx-auto mb-2 opacity-20" />
              <p className="text-sm">Nenhuma demanda vinculada</p>
              {firstBoard && (
                <Button 
                  size="sm" 
                  variant="link" 
                  onClick={() => setShowCreateDialog(true)}
                  className="mt-2"
                >
                  Criar primeira demanda
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Open Demands */}
              {openDemands.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">
                    Em Aberto ({openDemands.length})
                  </p>
                  <div className="space-y-2">
                    {openDemands.map(demand => {
                      const isOverdue = demand.sla_deadline && isPast(new Date(demand.sla_deadline));
                      const urgencyConfig = URGENCY_CONFIG[demand.urgency];
                      
                      return (
                        <div 
                          key={demand.id}
                          className="p-3 rounded-lg border bg-card hover:bg-muted/50 cursor-pointer transition-colors"
                          onClick={() => setSelectedDemand({ id: demand.id, boardId: demand.board_id })}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">{demand.title}</p>
                              <div className="flex items-center gap-2 mt-1">
                                {demand.column && (
                                  <Badge 
                                    variant="secondary" 
                                    className="text-[10px]"
                                    style={{ 
                                      backgroundColor: demand.column.color ? `${demand.column.color}20` : undefined 
                                    }}
                                  >
                                    {demand.column.name}
                                  </Badge>
                                )}
                                <Badge 
                                  variant="outline" 
                                  className={`text-[10px] ${urgencyConfig.color}`}
                                >
                                  {urgencyConfig.label}
                                </Badge>
                              </div>
                            </div>
                            {isOverdue ? (
                              <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0" />
                            ) : demand.sla_deadline ? (
                              <div className="text-right flex-shrink-0">
                                <Clock className="h-3 w-3 text-muted-foreground inline mr-1" />
                                <span className="text-xs text-muted-foreground">
                                  {formatDistanceToNow(new Date(demand.sla_deadline), { locale: ptBR })}
                                </span>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Completed Demands */}
              {completedDemands.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">
                    Concluídas ({completedDemands.length})
                  </p>
                  <div className="space-y-2">
                    {completedDemands.slice(0, 3).map(demand => (
                      <div 
                        key={demand.id}
                        className="p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 cursor-pointer transition-colors"
                        onClick={() => setSelectedDemand({ id: demand.id, boardId: demand.board_id })}
                      >
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                          <p className="text-sm text-muted-foreground truncate">{demand.title}</p>
                        </div>
                      </div>
                    ))}
                    {completedDemands.length > 3 && (
                      <p className="text-xs text-muted-foreground text-center">
                        +{completedDemands.length - 3} concluídas
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      {firstBoard && (
        <CreateDemandDialog
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
          boardId={firstBoard.id}
          leadId={leadId}
        />
      )}

      {/* Detail Dialog */}
      {selectedDemand && (
        <DemandDetailDialog
          open={!!selectedDemand}
          onOpenChange={(open) => !open && setSelectedDemand(null)}
          demandId={selectedDemand.id}
          boardId={selectedDemand.boardId}
        />
      )}
    </>
  );
}
