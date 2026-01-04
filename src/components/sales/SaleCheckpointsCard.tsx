import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Clock, User, ChevronDown, ChevronUp } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  useSaleCheckpoints,
  useToggleSaleCheckpoint,
  checkpointLabels,
  checkpointOrder,
  getCheckpointStatus,
  type CheckpointType,
} from '@/hooks/useSaleCheckpoints';
import { useMyPermissions } from '@/hooks/useUserPermissions';
import { toast } from 'sonner';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface SaleCheckpointsCardProps {
  saleId: string;
  isCancelled?: boolean;
}

export function SaleCheckpointsCard({ saleId, isCancelled }: SaleCheckpointsCardProps) {
  const { data: checkpoints = [], isLoading } = useSaleCheckpoints(saleId);
  const toggleMutation = useToggleSaleCheckpoint();
  const { data: permissions } = useMyPermissions();
  const [expandedNotes, setExpandedNotes] = useState<Record<CheckpointType, boolean>>({} as any);
  const [noteInputs, setNoteInputs] = useState<Record<CheckpointType, string>>({} as any);
  const [showNoteInput, setShowNoteInput] = useState<Record<CheckpointType, boolean>>({} as any);

  const handleToggle = async (type: CheckpointType, isCompleted: boolean) => {
    if (isCancelled) {
      toast.error('Venda cancelada não pode ser alterada');
      return;
    }

    // Check permissions
    if (type === 'dispatched' && !permissions?.sales_dispatch) {
      toast.error('Sem permissão para despachar vendas');
      return;
    }
    if (type === 'delivered' && !permissions?.sales_mark_delivered) {
      toast.error('Sem permissão para marcar como entregue');
      return;
    }
    if (type === 'payment_confirmed' && !permissions?.sales_confirm_payment) {
      toast.error('Sem permissão para confirmar pagamento');
      return;
    }

    const notes = noteInputs[type] || undefined;

    try {
      await toggleMutation.mutateAsync({
        saleId,
        checkpointType: type,
        complete: !isCompleted,
        notes,
      });
      toast.success(
        !isCompleted
          ? `${checkpointLabels[type]} marcado como concluído`
          : `${checkpointLabels[type]} desmarcado`
      );
      setNoteInputs(prev => ({ ...prev, [type]: '' }));
      setShowNoteInput(prev => ({ ...prev, [type]: false }));
    } catch (error) {
      toast.error('Erro ao atualizar etapa');
    }
  };

  const canEditCheckpoint = (type: CheckpointType) => {
    if (isCancelled) return false;
    if (type === 'dispatched') return permissions?.sales_dispatch;
    if (type === 'delivered') return permissions?.sales_mark_delivered;
    if (type === 'payment_confirmed') return permissions?.sales_confirm_payment;
    return false;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Etapas da Venda</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-muted rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-primary" />
          Etapas da Venda
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {checkpointOrder.map(type => {
          const status = getCheckpointStatus(checkpoints, type);
          const canEdit = canEditCheckpoint(type);

          return (
            <div
              key={type}
              className={`p-3 rounded-lg border transition-colors ${
                status.isCompleted
                  ? 'bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800'
                  : 'bg-muted/30 border-border'
              }`}
            >
              <div className="flex items-start gap-3">
                <Checkbox
                  checked={status.isCompleted}
                  disabled={!canEdit || toggleMutation.isPending}
                  onCheckedChange={() => handleToggle(type, status.isCompleted)}
                  className="mt-1"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`font-medium ${
                        status.isCompleted ? 'text-green-700 dark:text-green-400' : 'text-foreground'
                      }`}
                    >
                      {checkpointLabels[type]}
                    </span>
                    {status.isCompleted && (
                      <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300">
                        Concluído
                      </Badge>
                    )}
                  </div>

                  {status.isCompleted && status.completedAt && (
                    <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {format(new Date(status.completedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </span>
                      {status.completedBy && (
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {status.completedBy}
                        </span>
                      )}
                    </div>
                  )}

                  {status.notes && (
                    <Collapsible
                      open={expandedNotes[type]}
                      onOpenChange={(open) => setExpandedNotes(prev => ({ ...prev, [type]: open }))}
                    >
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-6 px-2 mt-1 text-xs">
                          {expandedNotes[type] ? (
                            <>
                              <ChevronUp className="w-3 h-3 mr-1" /> Ocultar nota
                            </>
                          ) : (
                            <>
                              <ChevronDown className="w-3 h-3 mr-1" /> Ver nota
                            </>
                          )}
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <p className="text-sm text-muted-foreground mt-1 p-2 bg-muted/50 rounded">
                          {status.notes}
                        </p>
                      </CollapsibleContent>
                    </Collapsible>
                  )}

                  {!status.isCompleted && canEdit && (
                    <>
                      {showNoteInput[type] ? (
                        <div className="mt-2 space-y-2">
                          <Textarea
                            placeholder="Observação (opcional)"
                            value={noteInputs[type] || ''}
                            onChange={e => setNoteInputs(prev => ({ ...prev, [type]: e.target.value }))}
                            className="h-16 text-sm"
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleToggle(type, false)}
                              disabled={toggleMutation.isPending}
                            >
                              Confirmar
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setShowNoteInput(prev => ({ ...prev, [type]: false }))}
                            >
                              Cancelar
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="mt-1 h-7 text-xs"
                          onClick={() => setShowNoteInput(prev => ({ ...prev, [type]: true }))}
                        >
                          Adicionar observação
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
