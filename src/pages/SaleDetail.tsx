import React, { useState, useMemo } from 'react';
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
  Copy
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { useSale, useUpdateSale, formatCurrency, getStatusLabel, getStatusColor, DeliveryStatus, getDeliveryStatusLabel } from '@/hooks/useSales';
import { useTenantMembers } from '@/hooks/multi-tenant';
import { useAuth } from '@/hooks/useAuth';
import { useMyPermissions } from '@/hooks/useUserPermissions';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { useDeliveryRegions } from '@/hooks/useDeliveryConfig';
import { PaymentConfirmationDialog } from '@/components/sales/PaymentConfirmationDialog';


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

export default function SaleDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: sale, isLoading } = useSale(id);
  const updateSale = useUpdateSale();
  const { data: members = [] } = useTenantMembers();
  const { data: regions = [] } = useDeliveryRegions();
  const { profile } = useAuth();
  const { data: permissions } = useMyPermissions();

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
  const [showExpeditionDialog, setShowExpeditionDialog] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
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
    
    if (markAsMissingProof) {
      toast.warning('Entrega registrada - Venda marcada como desconforme (sem comprovante)');
    } else {
      toast.success('Entrega registrada!');
    }
  };

  // Confirm payment with conciliation data
  const handleConfirmPayment = async (data: {
    payment_method_id: string;
    payment_method_name: string;
    payment_notes?: string;
    transaction_date?: Date;
    card_brand?: string;
    transaction_type?: string;
    nsu_cv?: string;
    acquirer_id?: string;
    installments?: number;
  }) => {
    if (!sale) return;

    await updateSale.mutateAsync({
      id: sale.id,
      data: {
        status: 'payment_confirmed',
        payment_method: data.payment_method_name,
        payment_method_id: data.payment_method_id,
        payment_notes: data.payment_notes || null,
      }
    });
    
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
            <Button 
              variant="outline"
              size="sm"
              className="flex-1 sm:flex-none"
              onClick={() => navigate(`/vendas/${sale.id}/romaneio`)}
            >
              <Printer className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Imprimir </span>Romaneio
            </Button>
            {canCancel && sale.status !== 'cancelled' && sale.status !== 'payment_confirmed' && (
              <Button variant="destructive" size="sm" className="flex-1 sm:flex-none" onClick={() => setShowCancelDialog(true)}>
                <XCircle className="w-4 h-4 mr-2" />
                Cancelar
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
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/leads/${sale.lead_id}`)}
                  >
                    Ver Lead
                  </Button>
                </div>

                {sale.lead?.street && (
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 mt-0.5 text-muted-foreground" />
                      <div className="text-sm">
                        <p>{sale.lead.street}, {sale.lead.street_number}</p>
                        {sale.lead.complement && <p>{sale.lead.complement}</p>}
                        <p>{sale.lead.neighborhood} - {sale.lead.city}/{sale.lead.state}</p>
                        {sale.lead.cep && <p>CEP: {sale.lead.cep}</p>}
                      </div>
                    </div>
                  </div>
                )}

                {/* Delivery Method & Seller Info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
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
                </div>
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
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Actions & Status */}
          <div className="space-y-6">
            {/* Timeline / Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Status
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${sale.status !== 'cancelled' ? 'bg-green-500' : 'bg-muted'}`} />
                    <span className="text-sm">Venda Criada</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${sale.expedition_validated_at ? 'bg-green-500' : 'bg-muted'}`} />
                    <span className="text-sm">Expedição Validada</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${sale.dispatched_at ? 'bg-green-500' : 'bg-muted'}`} />
                    <span className="text-sm">Despachado</span>
                  </div>
                  {sale.status === 'returned' && (
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full bg-amber-500" />
                      <span className="text-sm text-amber-600 font-medium">Voltou / Reagendar</span>
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${sale.delivered_at ? 'bg-green-500' : 'bg-muted'}`} />
                    <span className="text-sm">Entregue</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${sale.payment_confirmed_at ? 'bg-green-500' : 'bg-muted'}`} />
                    <span className="text-sm">Pagamento Confirmado</span>
                  </div>
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

            {/* Expedition Actions */}
            {(sale.status === 'draft' || sale.status === 'pending_expedition') && (canValidateExpedition || canDispatch) && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Truck className="w-5 h-5" />
                    Expedição
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {sale.status === 'draft' && canValidateExpedition && (
                    <Button 
                      className="w-full" 
                      onClick={() => setShowExpeditionDialog(true)}
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Validar Expedição
                    </Button>
                  )}

                  {sale.status === 'pending_expedition' && canDispatch && (
                    <>
                      <div>
                        <Label>Selecionar Entregador</Label>
                      <Select 
                        value={selectedDeliveryUser || "none"} 
                        onValueChange={(v) => setSelectedDeliveryUser(v === "none" ? "" : v)}
                      >
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="Selecione o entregador..." />
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
                      </div>
                      <Button 
                        className="w-full" 
                        onClick={handleDispatch}
                        disabled={updateSale.isPending}
                      >
                        <Send className="w-4 h-4 mr-2" />
                        Despachar
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Tracking Code for Carrier Sales */}
            {sale.delivery_type === 'carrier' && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Truck className="w-5 h-5 text-blue-600" />
                    Código de Rastreio
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {sale.tracking_code ? (
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-blue-600 dark:text-blue-400">Código de Rastreio</p>
                          <p className="font-mono text-lg font-medium text-blue-800 dark:text-blue-200">{sale.tracking_code}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            navigator.clipboard.writeText(sale.tracking_code!);
                            toast.success('Código copiado!');
                          }}
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Nenhum código de rastreio adicionado ainda.</p>
                  )}
                  
                  <div className="space-y-2">
                    <Label>Atualizar Código de Rastreio</Label>
                    <div className="flex gap-2">
                      <Input
                        value={trackingCode}
                        onChange={(e) => setTrackingCode(e.target.value)}
                        placeholder="Ex: BR123456789BR"
                        className="font-mono"
                      />
                      <Button
                        variant="outline"
                        onClick={async () => {
                          await updateSale.mutateAsync({
                            id: sale.id,
                            data: { tracking_code: trackingCode || null }
                          });
                          toast.success('Código de rastreio atualizado!');
                        }}
                        disabled={updateSale.isPending}
                      >
                        Salvar
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Delivery Actions - Mark as Delivered OR Mark as Returned */}
            {sale.status === 'dispatched' && canMarkDelivered && (
              <DeliveryActionsCard 
                sale={sale}
                handleMarkDelivered={handleMarkDelivered}
                updateSale={updateSale}
                paymentMethodRequiresProof={paymentMethodRequiresProof}
              />
            )}

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

            {/* Invoice Upload */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Nota Fiscal
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>NF PDF</Label>
                  <Input
                    type="file"
                    accept=".pdf"
                    onChange={(e) => handleInvoiceUpload(e, 'pdf')}
                  />
                  {sale.invoice_pdf_url && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleViewFile(sale.invoice_pdf_url!)}
                        className="text-sm text-primary hover:underline flex items-center gap-1"
                      >
                        <Eye className="w-4 h-4" />
                        Ver NF PDF
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDownloadFile(sale.invoice_pdf_url!)}
                        className="text-sm text-primary hover:underline flex items-center gap-1"
                      >
                        <Download className="w-4 h-4" />
                        Baixar
                      </button>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>NF XML</Label>
                  <Input
                    type="file"
                    accept=".xml"
                    onChange={(e) => handleInvoiceUpload(e, 'xml')}
                  />
                  {sale.invoice_xml_url && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleViewFile(sale.invoice_xml_url!)}
                        className="text-sm text-primary hover:underline flex items-center gap-1"
                      >
                        <Eye className="w-4 h-4" />
                        Ver NF XML
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDownloadFile(sale.invoice_xml_url!)}
                        className="text-sm text-primary hover:underline flex items-center gap-1"
                      >
                        <Download className="w-4 h-4" />
                        Baixar
                      </button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
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
