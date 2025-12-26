import { useState } from 'react';
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
  AlertTriangle
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { useSale, useUpdateSale, formatCurrency, getStatusLabel, getStatusColor, DeliveryStatus, getDeliveryStatusLabel } from '@/hooks/useSales';
import { useTenantMembers } from '@/hooks/multi-tenant';
import { useAuth } from '@/hooks/useAuth';
import { useMyPermissions } from '@/hooks/useUserPermissions';
import { supabase } from '@/integrations/supabase/client';
const DELIVERY_STATUS_OPTIONS: { value: DeliveryStatus; label: string }[] = [
  { value: 'delivered_normal', label: 'Normal' },
  { value: 'delivered_missing_prescription', label: 'Falta receita' },
  { value: 'delivered_no_money', label: 'Cliente sem dinheiro' },
  { value: 'delivered_no_card_limit', label: 'Cliente sem limite cartão' },
  { value: 'delivered_customer_absent', label: 'Cliente ausente' },
  { value: 'delivered_customer_denied', label: 'Cliente disse que não pediu' },
  { value: 'delivered_customer_gave_up', label: 'Cliente desistiu' },
  { value: 'delivered_wrong_product', label: 'Produto enviado errado' },
  { value: 'delivered_missing_product', label: 'Produto faltante' },
  { value: 'delivered_insufficient_address', label: 'Endereço insuficiente' },
  { value: 'delivered_wrong_time', label: 'Motoboy foi em horário errado' },
  { value: 'delivered_other', label: 'Outros' },
];

export default function SaleDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: sale, isLoading } = useSale(id);
  const updateSale = useUpdateSale();
  const { data: members = [] } = useTenantMembers();
  const { profile } = useAuth();
  const { data: permissions } = useMyPermissions();

  // Permission checks
  const canValidateExpedition = permissions?.sales_validate_expedition;
  const canDispatch = permissions?.sales_dispatch;
  const canMarkDelivered = permissions?.sales_mark_delivered;
  const canConfirmPayment = permissions?.sales_confirm_payment;
  const canCancel = permissions?.sales_cancel;
  const [showExpeditionDialog, setShowExpeditionDialog] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  
  const [selectedDeliveryUser, setSelectedDeliveryUser] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [selectedDeliveryStatus, setSelectedDeliveryStatus] = useState<DeliveryStatus>('delivered_normal');

  // Filter users who can be delivery persons (entregador role)
  const deliveryUsers = members.filter(m => m.role === 'entregador' || m.role === 'member');

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

    const { data: { publicUrl } } = supabase.storage
      .from('sales-documents')
      .getPublicUrl(fileName);

    return publicUrl;
  };

  // Validate expedition and send to delivery
  const handleValidateExpedition = async () => {
    if (!sale) return;
    
    await updateSale.mutateAsync({
      id: sale.id,
      data: {
        status: 'pending_expedition',
      }
    });
    setShowExpeditionDialog(false);
  };

  // Dispatch sale
  const handleDispatch = async () => {
    if (!sale) return;

    await updateSale.mutateAsync({
      id: sale.id,
      data: {
        status: 'dispatched',
        assigned_delivery_user_id: selectedDeliveryUser || null,
      }
    });
    toast.success('Venda despachada!');
  };

  // Mark as delivered
  const handleMarkDelivered = async () => {
    if (!sale) return;

    await updateSale.mutateAsync({
      id: sale.id,
      data: {
        status: 'delivered',
        delivery_status: selectedDeliveryStatus,
        delivery_notes: deliveryNotes || null,
      }
    });
    toast.success('Entrega registrada!');
  };

  // Confirm payment
  const handleConfirmPayment = async () => {
    if (!sale) return;

    await updateSale.mutateAsync({
      id: sale.id,
      data: {
        status: 'payment_confirmed',
        payment_method: paymentMethod,
        payment_notes: paymentNotes || null,
      }
    });
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

  // Handle payment proof upload
  const handlePaymentProofUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !sale) return;

    const url = await handleFileUpload(file, 'payment_proof');
    if (url) {
      await updateSale.mutateAsync({
        id: sale.id,
        data: { payment_proof_url: url }
      });
      toast.success('Comprovante anexado!');
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
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold">Venda #{sale.id.slice(0, 8)}</h1>
                <Badge className={getStatusColor(sale.status)}>
                  {getStatusLabel(sale.status)}
                </Badge>
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
                        <TableCell className="font-medium">{item.product_name}</TableCell>
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
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${sale.delivered_at ? 'bg-green-500' : 'bg-muted'}`} />
                    <span className="text-sm">Entregue</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${sale.payment_confirmed_at ? 'bg-green-500' : 'bg-muted'}`} />
                    <span className="text-sm">Pagamento Confirmado</span>
                  </div>
                </div>

                {sale.delivery_status && sale.delivery_status !== 'pending' && (
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
                        <Select value={selectedDeliveryUser} onValueChange={setSelectedDeliveryUser}>
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="Selecione o entregador..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">Sem entregador definido</SelectItem>
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

            {/* Delivery Actions */}
            {sale.status === 'dispatched' && canMarkDelivered && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Truck className="w-5 h-5" />
                    Registrar Entrega
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Como foi a entrega?</Label>
                    <Select 
                      value={selectedDeliveryStatus} 
                      onValueChange={(v) => setSelectedDeliveryStatus(v as DeliveryStatus)}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DELIVERY_STATUS_OPTIONS.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedDeliveryStatus === 'delivered_other' && (
                    <div>
                      <Label>Observações</Label>
                      <Textarea
                        value={deliveryNotes}
                        onChange={(e) => setDeliveryNotes(e.target.value)}
                        placeholder="Descreva o que aconteceu..."
                        className="mt-1"
                      />
                    </div>
                  )}

                  <Button 
                    className="w-full"
                    onClick={handleMarkDelivered}
                    disabled={updateSale.isPending}
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Marcar como Entregue
                  </Button>
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

                  <div className="space-y-2">
                    <Label>Anexar Comprovante</Label>
                    <Input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={handlePaymentProofUpload}
                    />
                    {sale.payment_proof_url && (
                      <a 
                        href={sale.payment_proof_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline"
                      >
                        Ver comprovante anexado
                      </a>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

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
                    <a 
                      href={sale.invoice_pdf_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline"
                    >
                      Ver NF PDF
                    </a>
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
                    <a 
                      href={sale.invoice_xml_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline"
                    >
                      Ver NF XML
                    </a>
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
      <AlertDialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Pagamento</AlertDialogTitle>
            <AlertDialogDescription>
              Informe os detalhes do pagamento recebido.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Método de Pagamento</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pix">PIX</SelectItem>
                  <SelectItem value="cartao_credito">Cartão de Crédito</SelectItem>
                  <SelectItem value="cartao_debito">Cartão de Débito</SelectItem>
                  <SelectItem value="dinheiro">Dinheiro</SelectItem>
                  <SelectItem value="boleto">Boleto</SelectItem>
                  <SelectItem value="transferencia">Transferência</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
                placeholder="Ex: Pago via PIX, comprovante anexado..."
                className="mt-1"
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmPayment} disabled={!paymentMethod}>
              Confirmar Pagamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
    </Layout>
  );
}
