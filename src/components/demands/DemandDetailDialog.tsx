import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useDemand } from '@/hooks/useDemands';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { URGENCY_CONFIG } from '@/types/demand';
import { Clock, User, Calendar, Building2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface DemandDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  demandId: string;
  boardId: string;
}

export function DemandDetailDialog({ open, onOpenChange, demandId, boardId }: DemandDetailDialogProps) {
  const { data: demand, isLoading } = useDemand(open ? demandId : null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : demand ? (
          <>
            <DialogHeader>
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <DialogTitle className="text-xl">{demand.title}</DialogTitle>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    {demand.board && (
                      <Badge variant="outline">
                        <Building2 className="h-3 w-3 mr-1" />
                        {demand.board.name}
                      </Badge>
                    )}
                    {demand.column && (
                      <Badge 
                        variant="secondary"
                        style={{ 
                          backgroundColor: demand.column.color ? `${demand.column.color}20` : undefined,
                          borderColor: demand.column.color || undefined 
                        }}
                      >
                        {demand.column.name}
                      </Badge>
                    )}
                  </div>
                </div>
                <Badge className={URGENCY_CONFIG[demand.urgency].bgColor + ' ' + URGENCY_CONFIG[demand.urgency].color}>
                  {URGENCY_CONFIG[demand.urgency].label}
                </Badge>
              </div>
            </DialogHeader>

            <div className="space-y-6 py-4">
              {/* Labels */}
              {demand.labels && demand.labels.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {demand.labels.map(label => (
                    <Badge 
                      key={label.id}
                      className="text-white"
                      style={{ backgroundColor: label.color }}
                    >
                      {label.name}
                    </Badge>
                  ))}
                </div>
              )}

              {/* Description */}
              {demand.description && (
                <div>
                  <h4 className="font-medium mb-2">Descrição</h4>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {demand.description}
                  </p>
                </div>
              )}

              {/* Meta */}
              <div className="grid grid-cols-2 gap-4">
                {/* Deadline */}
                {demand.sla_deadline && (
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-muted-foreground">Prazo SLA</p>
                      <p className="font-medium">
                        {format(new Date(demand.sla_deadline), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                )}

                {/* Created */}
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-muted-foreground">Criado em</p>
                    <p className="font-medium">
                      {format(new Date(demand.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                </div>

                {/* Time Spent */}
                {demand.total_time_seconds > 0 && (
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-muted-foreground">Tempo gasto</p>
                      <p className="font-medium">
                        {Math.floor(demand.total_time_seconds / 3600)}h {Math.floor((demand.total_time_seconds % 3600) / 60)}m
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Assignees */}
              {demand.assignees && demand.assignees.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Responsáveis
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {demand.assignees.map(assignee => (
                      <Badge key={assignee.id} variant="outline">
                        {assignee.user?.first_name} {assignee.user?.last_name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Lead */}
              {demand.lead && (
                <div>
                  <h4 className="font-medium mb-2">Cliente Vinculado</h4>
                  <Badge variant="secondary">{demand.lead.name}</Badge>
                </div>
              )}
            </div>
          </>
        ) : (
          <p className="text-muted-foreground text-center py-8">Demanda não encontrada</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
