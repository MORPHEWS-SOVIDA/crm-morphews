import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  ArrowLeft, 
  User, 
  MapPin, 
  Phone, 
  Mail,
  Package,
  Printer,
  Truck,
  CreditCard,
  CheckCircle,
  FileText,
  Upload,
  Clock,
  XCircle,
  Send,
  AlertTriangle,
  Download,
  Eye,
  Bike,
  Building2,
  Store,
  RotateCcw,
  Copy,
  Pencil,
  History
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { useSale, useUpdateSale, formatCurrency, getStatusLabel, getStatusColor, DeliveryStatus, getDeliveryStatusLabel } from '@/hooks/useSales';
import { useTenantMembers } from '@/hooks/multi-tenant';
import { useAuth } from '@/hooks/useAuth';
import { useMyPermissions } from '@/hooks/useUserPermissions';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useDeliveryRegions } from '@/hooks/useDeliveryConfig';
import { PaymentConfirmationDialog, PaymentConfirmationData } from '@/components/sales/PaymentConfirmationDialog';
import { useSaveSalePayments, useSalePayments } from '@/hooks/useSalePayments';
import { useSalePostSaleSurvey, useCreatePostSaleSurvey, useUpdatePostSaleSurvey, PostSaleSurveyStatus } from '@/hooks/usePostSaleSurveys';
import { MedicationAutocomplete } from '@/components/post-sale/MedicationAutocomplete';
import { useActivePostSaleQuestions, useSurveyResponses, useSavePostSaleResponses } from '@/hooks/usePostSaleQuestions';
import { useSaleChangesLog, getChangeTypeLabel } from '@/hooks/useSaleChangesLog';
import { SaleCheckpointsCard } from '@/components/sales/SaleCheckpointsCard';
import { CarrierTrackingCard } from '@/components/sales/CarrierTrackingCard';
import { MotoboyTrackingCard } from '@/components/sales/MotoboyTrackingCard';
import { RomaneioPrintButtons } from '@/components/sales/RomaneioPrintButtons';
import { SaleInvoiceCard } from '@/components/sales/SaleInvoiceCard';
import { SaleClosingInfoCard } from '@/components/sales/SaleClosingInfoCard';

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

// Delivery Actions Card Component - Simplified with just 2 buttons
interface DeliveryActionsCardProps {
  sale: any;
  handleMarkDelivered: (skipProofCheck?: boolean) => void;
  updateSale: any;
  paymentMethodRequiresProof: boolean;
}

function DeliveryActionsCard({
  sale,
  handleMarkDelivered,
  updateSale,
  paymentMethodRequiresProof,
}: DeliveryActionsCardProps) {
  const [showReturnDialog, setShowReturnDialog] = React.useState(false);
  const [showDeliveryProofDialog, setShowDeliveryProofDialog] = React.useState(false);
  const [selectedReturnReason, setSelectedReturnReason] = React.useState<string>('');
  const [returnNotes, setReturnNotes] = React.useState('');
  const { data: returnReasons = [] } = useDeliveryReturnReasons();

  const handleMarkReturned = async () => {
    if (!selectedReturnReason) {
      toast.error('Selecione um motivo');
      return;
    }

    await updateSale.mutateAsync({
      id: sale.id,
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
      .eq('id', sale.id);

    // Automatically unmark printed and dispatched checkpoints with history
    const { data: checkpointsToUnmark } = await supabase
      .from('sale_checkpoints')
      .select('id, checkpoint_type, completed_at, organization_id')
      .eq('sale_id', sale.id)
      .in('checkpoint_type', ['printed', 'dispatched'])
      .not('completed_at', 'is', null);

    const currentUser = await supabase.auth.getUser();
    const userId = currentUser.data.user?.id;

    if (checkpointsToUnmark && checkpointsToUnmark.length > 0) {
      for (const cp of checkpointsToUnmark) {
        // Update checkpoint to uncompleted
        await supabase
          .from('sale_checkpoints')
          .update({
            completed_at: null,
            completed_by: null,
          })
          .eq('id', cp.id);

        // Insert history record
        await supabase
          .from('sale_checkpoint_history')
          .insert({
            sale_id: sale.id,
            checkpoint_id: cp.id,
            checkpoint_type: cp.checkpoint_type,
            action: 'uncompleted',
            changed_by: userId,
            notes: `Desmarcado automaticamente porque venda foi marcada como "Voltou"`,
            organization_id: cp.organization_id,
          });
      }
    }

    setShowReturnDialog(false);
    toast.success('Venda marcada como retornada');
  };

  const handleDeliveryClick = () => {
    // Check if payment method requires proof and proof is missing
    const needsProof = paymentMethodRequiresProof && !sale.payment_proof_url;
    
    if (needsProof) {
      setShowDeliveryProofDialog(true);
    } else {
      handleMarkDelivered(false);
    }
  };

  const handleProceedWithoutProof = async () => {
    setShowDeliveryProofDialog(false);
    handleMarkDelivered(true); // Flag as missing proof
  };

  // Handle payment proof upload in delivery dialog
  const handleProofUploadInDialog = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileExt = file.name.split('.').pop();
    const fileName = `${sale.id}/payment_proof_${Date.now()}.${fileExt}`;
    
    const { error: uploadError } = await supabase.storage
      .from('sales-documents')
      .upload(fileName, file);

    if (uploadError) {
      toast.error('Erro ao fazer upload do arquivo');
      return;
    }

    await updateSale.mutateAsync({
      id: sale.id,
      data: { payment_proof_url: fileName }
    });
    
    setShowDeliveryProofDialog(false);
    toast.success('Comprovante anexado!');
    handleMarkDelivered(false); // Now can mark as delivered without flag
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="w-5 h-5" />
            Registrar Entrega
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2">
            <Button 
              className="w-full"
              onClick={handleDeliveryClick}
              disabled={updateSale.isPending}
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Entregue
            </Button>
            
            <Button 
              variant="outline"
              className="w-full border-amber-500 text-amber-600 hover:bg-amber-50"
              onClick={() => setShowReturnDialog(true)}
              disabled={updateSale.isPending}
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Não Entregue
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Return Dialog - Shows reasons after clicking "Não Entregue" */}
      <AlertDialog open={showReturnDialog} onOpenChange={setShowReturnDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Marcar como Não Entregue</AlertDialogTitle>
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

      {/* Delivery Proof Required Dialog */}
      <AlertDialog open={showDeliveryProofDialog} onOpenChange={setShowDeliveryProofDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Comprovante de Pagamento
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                A forma de pagamento desta venda <strong>exige comprovante</strong>, mas ele ainda não foi anexado.
              </p>
              <p>
                Você pode anexar o comprovante agora ou continuar sem ele. Se continuar sem, a venda será marcada como <strong>desconforme</strong> para posterior regularização.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label className="flex items-center gap-2 mb-2">
              <Upload className="w-4 h-4" />
              Anexar Comprovante Agora
            </Label>
            <Input
              type="file"
              accept="image/*,.pdf"
              onChange={handleProofUploadInDialog}
              className="cursor-pointer"
            />
          </div>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button 
              variant="outline" 
              className="border-amber-500 text-amber-600 hover:bg-amber-50"
              onClick={handleProceedWithoutProof}
            >
              Continuar sem comprovante
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// Inline Post-Sale Survey Form Component
interface PostSaleSurveyInlineFormProps {
  survey: any;
  updateSurvey: any;
}

function PostSaleSurveyInlineForm({ survey, updateSurvey }: PostSaleSurveyInlineFormProps) {
  const [receivedOrder, setReceivedOrder] = useState<boolean | null>(survey.received_order);
  const [knowsHowToUse, setKnowsHowToUse] = useState<boolean | null>(survey.knows_how_to_use);
  const [sellerRating, setSellerRating] = useState<number | null>(survey.seller_rating);
  const [usesContinuousMedication, setUsesContinuousMedication] = useState<boolean | null>(survey.uses_continuous_medication);
  const [continuousMedicationDetails, setContinuousMedicationDetails] = useState(survey.continuous_medication_details || '');
  const [deliveryRating, setDeliveryRating] = useState<number | null>(survey.delivery_rating);
  const [notes, setNotes] = useState(survey.notes || '');
  
  // Custom questions
  const { data: customQuestions = [], isLoading: customQuestionsLoading } = useActivePostSaleQuestions();
  const { data: existingResponses = [] } = useSurveyResponses(survey.id);
  const saveResponses = useSavePostSaleResponses();
  
  // State for custom question responses
  const [customResponses, setCustomResponses] = useState<Record<string, { text?: string; number?: number; boolean?: boolean }>>({});
  
  // Initialize custom responses from existing data
  useEffect(() => {
    if (existingResponses.length > 0) {
      const responseMap: Record<string, { text?: string; number?: number; boolean?: boolean }> = {};
      existingResponses.forEach((resp: any) => {
        responseMap[resp.question_id] = {
          text: resp.answer_text || undefined,
          number: resp.answer_number ?? undefined,
          boolean: resp.answer_boolean ?? undefined,
        };
      });
      setCustomResponses(responseMap);
    }
  }, [existingResponses]);

  const deliveryType = survey.sale?.delivery_type || survey.delivery_type;

  const handleComplete = async (completionType: 'call' | 'whatsapp') => {
    // Save custom responses first
    if (customQuestions.length > 0) {
      const responsesToSave = customQuestions.map(q => ({
        question_id: q.id,
        answer_text: customResponses[q.id]?.text || null,
        answer_number: customResponses[q.id]?.number ?? null,
        answer_boolean: customResponses[q.id]?.boolean ?? null,
      }));
      
      await saveResponses.mutateAsync({
        surveyId: survey.id,
        responses: responsesToSave,
      });
    }
    
    await updateSurvey.mutateAsync({
      id: survey.id,
      received_order: receivedOrder ?? undefined,
      knows_how_to_use: knowsHowToUse ?? undefined,
      seller_rating: sellerRating ?? undefined,
      uses_continuous_medication: usesContinuousMedication ?? undefined,
      continuous_medication_details: continuousMedicationDetails || undefined,
      delivery_rating: deliveryRating ?? undefined,
      notes: notes || undefined,
      status: 'completed',
      completion_type: completionType,
    });
  };

  const handleAttempt = async () => {
    await updateSurvey.mutateAsync({
      id: survey.id,
      notes: notes || undefined,
      status: 'attempted',
    });
  };
  
  const updateCustomResponse = (questionId: string, value: { text?: string; number?: number; boolean?: boolean }) => {
    setCustomResponses(prev => ({
      ...prev,
      [questionId]: { ...prev[questionId], ...value },
    }));
  };

  const YesNoButton = ({ value, selected, onClick, children }: { value: boolean; selected: boolean; onClick: () => void; children: React.ReactNode }) => (
    <Button
      type="button"
      variant={selected ? (value ? 'default' : 'destructive') : 'outline'}
      size="sm"
      className="flex-1"
      onClick={onClick}
    >
      {children}
    </Button>
  );

  const RatingButtons = ({ value, onChange }: { value: number | null; onChange: (v: number) => void }) => (
    <div className="flex flex-wrap gap-1">
      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
        <Button
          key={n}
          type="button"
          variant={value === n ? 'default' : 'outline'}
          size="sm"
          className="w-8 h-8 p-0"
          onClick={() => onChange(n)}
        >
          {n}
        </Button>
      ))}
    </div>
  );

  return (
    <div className="space-y-4">
      {survey.status === 'attempted' && (
        <div className="p-2 bg-amber-50 dark:bg-amber-900/20 rounded text-xs text-amber-700 dark:text-amber-400">
          Tentativa registrada - continue a pesquisa quando conseguir contato
        </div>
      )}
      
      <div className="space-y-3">
        <div>
          <Label className="text-xs">Recebeu seu pedido?</Label>
          <div className="flex gap-2 mt-1">
            <YesNoButton value={true} selected={receivedOrder === true} onClick={() => setReceivedOrder(true)}>
              <CheckCircle className="w-3 h-3 mr-1" /> Sim
            </YesNoButton>
            <YesNoButton value={false} selected={receivedOrder === false} onClick={() => setReceivedOrder(false)}>
              <XCircle className="w-3 h-3 mr-1" /> Não
            </YesNoButton>
          </div>
        </div>

        <div>
          <Label className="text-xs">Sabe como usar?</Label>
          <div className="flex gap-2 mt-1">
            <YesNoButton value={true} selected={knowsHowToUse === true} onClick={() => setKnowsHowToUse(true)}>
              <CheckCircle className="w-3 h-3 mr-1" /> Sim
            </YesNoButton>
            <YesNoButton value={false} selected={knowsHowToUse === false} onClick={() => setKnowsHowToUse(false)}>
              <XCircle className="w-3 h-3 mr-1" /> Não
            </YesNoButton>
          </div>
        </div>

        <div>
          <Label className="text-xs">Nota para o vendedor (0-10)</Label>
          <RatingButtons value={sellerRating} onChange={setSellerRating} />
        </div>

        <div>
          <Label className="text-xs">Usa remédio de uso contínuo?</Label>
          <div className="flex gap-2 mt-1">
            <YesNoButton value={true} selected={usesContinuousMedication === true} onClick={() => setUsesContinuousMedication(true)}>
              Sim
            </YesNoButton>
            <YesNoButton value={false} selected={usesContinuousMedication === false} onClick={() => setUsesContinuousMedication(false)}>
              Não
            </YesNoButton>
          </div>
          {usesContinuousMedication && (
            <div className="mt-2">
              <MedicationAutocomplete
                value={continuousMedicationDetails}
                onChange={setContinuousMedicationDetails}
                placeholder="Digite o nome do medicamento..."
              />
            </div>
          )}
        </div>

        {deliveryType && (
          <div>
            <Label className="text-xs">
              Nota para {deliveryType === 'motoboy' ? 'o motoboy' : deliveryType === 'carrier' ? 'a transportadora' : 'o atendimento'} (0-10)
            </Label>
            <RatingButtons value={deliveryRating} onChange={setDeliveryRating} />
          </div>
        )}
        
        {/* Custom Questions */}
        {customQuestionsLoading ? (
          <div className="text-xs text-muted-foreground">Carregando perguntas...</div>
        ) : customQuestions.length > 0 && (
          <div className="space-y-3 pt-2 border-t">
            <p className="text-xs font-medium text-muted-foreground">Perguntas Personalizadas</p>
            {customQuestions.map((question) => (
              <div key={question.id}>
                <Label className="text-xs">
                  {question.question}
                  {question.is_required && <span className="text-destructive ml-1">*</span>}
                </Label>
                
                {question.question_type === 'yes_no' && (
                  <div className="flex gap-2 mt-1">
                    <YesNoButton 
                      value={true} 
                      selected={customResponses[question.id]?.boolean === true} 
                      onClick={() => updateCustomResponse(question.id, { boolean: true })}
                    >
                      <CheckCircle className="w-3 h-3 mr-1" /> Sim
                    </YesNoButton>
                    <YesNoButton 
                      value={false} 
                      selected={customResponses[question.id]?.boolean === false} 
                      onClick={() => updateCustomResponse(question.id, { boolean: false })}
                    >
                      <XCircle className="w-3 h-3 mr-1" /> Não
                    </YesNoButton>
                  </div>
                )}
                
                {question.question_type === 'rating_0_10' && (
                  <RatingButtons 
                    value={customResponses[question.id]?.number ?? null} 
                    onChange={(v) => updateCustomResponse(question.id, { number: v })} 
                  />
                )}
                
                {question.question_type === 'text' && (
                  <Textarea
                    value={customResponses[question.id]?.text || ''}
                    onChange={(e) => updateCustomResponse(question.id, { text: e.target.value })}
                    placeholder="Digite sua resposta..."
                    className="mt-1 text-sm"
                    rows={2}
                  />
                )}
                
                {question.question_type === 'medication' && (
                  <div className="mt-1">
                    <MedicationAutocomplete
                      value={customResponses[question.id]?.text || ''}
                      onChange={(v) => updateCustomResponse(question.id, { text: v })}
                      placeholder="Digite o nome do medicamento..."
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div>
          <Label className="text-xs">Observações</Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anotações..."
            className="mt-1 text-sm"
            rows={2}
          />
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">Concluir pesquisa por:</p>
        <div className="flex gap-2">
          <Button
            onClick={() => handleComplete('call')}
            disabled={updateSurvey.isPending || saveResponses.isPending}
            size="sm"
            className="flex-1"
          >
            <Phone className="w-3 h-3 mr-1" />
            Ligação
          </Button>
          <Button
            onClick={() => handleComplete('whatsapp')}
            disabled={updateSurvey.isPending || saveResponses.isPending}
            size="sm"
            className="flex-1 bg-green-600 hover:bg-green-700"
          >
            <Send className="w-3 h-3 mr-1" />
            WhatsApp
          </Button>
        </div>
        <Button
          variant="outline"
          onClick={handleAttempt}
          disabled={updateSurvey.isPending}
          size="sm"
          className="w-full"
        >
          <Clock className="w-3 h-3 mr-1" />
          Registrar Tentativa
        </Button>
      </div>
    </div>
  );
}


export default function SaleDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: sale, isLoading } = useSale(id);
  const updateSale = useUpdateSale();
  const { data: members = [] } = useTenantMembers();
  const { data: regions = [] } = useDeliveryRegions();
  const { profile } = useAuth();
  const { data: permissions } = useMyPermissions();
  
  // Split payment lines
  const { data: salePaymentLines } = useSalePayments(sale?.id);

  // Post-sale survey hooks
  const { data: postSaleSurvey, isLoading: isLoadingSurvey } = useSalePostSaleSurvey(id);
  const createPostSaleSurvey = useCreatePostSaleSurvey();
  const updatePostSaleSurvey = useUpdatePostSaleSurvey();
  
  // Sale changes log (audit trail)
  const { data: changesLog = [] } = useSaleChangesLog(id);

  // Fetch payment method to check if it requires proof
  const { data: salePaymentMethod } = useQuery({
    queryKey: ['payment-method', sale?.payment_method_id],
    queryFn: async () => {
      if (!sale?.payment_method_id) return null;
      const { data, error } = await supabase
        .from('payment_methods')
        .select('*')
        .eq('id', sale.payment_method_id)
        .single();
      if (error) return null;
      return data;
    },
    enabled: !!sale?.payment_method_id,
  });

  // Check if payment method requires proof
  const paymentMethodRequiresProof = salePaymentMethod?.requires_proof || false;

  // Permission checks
  const canValidateExpedition = permissions?.sales_validate_expedition;
  const canDispatch = permissions?.sales_dispatch;
  const canMarkDelivered = permissions?.sales_mark_delivered;
  const canConfirmPayment = permissions?.sales_confirm_payment;
  const canCancel = permissions?.sales_cancel;
  const canEditDraft = permissions?.sales_edit_draft;
  
  // Admin check for reactivating cancelled sales
  const { isAdmin } = useAuth();
  const canReactivateCancelledSale = isAdmin;
  
  // Pode editar se:
  // - draft/returned
  // - pending_expedition com expedição desmarcada (sem expedition_validated_at)
  const isEditable = !!sale && (
    ['draft', 'returned'].includes(sale.status) ||
    (sale.status === 'pending_expedition' && !sale.expedition_validated_at)
  );
  const [showExpeditionDialog, setShowExpeditionDialog] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showReactivateDialog, setShowReactivateDialog] = useState(false);
  const [showPaymentProofRequiredDialog, setShowPaymentProofRequiredDialog] = useState(false);
  
  const [selectedDeliveryUser, setSelectedDeliveryUser] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [paymentNotes, setPaymentNotes] = useState(sale?.payment_notes || '');
  const [trackingCode, setTrackingCode] = useState(sale?.tracking_code || '');

  // Initialize paymentNotes and trackingCode when sale loads
  React.useEffect(() => {
    if (sale?.payment_notes) {
      setPaymentNotes(sale.payment_notes);
    }
    if (sale?.tracking_code) {
      setTrackingCode(sale.tracking_code);
    }
  }, [sale?.payment_notes, sale?.tracking_code]);

  // Filter delivery users based on the sale's delivery region
  // Only show users assigned to that region, not all users
  const deliveryUsers = useMemo(() => {
    if (!sale?.delivery_region_id) return [];
    
    const region = regions.find(r => r.id === sale.delivery_region_id);
    // Type assertion needed because useDeliveryRegions enriches the data with assigned_users
    const assignedUsers = (region as any)?.assigned_users;
    if (!assignedUsers || assignedUsers.length === 0) return [];
    
    // Get user IDs assigned to this region
    const regionUserIds = assignedUsers.map((u: { user_id: string }) => u.user_id);
    
    // Filter members to only those assigned to this region
    return members.filter(m => regionUserIds.includes(m.user_id));
  }, [sale?.delivery_region_id, regions, members]);

  // Handle file upload for payment proof or invoice
  const handleFileUpload = async (file: File, type: 'payment_proof' | 'invoice_pdf' | 'invoice_xml') => {
    if (!sale) return;
    
    const fileExt = file.name.split('.').pop();
    const fileName = `${sale.id}/${type}_${Date.now()}.${fileExt}`;
    
    const { error: uploadError } = await supabase.storage
      .from('sales-documents')
      .upload(fileName, file);

    if (uploadError) {
      toast.error('Erro ao fazer upload do arquivo');
      return null;
    }

    // Return the file path (not public URL) since bucket is private
    return fileName;
  };

  // Extract file path from URL or return as-is if already a path
  const extractFilePath = (urlOrPath: string): string => {
    // If it's already just a path (no http), return as-is
    if (!urlOrPath.startsWith('http')) {
      return urlOrPath;
    }
    
    // Extract path from full Supabase storage URL
    // Format: https://xxx.supabase.co/storage/v1/object/public/sales-documents/SALE_ID/filename
    const match = urlOrPath.match(/\/sales-documents\/(.+)$/);
    return match ? match[1] : urlOrPath;
  };

  // Get signed URL for viewing private files
  const getSignedUrl = async (urlOrPath: string) => {
    const filePath = extractFilePath(urlOrPath);
    
    const { data, error } = await supabase.storage
      .from('sales-documents')
      .createSignedUrl(filePath, 3600); // 1 hour expiry
    
    if (error || !data?.signedUrl) {
      console.error('Error creating signed URL:', error);
      toast.error('Erro ao gerar link do arquivo');
      return null;
    }
    return data.signedUrl;
  };

  const handleViewFile = async (urlOrPath: string) => {
    const url = await getSignedUrl(urlOrPath);
    if (url) {
      window.open(url, '_blank');
    }
  };

  const handleDownloadFile = async (urlOrPath: string) => {
    const url = await getSignedUrl(urlOrPath);
    if (url) {
      const filePath = extractFilePath(urlOrPath);
      const link = document.createElement('a');
      link.href = url;
      link.download = filePath.split('/').pop() || 'download';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  // Validate expedition and send to delivery
  const handleValidateExpedition = async () => {
    if (!sale) return;
    
    // Check if payment proof is required but not present
    if (sale.payment_status === 'will_pay_before' && !sale.payment_proof_url) {
      setShowPaymentProofRequiredDialog(true);
      return;
    }
    
    await updateSale.mutateAsync({
      id: sale.id,
      data: {
        status: 'pending_expedition',
      }
    });
    setShowExpeditionDialog(false);
  };

  // Check if dispatch is blocked due to missing payment proof
  const handleDispatch = async () => {
    if (!sale) return;
    
    // Check if payment proof is required but not present
    if (sale.payment_status === 'will_pay_before' && !sale.payment_proof_url) {
      setShowPaymentProofRequiredDialog(true);
      return;
    }

    await updateSale.mutateAsync({
      id: sale.id,
      data: {
        status: 'dispatched',
        assigned_delivery_user_id: selectedDeliveryUser || null,
      }
    });
    toast.success('Venda despachada!');
  };

  // Mark as delivered - with optional missing proof flag
  const handleMarkDelivered = async (markAsMissingProof: boolean = false) => {
    if (!sale) return;

    await updateSale.mutateAsync({
      id: sale.id,
      data: {
        status: 'delivered',
        delivery_status: 'delivered_normal' as DeliveryStatus,
        missing_payment_proof: markAsMissingProof,
      } as any
    });

    // Ensure delivered checkpoint is created for "Etapas da Venda" card
    const currentUser = (await supabase.auth.getUser()).data.user;
    if (currentUser?.id) {
      const { ensureDeliveredCheckpoint } = await import('@/utils/ensureDeliveredCheckpoint');
      await ensureDeliveredCheckpoint(sale.id, currentUser.id);
    }
    
    if (markAsMissingProof) {
      toast.warning('Entrega registrada - Venda marcada como desconforme (sem comprovante)');
    } else {
      toast.success('Entrega registrada!');
    }
  };

  const saveSalePayments = useSaveSalePayments();

  // Confirm payment with conciliation data
  const handleConfirmPayment = async (data: PaymentConfirmationData) => {
    if (!sale) return;

    // If total was adjusted
    const finalTotal = data.adjusted_total_cents || sale.total_cents;

    await updateSale.mutateAsync({
      id: sale.id,
      data: {
        status: 'payment_confirmed',
        payment_method: data.payment_method_name,
        payment_method_id: data.payment_method_id,
        payment_notes: data.payment_notes || null,
        ...(data.adjusted_total_cents ? { total_cents: data.adjusted_total_cents } : {}),
      }
    });

    // Save split payment lines
    if (data.payment_lines && data.payment_lines.length > 0) {
      await saveSalePayments.mutateAsync({
        saleId: sale.id,
        organizationId: sale.organization_id,
        payments: data.payment_lines.map((l) => ({
          payment_method_id: l.payment_method_id,
          payment_method_name: l.payment_method_name,
          amount_cents: l.amount_cents,
        })),
      });
    }
    
    // Check if installments exist for this sale
    const { data: existingInstallments } = await supabase
      .from('sale_installments')
      .select('id')
      .eq('sale_id', sale.id);
    
    // If no installments exist, create them
    if (!existingInstallments || existingInstallments.length === 0) {
      // Get payment method details
      const { data: paymentMethod } = await supabase
        .from('payment_methods')
        .select('*')
        .eq('id', data.payment_method_id)
        .single();
      
      if (paymentMethod) {
        const installmentCount = data.installments || sale.payment_installments || 1;
        const baseAmount = Math.floor(sale.total_cents / installmentCount);
        const remainder = sale.total_cents - (baseAmount * installmentCount);
        
        const isAnticipation = paymentMethod.installment_flow === 'anticipation';
        const anticipationFee = paymentMethod.anticipation_fee_percentage || 0;
        const settlementDays = paymentMethod.settlement_days || 30;
        
        const installmentsToCreate = [];
        
        for (let i = 0; i < installmentCount; i++) {
          const dueDate = new Date(data.transaction_date || new Date());
          
          if (isAnticipation) {
            dueDate.setDate(dueDate.getDate() + settlementDays);
          } else {
            dueDate.setDate(dueDate.getDate() + (settlementDays * (i + 1)));
          }
          
          let amount = baseAmount + (i === 0 ? remainder : 0);
          let feeAmount = 0;
          
          if (isAnticipation && anticipationFee > 0) {
            feeAmount = Math.round(amount * (anticipationFee / 100));
          }
          
          installmentsToCreate.push({
            sale_id: sale.id,
            organization_id: sale.organization_id,
            installment_number: i + 1,
            total_installments: installmentCount,
            amount_cents: amount,
            fee_cents: feeAmount,
            fee_percentage: isAnticipation ? anticipationFee : (paymentMethod.fee_percentage || 0),
            net_amount_cents: amount - feeAmount,
            due_date: dueDate.toISOString().split('T')[0],
            status: 'confirmed',
            acquirer_id: data.acquirer_id || paymentMethod.acquirer_id || null,
            transaction_date: data.transaction_date?.toISOString() || null,
            card_brand: (data.card_brand as any) || null,
            transaction_type: (data.transaction_type as any) || null,
            nsu_cv: data.nsu_cv || null,
            confirmed_at: new Date().toISOString(),
          });
        }
        
        if (installmentsToCreate.length > 0) {
          await supabase.from('sale_installments').insert(installmentsToCreate);
        }
      }
    } else {
      // If installments exist, update them with conciliation data and confirm
      await supabase
        .from('sale_installments')
        .update({
          status: 'confirmed',
          transaction_date: data.transaction_date?.toISOString() || null,
          card_brand: (data.card_brand as any) || null,
          transaction_type: (data.transaction_type as any) || null,
          nsu_cv: data.nsu_cv || null,
          acquirer_id: data.acquirer_id || null,
          confirmed_at: new Date().toISOString(),
        })
        .eq('sale_id', sale.id);
    }
    
    setShowPaymentDialog(false);
    toast.success('Pagamento confirmado!');
  };

  // Cancel sale
  const handleCancelSale = async () => {
    if (!sale) return;

    await updateSale.mutateAsync({
      id: sale.id,
      data: {
        status: 'cancelled',
      }
    });
    setShowCancelDialog(false);
    toast.success('Venda cancelada');
  };

  // Reactivate cancelled sale (admin only)
  const handleReactivateSale = async () => {
    if (!sale) return;

    try {
      // 1. Clear all checkpoints for this sale
      await supabase
        .from('sale_checkpoints')
        .update({
          completed_at: null,
          completed_by: null,
        })
        .eq('sale_id', sale.id);

      // 2. Clear expedition markers
      await supabase
        .from('sales')
        .update({
          expedition_validated_at: null,
          expedition_validated_by: null,
          separated_at: null,
          separated_by: null,
          printed_at: null,
          printed_by: null,
          dispatched_at: null,
          dispatched_by: null,
          delivered_at: null,
          assigned_delivery_user_id: null,
          carrier_tracking_status: null,
          motoboy_tracking_status: null,
        })
        .eq('id', sale.id);

      // 3. Reactivate to draft
      await updateSale.mutateAsync({
        id: sale.id,
        data: {
          status: 'draft',
        }
      });

      setShowReactivateDialog(false);
      toast.success('Venda reativada! Agora você pode editá-la.');
    } catch (error) {
      console.error('Error reactivating sale:', error);
      toast.error('Erro ao reativar venda');
    }
  };

  // Handle invoice upload
  const handleInvoiceUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'pdf' | 'xml') => {
    const file = e.target.files?.[0];
    if (!file || !sale) return;

    const url = await handleFileUpload(file, type === 'pdf' ? 'invoice_pdf' : 'invoice_xml');
    if (url) {
      await updateSale.mutateAsync({
        id: sale.id,
        data: type === 'pdf' 
          ? { invoice_pdf_url: url }
          : { invoice_xml_url: url }
      });
      toast.success(`NF ${type.toUpperCase()} anexada!`);
    }
  };

  // Handle payment proof upload - also clears missing_payment_proof flag if it was set
  const handlePaymentProofUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !sale) return;

    const url = await handleFileUpload(file, 'payment_proof');
    if (url) {
      // Update payment proof URL and clear missing_payment_proof flag if it was set
      await updateSale.mutateAsync({
        id: sale.id,
        data: { 
          payment_proof_url: url,
          missing_payment_proof: false,
        } as any
      });
      
      if ((sale as any).missing_payment_proof) {
        toast.success('Comprovante anexado! Venda regularizada.');
      } else {
        toast.success('Comprovante anexado!');
      }
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-48" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
          </div>
        </div>
      </Layout>
    );
  }

  if (!sale) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center py-12">
          <AlertTriangle className="w-12 h-12 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Venda não encontrada</h2>
          <Button onClick={() => navigate('/vendas')}>Voltar para vendas</Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/vendas')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <span className="font-mono text-lg bg-primary/10 text-primary px-3 py-1 rounded">
                  #{sale.romaneio_number}
                </span>
                <h1 className="text-2xl font-bold">Venda</h1>
                <Badge className={getStatusColor(sale.status)}>
                  {getStatusLabel(sale.status)}
                </Badge>
                {(sale as any).missing_payment_proof && (
                  <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800">
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    DESCONFORME
                  </Badge>
                )}
              </div>
              <p className="text-muted-foreground">
                Criada em {format(new Date(sale.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {canEditDraft && (
              <Button 
                variant="outline"
                size="sm"
                className={`flex-1 sm:flex-none ${!isEditable ? 'opacity-50 cursor-not-allowed' : ''}`}
                onClick={() => isEditable && navigate(`/vendas/${sale.id}/editar`)}
                disabled={!isEditable}
                title={!isEditable ? 'Só é possível editar vendas em rascunho ou que voltaram' : 'Editar venda'}
              >
                <Pencil className="w-4 h-4 mr-2" />
                Editar
              </Button>
            )}
            <RomaneioPrintButtons saleId={sale.id} />
            {canCancel && sale.status !== 'cancelled' && sale.status !== 'payment_confirmed' && (
              <Button variant="destructive" size="sm" className="flex-1 sm:flex-none" onClick={() => setShowCancelDialog(true)}>
                <XCircle className="w-4 h-4 mr-2" />
                Cancelar
              </Button>
            )}
            {/* Reactivate button for admin - only on cancelled sales */}
            {canReactivateCancelledSale && sale.status === 'cancelled' && (
              <Button 
                variant="outline" 
                size="sm" 
                className="flex-1 sm:flex-none border-green-500 text-green-600 hover:bg-green-50 dark:hover:bg-green-950/30"
                onClick={() => setShowReactivateDialog(true)}
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Reativar Venda
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Client & Products */}
          <div className="lg:col-span-2 space-y-6">
            {/* Client Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Cliente
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-lg">{sale.lead?.name}</h3>
                    {sale.lead?.email && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Mail className="w-4 h-4" />
                        {sale.lead.email}
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="w-4 h-4" />
                      {sale.lead?.whatsapp}
                    </div>
                    {(sale.lead as any)?.secondary_phone && (
                      <div className="flex items-center gap-2 text-muted-foreground text-sm">
                        <Phone className="w-3 h-3" />
                        {(sale.lead as any).secondary_phone} (secundário)
                      </div>
                    )}
                    {/* Lead Profile Info */}
                    {((sale.lead as any)?.cpf_cnpj || (sale.lead as any)?.birth_date || (sale.lead as any)?.favorite_team) && (
                      <div className="mt-2 pt-2 border-t text-xs text-muted-foreground space-y-1">
                        {(sale.lead as any)?.cpf_cnpj && (
                          <p>CPF/CNPJ: {(sale.lead as any).cpf_cnpj}</p>
                        )}
                        {(sale.lead as any)?.birth_date && (
                          <p>Nascimento: {format(new Date((sale.lead as any).birth_date + 'T12:00:00'), 'dd/MM/yyyy')}</p>
                        )}
                        {(sale.lead as any)?.favorite_team && (
                          <p>Time: {(sale.lead as any).favorite_team}</p>
                        )}
                      </div>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(`/leads/${sale.lead_id}`, '_blank')}
                  >
                    Ver Lead
                  </Button>
                </div>

                {/* Shipping Address - from lead_addresses if exists, fallback to lead */}
                {(sale as any).shipping_address ? (
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 mt-0.5 text-primary" />
                      <div className="text-sm flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-primary">Endereço de Entrega</span>
                          {(sale as any).shipping_address.label && (
                            <Badge variant="outline" className="text-xs">{(sale as any).shipping_address.label}</Badge>
                          )}
                        </div>
                        <p>{(sale as any).shipping_address.street}, {(sale as any).shipping_address.street_number}</p>
                        {(sale as any).shipping_address.complement && <p>{(sale as any).shipping_address.complement}</p>}
                        <p>{(sale as any).shipping_address.neighborhood} - {(sale as any).shipping_address.city}/{(sale as any).shipping_address.state}</p>
                        {(sale as any).shipping_address.cep && <p>CEP: {(sale as any).shipping_address.cep}</p>}
                        {(sale as any).shipping_address.delivery_notes && (
                          <p className="text-xs text-amber-600 mt-1">📝 {(sale as any).shipping_address.delivery_notes}</p>
                        )}
                        {(sale as any).shipping_address.google_maps_link && (
                          <a 
                            href={(sale as any).shipping_address.google_maps_link} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="text-xs text-primary hover:underline mt-1 inline-flex items-center gap-1"
                          >
                            <MapPin className="w-3 h-3" /> Ver no Maps
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                ) : sale.lead?.street && (
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 mt-0.5 text-muted-foreground" />
                      <div className="text-sm">
                        <p>{sale.lead.street}, {sale.lead.street_number}</p>
                        {sale.lead.complement && <p>{sale.lead.complement}</p>}
                        <p>{sale.lead.neighborhood} - {sale.lead.city}/{sale.lead.state}</p>
                        {sale.lead.cep && <p>CEP: {sale.lead.cep}</p>}
                        {(sale.lead as any).delivery_notes && (
                          <p className="text-xs text-amber-600 mt-1">📝 {(sale.lead as any).delivery_notes}</p>
                        )}
                        {(sale.lead as any).google_maps_link && (
                          <a 
                            href={(sale.lead as any).google_maps_link} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="text-xs text-primary hover:underline mt-1 inline-flex items-center gap-1"
                          >
                            <MapPin className="w-3 h-3" /> Ver no Maps
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Delivery Details Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
                  {/* Delivery Method */}
                  <div className="flex items-center gap-2">
                    {sale.delivery_type === 'motoboy' && <Bike className="w-4 h-4 text-primary" />}
                    {sale.delivery_type === 'carrier' && <Truck className="w-4 h-4 text-blue-600" />}
                    {sale.delivery_type === 'pickup' && <Store className="w-4 h-4 text-green-600" />}
                    {!sale.delivery_type && <Truck className="w-4 h-4 text-muted-foreground" />}
                    <div>
                      <p className="text-xs text-muted-foreground">Método de Entrega</p>
                      <p className="font-medium">
                        {sale.delivery_type === 'motoboy' && 'Motoboy'}
                        {sale.delivery_type === 'carrier' && 'Transportadora'}
                        {sale.delivery_type === 'pickup' && 'Retirada no Balcão'}
                        {!sale.delivery_type && 'Não definido'}
                      </p>
                    </div>
                  </div>

                  {/* Delivery Region */}
                  {(sale as any).delivery_region?.name && (
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-green-600" />
                      <div>
                        <p className="text-xs text-muted-foreground">Região de Entrega</p>
                        <p className="font-medium">{(sale as any).delivery_region.name}</p>
                      </div>
                    </div>
                  )}

                  {/* Shipping Carrier */}
                  {(sale as any).shipping_carrier?.name && (
                    <div className="flex items-center gap-2">
                      <Truck className="w-4 h-4 text-blue-600" />
                      <div>
                        <p className="text-xs text-muted-foreground">Transportadora</p>
                        <p className="font-medium">{(sale as any).shipping_carrier.name}</p>
                      </div>
                    </div>
                  )}

                  {/* Scheduled Delivery Date */}
                  {sale.scheduled_delivery_date && (
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-amber-600" />
                      <div>
                        <p className="text-xs text-muted-foreground">Data Agendada</p>
                        <p className="font-medium">
                          {format(new Date(sale.scheduled_delivery_date + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })}
                          {sale.scheduled_delivery_shift && (
                            <span className="text-xs text-muted-foreground ml-1">
                              ({sale.scheduled_delivery_shift === 'morning' ? 'Manhã' : 'Tarde'})
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Tracking Code */}
                  {sale.tracking_code && (
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-purple-600" />
                      <div>
                        <p className="text-xs text-muted-foreground">Código de Rastreio</p>
                        <div className="flex items-center gap-1">
                          <p className="font-medium font-mono text-sm">{sale.tracking_code}</p>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-5 w-5"
                            onClick={() => {
                              navigator.clipboard.writeText(sale.tracking_code || '');
                              toast.success('Código copiado!');
                            }}
                          >
                            <Copy className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Payment Method */}
                  {((sale as any).payment_method_data?.name || sale.payment_method) && (
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-emerald-600" />
                      <div>
                        <p className="text-xs text-muted-foreground">Forma de Pagamento</p>
                        <p className="font-medium">
                          {(sale as any).payment_method_data?.name || sale.payment_method}
                          {sale.payment_installments && sale.payment_installments > 1 && (
                            <span className="text-xs text-muted-foreground ml-1">
                              ({sale.payment_installments}x)
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Split Payment Lines */}
                  {salePaymentLines && salePaymentLines.length > 1 && (
                    <div className="col-span-full">
                      <p className="text-xs text-muted-foreground mb-1">Pagamento Dividido</p>
                      <div className="space-y-1">
                        {salePaymentLines.map((sp) => (
                          <div key={sp.id} className="flex items-center justify-between text-sm p-1.5 rounded bg-muted/50">
                            <span>{sp.payment_method_name}</span>
                            <span className="font-medium">{formatCurrency(sp.amount_cents)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Seller */}
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-primary" />
                    <div>
                      <p className="text-xs text-muted-foreground">Vendido por</p>
                      <p className="font-medium">
                        {sale.seller_profile 
                          ? `${sale.seller_profile.first_name} ${sale.seller_profile.last_name}`
                          : sale.created_by_profile 
                            ? `${sale.created_by_profile.first_name} ${sale.created_by_profile.last_name}`
                            : 'Não identificado'}
                      </p>
                    </div>
                  </div>

                  {/* Assigned Motoboy */}
                  {sale.delivery_type === 'motoboy' && (sale as any).assigned_delivery_user_profile && (
                    <div className="flex items-center gap-2">
                      <Bike className="w-4 h-4 text-orange-600" />
                      <div>
                        <p className="text-xs text-muted-foreground">Motoboy</p>
                        <p className="font-medium">
                          {(sale as any).assigned_delivery_user_profile.first_name} {(sale as any).assigned_delivery_user_profile.last_name}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Shipping Cost */}
                  {sale.shipping_cost_cents > 0 && (
                    <div className="flex items-center gap-2">
                      <Truck className="w-4 h-4 text-slate-600" />
                      <div>
                        <p className="text-xs text-muted-foreground">Frete</p>
                        <p className="font-medium">{formatCurrency(sale.shipping_cost_cents)}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Delivery Notes */}
                {sale.delivery_notes && (
                  <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                    <p className="text-xs text-muted-foreground mb-1">Observações da Entrega:</p>
                    <p className="text-sm">{sale.delivery_notes}</p>
                  </div>
                )}

                {/* Payment Notes */}
                {sale.payment_notes && (
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <p className="text-xs text-muted-foreground mb-1">Observações do Pagamento:</p>
                    <p className="text-sm">{sale.payment_notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Products */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="w-5 h-5" />
                  Produtos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produto</TableHead>
                      <TableHead className="text-center">Qtd</TableHead>
                      <TableHead className="text-right">Preço Un.</TableHead>
                      <TableHead className="text-right">Desconto</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sale.items?.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">
                          {item.product_name}
                          {item.requisition_number && (
                            <span className="block text-xs text-amber-600 font-normal mt-1">
                              Requisição: {item.requisition_number}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">{item.quantity}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.unit_price_cents)}</TableCell>
                        <TableCell className="text-right text-green-600">
                          {item.discount_cents > 0 ? `-${formatCurrency(item.discount_cents)}` : '-'}
                        </TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(item.total_cents)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                <Separator className="my-4" />

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Subtotal</span>
                    <span>{formatCurrency(sale.subtotal_cents)}</span>
                  </div>
                  {sale.discount_cents > 0 && (
                    <div className="flex justify-between text-sm text-green-600">
                      <span>
                        Desconto 
                        {sale.discount_type === 'percentage' && sale.discount_value 
                          ? ` (${sale.discount_value}%)` 
                          : ''}
                      </span>
                      <span>- {formatCurrency(sale.discount_cents)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-lg font-bold border-t pt-2">
                    <span>Total</span>
                    <span className="text-primary">{formatCurrency(sale.total_cents)}</span>
                  </div>
                </div>

                {/* Observation fields from integrations */}
                {((sale as any).observation_1 || (sale as any).observation_2) && (
                  <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                    <p className="text-sm font-semibold text-amber-800 dark:text-amber-200 mb-2">
                      ⚠️ Observações da Integração
                    </p>
                    {(sale as any).observation_1 && (
                      <div className="mb-2">
                        <p className="text-xs text-muted-foreground">Observação 1:</p>
                        <p className="text-sm font-medium">{(sale as any).observation_1}</p>
                      </div>
                    )}
                    {(sale as any).observation_2 && (
                      <div>
                        <p className="text-xs text-muted-foreground">Observação 2:</p>
                        <p className="text-sm font-medium">{(sale as any).observation_2}</p>
                      </div>
                    )}
                    {(sale as any).external_source && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Origem: {(sale as any).external_source}
                        {(sale as any).external_order_id && ` | Pedido: ${(sale as any).external_order_id}`}
                      </p>
                    )}
                    {(sale as any).external_order_url && (
                      <a 
                        href={(sale as any).external_order_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline"
                      >
                        Ver pedido externo
                      </a>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Actions & Status */}
          <div className="space-y-6">
            {/* NEW: Sale Checkpoints Card - Independent Tasks with integrated actions */}
            <SaleCheckpointsCard 
              saleId={sale.id} 
              saleStatus={sale.status}
              isCancelled={sale.status === 'cancelled'}
              deliveryRegionId={sale.delivery_region_id}
              closedAt={sale.closed_at}
              closedByName={sale.closed_by_profile 
                ? `${sale.closed_by_profile.first_name || ''} ${sale.closed_by_profile.last_name || ''}`.trim() 
                : null}
              finalizedAt={sale.finalized_at}
              finalizedByName={sale.finalized_by_profile 
                ? `${sale.finalized_by_profile.first_name || ''} ${sale.finalized_by_profile.last_name || ''}`.trim() 
                : null}
            />

            {/* Carrier Tracking Card - only for carrier delivery */}
            {sale.delivery_type === 'carrier' && (
              <CarrierTrackingCard
                saleId={sale.id}
                currentStatus={(sale as any).carrier_tracking_status}
                trackingCode={sale.tracking_code}
                isCancelled={sale.status === 'cancelled'}
                sale={sale}
              />
            )}

            {/* Motoboy Tracking Card - only for motoboy delivery */}
            {sale.delivery_type === 'motoboy' && (
              <MotoboyTrackingCard
                saleId={sale.id}
                currentStatus={(sale as any).motoboy_tracking_status}
                isCancelled={sale.status === 'cancelled'}
                deliveryRegionId={sale.delivery_region_id}
                assignedMotoboyId={sale.assigned_delivery_user_id}
                assignedMotoboyName={
                  (sale as any).assigned_delivery_user_profile
                    ? `${(sale as any).assigned_delivery_user_profile.first_name || ''} ${(sale as any).assigned_delivery_user_profile.last_name || ''}`.trim()
                    : null
                }
              />
            )}

            {/* Sale Closing Info Card - Shows which closing this sale belongs to */}
            <SaleClosingInfoCard saleId={sale.id} />

            {/* Fiscal Invoice Card - Unified */}
            <Card>
              <CardContent className="pt-6">
                <SaleInvoiceCard
                  saleId={sale.id}
                  saleTotalCents={sale.total_cents}
                  invoicePdfUrl={sale.invoice_pdf_url}
                  invoiceXmlUrl={sale.invoice_xml_url}
                  onUploadInvoice={handleInvoiceUpload}
                  onViewFile={handleViewFile}
                  onDownloadFile={handleDownloadFile}
                />
              </CardContent>
            </Card>

            {/* Legacy Status Timeline - kept for reference */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Timeline
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${sale.status !== 'cancelled' ? 'bg-green-500' : 'bg-muted'}`} />
                    <div className="flex-1">
                      <span className="text-sm">Venda Criada</span>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(sale.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                  {sale.expedition_validated_at && (
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full bg-green-500" />
                      <div className="flex-1">
                        <span className="text-sm">Expedição Validada</span>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(sale.expedition_validated_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                  )}
                  {sale.status === 'returned' && (
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full bg-amber-500" />
                      <span className="text-sm text-amber-600 font-medium">Voltou / Reagendar</span>
                    </div>
                  )}
                </div>

                {/* Payment Status Warning */}
                {sale.payment_status === 'will_pay_before' && !sale.payment_proof_url && (
                  <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                    <div className="flex items-start gap-2">
                      <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                          Aguardando pagamento
                        </p>
                        <p className="text-xs text-amber-700 dark:text-amber-300">
                          Cliente vai pagar antes de receber. Expedição bloqueada até comprovante ser anexado.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {sale.payment_status === 'paid_now' && sale.payment_proof_url && (
                  <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                      <p className="text-sm font-medium text-green-800 dark:text-green-200">
                        Comprovante anexado na criação da venda
                      </p>
                    </div>
                  </div>
                )}

                {/* Missing Payment Proof Alert - Non-conforming sale */}
                {(sale as any).missing_payment_proof && (
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-red-800 dark:text-red-200">
                          Venda Desconforme
                        </p>
                        <p className="text-xs text-red-700 dark:text-red-300">
                          Entregue sem comprovante de pagamento anexado. Regularize esta venda.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {sale.status === 'returned' && (sale as any).returned_at && (
                  <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800 space-y-2">
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-200">Esta entrega voltou</p>
                    {(sale as any).return_notes && (
                      <p className="text-sm text-amber-700 dark:text-amber-300">{(sale as any).return_notes}</p>
                    )}
                    
                    {/* Tags for missing proof */}
                    <div className="flex flex-wrap gap-2 mt-2">
                      {!(sale as any).return_photo_url && (
                        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800">
                          VOLTOU SEM FOTO
                        </Badge>
                      )}
                      {!(sale as any).return_latitude && (
                        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800">
                          VOLTOU SEM LOCALIZAÇÃO
                        </Badge>
                      )}
                      {(sale as any).return_photo_url && (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          FOTO ANEXADA
                        </Badge>
                      )}
                      {(sale as any).return_latitude && (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800">
                          <MapPin className="w-3 h-3 mr-1" />
                          LOCALIZAÇÃO REGISTRADA
                        </Badge>
                      )}
                    </div>
                  </div>
                )}

                {sale.delivery_status && sale.delivery_status !== 'pending' && sale.status !== 'returned' && (
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-sm font-medium">Status da Entrega:</p>
                    <p className="text-sm">{getDeliveryStatusLabel(sale.delivery_status)}</p>
                    {sale.delivery_notes && (
                      <p className="text-sm text-muted-foreground mt-1">{sale.delivery_notes}</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Expedition Actions Card removed - now integrated into SaleCheckpointsCard */}
            {/* Tracking Code Card removed - now included in CarrierTrackingCard above */}
            {/* DeliveryActionsCard removed - now integrated into SaleCheckpointsCard */}

            {/* Returned Sale - Option to Reschedule */}
            {sale.status === 'returned' && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-amber-600">
                    <RotateCcw className="w-5 h-5" />
                    Venda Retornou
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {(sale as any).return_reason && (
                    <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                      <p className="text-sm font-medium text-amber-800 dark:text-amber-200">Motivo:</p>
                      <p className="text-sm text-amber-700 dark:text-amber-300">{(sale as any).return_reason?.name}</p>
                      {(sale as any).return_notes && (
                        <p className="text-sm text-muted-foreground mt-1">{(sale as any).return_notes}</p>
                      )}
                    </div>
                  )}
                  <p className="text-sm text-muted-foreground">
                    Esta venda voltou e precisa ser reagendada. O vendedor deve remarcar a entrega.
                  </p>
                  {canValidateExpedition && (
                    <Button 
                      className="w-full"
                      onClick={async () => {
                        await updateSale.mutateAsync({
                          id: sale.id,
                          data: { status: 'draft' },
                          previousStatus: sale.status
                        });
                        toast.success('Venda voltou para rascunho para reagendamento');
                      }}
                      disabled={updateSale.isPending}
                    >
                      <RotateCcw className="w-4 h-4 mr-2" />
                      Voltar para Rascunho (Reagendar)
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Finance Actions */}
            {(sale.status === 'delivered' || sale.status === 'payment_pending') && canConfirmPayment && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="w-5 h-5" />
                    Financeiro
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Button 
                    className="w-full"
                    onClick={() => setShowPaymentDialog(true)}
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Confirmar Pagamento
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Post-Sale Survey Section */}
            {(sale.status === 'delivered' || sale.status === 'payment_confirmed') && permissions?.post_sale_view && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-primary">
                    <Phone className="w-5 h-5" />
                    Pesquisa Pós-Venda
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {isLoadingSurvey ? (
                    <div className="flex justify-center py-4">
                      <Skeleton className="h-24 w-full" />
                    </div>
                  ) : postSaleSurvey ? (
                    // Survey exists - show form or completed status
                    postSaleSurvey.status === 'completed' ? (
                      <div className="space-y-4">
                        <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-green-600" />
                            <span className="text-sm font-medium text-green-700 dark:text-green-400">
                              Pesquisa concluída
                            </span>
                          </div>
                          {postSaleSurvey.completed_at && (
                            <p className="text-xs text-green-600 dark:text-green-500 mt-1">
                              Em {format(new Date(postSaleSurvey.completed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                            </p>
                          )}
                        </div>
                        
                        {/* Show survey results summary */}
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          {postSaleSurvey.received_order !== null && (
                            <div>
                              <p className="text-xs text-muted-foreground">Recebeu pedido?</p>
                              <p className="font-medium">{postSaleSurvey.received_order ? 'Sim' : 'Não'}</p>
                            </div>
                          )}
                          {postSaleSurvey.knows_how_to_use !== null && (
                            <div>
                              <p className="text-xs text-muted-foreground">Sabe usar?</p>
                              <p className="font-medium">{postSaleSurvey.knows_how_to_use ? 'Sim' : 'Não'}</p>
                            </div>
                          )}
                          {postSaleSurvey.seller_rating !== null && (
                            <div>
                              <p className="text-xs text-muted-foreground">Nota vendedor</p>
                              <p className="font-medium">{postSaleSurvey.seller_rating}/10</p>
                            </div>
                          )}
                          {postSaleSurvey.delivery_rating !== null && (
                            <div>
                              <p className="text-xs text-muted-foreground">Nota entrega</p>
                              <p className="font-medium">{postSaleSurvey.delivery_rating}/10</p>
                            </div>
                          )}
                        </div>
                        {postSaleSurvey.notes && (
                          <div className="p-2 bg-muted rounded text-sm">
                            <p className="text-xs text-muted-foreground mb-1">Observações:</p>
                            {postSaleSurvey.notes}
                          </div>
                        )}
                      </div>
                    ) : (
                      // Survey pending or attempted - show inline form
                      <PostSaleSurveyInlineForm 
                        survey={postSaleSurvey} 
                        updateSurvey={updatePostSaleSurvey}
                      />
                    )
                  ) : (
                    // No survey yet - create button (only for post_sale_manage permission)
                    permissions?.post_sale_manage && (
                      <Button
                        className="w-full"
                        onClick={() => {
                          createPostSaleSurvey.mutate({
                            sale_id: sale.id,
                            lead_id: sale.lead_id,
                            delivery_type: (sale.delivery_type === 'motoboy' ? 'motoboy' : sale.delivery_type === 'carrier' ? 'carrier' : 'counter') as any,
                          });
                        }}
                        disabled={createPostSaleSurvey.isPending}
                      >
                        <Phone className="w-4 h-4 mr-2" />
                        Iniciar Pesquisa Pós-Venda
                      </Button>
                    )
                  )}
                </CardContent>
              </Card>
            )}

            {/* Payment Proof - Always visible */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5" />
                  Comprovante de Pagamento
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Anexar Comprovante</Label>
                  <Input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={handlePaymentProofUpload}
                  />
                  {sale.payment_proof_url && (
                    <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span className="text-sm text-green-700 dark:text-green-400 flex-1">Comprovante anexado</span>
                      <button
                        type="button"
                        onClick={() => handleViewFile(sale.payment_proof_url!)}
                        className="text-sm text-primary hover:underline flex items-center gap-1"
                      >
                        <Eye className="w-4 h-4" />
                        Ver
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDownloadFile(sale.payment_proof_url!)}
                        className="text-sm text-primary hover:underline flex items-center gap-1"
                      >
                        <Download className="w-4 h-4" />
                        Baixar
                      </button>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Observações do Pagamento</Label>
                  <Textarea
                    value={paymentNotes}
                    onChange={(e) => setPaymentNotes(e.target.value)}
                    placeholder="Ex: Pago via PIX, comprovante anexado..."
                    className="mt-1"
                    rows={2}
                  />
                  {paymentNotes && paymentNotes !== (sale.payment_notes || '') && (
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={async () => {
                        await updateSale.mutateAsync({
                          id: sale.id,
                          data: { payment_notes: paymentNotes }
                        });
                        toast.success('Observação salva!');
                      }}
                      disabled={updateSale.isPending}
                    >
                      Salvar Observação
                    </Button>
                  )}
                  {sale.payment_notes && (
                    <p className="text-sm text-muted-foreground bg-muted p-2 rounded">
                      {sale.payment_notes}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Legacy Invoice Upload card removed - unified into SaleInvoiceCard above */}

            {/* Changes History Log */}
            {changesLog.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <History className="w-5 h-5" />
                    Histórico de Alterações
                    <Badge variant="secondary" className="ml-auto">{changesLog.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {changesLog.map((log) => (
                      <div key={log.id} className="text-sm border-b last:border-0 pb-2 last:pb-0">
                        <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                          <span>
                            {format(new Date(log.changed_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                          </span>
                          <span>•</span>
                          <span>
                            {log.changed_by_profile 
                              ? `${log.changed_by_profile.first_name} ${log.changed_by_profile.last_name}`
                              : 'Usuário'}
                          </span>
                        </div>
                        <div className="flex items-start gap-2">
                          <Badge variant="outline" className="text-xs shrink-0">
                            {getChangeTypeLabel(log.change_type as any)}
                          </Badge>
                          <div>
                            {log.product_name && (
                              <span className="font-medium">{log.product_name}: </span>
                            )}
                            {log.old_value && log.new_value && (
                              <span className="text-muted-foreground">
                                {log.old_value} → {log.new_value}
                              </span>
                            )}
                            {log.notes && !log.old_value && (
                              <span className="text-muted-foreground">{log.notes}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Was Edited Badge */}
            {(sale as any).was_edited && (
              <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg flex items-center gap-2">
                <Pencil className="w-4 h-4 text-amber-600" />
                <span className="text-sm text-amber-700 dark:text-amber-400">
                  Esta venda foi editada após a criação
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Expedition Validation Dialog */}
      <AlertDialog open={showExpeditionDialog} onOpenChange={setShowExpeditionDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Validar Expedição</AlertDialogTitle>
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

      {/* Payment Confirmation Dialog */}
      <PaymentConfirmationDialog
        open={showPaymentDialog}
        onOpenChange={setShowPaymentDialog}
        onConfirm={handleConfirmPayment}
        totalCents={sale?.total_cents || 0}
        existingPaymentMethodId={sale?.payment_method_id}
        allowTotalEdit={true}
      />

      {/* Cancel Dialog */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar Venda</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja cancelar esta venda? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Não, manter</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleCancelSale}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Sim, cancelar venda
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reactivate Cancelled Sale Dialog (Admin Only) */}
      <AlertDialog open={showReactivateDialog} onOpenChange={setShowReactivateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-green-600" />
              Reativar Venda Cancelada
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                Você está prestes a <strong>reativar uma venda cancelada</strong>.
              </p>
              <p>
                A venda será restaurada para o status <strong>"Rascunho"</strong> e você poderá editá-la normalmente.
              </p>
              <p className="text-amber-600 dark:text-amber-400">
                Todos os checkpoints de expedição serão resetados.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleReactivateSale}
              className="bg-green-600 text-white hover:bg-green-700"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Reativar Venda
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Payment Proof Required Dialog */}
      <AlertDialog open={showPaymentProofRequiredDialog} onOpenChange={setShowPaymentProofRequiredDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Comprovante de Pagamento Obrigatório
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                Esta venda foi marcada como <strong>"Cliente vai pagar antes de receber"</strong>.
              </p>
              <p>
                Para prosseguir com a expedição, é necessário que o comprovante de pagamento seja anexado.
              </p>
              <p className="text-amber-600 dark:text-amber-400">
                Solicite ao vendedor que anexe o comprovante na seção "Comprovante de Pagamento" desta página, ou anexe você mesmo abaixo.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label className="flex items-center gap-2 mb-2">
              <Upload className="w-4 h-4" />
              Anexar Comprovante Agora
            </Label>
            <Input
              type="file"
              accept="image/*,.pdf"
              onChange={handlePaymentProofUpload}
              className="cursor-pointer"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Fechar</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
