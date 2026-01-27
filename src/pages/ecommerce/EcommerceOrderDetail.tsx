import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { EcommerceLayout } from '@/components/ecommerce/EcommerceLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Package,
  CreditCard,
  Truck,
  History,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Ban,
  Copy,
  ExternalLink,
} from 'lucide-react';

// Status configuration
const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; color: string }> = {
  awaiting_payment: { label: 'Aguardando Pagamento', variant: 'secondary', color: 'text-yellow-600' },
  processing: { label: 'Processando', variant: 'secondary', color: 'text-blue-600' },
  approved: { label: 'Compra Aprovada', variant: 'default', color: 'text-green-600' },
  separating: { label: 'Em Separação', variant: 'secondary', color: 'text-blue-600' },
  shipped: { label: 'Em Transporte', variant: 'secondary', color: 'text-blue-600' },
  delivered: { label: 'Entregue', variant: 'default', color: 'text-green-600' },
  canceled: { label: 'Cancelada', variant: 'destructive', color: 'text-red-600' },
  refunded: { label: 'Reembolsada', variant: 'destructive', color: 'text-red-600' },
  partial_refund: { label: 'Reembolso Parcial', variant: 'destructive', color: 'text-orange-600' },
  chargeback: { label: 'Chargeback', variant: 'destructive', color: 'text-red-600' },
};

function formatCurrency(cents: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

export default function EcommerceOrderDetail() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('products');
  const [refundDialogOpen, setRefundDialogOpen] = useState(false);
  const [refundType, setRefundType] = useState<'total' | 'partial'>('total');
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [notifyCustomer, setNotifyCustomer] = useState(true);

  // Fetch order data
  const { data: order, isLoading, error: queryError } = useQuery({
    queryKey: ['ecommerce-order', orderId],
    enabled: !!orderId,
    queryFn: async () => {
      console.log('[EcommerceOrderDetail] Fetching order:', orderId);
      const { data, error } = await supabase
        .from('ecommerce_orders')
        .select(`
          *,
          storefront:tenant_storefronts(name),
          landing_page:landing_pages(name),
          lead:leads(name, whatsapp, email),
          affiliate:affiliates(affiliate_code, virtual_account:virtual_accounts(holder_name))
        `)
        .eq('id', orderId)
        .single();

      if (error) {
        console.error('[EcommerceOrderDetail] Error fetching order:', error);
        throw error;
      }
      console.log('[EcommerceOrderDetail] Order fetched:', data?.order_number);
      return data;
    },
  });

  // Fetch sale items (from sale_items or ecommerce_order_items)
  const { data: saleItems } = useQuery({
    queryKey: ['sale-items', order?.sale_id, orderId],
    enabled: !!order,
    queryFn: async () => {
      // First try sale_items if sale_id exists
      if (order?.sale_id) {
        const { data: items, error } = await supabase
          .from('sale_items')
          .select(`
            *,
            product:lead_products(name, base_price_cents)
          `)
          .eq('sale_id', order.sale_id);

        if (!error && items && items.length > 0) {
          return items;
        }
      }

      // Fallback to ecommerce_order_items
      const { data: orderItems, error: orderError } = await supabase
        .from('ecommerce_order_items')
        .select('*')
        .eq('order_id', orderId);

      if (!orderError && orderItems && orderItems.length > 0) {
        // Map to a compatible format
        return orderItems.map((item: any) => ({
          id: item.id,
          quantity: item.quantity,
          unit_price_cents: item.unit_price_cents,
          total_cents: item.total_cents,
          product: {
            name: item.product_name,
          },
          product_image_url: item.product_image_url,
        }));
      }

      return [];
    },
  });

  // Fetch payment attempts
  const { data: paymentAttempts } = useQuery({
    queryKey: ['payment-attempts', order?.sale_id],
    enabled: !!order?.sale_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payment_attempts')
        .select('*')
        .eq('sale_id', order?.sale_id!)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  // Refund mutation
  const refundMutation = useMutation({
    mutationFn: async ({ amountCents, reason }: { amountCents: number; reason: string }) => {
      const response = await supabase.functions.invoke('process-refund', {
        body: {
          sale_id: order?.sale_id,
          order_id: orderId,
          amount_cents: amountCents,
          reason,
          notify_customer: notifyCustomer,
          refund_type: refundType,
        },
      });

      if (response.error) throw response.error;
      return response.data;
    },
    onSuccess: () => {
      toast.success('Reembolso processado com sucesso');
      setRefundDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['ecommerce-order', orderId] });
      queryClient.invalidateQueries({ queryKey: ['payment-attempts', order?.sale_id] });
    },
    onError: (error: Error) => {
      toast.error(`Erro ao processar reembolso: ${error.message}`);
    },
  });

  const handleRefund = () => {
    const amountCents = refundType === 'total' 
      ? order?.total_cents || 0
      : Math.round(parseFloat(refundAmount.replace(',', '.')) * 100);

    if (amountCents <= 0) {
      toast.error('Valor de reembolso inválido');
      return;
    }

    if (amountCents > (order?.total_cents || 0)) {
      toast.error('Valor de reembolso não pode ser maior que o total do pedido');
      return;
    }

    refundMutation.mutate({ amountCents, reason: refundReason });
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado!`);
  };

  if (isLoading) {
    return (
      <EcommerceLayout title="Detalhes do Pedido" description="Carregando...">
        <div className="space-y-4">
          <Skeleton className="h-12 w-48" />
          <Card>
            <CardContent className="pt-6">
              <Skeleton className="h-64 w-full" />
            </CardContent>
          </Card>
        </div>
      </EcommerceLayout>
    );
  }

  if (!order) {
    return (
      <EcommerceLayout title="Pedido não encontrado" description="">
        <div className="text-center py-12 space-y-4">
          <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto" />
          <p className="text-muted-foreground">O pedido solicitado não foi encontrado.</p>
          {queryError && (
            <p className="text-sm text-destructive">Erro: {(queryError as Error).message}</p>
          )}
          <p className="text-xs text-muted-foreground">ID: {orderId}</p>
          <div className="flex gap-2 justify-center">
            <Button onClick={() => window.location.reload()} variant="outline">
              Tentar novamente
            </Button>
            <Button onClick={() => navigate('/ecommerce/vendas')}>
              Voltar para Vendas
            </Button>
          </div>
        </div>
      </EcommerceLayout>
    );
  }

  const statusConfig = STATUS_CONFIG[order.status] || STATUS_CONFIG.processing;
  const canRefund = ['approved', 'separating', 'shipped', 'delivered'].includes(order.status);

  return (
    <EcommerceLayout 
      title={`Pedido ${order.order_number}`} 
      description="Gerencie os detalhes do pedido"
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/ecommerce/vendas')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold">{order.order_number}</h2>
                <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {format(new Date(order.created_at), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
              </p>
            </div>
          </div>
          {canRefund && (
            <Button 
              variant="destructive" 
              onClick={() => setRefundDialogOpen(true)}
              className="gap-2"
            >
              <XCircle className="h-4 w-4" />
              Reembolsar transação
            </Button>
          )}
        </div>

        {/* Customer & Summary Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          {/* Customer Info */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Cliente</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="font-medium">{order.customer_name}</p>
              {order.customer_email && (
                <p className="text-sm text-muted-foreground">{order.customer_email}</p>
              )}
              {order.customer_phone && (
                <p className="text-sm text-muted-foreground">{order.customer_phone}</p>
              )}
              {order.customer_cpf && (
                <p className="text-sm text-muted-foreground">CPF: {order.customer_cpf}</p>
              )}
            </CardContent>
          </Card>

          {/* Shipping Info */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Endereço de Entrega</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              {order.shipping_street ? (
                <>
                  <p>{order.shipping_street}{order.shipping_number ? `, ${order.shipping_number}` : ''}</p>
                  {order.shipping_complement && <p>{order.shipping_complement}</p>}
                  {order.shipping_neighborhood && <p>{order.shipping_neighborhood}</p>}
                  <p>{order.shipping_city} - {order.shipping_state}</p>
                  <p>CEP: {order.shipping_cep}</p>
                </>
              ) : (
                <p className="text-muted-foreground">Endereço não informado</p>
              )}
            </CardContent>
          </Card>

          {/* Order Summary */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Resumo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Subtotal</span>
                <span>{formatCurrency(order.subtotal_cents || 0)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Frete</span>
                <span>{formatCurrency(order.shipping_cents || 0)}</span>
              </div>
              {(order.discount_cents || 0) > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>Desconto</span>
                  <span>-{formatCurrency(order.discount_cents || 0)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold pt-2 border-t">
                <span>Total</span>
                <span className="text-lg">{formatCurrency(order.total_cents || 0)}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="products" className="gap-2">
              <Package className="h-4 w-4" />
              Produtos
            </TabsTrigger>
            <TabsTrigger value="transactions" className="gap-2">
              <CreditCard className="h-4 w-4" />
              Transações ({paymentAttempts?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="tracking" className="gap-2">
              <Truck className="h-4 w-4" />
              Rastreamento
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2">
              <History className="h-4 w-4" />
              Histórico
            </TabsTrigger>
          </TabsList>

          {/* Products Tab */}
          <TabsContent value="products" className="mt-4">
            <Card>
              <CardContent className="pt-6">
                {saleItems && saleItems.length > 0 ? (
                  <div className="space-y-4">
                    {saleItems.map((item: any) => (
                      <div key={item.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                          <p className="font-medium">{item.product?.name || 'Produto'}</p>
                          <p className="text-sm text-muted-foreground">
                            Qtd: {item.quantity} x {formatCurrency(item.unit_price_cents)}
                          </p>
                        </div>
                        <div className="text-right font-semibold">
                          {formatCurrency(item.total_cents)}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhum produto encontrado
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Transactions Tab */}
          <TabsContent value="transactions" className="mt-4">
            <Card>
              <CardContent className="pt-6">
                {paymentAttempts && paymentAttempts.length > 0 ? (
                  <div className="space-y-4">
                    {paymentAttempts.map((attempt: any) => (
                      <div key={attempt.id} className="p-4 border rounded-lg space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm text-muted-foreground">
                              #{attempt.gateway_transaction_id?.slice(0, 20) || attempt.id.slice(0, 8)}
                            </span>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-6 w-6"
                              onClick={() => copyToClipboard(attempt.gateway_transaction_id || attempt.id, 'ID da transação')}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                          <Badge variant={attempt.status === 'success' ? 'default' : attempt.status === 'pending' ? 'secondary' : 'destructive'}>
                            {attempt.status === 'success' ? 'Aprovado' : attempt.status === 'pending' ? 'Pendente' : 'Falhou'}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">Gateway</p>
                            <p className="font-medium capitalize">{attempt.gateway_type}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Método</p>
                            <p className="font-medium capitalize">{attempt.payment_method?.replace('_', ' ')}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Valor</p>
                            <p className="font-medium">{formatCurrency(attempt.amount_cents)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Data</p>
                            <p className="font-medium">
                              {format(new Date(attempt.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                            </p>
                          </div>
                        </div>

                        {attempt.status === 'success' && canRefund && (
                          <div className="pt-3 border-t">
                            <Button 
                              variant="destructive" 
                              size="sm"
                              onClick={() => setRefundDialogOpen(true)}
                              className="gap-2"
                            >
                              <XCircle className="h-4 w-4" />
                              Reembolsar transação
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhuma transação encontrada
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tracking Tab */}
          <TabsContent value="tracking" className="mt-4">
            <Card>
              <CardContent className="pt-6">
                {order.tracking_code ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                      <div>
                        <p className="text-sm text-muted-foreground">Código de Rastreio</p>
                        <p className="font-mono font-medium text-lg">{order.tracking_code}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => copyToClipboard(order.tracking_code!, 'Código de rastreio')}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => window.open(`https://www.linkcorreios.com.br/?id=${order.tracking_code}`, '_blank')}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {order.carrier && (
                      <div className="flex items-center justify-between p-4 bg-muted rounded-lg mb-4">
                        <div>
                          <p className="text-sm text-muted-foreground">Transportadora</p>
                          <p className="font-medium">{order.carrier}</p>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhum código de rastreio cadastrado
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="mt-4">
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  {order.paid_at && (
                    <div className="flex items-center gap-3 p-3 border rounded-lg">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <div>
                        <p className="font-medium">Pagamento confirmado</p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(order.paid_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                  )}
                  {order.shipped_at && (
                    <div className="flex items-center gap-3 p-3 border rounded-lg">
                      <Truck className="h-5 w-5 text-blue-600" />
                      <div>
                        <p className="font-medium">Pedido enviado</p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(order.shipped_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                  )}
                  {order.delivered_at && (
                    <div className="flex items-center gap-3 p-3 border rounded-lg">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <div>
                        <p className="font-medium">Pedido entregue</p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(order.delivered_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                  )}
                  {order.canceled_at && (
                    <div className="flex items-center gap-3 p-3 border rounded-lg">
                      <XCircle className="h-5 w-5 text-red-600" />
                      <div>
                        <p className="font-medium">Pedido cancelado</p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(order.canceled_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-3 p-3 border rounded-lg">
                    <Clock className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Pedido criado</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(order.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Refund Dialog */}
      <Dialog open={refundDialogOpen} onOpenChange={setRefundDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Realizar reembolso</DialogTitle>
            <DialogDescription>
              Preencha todas as informações para fazer o reembolso
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Tipo de reembolso</Label>
              <Select value={refundType} onValueChange={(v) => setRefundType(v as 'total' | 'partial')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="total">Total</SelectItem>
                  <SelectItem value="partial">Parcial</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                Reembolsar valor total ou parcial da compra
              </p>
            </div>

            <div className="space-y-2">
              <Label>Valor do reembolso</Label>
              <Input
                value={refundType === 'total' ? formatCurrency(order.total_cents) : refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
                disabled={refundType === 'total'}
                placeholder="R$ 0,00"
                className={refundType === 'total' ? 'bg-muted' : ''}
              />
              <p className="text-sm text-muted-foreground">
                Valor que deseja reembolsar
              </p>
            </div>

            <div className="space-y-2">
              <Label>Comentários</Label>
              <Textarea
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                placeholder="Descreva o motivo do reembolso"
                rows={3}
              />
              <p className="text-sm text-muted-foreground">
                Descreva o motivo do reembolso
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="notify"
                checked={notifyCustomer}
                onCheckedChange={(checked) => setNotifyCustomer(checked as boolean)}
              />
              <Label htmlFor="notify" className="text-sm font-normal">
                Notificar comprador por email
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRefundDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleRefund}
              disabled={refundMutation.isPending}
              className="gap-2"
            >
              {refundMutation.isPending ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Reembolsar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </EcommerceLayout>
  );
}
