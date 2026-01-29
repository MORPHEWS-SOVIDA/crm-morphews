import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
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
  Eye,
  Store,
  FileText,
  ShoppingCart,
  AlertCircle,
  CheckCircle,
  XCircle,
  History,
  RefreshCw,
  Percent,
  Loader2,
  BarChart3
} from 'lucide-react';
import { format, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useState, useMemo } from 'react';
import { GatewayDetailedTable } from './GatewayDetailedTable';
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
  sale_id: string | null;
  total_cents: number;
  payment_method: string;
  status: string;
  source: string | null;
  created_at: string;
  storefront_id: string | null;
  landing_page_id: string | null;
  storefront: { name: string } | null;
  organization: { name: string } | null;
}

interface PaymentAttempt {
  id: string;
  sale_id: string;
  gateway: string; // Column is 'gateway' not 'gateway_type'
  payment_method: string;
  amount_cents: number;
  status: string;
  gateway_transaction_id: string | null;
  error_code: string | null;
  error_message: string | null;
  is_fallback: boolean;
  fallback_from_gateway: string | null;
  attempt_number: number;
  gateway_response: Record<string, unknown> | null; // Column is 'gateway_response' not 'response_data'
  created_at: string;
}

interface SaleDetail {
  id: string;
  total_cents: number;
  payment_method: string;
  payment_installments: number;
  payment_status: string;
  status: string;
  gateway_transaction_id: string | null;
  created_at: string;
  lead: { name: string | null; email: string | null } | null; // Column is 'name' not 'full_name'
  organization: { name: string } | null;
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

const getSourceLabel = (order: EcommerceOrder): { label: string; icon: React.ReactNode; color: string } => {
  if (order.storefront_id) {
    return { label: 'Loja', icon: <Store className="h-3 w-3" />, color: 'bg-blue-100 text-blue-700' };
  }
  if (order.landing_page_id) {
    return { label: 'Landing', icon: <FileText className="h-3 w-3" />, color: 'bg-green-100 text-green-700' };
  }
  if (order.source === 'landing_page') {
    return { label: 'Landing', icon: <FileText className="h-3 w-3" />, color: 'bg-green-100 text-green-700' };
  }
  // Standalone checkout (no storefront and no landing)
  return { label: 'Checkout', icon: <ShoppingCart className="h-3 w-3" />, color: 'bg-purple-100 text-purple-700' };
};

const getAttemptStatusIcon = (status: string) => {
  switch (status) {
    case 'success':
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case 'failed':
      return <XCircle className="h-4 w-4 text-red-500" />;
    case 'pending':
    case 'processing':
      return <Loader2 className="h-4 w-4 text-amber-500 animate-spin" />;
    default:
      return <AlertCircle className="h-4 w-4 text-gray-400" />;
  }
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
          sale_id,
          total_cents,
          payment_method,
          status,
          source,
          storefront_id,
          landing_page_id,
          created_at,
          storefront:tenant_storefronts(name),
          organization:organizations(name)
        `)
        .gte('created_at', thirtyDaysAgo.toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as EcommerceOrder[];
    },
  });

  // Fetch sales with interest (subtotal vs total difference)
  const { data: salesWithInterest, isLoading: interestLoading } = useQuery({
    queryKey: ['sales-interest-30d'],
    queryFn: async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const { data, error } = await supabase
        .from('sales')
        .select('id, total_cents, subtotal_cents, status')
        .gte('created_at', thirtyDaysAgo.toISOString())
        .eq('status', 'payment_confirmed');

      if (error) throw error;
      return data;
    },
  });

  // Calculate total interest revenue (total - subtotal for all paid sales)
  const totalInterestRevenue = useMemo(() => {
    if (!salesWithInterest) return 0;
    return salesWithInterest.reduce((acc, sale) => {
      const interest = (sale.total_cents || 0) - (sale.subtotal_cents || 0);
      return acc + (interest > 0 ? interest : 0);
    }, 0);
  }, [salesWithInterest]);

  // Fetch ALL payment attempts from last 30 days
  const { data: paymentAttempts, isLoading: attemptsLoading, refetch: refetchAttempts } = useQuery({
    queryKey: ['payment-attempts-30d'],
    queryFn: async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const { data, error } = await supabase
        .from('payment_attempts')
        .select('*')
        .gte('created_at', thirtyDaysAgo.toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as PaymentAttempt[];
    },
  });

  // Fetch splits for selected sale
  const { data: saleSplits, isLoading: saleSplitsLoading } = useQuery({
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

  // Fetch sale detail for selected sale
  const { data: saleDetail, isLoading: saleDetailLoading } = useQuery({
    queryKey: ['sale-detail', selectedSaleId],
    queryFn: async () => {
      if (!selectedSaleId) return null;
      
      const { data, error } = await supabase
        .from('sales')
        .select(`
          id,
          total_cents,
          payment_method,
          payment_installments,
          payment_status,
          status,
          gateway_transaction_id,
          created_at,
          lead:leads(name, email),
          organization:organizations(name)
        `)
        .eq('id', selectedSaleId)
        .single();

      if (error) throw error;
      return data as SaleDetail;
    },
    enabled: !!selectedSaleId,
  });

  // Fetch ecommerce order for selected sale
  const { data: saleOrder } = useQuery({
    queryKey: ['sale-order', selectedSaleId],
    queryFn: async () => {
      if (!selectedSaleId) return null;
      
      const { data, error } = await supabase
        .from('ecommerce_orders')
        .select('*')
        .eq('sale_id', selectedSaleId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!selectedSaleId,
  });

  // Fetch payment attempts for selected sale
  const { data: saleAttempts } = useQuery({
    queryKey: ['sale-attempts', selectedSaleId],
    queryFn: async () => {
      if (!selectedSaleId) return [];
      
      const { data, error } = await supabase
        .from('payment_attempts')
        .select('*')
        .eq('sale_id', selectedSaleId)
        .order('attempt_number', { ascending: true });

      if (error) throw error;
      return data as PaymentAttempt[];
    },
    enabled: !!selectedSaleId,
  });

  // Calculate totals from e-commerce orders
  const totalGMV = ecommerceOrders?.reduce((acc, order) => acc + order.total_cents, 0) || 0;
  
  // Calculate paid orders GMV
  const paidOrders = ecommerceOrders?.filter(o => ['paid', 'approved', 'payment_confirmed', 'delivered', 'dispatched'].includes(o.status)) || [];
  const paidGMV = paidOrders.reduce((acc, order) => acc + order.total_cents, 0);
  
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

  // Attempt stats
  const attemptStats = useMemo(() => {
    if (!paymentAttempts) return { total: 0, success: 0, failed: 0, fallbacks: 0 };
    return {
      total: paymentAttempts.length,
      success: paymentAttempts.filter(a => a.status === 'success').length,
      failed: paymentAttempts.filter(a => a.status === 'failed').length,
      fallbacks: paymentAttempts.filter(a => a.is_fallback).length,
    };
  }, [paymentAttempts]);

  // Group orders by payment method
  const byPaymentMethod = ecommerceOrders?.reduce((acc, order) => {
    const method = order.payment_method || 'unknown';
    if (!acc[method]) {
      acc[method] = { count: 0, totalCents: 0, paid: 0, paidCents: 0 };
    }
    acc[method].count++;
    acc[method].totalCents += order.total_cents;
    if (['paid', 'approved', 'payment_confirmed', 'delivered', 'dispatched'].includes(order.status)) {
      acc[method].paid++;
      acc[method].paidCents += order.total_cents;
    }
    return acc;
  }, {} as Record<string, { count: number; totalCents: number; paid: number; paidCents: number }>);

  // Group orders by source
  const bySource = useMemo(() => {
    if (!ecommerceOrders) return {};
    return ecommerceOrders.reduce((acc, order) => {
      const src = getSourceLabel(order);
      const key = src.label;
      if (!acc[key]) {
        acc[key] = { count: 0, totalCents: 0, paid: 0, paidCents: 0 };
      }
      acc[key].count++;
      acc[key].totalCents += order.total_cents;
      if (['paid', 'approved', 'payment_confirmed', 'delivered', 'dispatched'].includes(order.status)) {
        acc[key].paid++;
        acc[key].paidCents += order.total_cents;
      }
      return acc;
    }, {} as Record<string, { count: number; totalCents: number; paid: number; paidCents: number }>);
  }, [ecommerceOrders]);

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
      {/* Summary Cards - Row 1 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-500" />
              GMV Total (30 dias)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalGMV)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {ecommerceOrders?.length || 0} pedidos • {paidOrders.length} pagos
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
              {paidGMV > 0 ? ((totalPlatformFee / paidGMV) * 100).toFixed(2) : 0}% do GMV pago
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
              {paidGMV > 0 ? ((splitsByType.tenant / paidGMV) * 100).toFixed(2) : 0}% do GMV
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
              {paidGMV > 0 ? ((splitsByType.affiliate / paidGMV) * 100).toFixed(2) : 0}% do GMV
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Summary Cards - Row 2 */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Factory className="h-4 w-4 text-orange-500" />
              Indústrias
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
              Fábricas
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
              Co-produtores
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-cyan-600">{formatCurrency(splitsByType.coproducer)}</div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Percent className="h-4 w-4 text-emerald-500" />
              Receita Juros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-emerald-600">{formatCurrency(totalInterestRevenue)}</div>
            <p className="text-xs text-muted-foreground">
              Parcelamento cartão
            </p>
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

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <History className="h-4 w-4 text-gray-500" />
              Tentativas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{attemptStats.total}</div>
            <p className="text-xs text-muted-foreground">
              {attemptStats.success} ✓ • {attemptStats.failed} ✗ • {attemptStats.fallbacks} fallback
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="detailed" className="w-full">
        <TabsList className="flex-wrap">
          <TabsTrigger value="detailed" className="flex items-center gap-1">
            <BarChart3 className="h-4 w-4" />
            Detalhado
          </TabsTrigger>
          <TabsTrigger value="orders">Pedidos</TabsTrigger>
          <TabsTrigger value="attempts">Tentativas</TabsTrigger>
          <TabsTrigger value="splits">Árvore de Splits</TabsTrigger>
          <TabsTrigger value="methods">Por Método</TabsTrigger>
          <TabsTrigger value="sources">Por Origem</TabsTrigger>
        </TabsList>
        
        {/* Detailed Financial Table Tab */}
        <TabsContent value="detailed">
          <GatewayDetailedTable onViewSale={(saleId) => setSelectedSaleId(saleId)} />
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
                Todas as vendas processadas através do gateway — clique para ver detalhes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Pedido</TableHead>
                      <TableHead>Origem</TableHead>
                      <TableHead>Tenant</TableHead>
                      <TableHead>Método</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ecommerceOrders?.map((order) => {
                      const src = getSourceLabel(order);
                      return (
                        <TableRow key={order.id}>
                          <TableCell className="font-mono text-sm font-medium">
                            {order.order_number}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`flex items-center gap-1 w-fit ${src.color}`}>
                              {src.icon}
                              {src.label}
                            </Badge>
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
                              variant={['approved', 'paid', 'payment_confirmed', 'delivered', 'dispatched'].includes(order.status) ? 'default' : 'secondary'}
                              className={['approved', 'paid', 'payment_confirmed', 'delivered', 'dispatched'].includes(order.status) ? 'bg-green-500' : ''}
                            >
                              {order.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {format(new Date(order.created_at), 'dd/MM HH:mm', { locale: ptBR })}
                          </TableCell>
                          <TableCell>
                            {order.sale_id && (
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => setSelectedSaleId(order.sale_id)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {(!ecommerceOrders || ecommerceOrders.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                          Nenhum pedido e-commerce nos últimos 30 dias
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payment Attempts Tab */}
        <TabsContent value="attempts">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <History className="h-5 w-5" />
                    Histórico de Tentativas de Pagamento
                  </CardTitle>
                  <CardDescription>
                    Todas as requisições enviadas aos gateways (sucessos, falhas, fallbacks)
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => refetchAttempts()}>
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Atualizar
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {attemptsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <ScrollArea className="h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Status</TableHead>
                        <TableHead>Venda ID</TableHead>
                        <TableHead>Gateway</TableHead>
                        <TableHead>Método</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead>Tentativa</TableHead>
                        <TableHead>Erro</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paymentAttempts && paymentAttempts.length > 0 ? (
                        paymentAttempts.map((attempt) => (
                          <TableRow key={attempt.id}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {getAttemptStatusIcon(attempt.status)}
                                <span className="capitalize text-sm">{attempt.status}</span>
                              </div>
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              {attempt.sale_id.substring(0, 8)}...
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="uppercase text-xs">
                                {attempt.gateway}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">
                                {getPaymentMethodLabel(attempt.payment_method)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {formatCurrency(attempt.amount_cents)}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <span className="font-mono text-sm">#{attempt.attempt_number}</span>
                                {attempt.is_fallback && (
                                  <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700">
                                    Fallback
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="max-w-[200px]">
                              {attempt.error_code && (
                                <div className="text-xs text-red-600 truncate" title={attempt.error_message || ''}>
                                  {attempt.error_code}
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                              {format(new Date(attempt.created_at), 'dd/MM HH:mm:ss', { locale: ptBR })}
                            </TableCell>
                            <TableCell>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => setSelectedSaleId(attempt.sale_id)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                            Nenhuma tentativa de pagamento registrada nos últimos 30 dias
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

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
                {paidGMV > 0 && (
                  <div className="relative h-8 rounded-lg overflow-hidden flex">
                    {splitsByType.platform_fee > 0 && (
                      <div 
                        className="bg-purple-500 flex items-center justify-center text-white text-xs font-medium"
                        style={{ width: `${(splitsByType.platform_fee / paidGMV) * 100}%` }}
                        title={`Plataforma: ${formatCurrency(splitsByType.platform_fee)}`}
                      >
                        {((splitsByType.platform_fee / paidGMV) * 100).toFixed(1)}%
                      </div>
                    )}
                    {splitsByType.industry > 0 && (
                      <div 
                        className="bg-orange-500 flex items-center justify-center text-white text-xs font-medium"
                        style={{ width: `${(splitsByType.industry / paidGMV) * 100}%` }}
                        title={`Indústria: ${formatCurrency(splitsByType.industry)}`}
                      >
                        {((splitsByType.industry / paidGMV) * 100).toFixed(1)}%
                      </div>
                    )}
                    {splitsByType.factory > 0 && (
                      <div 
                        className="bg-amber-500 flex items-center justify-center text-white text-xs font-medium"
                        style={{ width: `${(splitsByType.factory / paidGMV) * 100}%` }}
                        title={`Fábrica: ${formatCurrency(splitsByType.factory)}`}
                      >
                        {((splitsByType.factory / paidGMV) * 100).toFixed(1)}%
                      </div>
                    )}
                    {splitsByType.coproducer > 0 && (
                      <div 
                        className="bg-cyan-500 flex items-center justify-center text-white text-xs font-medium"
                        style={{ width: `${(splitsByType.coproducer / paidGMV) * 100}%` }}
                        title={`Co-produtor: ${formatCurrency(splitsByType.coproducer)}`}
                      >
                        {((splitsByType.coproducer / paidGMV) * 100).toFixed(1)}%
                      </div>
                    )}
                    {splitsByType.affiliate > 0 && (
                      <div 
                        className="bg-green-500 flex items-center justify-center text-white text-xs font-medium"
                        style={{ width: `${(splitsByType.affiliate / paidGMV) * 100}%` }}
                        title={`Afiliado: ${formatCurrency(splitsByType.affiliate)}`}
                      >
                        {((splitsByType.affiliate / paidGMV) * 100).toFixed(1)}%
                      </div>
                    )}
                    {splitsByType.tenant > 0 && (
                      <div 
                        className="bg-blue-500 flex items-center justify-center text-white text-xs font-medium"
                        style={{ width: `${(splitsByType.tenant / paidGMV) * 100}%` }}
                        title={`Tenant: ${formatCurrency(splitsByType.tenant)}`}
                      >
                        {((splitsByType.tenant / paidGMV) * 100).toFixed(1)}%
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
                          {paidGMV > 0 ? ((amount / paidGMV) * 100).toFixed(2) : 0}%
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

        {/* Payment Methods Tab */}
        <TabsContent value="methods">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Detalhamento por Método de Pagamento
              </CardTitle>
              <CardDescription>
                Volume e conversão por forma de pagamento
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Método</TableHead>
                    <TableHead className="text-right">Pedidos</TableHead>
                    <TableHead className="text-right">Pagos</TableHead>
                    <TableHead className="text-right">Volume Total</TableHead>
                    <TableHead className="text-right">Volume Pago</TableHead>
                    <TableHead className="text-right">Taxa Conversão</TableHead>
                    <TableHead className="text-right">Liquidação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {byPaymentMethod && Object.entries(byPaymentMethod).map(([method, data]) => (
                    <TableRow key={method}>
                      <TableCell>
                        <Badge variant="outline">{getPaymentMethodLabel(method)}</Badge>
                      </TableCell>
                      <TableCell className="text-right">{data.count}</TableCell>
                      <TableCell className="text-right font-medium text-green-600">{data.paid}</TableCell>
                      <TableCell className="text-right">{formatCurrency(data.totalCents)}</TableCell>
                      <TableCell className="text-right font-bold">{formatCurrency(data.paidCents)}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={data.count > 0 && (data.paid / data.count) >= 0.7 ? 'default' : 'secondary'}>
                          {data.count > 0 ? ((data.paid / data.count) * 100).toFixed(1) : 0}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="secondary">D+{getSettlementDays(method)}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!byPaymentMethod || Object.keys(byPaymentMethod).length === 0) && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        Nenhuma venda processada nos últimos 30 dias
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sources Tab */}
        <TabsContent value="sources">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Store className="h-5 w-5" />
                Detalhamento por Origem
              </CardTitle>
              <CardDescription>
                Loja (E-commerce), Landing Page ou Checkout Standalone
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Origem</TableHead>
                    <TableHead className="text-right">Pedidos</TableHead>
                    <TableHead className="text-right">Pagos</TableHead>
                    <TableHead className="text-right">Volume Total</TableHead>
                    <TableHead className="text-right">Volume Pago</TableHead>
                    <TableHead className="text-right">Taxa Conversão</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(bySource).map(([source, data]) => (
                    <TableRow key={source}>
                      <TableCell>
                        <Badge variant="outline" className={
                          source === 'Loja' ? 'bg-blue-100 text-blue-700' :
                          source === 'Landing' ? 'bg-green-100 text-green-700' :
                          'bg-purple-100 text-purple-700'
                        }>
                          {source === 'Loja' && <Store className="h-3 w-3 mr-1" />}
                          {source === 'Landing' && <FileText className="h-3 w-3 mr-1" />}
                          {source === 'Checkout' && <ShoppingCart className="h-3 w-3 mr-1" />}
                          {source}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{data.count}</TableCell>
                      <TableCell className="text-right font-medium text-green-600">{data.paid}</TableCell>
                      <TableCell className="text-right">{formatCurrency(data.totalCents)}</TableCell>
                      <TableCell className="text-right font-bold">{formatCurrency(data.paidCents)}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={data.count > 0 && (data.paid / data.count) >= 0.7 ? 'default' : 'secondary'}>
                          {data.count > 0 ? ((data.paid / data.count) * 100).toFixed(1) : 0}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {Object.keys(bySource).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
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

      {/* Sale Detail Dialog */}
      <Dialog open={!!selectedSaleId} onOpenChange={() => setSelectedSaleId(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="h-5 w-5" />
              Detalhes da Venda
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Sale Info */}
            <div className="p-4 rounded-lg bg-muted/50 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">ID da Venda:</span>
                <span className="font-mono text-sm">{selectedSaleId}</span>
              </div>
              {saleDetailLoading ? (
                <Skeleton className="h-16 w-full" />
              ) : saleDetail && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Cliente:</span>
                    <span className="font-medium">{saleDetail.lead?.name || '-'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Tenant:</span>
                    <span>{saleDetail.organization?.name || '-'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Valor Total:</span>
                    <span className="text-lg font-bold">{formatCurrency(saleDetail.total_cents)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Método:</span>
                    <Badge variant="outline">
                      {getPaymentMethodLabel(saleDetail.payment_method)}
                      {saleDetail.payment_installments > 1 && ` (${saleDetail.payment_installments}x)`}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Status:</span>
                    <Badge variant={saleDetail.payment_status === 'paid' ? 'default' : 'secondary'} 
                           className={saleDetail.payment_status === 'paid' ? 'bg-green-500' : ''}>
                      {saleDetail.payment_status}
                    </Badge>
                  </div>
                  {saleDetail.gateway_transaction_id && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Gateway ID:</span>
                      <span className="font-mono text-xs">{saleDetail.gateway_transaction_id}</span>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Attempts */}
            {saleAttempts && saleAttempts.length > 0 && (
              <div>
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <History className="h-4 w-4" />
                  Tentativas de Pagamento ({saleAttempts.length})
                </h4>
                <div className="space-y-2">
                  {saleAttempts.map((attempt) => (
                    <div 
                      key={attempt.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border ${
                        attempt.status === 'success' ? 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800' :
                        attempt.status === 'failed' ? 'bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800' :
                        'bg-muted/50'
                      }`}
                    >
                      {getAttemptStatusIcon(attempt.status)}
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">#{attempt.attempt_number}</span>
                          <Badge variant="outline" className="uppercase text-xs">{attempt.gateway}</Badge>
                          <Badge variant="secondary">{getPaymentMethodLabel(attempt.payment_method)}</Badge>
                          {attempt.is_fallback && (
                            <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700">
                              Fallback de {attempt.fallback_from_gateway}
                            </Badge>
                          )}
                        </div>
                        {attempt.error_message && (
                          <p className="text-xs text-red-600 mt-1">{attempt.error_code}: {attempt.error_message}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{formatCurrency(attempt.amount_cents)}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(attempt.created_at), 'HH:mm:ss', { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Splits */}
            <div>
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <Share2 className="h-4 w-4" />
                Árvore de Splits
              </h4>
              
              {saleSplitsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-muted-foreground">Carregando splits...</span>
                </div>
              ) : saleSplits && saleSplits.length > 0 ? (
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
                <div className="text-center py-6 text-muted-foreground border rounded-lg">
                  <AlertCircle className="h-8 w-8 mx-auto mb-2 text-amber-500" />
                  <p>Nenhum split registrado para esta venda.</p>
                  <p className="text-xs mt-1">Os splits são criados após a confirmação do pagamento.</p>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
