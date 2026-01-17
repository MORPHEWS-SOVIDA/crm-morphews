import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CheckCircle2, Clock, User, ChevronDown, ChevronUp, History, RotateCcw, Send } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  useSaleCheckpoints,
  useToggleSaleCheckpoint,
  useSaleCheckpointHistory,
  checkpointLabels,
  checkpointOrder,
  checkpointEmojis,
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { useUpdateSale } from '@/hooks/useSales';
import { useTenantMembers } from '@/hooks/multi-tenant';
import { useDeliveryRegions, type DeliveryRegion } from '@/hooks/useDeliveryConfig';

// Hook to fetch delivery return reasons
function useDeliveryReturnReasons() {
  return useQuery({
    queryKey: ['delivery-return-reasons'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('delivery_return_reasons')
        .select('*')
        .eq('is_active', true)
        .order('position', { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
  });
}

interface SaleCheckpointsCardProps {
  saleId: string;
  saleStatus?: string;
  isCancelled?: boolean;
  deliveryRegionId?: string | null;
}

export function SaleCheckpointsCard({ saleId, saleStatus, isCancelled, deliveryRegionId }: SaleCheckpointsCardProps) {
  const { data: checkpoints = [], isLoading } = useSaleCheckpoints(saleId);
  const { data: history = [] } = useSaleCheckpointHistory(saleId);
  const { data: returnReasons = [] } = useDeliveryReturnReasons();
  const { data: regions = [] } = useDeliveryRegions();
  const { data: members = [] } = useTenantMembers();
  const toggleMutation = useToggleSaleCheckpoint();
  const updateSale = useUpdateSale();
  const { data: permissions } = useMyPermissions();
  const [expandedNotes, setExpandedNotes] = useState<Record<CheckpointType, boolean>>({} as any);
  const [noteInputs, setNoteInputs] = useState<Record<CheckpointType, string>>({} as any);
  const [showNoteInput, setShowNoteInput] = useState<Record<CheckpointType, boolean>>({} as any);
  const [showHistory, setShowHistory] = useState(false);
  const [showReturnDialog, setShowReturnDialog] = useState(false);
  const [selectedReturnReason, setSelectedReturnReason] = useState<string>('');
  const [returnNotes, setReturnNotes] = useState('');
  const [showExpeditionDialog, setShowExpeditionDialog] = useState(false);
  const [selectedDeliveryUser, setSelectedDeliveryUser] = useState<string>('');

  // Get the selected region
  const selectedRegion = deliveryRegionId 
    ? (regions as DeliveryRegion[]).find(r => r.id === deliveryRegionId) 
    : null;

  // Filter delivery users based on region - ONLY show users assigned to this region
  const deliveryUsers = (() => {
    // If no region selected, show all members
    if (!deliveryRegionId || !selectedRegion) {
      return members;
    }
    
    // If region has assigned users, filter to only those users
    if (selectedRegion.assigned_users && selectedRegion.assigned_users.length > 0) {
      const assignedUserIds = new Set(selectedRegion.assigned_users.map(u => u.user_id));
      return members.filter(member => assignedUserIds.has(member.user_id));
    }
    
    // If region has no assigned users, show all (fallback)
    return members;
  })();

  const handleToggle = async (type: CheckpointType, isCompleted: boolean) => {
    if (isCancelled) {
      toast.error('Venda cancelada não pode ser alterada');
      return;
    }

    // Check permissions
    if (type === 'printed' && !permissions?.sales_mark_printed) {
      toast.error('Sem permissão para marcar como impresso');
      return;
    }
    if (type === 'pending_expedition' && !permissions?.sales_validate_expedition) {
      toast.error('Sem permissão para validar expedição');
      return;
    }
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

  const handleMarkReturned = async () => {
    if (!selectedReturnReason) {
      toast.error('Selecione um motivo');
      return;
    }

    await updateSale.mutateAsync({
      id: saleId,
      data: {
        status: 'returned' as any,
      }
    });

    // Update the sale with return reason info via direct update
    await supabase
      .from('sales')
      .update({
        return_reason_id: selectedReturnReason,
        return_notes: returnNotes || null,
        returned_at: new Date().toISOString(),
      })
      .eq('id', saleId);

    setShowReturnDialog(false);
    setSelectedReturnReason('');
    setReturnNotes('');
    toast.success('Venda marcada como retornada');
  };

  const handleValidateExpedition = async () => {
    try {
      await toggleMutation.mutateAsync({
        saleId,
        checkpointType: 'pending_expedition',
        complete: true,
      });
      setShowExpeditionDialog(false);
      toast.success('Expedição validada com sucesso!');
    } catch (error) {
      toast.error('Erro ao validar expedição');
    }
  };

  const handleDispatch = async () => {
    try {
      await toggleMutation.mutateAsync({
        saleId,
        checkpointType: 'dispatched',
        complete: true,
      });
      
      // Also update assigned delivery user if selected
      if (selectedDeliveryUser) {
        await supabase
          .from('sales')
          .update({ assigned_delivery_user_id: selectedDeliveryUser })
          .eq('id', saleId);
      }
      
      toast.success('Pedido despachado com sucesso!');
    } catch (error) {
      toast.error('Erro ao despachar');
    }
  };

  const canEditCheckpoint = (type: CheckpointType) => {
    if (isCancelled) return false;
    if (type === 'printed') return permissions?.sales_mark_printed;
    if (type === 'pending_expedition') return permissions?.sales_validate_expedition;
    if (type === 'dispatched') return permissions?.sales_dispatch;
    if (type === 'delivered') return permissions?.sales_mark_delivered;
    if (type === 'payment_confirmed') return permissions?.sales_confirm_payment;
    return false;
  };

  // Check if "Entregue" is checked to show Voltou button
  const dispatchedStatus = getCheckpointStatus(checkpoints, 'dispatched');
  const deliveredStatus = getCheckpointStatus(checkpoints, 'delivered');
  const showReturnButton = dispatchedStatus.isCompleted && 
    !deliveredStatus.isCompleted && 
    saleStatus !== 'returned' &&
    permissions?.sales_mark_delivered;

  // Determine what action button to show for each checkpoint
  const getActionButton = (type: CheckpointType) => {
    const status = getCheckpointStatus(checkpoints, type);
    
    // Pending expedition needs confirmation dialog
    if (type === 'pending_expedition' && !status.isCompleted && saleStatus === 'draft' && permissions?.sales_validate_expedition) {
      return (
        <Button
          size="sm"
          className="mt-2 w-full"
          onClick={() => setShowExpeditionDialog(true)}
          disabled={toggleMutation.isPending}
        >
          <CheckCircle2 className="w-4 h-4 mr-2" />
          Validar Expedição
        </Button>
      );
    }

    // Dispatched needs delivery user selection
    if (type === 'dispatched' && !status.isCompleted && saleStatus === 'pending_expedition' && permissions?.sales_dispatch) {
      return (
        <div className="mt-2 space-y-2">
          <Select 
            value={selectedDeliveryUser || "none"} 
            onValueChange={(v) => setSelectedDeliveryUser(v === "none" ? "" : v)}
          >
            <SelectTrigger className="text-xs h-8">
              <SelectValue placeholder="Selecionar entregador..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sem entregador definido</SelectItem>
              {deliveryUsers.map(member => (
                <SelectItem key={member.user_id} value={member.user_id}>
                  {member.profile?.first_name} {member.profile?.last_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            className="w-full"
            onClick={handleDispatch}
            disabled={toggleMutation.isPending}
          >
            <Send className="w-4 h-4 mr-2" />
            Despachar
          </Button>
        </div>
      );
    }

    return null;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Etapas da Venda</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-16 bg-muted rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const isReturned = saleStatus === 'returned';

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-primary" />
            Etapas da Venda
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Rascunho - Always shown as first step */}
          <div
            className={`p-3 rounded-lg border transition-colors ${
              saleStatus === 'draft'
                ? 'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800'
                : 'bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-xl">{checkpointEmojis.draft}</span>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`font-medium ${
                      saleStatus !== 'draft' ? 'text-green-700 dark:text-green-400' : 'text-amber-700 dark:text-amber-400'
                    }`}
                  >
                    Rascunho
                  </span>
                  {saleStatus === 'draft' ? (
                    <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-300 text-xs">
                      Atual
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300 text-xs">
                      ✓
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </div>

          {checkpointOrder.map((type, index) => {
            const status = getCheckpointStatus(checkpoints, type);
            const canEdit = canEditCheckpoint(type);
            const actionButton = getActionButton(type);
            
            // Insert "Voltou" after "dispatched" if sale is returned
            const showReturnedAfterThis = type === 'dispatched' && isReturned;

            return (
              <div key={type}>
                <div
                  className={`p-3 rounded-lg border transition-colors ${
                    status.isCompleted
                      ? 'bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800'
                      : 'bg-muted/30 border-border'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-xl mt-0.5">{checkpointEmojis[type]}</span>
                    {!actionButton && (
                      <Checkbox
                        checked={status.isCompleted}
                        disabled={!canEdit || toggleMutation.isPending}
                        onCheckedChange={() => handleToggle(type, status.isCompleted)}
                        className="mt-1"
                      />
                    )}
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
                          <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300 text-xs">
                            ✓
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

                      {/* Action button integrated directly in the step */}
                      {actionButton}

                      {!status.isCompleted && canEdit && !actionButton && (
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

                {/* Show "Voltou" step after dispatched if sale is returned */}
                {showReturnedAfterThis && (
                  <div className="p-3 rounded-lg border transition-colors bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800 mt-3">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{checkpointEmojis.returned}</span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-amber-700 dark:text-amber-400">
                            Voltou / Não Entregue
                          </span>
                          <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-300 text-xs">
                            Retornou
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Voltou / Não Entregue Button - show after dispatched but before delivered */}
          {showReturnButton && (
            <Button 
              variant="outline"
              className="w-full border-amber-500 text-amber-600 hover:bg-amber-50"
              onClick={() => setShowReturnDialog(true)}
              disabled={updateSale.isPending}
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              {checkpointEmojis.returned} Voltou / Não Entregue
            </Button>
          )}

          {/* History Section */}
          {history.length > 0 && (
            <Collapsible open={showHistory} onOpenChange={setShowHistory}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="w-full justify-between">
                  <span className="flex items-center gap-2">
                    <History className="w-4 h-4" />
                    Histórico de Alterações
                    <Badge variant="secondary" className="text-xs">{history.length}</Badge>
                  </span>
                  {showHistory ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-2 space-y-2 max-h-48 overflow-y-auto border rounded-lg p-2 bg-muted/20">
                  {history.map((entry) => (
                    <div key={entry.id} className="text-sm border-b last:border-0 pb-2 last:pb-0">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                        <Clock className="w-3 h-3" />
                        <span>
                          {format(new Date(entry.created_at), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}
                        </span>
                        {entry.changed_by_profile && (
                          <>
                            <span>•</span>
                            <User className="w-3 h-3" />
                            <span>
                              {`${entry.changed_by_profile.first_name || ''} ${entry.changed_by_profile.last_name || ''}`.trim()}
                            </span>
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge 
                          variant={entry.action === 'completed' ? 'default' : 'secondary'}
                          className="text-xs"
                        >
                          {entry.action === 'completed' ? 'Marcado' : 'Desmarcado'}
                        </Badge>
                        <span className="font-medium text-xs">
                          {checkpointEmojis[entry.checkpoint_type]} {checkpointLabels[entry.checkpoint_type]}
                        </span>
                      </div>
                      {entry.notes && (
                        <p className="text-xs text-muted-foreground mt-1 pl-2 border-l-2 border-muted">
                          {entry.notes}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}
        </CardContent>
      </Card>

      {/* Expedition Validation Dialog */}
      <AlertDialog open={showExpeditionDialog} onOpenChange={setShowExpeditionDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{checkpointEmojis.pending_expedition} Validar Expedição</AlertDialogTitle>
            <AlertDialogDescription>
              Confirma que os produtos foram conferidos e estão prontos para despacho?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleValidateExpedition}>
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Return Dialog */}
      <AlertDialog open={showReturnDialog} onOpenChange={setShowReturnDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{checkpointEmojis.returned} Marcar como Não Entregue</AlertDialogTitle>
            <AlertDialogDescription>
              Selecione o motivo pelo qual a entrega não foi concluída.
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Motivo *</Label>
              <Select value={selectedReturnReason} onValueChange={setSelectedReturnReason}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o motivo..." />
                </SelectTrigger>
                <SelectContent>
                  {returnReasons.map((reason: any) => (
                    <SelectItem key={reason.id} value={reason.id}>
                      {reason.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Observações (opcional)</Label>
              <Textarea
                value={returnNotes}
                onChange={(e) => setReturnNotes(e.target.value)}
                placeholder="Detalhes adicionais..."
              />
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleMarkReturned}
              disabled={!selectedReturnReason || updateSale.isPending}
              className="bg-amber-600 hover:bg-amber-700"
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}