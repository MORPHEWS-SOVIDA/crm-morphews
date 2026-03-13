import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { EcommerceLayout } from '@/components/ecommerce/EcommerceLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ArrowLeft,
  Package,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  Truck,
  DollarSign,
} from 'lucide-react';

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: any }> = {
  awaiting_payment: { label: 'Aguardando Pagamento', variant: 'secondary', icon: Clock },
  processing: { label: 'Processando', variant: 'secondary', icon: RefreshCw },
  approved: { label: 'Compra Aprovada', variant: 'default', icon: CheckCircle },
  separating: { label: 'Em Separação', variant: 'secondary', icon: Package },
  shipped: { label: 'Enviado', variant: 'secondary', icon: Truck },
  delivered: { label: 'Entregue', variant: 'default', icon: CheckCircle },
  canceled: { label: 'Cancelada', variant: 'destructive', icon: XCircle },
  refunded: { label: 'Reembolsada', variant: 'destructive', icon: RefreshCw },
};

function formatCurrency(cents: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

export default function EcommerceCoproducerOrderDetail() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();

  // Get virtual account id
  const { data: virtualAccountId } = useQuery({
    queryKey: ['coprod-va', profile?.user_id],
    enabled: !!profile?.user_id,
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('partner_virtual_account_id')
        .eq('user_id', profile!.user_id)
        .single();
      return data?.partner_virtual_account_id as string | null;
    },
  });

  // Fetch order basic info
  const { data: order, isLoading: orderLoading } = useQuery({
    queryKey: ['coprod-order', orderId],
    enabled: !!orderId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ecommerce_orders')
        .select('id, order_number, customer_name, status, created_at, storefront:tenant_storefronts(name)')
        .eq('id', orderId!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Fetch order items
  const { data: items } = useQuery({
    queryKey: ['coprod-order-items', orderId],
    enabled: !!orderId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ecommerce_order_items')
        .select('id, product_name, quantity, unit_price_cents')
        .eq('order_id', orderId!);
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch the coproducer's split for this order's sale
  const { data: mySplit } = useQuery({
    queryKey: ['coprod-split', orderId, virtualAccountId],
    enabled: !!orderId && !!virtualAccountId,
    queryFn: async () => {
      // First get sale_id from the order
      const { data: orderData } = await supabase
        .from('ecommerce_orders')
        .select('sale_id')
        .eq('id', orderId!)
        .single();

      if (!orderData?.sale_id) return null;

      const { data, error } = await supabase
        .from('sale_splits')
        .select('net_amount_cents, gross_amount_cents')
        .eq('sale_id', orderData.sale_id)
        .eq('virtual_account_id', virtualAccountId!)
        .eq('split_type', 'coproducer')
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });

  if (orderLoading) {
    return (
      <EcommerceLayout title="Detalhes do Pedido" description="Carregando...">
        <div className="space-y-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      </EcommerceLayout>
    );
  }

  if (!order) {
    return (
      <EcommerceLayout title="Pedido não encontrado" description="">
        <Button variant="ghost" onClick={() => navigate('/ecommerce/coprodutor-vendas')}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
        </Button>
      </EcommerceLayout>
    );
  }

  const statusConfig = STATUS_CONFIG[order.status] || STATUS_CONFIG.processing;
  const StatusIcon = statusConfig.icon;

  return (
    <EcommerceLayout title={`Pedido ${order.order_number}`} description="Detalhes da sua comissão">
      <div className="space-y-6">
        {/* Back + Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/ecommerce/coprodutor-vendas')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold font-mono">{order.order_number}</h2>
              <Badge variant={statusConfig.variant} className="gap-1">
                <StatusIcon className="h-3 w-3" />
                {statusConfig.label}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {format(new Date(order.created_at), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
            </p>
          </div>
        </div>

        {/* Customer + Commission */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Cliente</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-semibold">{order.customer_name}</p>
              {(order.storefront as any)?.name && (
                <p className="text-sm text-muted-foreground mt-1">Loja: {(order.storefront as any).name}</p>
              )}
            </CardContent>
          </Card>

          <Card className="border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Você recebe
              </CardTitle>
            </CardHeader>
            <CardContent>
              {mySplit ? (
                <p className="text-3xl font-bold text-green-600">
                  {formatCurrency(mySplit.net_amount_cents)}
                </p>
              ) : (
                <p className="text-muted-foreground">Carregando...</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Products */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="h-4 w-4" />
              Produtos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {items && items.length > 0 ? (
              <div className="space-y-3">
                {items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div>
                      <p className="font-medium">{item.product_name}</p>
                    </div>
                    <div className="text-right text-sm text-muted-foreground">
                      {item.quantity}x
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">Nenhum produto encontrado.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </EcommerceLayout>
  );
}
