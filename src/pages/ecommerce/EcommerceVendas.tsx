import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { EcommerceLayout } from '@/components/ecommerce/EcommerceLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Search, 
  Eye, 
  Package,
  Truck,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  CreditCard,
  RefreshCw,
  Ban,
  Gift
} from 'lucide-react';

interface Order {
  id: string;
  order_number: string;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  total_cents: number;
  status: string;
  payment_method: string | null;
  source: string;
  created_at: string;
  paid_at: string | null;
  shipped_at: string | null;
  tracking_code: string | null;
  storefront?: { name: string } | null;
  landing_page?: { name: string } | null;
  lead?: { name: string } | null;
}

function formatCurrency(cents: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: any; color: string }> = {
  awaiting_payment: { label: 'Aguardando Pagamento', variant: 'secondary', icon: Clock, color: 'text-yellow-600' },
  processing: { label: 'Processando', variant: 'secondary', icon: RefreshCw, color: 'text-blue-600' },
  approved: { label: 'Compra Aprovada', variant: 'default', icon: CheckCircle, color: 'text-green-600' },
  separating: { label: 'Produtos em Separação', variant: 'secondary', icon: Package, color: 'text-blue-600' },
  shipped: { label: 'Em Transporte', variant: 'secondary', icon: Truck, color: 'text-blue-600' },
  delivered: { label: 'Entregue', variant: 'default', icon: CheckCircle, color: 'text-green-600' },
  canceled: { label: 'Cancelada', variant: 'destructive', icon: XCircle, color: 'text-red-600' },
  refunded: { label: 'Reembolsada', variant: 'destructive', icon: RefreshCw, color: 'text-red-600' },
  partial_refund: { label: 'Reembolso Parcial', variant: 'destructive', icon: RefreshCw, color: 'text-orange-600' },
  refund_pending: { label: 'Reembolso Pendente', variant: 'outline', icon: Clock, color: 'text-orange-600' },
  refund_requested: { label: 'Solicitação de Reembolso', variant: 'outline', icon: AlertTriangle, color: 'text-orange-600' },
  chargeback: { label: 'Chargeback', variant: 'destructive', icon: AlertTriangle, color: 'text-red-600' },
  chargeback_disputed: { label: 'Chargeback Apresentado', variant: 'outline', icon: AlertTriangle, color: 'text-orange-600' },
  blacklisted: { label: 'Reprovado por Blacklist', variant: 'destructive', icon: Ban, color: 'text-red-600' },
  frustrated: { label: 'Frustrada', variant: 'destructive', icon: XCircle, color: 'text-red-600' },
  trial: { label: 'Período Grátis', variant: 'secondary', icon: Gift, color: 'text-purple-600' },
  awaiting_confirmation: { label: 'Aguardando Confirmação', variant: 'outline', icon: Clock, color: 'text-yellow-600' },
};

const STATUS_GROUPS = [
  { value: 'all', label: 'Todos' },
  { value: 'pending', label: 'Pendentes', statuses: ['awaiting_payment', 'processing', 'awaiting_confirmation'] },
  { value: 'approved', label: 'Aprovados', statuses: ['approved', 'separating'] },
  { value: 'shipping', label: 'Em Transporte', statuses: ['shipped'] },
  { value: 'delivered', label: 'Entregues', statuses: ['delivered'] },
  { value: 'problems', label: 'Problemas', statuses: ['canceled', 'refunded', 'partial_refund', 'refund_pending', 'refund_requested', 'chargeback', 'chargeback_disputed', 'blacklisted', 'frustrated'] },
];

export default function EcommerceVendas() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const { data: orders, isLoading } = useQuery({
    queryKey: ['ecommerce-orders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ecommerce_orders')
        .select(`
          *,
          storefront:tenant_storefronts(name),
          landing_page:landing_pages(name),
          lead:leads(name)
        `)
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (error) throw error;
      return data as unknown as Order[];
    },
  });

  // Filter orders
  const filteredOrders = orders?.filter((order) => {
    const matchesSearch = !search || 
      order.order_number.toLowerCase().includes(search.toLowerCase()) ||
      order.customer_name.toLowerCase().includes(search.toLowerCase()) ||
      order.customer_email?.toLowerCase().includes(search.toLowerCase()) ||
      order.customer_phone?.includes(search);
    
    const group = STATUS_GROUPS.find(g => g.value === statusFilter);
    const matchesStatus = statusFilter === 'all' || 
      (group?.statuses && group.statuses.includes(order.status));
    
    return matchesSearch && matchesStatus;
  }) || [];

  // Group stats
  const stats = {
    total: orders?.length || 0,
    pending: orders?.filter(o => ['awaiting_payment', 'processing', 'awaiting_confirmation'].includes(o.status)).length || 0,
    approved: orders?.filter(o => ['approved', 'separating'].includes(o.status)).length || 0,
    shipping: orders?.filter(o => o.status === 'shipped').length || 0,
    delivered: orders?.filter(o => o.status === 'delivered').length || 0,
    problems: orders?.filter(o => ['canceled', 'refunded', 'chargeback', 'frustrated'].includes(o.status)).length || 0,
    revenue: orders?.filter(o => ['approved', 'separating', 'shipped', 'delivered'].includes(o.status)).reduce((acc, o) => acc + o.total_cents, 0) || 0,
  };

  if (isLoading) {
    return (
      <EcommerceLayout title="Vendas Online" description="Acompanhe e gerencie seus pedidos online">
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </EcommerceLayout>
    );
  }

  return (
    <EcommerceLayout title="Vendas Online" description="Acompanhe e gerencie seus pedidos online">
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-6">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Pendentes</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Aprovados</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.approved}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Em Transporte</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats.shipping}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Entregues</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.delivered}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Receita Aprovada</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-green-600">{formatCurrency(stats.revenue)}</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por pedido, cliente, email ou telefone..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filtrar por status" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_GROUPS.map((group) => (
                <SelectItem key={group.value} value={group.value}>{group.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Orders List */}
        {filteredOrders.length === 0 ? (
          <Card>
            <CardContent className="py-8">
              <p className="text-center text-muted-foreground">
                {orders?.length === 0 ? 'Nenhum pedido encontrado' : 'Nenhum pedido corresponde aos filtros'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-4">
                {filteredOrders.map((order) => {
                  const statusConfig = STATUS_CONFIG[order.status] || STATUS_CONFIG.processing;
                  const StatusIcon = statusConfig.icon;
                  
                  return (
                    <div
                      key={order.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-medium text-primary">
                            {order.order_number}
                          </span>
                          <Badge variant={statusConfig.variant} className="gap-1">
                            <StatusIcon className="h-3 w-3" />
                            {statusConfig.label}
                          </Badge>
                        </div>
                        <div className="font-medium">
                          {order.customer_name}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {order.customer_email || order.customer_phone || 'Sem contato'}
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center gap-2">
                          <span>{order.storefront?.name || order.landing_page?.name || 'Manual'}</span>
                          <span>•</span>
                          <span>{format(new Date(order.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
                          {order.tracking_code && (
                            <>
                              <span>•</span>
                              <span className="font-mono">{order.tracking_code}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="font-semibold">{formatCurrency(order.total_cents)}</div>
                          <div className="text-xs text-muted-foreground capitalize">
                            {order.payment_method?.replace('_', ' ') || 'N/A'}
                          </div>
                        </div>
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => navigate(`/ecommerce/vendas/${order.id}`)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </EcommerceLayout>
  );
}
