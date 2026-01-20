import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { 
  ThumbsDown, 
  Calendar, 
  Coins, 
  MessageSquare, 
  Loader2, 
  ChevronDown,
  ChevronUp,
  Zap,
  Send,
  Clock
} from 'lucide-react';
import { useNonPurchaseReasons } from '@/hooks/useNonPurchaseReasons';
import { useFunnelStages } from '@/hooks/useFunnelStages';
import { useScheduleMessages } from '@/hooks/useScheduleMessages';
import { useProducts } from '@/hooks/useProducts';
import { useProductBrands } from '@/hooks/useProductBrands';
import { useUpdateLead, useLead } from '@/hooks/useLeads';
import { useAddStageHistory } from '@/hooks/useLeadStageHistory';
import { useAuth } from '@/hooks/useAuth';
import { useUsers } from '@/hooks/useUsers';
import { toast } from '@/hooks/use-toast';
import { FunnelStage } from '@/types/lead';
import { cn } from '@/lib/utils';
import { format, addHours } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { FollowupDateTimeEditor } from './FollowupDateTimeEditor';

interface LeadNonPurchaseProps {
  leadId: string;
}

const formatPrice = (cents: number) => `R$ ${(cents / 100).toFixed(2).replace('.', ',')}`;

// Map position to enum for stage changes
const POSITION_TO_ENUM: Record<number, FunnelStage> = {
  0: 'cloud',
  1: 'prospect',
  2: 'contacted',
  3: 'convincing',
  4: 'scheduled',
  5: 'positive',
  6: 'waiting_payment',
  7: 'success',
  8: 'trash',
  99: 'trash',
};

export function LeadNonPurchaseSection({ leadId }: LeadNonPurchaseProps) {
  const { data: lead } = useLead(leadId);
  const { data: reasons = [], isLoading } = useNonPurchaseReasons();
  const { data: funnelStages = [] } = useFunnelStages();
  const { data: products = [] } = useProducts();
  const { data: productBrands = [] } = useProductBrands();
  const { data: users = [] } = useUsers();
  const { scheduleMessagesForReason } = useScheduleMessages();
  const updateLead = useUpdateLead();
  const addStageHistory = useAddStageHistory();
  const { user } = useAuth();

  const [expanded, setExpanded] = useState(false);
  const [selectedReasonId, setSelectedReasonId] = useState<string | null>(null);
  const [purchasePotential, setPurchasePotential] = useState(0);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState(false);
  const [customFollowupDate, setCustomFollowupDate] = useState<Date | null>(null);
  const [followupConfirmed, setFollowupConfirmed] = useState(false);
  const [showAllReasons, setShowAllReasons] = useState(false);

  if (isLoading) {
    return (
      <Card className="border-amber-500/30">
        <CardContent className="py-8 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (reasons.length === 0) {
    return null;
  }

  const selectedReason = reasons.find(r => r.id === selectedReasonId);
  const selectedProduct = products.find(p => p.id === selectedProductId);
  const targetStage = selectedReason?.target_stage_id 
    ? funnelStages.find(s => s.id === selectedReason.target_stage_id)
    : null;
  
  // When reason changes, reset followup confirmation
  const handleReasonSelect = (reasonId: string) => {
    setSelectedReasonId(reasonId);
    setCustomFollowupDate(null);
    setFollowupConfirmed(false);
  };
  
  const handleFollowupConfirm = (date: Date) => {
    setCustomFollowupDate(date);
    setFollowupConfirmed(true);
  };

  const handleConfirmReason = async () => {
    if (!selectedReasonId || !lead) return;

    setIsSaving(true);
    try {
      const reason = reasons.find(r => r.id === selectedReasonId);
      if (!reason) throw new Error('Motivo não encontrado');

      // Update lead with purchase potential
      const updates: Record<string, any> = {};
      if (purchasePotential > 0) {
        updates.negotiated_value = (lead.negotiated_value || 0) + (purchasePotential / 100);
      }

      // Change funnel stage if configured
      if (reason.target_stage_id) {
        const targetStageConfig = funnelStages.find(s => s.id === reason.target_stage_id);
        if (targetStageConfig) {
          const newStageEnum = POSITION_TO_ENUM[targetStageConfig.position];
          if (newStageEnum && newStageEnum !== lead.stage) {
            updates.stage = newStageEnum;
            
            // Record stage history
            await addStageHistory.mutateAsync({
              lead_id: leadId,
              organization_id: lead.organization_id!,
              stage: newStageEnum,
              previous_stage: lead.stage,
              reason: `Motivo: ${reason.name}`,
              changed_by: user?.id || null,
            });
          }
        }
      }

      if (Object.keys(updates).length > 0) {
        await updateLead.mutateAsync({ id: leadId, ...updates });
      }

      // Schedule automated messages
      const currentUser = users.find(u => u.user_id === user?.id);
      const sellerName = currentUser 
        ? `${currentUser.first_name || ''} ${currentUser.last_name || ''}`.trim() 
        : user?.user_metadata?.name || '';

      const productBrand = selectedProduct?.brand_id
        ? productBrands.find(b => b.id === selectedProduct.brand_id)?.name
        : undefined;

      const { scheduled, error: scheduleError } = await scheduleMessagesForReason({
        leadId,
        leadName: lead.name,
        leadWhatsapp: lead.whatsapp || '',
        reasonId: selectedReasonId,
        productId: selectedProductId || undefined,
        productName: selectedProduct?.name,
        productBrand,
        sellerName,
        customScheduledAt: customFollowupDate || undefined,
      });

      if (scheduleError) {
        console.error('Erro ao agendar mensagens:', scheduleError);
      }

      // Call webhook if configured
      if (reason.webhook_url) {
        try {
          await fetch(reason.webhook_url, {
            method: 'POST',
            mode: 'no-cors',
            body: JSON.stringify({
              event: 'non_purchase',
              reason_id: reason.id,
              reason_name: reason.name,
              lead_id: leadId,
              lead_name: lead.name,
              lead_whatsapp: lead.whatsapp,
              lead_email: lead.email,
              purchase_potential_cents: purchasePotential,
              product_id: selectedProductId,
              product_name: selectedProduct?.name,
              seller_user_id: user?.id,
              timestamp: new Date().toISOString(),
            }),
          });
        } catch (e) {
          console.error('Webhook error:', e);
        }
      }

      toast({
        title: 'Classificação registrada',
        description: scheduled > 0 
          ? `${scheduled} mensagem(s) agendada(s) para follow-up automático`
          : `Motivo: ${reason.name}`,
      });

      // Reset form
      setSelectedReasonId(null);
      setPurchasePotential(0);
      setSelectedProductId(null);
      setConfirmDialog(false);
      setExpanded(false);
      setCustomFollowupDate(null);
      setFollowupConfirmed(false);
    } catch (error: any) {
      toast({
        title: 'Erro ao registrar',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <Card className="border-amber-500/30 bg-gradient-to-br from-amber-50/50 to-orange-50/50 dark:from-amber-950/20 dark:to-orange-950/20">
        <CardHeader 
          className="cursor-pointer select-none"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <ThumbsDown className="w-5 h-5" />
              Classificar - Não Comprou
            </CardTitle>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          </div>
          <CardDescription className="flex items-center gap-2 text-amber-600/80 dark:text-amber-500/80">
            <Zap className="w-3 h-3" />
            Follow-up automático por WhatsApp e mudança de etapa do funil
          </CardDescription>
        </CardHeader>

        {expanded && (
          <CardContent className="space-y-4">
            {/* Purchase Potential - Optional */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Coins className="w-4 h-4 text-amber-500" />
                Potencial de Compra <span className="text-muted-foreground text-xs">(opcional)</span>
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium pointer-events-none">
                  R$
                </span>
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder="0,00"
                  value={purchasePotential > 0 ? (purchasePotential / 100).toFixed(2).replace('.', ',') : ''}
                  onChange={(e) => {
                    const rawValue = e.target.value;
                    // Se apagou tudo, limpa
                    if (!rawValue.trim()) {
                      setPurchasePotential(0);
                      return;
                    }
                    // Remove tudo exceto dígitos
                    const onlyDigits = rawValue.replace(/\D/g, '');
                    const cents = parseInt(onlyDigits || '0', 10);
                    setPurchasePotential(cents);
                  }}
                  onFocus={(e) => setTimeout(() => e.target.select(), 0)}
                  className="bg-background pl-10 text-right"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Este valor será adicionado ao "Valor Negociado" do lead
              </p>
            </div>

            {/* Product (optional) */}
            <div className="space-y-2">
              <Label className="text-muted-foreground">Produto de interesse (opcional)</Label>
              <Select 
                value={selectedProductId || '__none__'} 
                onValueChange={(v) => setSelectedProductId(v === '__none__' ? null : v)}
              >
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Selecione um produto" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Nenhum</SelectItem>
                  {products.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Separator className="bg-amber-200/50 dark:bg-amber-800/30" />

            {/* Reason Selection with Featured + Scrollable List */}
            <div className="space-y-2">
              <Label>Selecione o motivo para acompanhamento futuro</Label>
              
              {/* Featured Reasons */}
              {reasons.filter((r: any) => r.is_featured).length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {reasons.filter((r: any) => r.is_featured).map((reason) => {
                    const isSelected = selectedReasonId === reason.id;
                    const reasonTargetStage = reason.target_stage_id 
                      ? funnelStages.find(s => s.id === reason.target_stage_id)
                      : null;

                    return (
                      <Button
                        key={reason.id}
                        variant="outline"
                        className={cn(
                          "justify-start h-auto p-3 text-left transition-all",
                          isSelected 
                            ? "border-amber-500 bg-amber-500/10 ring-1 ring-amber-500" 
                            : "hover:border-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                        )}
                        onClick={() => handleReasonSelect(reason.id)}
                      >
                        <div className="flex-1 space-y-1">
                          <p className="font-medium text-sm">{reason.name}</p>
                          <div className="flex flex-wrap gap-1">
                            {reason.followup_hours > 0 && (
                              <Badge variant="secondary" className="text-xs">
                                <Calendar className="w-3 h-3 mr-1" />
                                Sugestão: {reason.followup_hours}h
                              </Badge>
                            )}
                            {reasonTargetStage && (
                              <Badge 
                                variant="outline" 
                                className="text-xs"
                                style={{ 
                                  borderColor: reasonTargetStage.color,
                                  color: reasonTargetStage.color 
                                }}
                              >
                                → {reasonTargetStage.name}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </Button>
                    );
                  })}
                </div>
              )}
              
              {/* All Reasons in Scrollable Area */}
              {reasons.filter((r: any) => !r.is_featured).length > 0 && (
                <>
                  <Button
                    variant="link"
                    className="text-xs text-muted-foreground p-0 h-auto"
                    onClick={() => setShowAllReasons(!showAllReasons)}
                  >
                    {showAllReasons ? (
                      <>Ocultar lista completa <ChevronUp className="w-3 h-3 ml-1" /></>
                    ) : (
                      <>Ver todos os motivos ({reasons.filter((r: any) => !r.is_featured).length}) <ChevronDown className="w-3 h-3 ml-1" /></>
                    )}
                  </Button>
                  
                  {showAllReasons && (
                    <div className="max-h-48 overflow-y-auto border rounded-lg p-2 bg-muted/30">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {reasons.filter((r: any) => !r.is_featured).map((reason) => {
                          const isSelected = selectedReasonId === reason.id;
                          const reasonTargetStage = reason.target_stage_id 
                            ? funnelStages.find(s => s.id === reason.target_stage_id)
                            : null;

                          return (
                            <Button
                              key={reason.id}
                              variant="outline"
                              className={cn(
                                "justify-start h-auto p-3 text-left transition-all",
                                isSelected 
                                  ? "border-amber-500 bg-amber-500/10 ring-1 ring-amber-500" 
                                  : "hover:border-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                              )}
                              onClick={() => handleReasonSelect(reason.id)}
                            >
                              <div className="flex-1 space-y-1">
                                <p className="font-medium text-sm">{reason.name}</p>
                                <div className="flex flex-wrap gap-1">
                                  {reason.followup_hours > 0 && (
                                    <Badge variant="secondary" className="text-xs">
                                      <Calendar className="w-3 h-3 mr-1" />
                                      Sugestão: {reason.followup_hours}h
                                    </Badge>
                                  )}
                                  {reasonTargetStage && (
                                    <Badge 
                                      variant="outline" 
                                      className="text-xs"
                                      style={{ 
                                        borderColor: reasonTargetStage.color,
                                        color: reasonTargetStage.color 
                                      }}
                                    >
                                      → {reasonTargetStage.name}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </Button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Follow-up Date/Time Editor - Only show when reason has followup_hours */}
            {selectedReason && selectedReason.followup_hours > 0 && (
              <FollowupDateTimeEditor
                suggestedHours={selectedReason.followup_hours}
                onConfirm={handleFollowupConfirm}
                disabled={isSaving}
              />
            )}

            {/* Selected Reason Preview */}
            {selectedReason && (
              <div className="p-3 bg-amber-100/50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800 space-y-2">
                <p className="font-medium text-sm">Ao confirmar:</p>
                <ul className="text-xs text-muted-foreground space-y-1">
                  {purchasePotential > 0 && (
                    <li className="flex items-center gap-2">
                      <Coins className="w-3 h-3 text-amber-500" />
                      Potencial +{formatPrice(purchasePotential)} será registrado
                    </li>
                  )}
                  {targetStage && (
                    <li className="flex items-center gap-2">
                      <span 
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: targetStage.color }}
                      />
                      Etapa mudará para "{targetStage.name}"
                    </li>
                  )}
                  {selectedReason.followup_hours > 0 && customFollowupDate && (
                    <li className="flex items-center gap-2">
                      <Clock className="w-3 h-3 text-blue-500" />
                      Follow-up em {format(customFollowupDate, "dd/MM 'às' HH:mm", { locale: ptBR })}
                    </li>
                  )}
                  {selectedReason.followup_hours > 0 && followupConfirmed && (
                    <li className="flex items-center gap-2">
                      <Send className="w-3 h-3 text-green-500" />
                      Mensagens WhatsApp serão agendadas automaticamente
                    </li>
                  )}
                  {selectedReason.exclusivity_hours > 0 && selectedReason.lead_visibility === 'assigned_only' && (
                    <li className="flex items-center gap-2 text-amber-600">
                      <Clock className="w-3 h-3" />
                      Você tem {selectedReason.exclusivity_hours}h de exclusividade após o follow-up
                    </li>
                  )}
                </ul>
              </div>
            )}

            {/* Confirm Button */}
            <Button 
              className="w-full bg-amber-600 hover:bg-amber-700 text-white"
              disabled={!selectedReasonId || isSaving || (selectedReason?.followup_hours > 0 && !followupConfirmed)}
              onClick={() => setConfirmDialog(true)}
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <MessageSquare className="w-4 h-4 mr-2" />
              )}
              {selectedReason?.followup_hours > 0 && !followupConfirmed 
                ? 'Confirme a data do follow-up acima'
                : 'Confirmar Classificação'
              }
            </Button>
          </CardContent>
        )}
      </Card>

      {/* Confirmation Dialog */}
      <AlertDialog open={confirmDialog} onOpenChange={setConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Classificação</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>Você está classificando este lead como:</p>
                <p className="font-medium text-foreground">{selectedReason?.name}</p>
                {targetStage && (
                  <p className="text-sm">
                    A etapa do funil será alterada para{' '}
                    <span className="font-medium" style={{ color: targetStage.color }}>
                      {targetStage.name}
                    </span>
                  </p>
                )}
                {selectedReason && selectedReason.followup_hours > 0 && customFollowupDate && (
                  <p className="text-sm text-blue-600">
                    ✓ Follow-up agendado para {format(customFollowupDate, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                )}
                {selectedReason && selectedReason.followup_hours > 0 && followupConfirmed && (
                  <p className="text-sm text-green-600">
                    ✓ Mensagens de follow-up serão agendadas automaticamente
                  </p>
                )}
                {selectedReason && selectedReason.exclusivity_hours > 0 && selectedReason.lead_visibility === 'assigned_only' && (
                  <p className="text-sm text-amber-600">
                    ⏱️ Você terá {selectedReason.exclusivity_hours}h de exclusividade para atender após o follow-up
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSaving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmReason}
              disabled={isSaving}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
