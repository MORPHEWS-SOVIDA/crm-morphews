import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { DemandDetailDialog } from '@/components/demands/DemandDetailDialog';
import { URGENCY_CONFIG } from '@/types/demand';
import type { DemandWithRelations } from '@/types/demand';
import { Clock, AlertTriangle, User, MessageSquare, Paperclip } from 'lucide-react';
import { formatDistanceToNow, isPast } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface DemandCardProps {
  demand: DemandWithRelations;
  boardId: string;
}

export function DemandCard({ demand, boardId }: DemandCardProps) {
  const [showDetail, setShowDetail] = useState(false);

  const urgencyConfig = URGENCY_CONFIG[demand.urgency];
  const isOverdue = demand.sla_deadline && isPast(new Date(demand.sla_deadline));

  const getUserInitials = (user: { first_name: string | null; last_name: string | null } | null | undefined) => {
    if (!user) return '?';
    return `${user.first_name?.[0] || ''}${user.last_name?.[0] || ''}`.toUpperCase() || '?';
  };

  return (
    <>
      <Card 
        className="cursor-pointer hover:shadow-md transition-shadow"
        onClick={() => setShowDetail(true)}
      >
        <CardContent className="p-3 space-y-2">
          {/* Labels */}
          {demand.labels && demand.labels.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {demand.labels.slice(0, 3).map(label => (
                <Badge 
                  key={label.id}
                  className="text-[10px] px-1.5 py-0 text-white"
                  style={{ backgroundColor: label.color }}
                >
                  {label.name}
                </Badge>
              ))}
              {demand.labels.length > 3 && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  +{demand.labels.length - 3}
                </Badge>
              )}
            </div>
          )}

          {/* Title */}
          <p className="font-medium text-sm line-clamp-2">{demand.title}</p>

          {/* Meta Info */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              {/* Urgency */}
              <Badge variant="outline" className={`text-[10px] ${urgencyConfig.color}`}>
                {urgencyConfig.label}
              </Badge>

              {/* Overdue indicator */}
              {isOverdue && (
                <Tooltip>
                  <TooltipTrigger>
                    <AlertTriangle className="h-3 w-3 text-destructive" />
                  </TooltipTrigger>
                  <TooltipContent>SLA estourado</TooltipContent>
                </Tooltip>
              )}
            </div>

            {/* Due date */}
            {demand.sla_deadline && (
              <Tooltip>
                <TooltipTrigger className="flex items-center gap-1">
                  <Clock className={`h-3 w-3 ${isOverdue ? 'text-destructive' : ''}`} />
                  <span className={isOverdue ? 'text-destructive' : ''}>
                    {formatDistanceToNow(new Date(demand.sla_deadline), { 
                      addSuffix: true, 
                      locale: ptBR 
                    })}
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  Prazo SLA: {new Date(demand.sla_deadline).toLocaleString('pt-BR')}
                </TooltipContent>
              </Tooltip>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-1">
            {/* Assignees */}
            <div className="flex -space-x-2">
              {demand.assignees && demand.assignees.length > 0 ? (
                demand.assignees.slice(0, 3).map((assignee) => (
                  <Tooltip key={assignee.id}>
                    <TooltipTrigger>
                      <Avatar className="h-6 w-6 border-2 border-background">
                        <AvatarImage src={assignee.user?.avatar_url || undefined} />
                        <AvatarFallback className="text-[10px]">
                          {getUserInitials(assignee.user)}
                        </AvatarFallback>
                      </Avatar>
                    </TooltipTrigger>
                    <TooltipContent>
                      {assignee.user?.first_name} {assignee.user?.last_name}
                    </TooltipContent>
                  </Tooltip>
                ))
              ) : (
                <div className="flex items-center gap-1 text-muted-foreground">
                  <User className="h-3 w-3" />
                  <span className="text-xs">Sem responsável</span>
                </div>
              )}
              {demand.assignees && demand.assignees.length > 3 && (
                <Avatar className="h-6 w-6 border-2 border-background">
                  <AvatarFallback className="text-[10px] bg-muted">
                    +{demand.assignees.length - 3}
                  </AvatarFallback>
                </Avatar>
              )}
            </div>

            {/* Lead link */}
            {demand.lead && (
              <Tooltip>
                <TooltipTrigger>
                  <Badge variant="outline" className="text-[10px]">
                    {demand.lead.name?.split(' ')[0]}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>Cliente: {demand.lead.name}</TooltipContent>
              </Tooltip>
            )}
          </div>
        </CardContent>
      </Card>

      <DemandDetailDialog
        open={showDetail}
        onOpenChange={setShowDetail}
        demandId={demand.id}
        boardId={boardId}
      />
    </>
  );
}
