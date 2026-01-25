import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  DollarSign, 
  TrendingUp, 
  Clock, 
  CreditCard, 
  Wallet,
  ArrowDownRight,
  ArrowUpRight,
  Calendar,
  Percent
} from 'lucide-react';
import { format, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface SplitData {
  id: string;
  sale_id: string;
  split_type: string;
  gross_amount_cents: number;
  fee_cents: number;
  net_amount_cents: number;
  percentage: number;
  created_at: string;
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

export function GatewayFinancialDashboard() {
  // Fetch platform splits (platform_fee type)
  const { data: platformSplits, isLoading: splitsLoading } = useQuery({
    queryKey: ['platform-splits-30d'],
    queryFn: async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const { data, error } = await supabase
        .from('sale_splits')
        .select('*')
        .eq('split_type', 'platform_fee')
        .gte('created_at', thirtyDaysAgo.toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as SplitData[];
    },
  });

  // Fetch paid sales with gateway info
  const { data: paidSales, isLoading: salesLoading } = useQuery({
    queryKey: ['paid-sales-30d'],
    queryFn: async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const { data, error } = await supabase
        .from('sales')
        .select('id, total_cents, payment_method, gateway_fee_cents, gateway_net_cents, payment_installments, created_at, payment_confirmed_at')
        .eq('payment_status', 'paid')
        .gte('created_at', thirtyDaysAgo.toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as SaleWithGateway[];
    },
  });

  // Calculate totals
  const totalGMV = paidSales?.reduce((acc, sale) => acc + sale.total_cents, 0) || 0;
  const totalPlatformFee = platformSplits?.reduce((acc, split) => acc + split.net_amount_cents, 0) || 0;
  const totalGatewayFee = paidSales?.reduce((acc, sale) => acc + (sale.gateway_fee_cents || 0), 0) || 0;
  const netProfit = totalPlatformFee - totalGatewayFee;

  // Group by payment method
  const byPaymentMethod = paidSales?.reduce((acc, sale) => {
    const method = sale.payment_method || 'unknown';
    if (!acc[method]) {
      acc[method] = { count: 0, totalCents: 0, gatewayCents: 0 };
    }
    acc[method].count++;
    acc[method].totalCents += sale.total_cents;
    acc[method].gatewayCents += sale.gateway_fee_cents || 0;
    return acc;
  }, {} as Record<string, { count: number; totalCents: number; gatewayCents: number }>);

  // Calculate upcoming settlements
  const upcomingSettlements = paidSales?.map(sale => {
    const confirmDate = sale.payment_confirmed_at ? new Date(sale.payment_confirmed_at) : new Date(sale.created_at);
    const settlementDays = getSettlementDays(sale.payment_method || 'credit_card');
    const settlementDate = addDays(confirmDate, settlementDays);
    
    return {
      ...sale,
      settlementDate,
      isPending: settlementDate > new Date(),
    };
  }).filter(s => s.isPending) || [];

  const pendingSettlementTotal = upcomingSettlements.reduce((acc, s) => acc + s.total_cents - (s.gateway_fee_cents || 0), 0);

  if (splitsLoading || salesLoading) {
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
              GMV (30 dias)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalGMV)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {paidSales?.length || 0} vendas processadas
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Wallet className="h-4 w-4 text-green-500" />
              Receita Plataforma
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(totalPlatformFee)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {totalGMV > 0 ? ((totalPlatformFee / totalGMV) * 100).toFixed(2) : 0}% do GMV
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <ArrowDownRight className="h-4 w-4 text-red-500" />
              Custo Gateway
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{formatCurrency(totalGatewayFee)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {totalGMV > 0 ? ((totalGatewayFee / totalGMV) * 100).toFixed(2) : 0}% do GMV
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <ArrowUpRight className="h-4 w-4 text-emerald-500" />
              Lucro Líquido
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {formatCurrency(netProfit)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Margem: {totalPlatformFee > 0 ? ((netProfit / totalPlatformFee) * 100).toFixed(1) : 0}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Pending Settlements */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-amber-500" />
            Previsão de Recebimentos
          </CardTitle>
          <CardDescription>
            Valores pendentes de liquidação no gateway
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="bg-amber-50 dark:bg-amber-950/30 rounded-lg p-4">
              <p className="text-sm text-muted-foreground">Pendente de Liberação</p>
              <p className="text-xl font-bold text-amber-600">{formatCurrency(pendingSettlementTotal)}</p>
              <p className="text-xs text-muted-foreground">{upcomingSettlements.length} transações</p>
            </div>
            
            <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-4">
              <p className="text-sm text-muted-foreground">PIX/Boleto (D+1)</p>
              <p className="text-xl font-bold text-blue-600">
                {formatCurrency(
                  upcomingSettlements
                    .filter(s => s.payment_method === 'pix' || s.payment_method === 'boleto')
                    .reduce((acc, s) => acc + s.total_cents - (s.gateway_fee_cents || 0), 0)
                )}
              </p>
            </div>

            <div className="bg-purple-50 dark:bg-purple-950/30 rounded-lg p-4">
              <p className="text-sm text-muted-foreground">Cartão (D+30)</p>
              <p className="text-xl font-bold text-purple-600">
                {formatCurrency(
                  upcomingSettlements
                    .filter(s => s.payment_method === 'credit_card')
                    .reduce((acc, s) => acc + s.total_cents - (s.gateway_fee_cents || 0), 0)
                )}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Breakdown by Payment Method */}
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
                <TableHead className="text-right">Custo Gateway</TableHead>
                <TableHead className="text-right">% Custo</TableHead>
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
                  <TableCell className="text-right">{formatCurrency(data.totalCents)}</TableCell>
                  <TableCell className="text-right text-red-600">
                    {formatCurrency(data.gatewayCents)}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {data.totalCents > 0 ? ((data.gatewayCents / data.totalCents) * 100).toFixed(2) : 0}%
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant="secondary">D+{getSettlementDays(method)}</Badge>
                  </TableCell>
                </TableRow>
              ))}
              {(!byPaymentMethod || Object.keys(byPaymentMethod).length === 0) && (
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

      {/* Recent Sales with Gateway Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Últimas Vendas Processadas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Método</TableHead>
                <TableHead className="text-right">Valor Bruto</TableHead>
                <TableHead className="text-right">Taxa Gateway</TableHead>
                <TableHead className="text-right">Valor Líquido</TableHead>
                <TableHead className="text-right">Previsão Liquidação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paidSales?.slice(0, 10).map((sale) => {
                const confirmDate = sale.payment_confirmed_at ? new Date(sale.payment_confirmed_at) : new Date(sale.created_at);
                const settlementDays = getSettlementDays(sale.payment_method || 'credit_card');
                const settlementDate = addDays(confirmDate, settlementDays);
                const gatewayFee = sale.gateway_fee_cents || 0;
                const netAmount = sale.total_cents - gatewayFee;
                
                return (
                  <TableRow key={sale.id}>
                    <TableCell className="text-sm">
                      {format(new Date(sale.created_at), 'dd/MM HH:mm', { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {getPaymentMethodLabel(sale.payment_method || 'unknown')}
                        {sale.payment_installments && sale.payment_installments > 1 && (
                          <span className="ml-1">({sale.payment_installments}x)</span>
                        )}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(sale.total_cents)}
                    </TableCell>
                    <TableCell className="text-right text-red-600">
                      {formatCurrency(gatewayFee)}
                    </TableCell>
                    <TableCell className="text-right text-green-600">
                      {formatCurrency(netAmount)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Calendar className="h-3 w-3 text-muted-foreground" />
                        <span className={settlementDate > new Date() ? 'text-amber-600' : 'text-green-600'}>
                          {format(settlementDate, 'dd/MM', { locale: ptBR })}
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {(!paidSales || paidSales.length === 0) && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Nenhuma venda encontrada nos últimos 30 dias
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
