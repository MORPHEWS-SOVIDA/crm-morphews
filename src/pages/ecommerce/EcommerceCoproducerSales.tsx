import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { EcommerceLayout } from '@/components/ecommerce/EcommerceLayout';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Search, 
  Eye, 
  Package,
  Truck,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  DollarSign,
  TrendingUp,
  ShoppingBag,
} from 'lucide-react';

interface CoproducerSale {
  id: string;
  sale_id: string;
  gross_amount_cents: number;
  net_amount_cents: number;
  split_type: string;
  created_at: string;
  sale: {
    id: string;
    status: string;
    created_at: string;
    lead: { name: string } | null;
  } | null;
  order: {
    id: string;
    order_number: string;
    customer_name: string;
    status: string;
    created_at: string;
    storefront: { name: string } | null;
  } | null;
}

function formatCurrency(cents: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

const ORDER_STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: any }> = {
  awaiting_payment: { label: 'Aguardando Pgto', variant: 'secondary', icon: Clock },
  processing: { label: 'Processando', variant: 'secondary', icon: RefreshCw },
  approved: { label: 'Aprovada', variant: 'default', icon: CheckCircle },
  separating: { label: 'Em Separação', variant: 'secondary', icon: Package },
  shipped: { label: 'Enviado', variant: 'secondary', icon: Truck },
  delivered: { label: 'Entregue', variant: 'default', icon: CheckCircle },
  canceled: { label: 'Cancelada', variant: 'destructive', icon: XCircle },
  refunded: { label: 'Reembolsada', variant: 'destructive', icon: RefreshCw },
};

export default function EcommerceCoproducerSales() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [search, setSearch] = useState('');

  // Get the user's virtual account
  const { data: virtualAccountId } = useQuery({
    queryKey: ['coprod-virtual-account', profile?.user_id],
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

  // Get sale_splits for this coproducer's virtual account
  const { data: sales, isLoading } = useQuery({
    queryKey: ['coprod-sales', virtualAccountId],
    enabled: !!virtualAccountId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sale_splits')
        .select(`
          id,
          sale_id,
          gross_amount_cents,
          net_amount_cents,
          split_type,
          created_at,
          sale:sales(
            id,
            status,
            created_at,
            lead:leads(name)
          )
        `)
        .eq('virtual_account_id', virtualAccountId!)
        .eq('split_type', 'coproducer')
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) throw error;

      // Now get the ecommerce_order info for each sale
      const saleIds = (data || []).map((d: any) => d.sale_id).filter(Boolean);
      let ordersMap: Record<string, any> = {};
      
      if (saleIds.length > 0) {
        const { data: orders } = await supabase
          .from('ecommerce_orders')
          .select('id, order_number, customer_name, status, created_at, sale_id, storefront:tenant_storefronts(name)')
          .in('sale_id', saleIds);
        
        for (const o of orders || []) {
          if ((o as any).sale_id) ordersMap[(o as any).sale_id] = o;
        }
      }

      return (data || []).map((s: any) => ({
        ...s,
        order: ordersMap[s.sale_id] || null,
      })) as CoproducerSale[];
    },
  });

  // Filter
  const filtered = sales?.filter(s => {
    if (!search) return true;
    const q = search.toLowerCase();
    const customerName = s.order?.customer_name || s.sale?.lead?.name || '';
    const orderNumber = s.order?.order_number || '';
    return customerName.toLowerCase().includes(q) || orderNumber.toLowerCase().includes(q);
  }) || [];

  // Stats
  const totalEarnings = sales?.reduce((sum, s) => sum + (s.net_amount_cents || 0), 0) || 0;
  const totalSales = sales?.length || 0;
  const availableNow = sales?.filter(s => {
    if (!s.hold_until) return true;
    return new Date(s.hold_until) <= new Date();
  }).reduce((sum, s) => sum + (s.net_amount_cents || 0), 0) || 0;

  if (isLoading) {
    return (
      <EcommerceLayout title="Minhas Vendas" description="Acompanhe suas comissões">
        <div className="space-y-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      </EcommerceLayout>
    );
  }

  return (
    <EcommerceLayout title="Minhas Vendas" description="Acompanhe suas comissões por venda">
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardDescription>Total de Vendas</CardDescription>
              <ShoppingBag className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalSales}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardDescription>Ganhos Totais</CardDescription>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{formatCurrency(totalEarnings)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardDescription>Disponível Agora</CardDescription>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{formatCurrency(availableNow)}</div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por cliente ou nº pedido..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Sales List */}
        {filtered.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">Nenhuma venda encontrada.</p>
              <p className="text-sm text-muted-foreground">Suas comissões aparecerão aqui quando houver vendas confirmadas.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filtered.map((sale) => {
              const orderStatus = sale.order?.status || 'processing';
              const config = ORDER_STATUS_CONFIG[orderStatus] || ORDER_STATUS_CONFIG.processing;
              const StatusIcon = config.icon;
              const customerName = sale.order?.customer_name || sale.sale?.lead?.name || 'Cliente';
              const orderNumber = sale.order?.order_number || `#${sale.sale_id.slice(0, 8)}`;
              const orderDate = sale.order?.created_at || sale.created_at;
              const storeName = sale.order?.storefront?.name;

              return (
                <Card key={sale.id} className="hover:bg-muted/30 transition-colors">
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-medium text-primary">
                            {orderNumber}
                          </span>
                          <Badge variant={config.variant} className="gap-1 text-xs">
                            <StatusIcon className="h-3 w-3" />
                            {config.label}
                          </Badge>
                        </div>
                        <div className="font-medium">{customerName}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-2">
                          {storeName && <span>{storeName}</span>}
                          {storeName && <span>•</span>}
                          <span>{format(new Date(orderDate), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="text-lg font-bold text-green-600">
                            +{formatCurrency(sale.net_amount_cents)}
                          </div>
                          {sale.hold_until && new Date(sale.hold_until) > new Date() && (
                            <div className="text-xs text-muted-foreground">
                              Disponível em {format(new Date(sale.hold_until), "dd/MM", { locale: ptBR })}
                            </div>
                          )}
                        </div>
                        {sale.order?.id && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => navigate(`/ecommerce/vendas/${sale.order!.id}`)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </EcommerceLayout>
  );
}
