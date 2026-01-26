import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  DollarSign, 
  TrendingUp, 
  Clock, 
  CreditCard, 
  Wallet,
  ArrowDownRight,
  ArrowUpRight,
  Calendar,
  Users,
  Building2,
  Factory,
  UserCheck,
  Share2,
  ChevronRight,
  Eye
} from 'lucide-react';
import { format, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface SplitData {
  id: string;
  sale_id: string;
  split_type: string;
  gross_amount_cents: number;
  fee_cents: number;
  net_amount_cents: number;
  percentage: number;
  priority: number;
  liable_for_refund: boolean;
  liable_for_chargeback: boolean;
  created_at: string;
  virtual_account_id: string;
  industry_id: string | null;
}

interface EcommerceOrder {
  id: string;
  order_number: string;
  total_cents: number;
  payment_method: string;
  status: string;
  created_at: string;
  storefront: { name: string } | null;
  organization: { name: string } | null;
}

interface SaleWithGateway {
  id: string;
  total_cents: number;
  payment_method: string;
  gateway_fee_cents: number | null;
  gateway_net_cents: number | null;
  payment_installments: number | null;
  created_at: string;
  payment_confirmed_at: string | null;
}

interface SplitsByType {
  platform_fee: number;
  tenant: number;
  affiliate: number;
  industry: number;
  factory: number;
  coproducer: number;
  gateway_fee: number;
}

const formatCurrency = (cents: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
};

// Settlement days based on payment method
const getSettlementDays = (paymentMethod: string): number => {
  switch (paymentMethod) {
    case 'pix': return 1;
    case 'boleto': return 1;
    case 'credit_card': return 30;
    default: return 30;
  }
};

const getPaymentMethodLabel = (method: string): string => {
  const labels: Record<string, string> = {
    pix: 'PIX',
    credit_card: 'Cartão',
    boleto: 'Boleto',
  };
  return labels[method] || method;
};

const getSplitTypeLabel = (type: string): string => {
  const labels: Record<string, string> = {
    platform_fee: 'Plataforma (Morphews)',
    tenant: 'Lojista (Tenant)',
    affiliate: 'Afiliado',
    industry: 'Indústria',
    factory: 'Fábrica',
    coproducer: 'Co-produtor',
    gateway_fee: 'Taxa Gateway',
  };
  return labels[type] || type;
};

const getSplitTypeIcon = (type: string) => {
  const icons: Record<string, React.ReactNode> = {
    platform_fee: <Building2 className="h-4 w-4 text-purple-500" />,
    tenant: <Users className="h-4 w-4 text-blue-500" />,
    affiliate: <UserCheck className="h-4 w-4 text-green-500" />,
    industry: <Factory className="h-4 w-4 text-orange-500" />,
    factory: <Factory className="h-4 w-4 text-amber-600" />,
    coproducer: <Share2 className="h-4 w-4 text-cyan-500" />,
    gateway_fee: <CreditCard className="h-4 w-4 text-red-500" />,
  };
  return icons[type] || <DollarSign className="h-4 w-4" />;
};

const getSplitTypeColor = (type: string): string => {
  const colors: Record<string, string> = {
    platform_fee: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
    tenant: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    affiliate: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    industry: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
    factory: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    coproducer: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300',
    gateway_fee: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  };
  return colors[type] || 'bg-gray-100 text-gray-800';
};

export function GatewayFinancialDashboard() {
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);
  
  // Fetch all splits from last 30 days
  const { data: allSplits, isLoading: splitsLoading } = useQuery({
    queryKey: ['all-splits-30d'],
    queryFn: async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const { data, error } = await supabase
        .from('sale_splits')
        .select('*')
        .gte('created_at', thirtyDaysAgo.toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as SplitData[];
    },
  });

  // Fetch e-commerce orders (real gateway transactions)
  const { data: ecommerceOrders, isLoading: ordersLoading } = useQuery({
    queryKey: ['ecommerce-orders-30d'],
    queryFn: async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const { data, error } = await supabase
        .from('ecommerce_orders')
        .select(`
          id,
          order_number,
          total_cents,
          payment_method,
          status,
          created_at,
          storefront:tenant_storefronts(name),
          organization:organizations(name)
        `)
        .in('status', ['paid', 'approved', 'payment_confirmed', 'delivered', 'dispatched'])
        .gte('created_at', thirtyDaysAgo.toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as EcommerceOrder[];
    },
  });

  // Fetch splits for selected sale
  const { data: saleSplits } = useQuery({
    queryKey: ['sale-splits', selectedSaleId],
    queryFn: async () => {
      if (!selectedSaleId) return [];
      
      const { data, error } = await supabase
        .from('sale_splits')
        .select(`
          *,
          virtual_account:virtual_accounts(holder_name, account_type)
        `)
        .eq('sale_id', selectedSaleId)
        .order('priority', { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: !!selectedSaleId,
  });

  // Calculate totals from e-commerce orders
  const totalGMV = ecommerceOrders?.reduce((acc, order) => acc + order.total_cents, 0) || 0;
  
  // Calculate splits by type
  const splitsByType: SplitsByType = allSplits?.reduce((acc, split) => {
    const type = split.split_type as keyof SplitsByType;
    if (acc[type] !== undefined) {
      acc[type] += split.net_amount_cents;
    }
    return acc;
  }, {
    platform_fee: 0,
    tenant: 0,
    affiliate: 0,
    industry: 0,
    factory: 0,
    coproducer: 0,
    gateway_fee: 0,
  } as SplitsByType) || {
    platform_fee: 0,
    tenant: 0,
    affiliate: 0,
    industry: 0,
    factory: 0,
    coproducer: 0,
    gateway_fee: 0,
  };

  const totalPlatformFee = splitsByType.platform_fee;
  const totalGatewayFee = splitsByType.gateway_fee;
  const netProfit = totalPlatformFee; // Platform already net of fees

  // Group orders by payment method
  const byPaymentMethod = ecommerceOrders?.reduce((acc, order) => {
    const method = order.payment_method || 'unknown';
    if (!acc[method]) {
      acc[method] = { count: 0, totalCents: 0 };
    }
    acc[method].count++;
    acc[method].totalCents += order.total_cents;
    return acc;
  }, {} as Record<string, { count: number; totalCents: number }>);

  // Get unique sales with splits
  const uniqueSalesWithSplits = allSplits 
    ? [...new Set(allSplits.map(s => s.sale_id))]
    : [];

  // Count splits by type
  const splitCounts = allSplits?.reduce((acc, split) => {
    acc[split.split_type] = (acc[split.split_type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};

  const isLoading = splitsLoading || ordersLoading;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-500" />
              GMV E-commerce (30 dias)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalGMV)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {ecommerceOrders?.length || 0} pedidos via gateway
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Building2 className="h-4 w-4 text-purple-500" />
              Receita Plataforma
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{formatCurrency(totalPlatformFee)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {totalGMV > 0 ? ((totalPlatformFee / totalGMV) * 100).toFixed(2) : 0}% do GMV
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-400">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-400" />
              Repasse Tenants
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{formatCurrency(splitsByType.tenant)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {totalGMV > 0 ? ((splitsByType.tenant / totalGMV) * 100).toFixed(2) : 0}% do GMV
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-green-500" />
              Comissões Afiliados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(splitsByType.affiliate)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {totalGMV > 0 ? ((splitsByType.affiliate / totalGMV) * 100).toFixed(2) : 0}% do GMV
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Additional Participants */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Factory className="h-4 w-4 text-orange-500" />
              Repasse Indústrias
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-orange-600">{formatCurrency(splitsByType.industry)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Factory className="h-4 w-4 text-amber-600" />
              Repasse Fábricas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-amber-600">{formatCurrency(splitsByType.factory)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Share2 className="h-4 w-4 text-cyan-500" />
              Repasse Co-produtores
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-cyan-600">{formatCurrency(splitsByType.coproducer)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-red-500" />
              Custos Gateway
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-red-600">{formatCurrency(totalGatewayFee)}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="splits" className="w-full">
        <TabsList>
          <TabsTrigger value="splits">Árvore de Splits</TabsTrigger>
          <TabsTrigger value="orders">Pedidos E-commerce</TabsTrigger>
          <TabsTrigger value="methods">Por Método</TabsTrigger>
        </TabsList>

        {/* Split Tree Tab */}
        <TabsContent value="splits" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Share2 className="h-5 w-5" />
                Distribuição de Receita por Participante
              </CardTitle>
              <CardDescription>
                Visão consolidada de quem está ganhando o quê em cada venda
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Visual Split Distribution */}
              <div className="space-y-4 mb-6">
                {totalGMV > 0 && (
                  <div className="relative h-8 rounded-lg overflow-hidden flex">
                    {splitsByType.platform_fee > 0 && (
                      <div 
                        className="bg-purple-500 flex items-center justify-center text-white text-xs font-medium"
                        style={{ width: `${(splitsByType.platform_fee / totalGMV) * 100}%` }}
                        title={`Plataforma: ${formatCurrency(splitsByType.platform_fee)}`}
                      >
                        {((splitsByType.platform_fee / totalGMV) * 100).toFixed(1)}%
                      </div>
                    )}
                    {splitsByType.industry > 0 && (
                      <div 
                        className="bg-orange-500 flex items-center justify-center text-white text-xs font-medium"
                        style={{ width: `${(splitsByType.industry / totalGMV) * 100}%` }}
                        title={`Indústria: ${formatCurrency(splitsByType.industry)}`}
                      >
                        {((splitsByType.industry / totalGMV) * 100).toFixed(1)}%
                      </div>
                    )}
                    {splitsByType.factory > 0 && (
                      <div 
                        className="bg-amber-500 flex items-center justify-center text-white text-xs font-medium"
                        style={{ width: `${(splitsByType.factory / totalGMV) * 100}%` }}
                        title={`Fábrica: ${formatCurrency(splitsByType.factory)}`}
                      >
                        {((splitsByType.factory / totalGMV) * 100).toFixed(1)}%
                      </div>
                    )}
                    {splitsByType.coproducer > 0 && (
                      <div 
                        className="bg-cyan-500 flex items-center justify-center text-white text-xs font-medium"
                        style={{ width: `${(splitsByType.coproducer / totalGMV) * 100}%` }}
                        title={`Co-produtor: ${formatCurrency(splitsByType.coproducer)}`}
                      >
                        {((splitsByType.coproducer / totalGMV) * 100).toFixed(1)}%
                      </div>
                    )}
                    {splitsByType.affiliate > 0 && (
                      <div 
                        className="bg-green-500 flex items-center justify-center text-white text-xs font-medium"
                        style={{ width: `${(splitsByType.affiliate / totalGMV) * 100}%` }}
                        title={`Afiliado: ${formatCurrency(splitsByType.affiliate)}`}
                      >
                        {((splitsByType.affiliate / totalGMV) * 100).toFixed(1)}%
                      </div>
                    )}
                    {splitsByType.tenant > 0 && (
                      <div 
                        className="bg-blue-500 flex items-center justify-center text-white text-xs font-medium"
                        style={{ width: `${(splitsByType.tenant / totalGMV) * 100}%` }}
                        title={`Tenant: ${formatCurrency(splitsByType.tenant)}`}
                      >
                        {((splitsByType.tenant / totalGMV) * 100).toFixed(1)}%
                      </div>
                    )}
                  </div>
                )}
                
                {/* Legend */}
                <div className="flex flex-wrap gap-4 text-sm">
                  {splitsByType.platform_fee > 0 && (
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded bg-purple-500" />
                      <span>Plataforma</span>
                    </div>
                  )}
                  {splitsByType.industry > 0 && (
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded bg-orange-500" />
                      <span>Indústria</span>
                    </div>
                  )}
                  {splitsByType.factory > 0 && (
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded bg-amber-500" />
                      <span>Fábrica</span>
                    </div>
                  )}
                  {splitsByType.coproducer > 0 && (
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded bg-cyan-500" />
                      <span>Co-produtor</span>
                    </div>
                  )}
                  {splitsByType.affiliate > 0 && (
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded bg-green-500" />
                      <span>Afiliado</span>
                    </div>
                  )}
                  {splitsByType.tenant > 0 && (
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded bg-blue-500" />
                      <span>Tenant</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Split Details Table */}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Participante</TableHead>
                    <TableHead className="text-right">Transações</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">% do GMV</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(splitsByType)
                    .filter(([_, value]) => value > 0)
                    .sort((a, b) => b[1] - a[1])
                    .map(([type, amount]) => (
                      <TableRow key={type}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getSplitTypeIcon(type)}
                            <Badge className={getSplitTypeColor(type)}>
                              {getSplitTypeLabel(type)}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {splitCounts[type] || 0}
                        </TableCell>
                        <TableCell className="text-right font-bold">
                          {formatCurrency(amount)}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {totalGMV > 0 ? ((amount / totalGMV) * 100).toFixed(2) : 0}%
                        </TableCell>
                      </TableRow>
                    ))}
                  {Object.values(splitsByType).every(v => v === 0) && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                        Nenhum split registrado nos últimos 30 dias
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Per-Sale Split Details */}
          <Card>
            <CardHeader>
              <CardTitle>Splits por Venda</CardTitle>
              <CardDescription>
                Clique em uma venda para ver a árvore de divisão completa
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Venda ID</TableHead>
                    <TableHead className="text-right">Participantes</TableHead>
                    <TableHead className="text-right">Total Distribuído</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {uniqueSalesWithSplits.slice(0, 20).map(saleId => {
                    const saleSplitsData = allSplits?.filter(s => s.sale_id === saleId) || [];
                    const totalDistributed = saleSplitsData.reduce((acc, s) => acc + s.net_amount_cents, 0);
                    const participantTypes = [...new Set(saleSplitsData.map(s => s.split_type))];
                    
                    return (
                      <TableRow key={saleId}>
                        <TableCell className="font-mono text-sm">
                          {saleId.substring(0, 8)}...
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {participantTypes.map(type => (
                              <span key={type} title={getSplitTypeLabel(type)}>
                                {getSplitTypeIcon(type)}
                              </span>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(totalDistributed)}
                        </TableCell>
                        <TableCell>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => setSelectedSaleId(saleId)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {uniqueSalesWithSplits.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                        Nenhuma venda com splits encontrada
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* E-commerce Orders Tab */}
        <TabsContent value="orders">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Pedidos E-commerce (Gateway)
              </CardTitle>
              <CardDescription>
                Vendas processadas através do gateway de pagamento
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pedido</TableHead>
                    <TableHead>Loja</TableHead>
                    <TableHead>Tenant</TableHead>
                    <TableHead>Método</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ecommerceOrders?.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-mono text-sm font-medium">
                        {order.order_number}
                      </TableCell>
                      <TableCell className="text-sm">
                        {order.storefront?.name || '-'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {order.organization?.name || '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {getPaymentMethodLabel(order.payment_method || 'unknown')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-bold">
                        {formatCurrency(order.total_cents)}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={order.status === 'approved' || order.status === 'paid' ? 'default' : 'secondary'}
                          className={order.status === 'approved' || order.status === 'paid' ? 'bg-green-500' : ''}
                        >
                          {order.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(order.created_at), 'dd/MM HH:mm', { locale: ptBR })}
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!ecommerceOrders || ecommerceOrders.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        Nenhum pedido e-commerce nos últimos 30 dias
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payment Methods Tab */}
        <TabsContent value="methods">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Detalhamento por Método de Pagamento
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Método</TableHead>
                    <TableHead className="text-right">Transações</TableHead>
                    <TableHead className="text-right">Volume</TableHead>
                    <TableHead className="text-right">% do Total</TableHead>
                    <TableHead className="text-right">Liquidação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {byPaymentMethod && Object.entries(byPaymentMethod).map(([method, data]) => (
                    <TableRow key={method}>
                      <TableCell>
                        <Badge variant="outline">{getPaymentMethodLabel(method)}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">{data.count}</TableCell>
                      <TableCell className="text-right font-bold">{formatCurrency(data.totalCents)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {totalGMV > 0 ? ((data.totalCents / totalGMV) * 100).toFixed(1) : 0}%
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="secondary">D+{getSettlementDays(method)}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!byPaymentMethod || Object.keys(byPaymentMethod).length === 0) && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        Nenhuma venda processada nos últimos 30 dias
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Sale Split Detail Dialog */}
      <Dialog open={!!selectedSaleId} onOpenChange={() => setSelectedSaleId(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="h-5 w-5" />
              Árvore de Splits da Venda
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground font-mono">
              ID: {selectedSaleId}
            </div>
            
            {saleSplits && saleSplits.length > 0 ? (
              <div className="space-y-2">
                {saleSplits.map((split: any, index: number) => (
                  <div 
                    key={split.id}
                    className="flex items-center gap-2 p-3 rounded-lg bg-muted/50"
                  >
                    <div className="flex items-center gap-2 flex-1">
                      {index > 0 && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                      {getSplitTypeIcon(split.split_type)}
                      <div>
                        <p className="font-medium">{getSplitTypeLabel(split.split_type)}</p>
                        <p className="text-xs text-muted-foreground">
                          {split.virtual_account?.holder_name || 'Conta não identificada'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{formatCurrency(split.net_amount_cents)}</p>
                      <p className="text-xs text-muted-foreground">
                        {split.percentage > 0 ? `${split.percentage}%` : 'Fixo'}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      {split.liable_for_refund && (
                        <Badge variant="outline" className="text-xs">Refund</Badge>
                      )}
                      {split.liable_for_chargeback && (
                        <Badge variant="outline" className="text-xs">Chargeback</Badge>
                      )}
                    </div>
                  </div>
                ))}
                
                <div className="flex items-center justify-between pt-4 border-t">
                  <span className="font-medium">Total Distribuído</span>
                  <span className="text-xl font-bold">
                    {formatCurrency(saleSplits.reduce((acc: number, s: any) => acc + s.net_amount_cents, 0))}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-4">
                Carregando splits...
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
