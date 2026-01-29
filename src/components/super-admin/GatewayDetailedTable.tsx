import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Download, 
  ExternalLink, 
  Eye,
  DollarSign,
  CreditCard,
  Building2,
  UserCheck,
  Factory,
  Share2,
  Percent,
  TrendingUp,
  AlertTriangle
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface DetailedSaleData {
  id: string;
  order_number: string;
  total_cents: number;
  subtotal_cents: number;
  interest_cents: number;
  gateway_transaction_id: string | null;
  gateway_fee_cents: number;
  gateway_net_cents: number;
  payment_method: string;
  payment_installments: number;
  status: string;
  created_at: string;
  organization_name: string | null;
  lead_name: string | null;
  source: 'Loja' | 'Landing' | 'Checkout';
  splits: {
    affiliate: number;
    coproducer: number;
    industry: number;
    factory: number;
    platform_fee: number;
    tenant: number;
  };
}

// Pagar.me constants - Super Admin can configure these in settings
const PAGARME_MERCHANT_ID = 'merch_WrgRKV8tGubALlPe';
const PAGARME_ACCOUNT_ID = 'acc_40nvZdeuVSn03aQB';

// Platform gateway fee (4.99% + R$1.00 for card)
const PLATFORM_FEE_PERCENTAGE = 4.99;
const PLATFORM_FEE_FIXED_CENTS = 100;

// Estimated anticipation rate (monthly)
const ANTICIPATION_RATE_MONTHLY = 1.5; // 1.5% per month estimate

const formatCurrency = (cents: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
};

const getPaymentMethodLabel = (method: string): string => {
  const labels: Record<string, string> = {
    pix: 'PIX',
    credit_card: 'Cartão',
    boleto: 'Boleto',
  };
  return labels[method] || method;
};

const buildPagarmeUrl = (transactionId: string | null): string | null => {
  if (!transactionId) return null;
  
  // Handle different ID formats
  if (transactionId.startsWith('ch_')) {
    return `https://dash.pagar.me/${PAGARME_MERCHANT_ID}/${PAGARME_ACCOUNT_ID}/charges/${transactionId}`;
  }
  if (transactionId.startsWith('or_')) {
    return `https://dash.pagar.me/${PAGARME_MERCHANT_ID}/${PAGARME_ACCOUNT_ID}/orders/${transactionId}`;
  }
  return null;
};

interface GatewayDetailedTableProps {
  onViewSale: (saleId: string) => void;
}

export function GatewayDetailedTable({ onViewSale }: GatewayDetailedTableProps) {
  const [isExporting, setIsExporting] = useState(false);

  // Fetch detailed sales with splits
  const { data: detailedSales, isLoading } = useQuery({
    queryKey: ['detailed-gateway-sales'],
    queryFn: async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      // Get e-commerce orders with sale info
      const { data: orders, error: ordersError } = await supabase
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
          organization:organizations(name)
        `)
        .gte('created_at', thirtyDaysAgo.toISOString())
        .order('created_at', { ascending: false });

      if (ordersError) throw ordersError;
      if (!orders || orders.length === 0) return [];

      // Get sales for these orders
      const saleIds = orders.map(o => o.sale_id).filter(Boolean) as string[];
      
      const { data: salesData, error: salesError } = await supabase
        .from('sales')
        .select(`
          id,
          total_cents,
          subtotal_cents,
          gateway_transaction_id,
          gateway_fee_cents,
          gateway_net_cents,
          payment_method,
          payment_installments,
          lead:leads(name)
        `)
        .in('id', saleIds);

      if (salesError) throw salesError;

      // Get splits for these sales
      const { data: splitsData, error: splitsError } = await supabase
        .from('sale_splits')
        .select('sale_id, split_type, net_amount_cents')
        .in('sale_id', saleIds);

      if (splitsError) throw splitsError;

      // Group splits by sale
      const splitsBySale: Record<string, { 
        affiliate: number; 
        coproducer: number; 
        industry: number; 
        factory: number;
        platform_fee: number;
        tenant: number;
      }> = {};

      splitsData?.forEach(split => {
        if (!splitsBySale[split.sale_id]) {
          splitsBySale[split.sale_id] = { 
            affiliate: 0, 
            coproducer: 0, 
            industry: 0, 
            factory: 0,
            platform_fee: 0,
            tenant: 0
          };
        }
        const type = split.split_type as keyof typeof splitsBySale[string];
        if (splitsBySale[split.sale_id][type] !== undefined) {
          splitsBySale[split.sale_id][type] += split.net_amount_cents || 0;
        }
      });

      // Map sales data
      const salesMap = new Map(salesData?.map(s => [s.id, s]));

      // Combine data
      return orders.map(order => {
        const sale = order.sale_id ? salesMap.get(order.sale_id) : null;
        const splits = order.sale_id ? (splitsBySale[order.sale_id] || { 
          affiliate: 0, coproducer: 0, industry: 0, factory: 0, platform_fee: 0, tenant: 0 
        }) : { affiliate: 0, coproducer: 0, industry: 0, factory: 0, platform_fee: 0, tenant: 0 };

        const subtotalCents = sale?.subtotal_cents || order.total_cents;
        const totalCents = sale?.total_cents || order.total_cents;
        const interestCents = Math.max(0, totalCents - subtotalCents);

        // Determine source
        let source: 'Loja' | 'Landing' | 'Checkout' = 'Checkout';
        if (order.storefront_id) source = 'Loja';
        else if (order.landing_page_id || order.source === 'landing_page') source = 'Landing';

        return {
          id: order.sale_id || order.id,
          order_number: order.order_number,
          total_cents: totalCents,
          subtotal_cents: subtotalCents,
          interest_cents: interestCents,
          gateway_transaction_id: sale?.gateway_transaction_id || null,
          gateway_fee_cents: sale?.gateway_fee_cents || 0,
          gateway_net_cents: sale?.gateway_net_cents || 0,
          payment_method: sale?.payment_method || order.payment_method,
          payment_installments: sale?.payment_installments || 1,
          status: order.status,
          created_at: order.created_at,
          organization_name: order.organization?.name || null,
          lead_name: sale?.lead?.name || null,
          source,
          splits,
        } as DetailedSaleData;
      });
    },
  });

  // Calculate totals
  const totals = useMemo(() => {
    if (!detailedSales) return null;
    
    const paidSales = detailedSales.filter(s => 
      ['paid', 'approved', 'payment_confirmed', 'delivered', 'dispatched'].includes(s.status)
    );

    return paidSales.reduce((acc, sale) => {
      // Calculate estimated gateway processing fee (0.88% of total + R$ 0.09 per transaction)
      const estimatedGatewayFee = Math.round(sale.total_cents * 0.0088) + 9;
      
      // Calculate estimated anticipation cost for card (D+30 -> D+2 = 28 days)
      let anticipationCost = 0;
      if (sale.payment_method === 'credit_card') {
        const daysAnticipated = 28;
        const dailyRate = ANTICIPATION_RATE_MONTHLY / 30;
        anticipationCost = Math.round(sale.total_cents * (dailyRate * daysAnticipated / 100));
      }

      return {
        totalValue: acc.totalValue + sale.total_cents,
        totalSubtotal: acc.totalSubtotal + sale.subtotal_cents,
        totalInterest: acc.totalInterest + sale.interest_cents,
        affiliateCost: acc.affiliateCost + sale.splits.affiliate,
        coproducerCost: acc.coproducerCost + sale.splits.coproducer,
        industryCost: acc.industryCost + sale.splits.industry,
        factoryCost: acc.factoryCost + sale.splits.factory,
        platformRevenue: acc.platformRevenue + sale.splits.platform_fee,
        tenantPayout: acc.tenantPayout + sale.splits.tenant,
        gatewayFee: acc.gatewayFee + (sale.gateway_fee_cents || estimatedGatewayFee),
        anticipationCost: acc.anticipationCost + anticipationCost,
        count: acc.count + 1,
      };
    }, {
      totalValue: 0,
      totalSubtotal: 0,
      totalInterest: 0,
      affiliateCost: 0,
      coproducerCost: 0,
      industryCost: 0,
      factoryCost: 0,
      platformRevenue: 0,
      tenantPayout: 0,
      gatewayFee: 0,
      anticipationCost: 0,
      count: 0,
    });
  }, [detailedSales]);

  // Export to CSV
  const handleExportCSV = () => {
    if (!detailedSales) return;
    setIsExporting(true);

    const headers = [
      'Pedido',
      'Data',
      'Status',
      'Origem',
      'Tenant',
      'Cliente',
      'Método',
      'Parcelas',
      'Valor Autorizado',
      'Subtotal (Base)',
      'Juros Parcelamento',
      'Custo Gateway Est.',
      'Custo Antecipação Est.',
      'Custo Afiliado',
      'Custo Co-produtor',
      'Custo Indústria',
      'Custo Fábrica',
      'Taxa Plataforma',
      'Repasse Lojista',
      'Ganho Gateway (Plataforma)',
      'Lucro Juros',
      'Lucro Total Plataforma',
      'ID Transação Gateway',
      'Link Pagar.me'
    ];

    const rows = detailedSales.map(sale => {
      const estimatedGatewayFee = Math.round(sale.total_cents * 0.0088) + 9;
      let anticipationCost = 0;
      if (sale.payment_method === 'credit_card') {
        const daysAnticipated = 28;
        const dailyRate = ANTICIPATION_RATE_MONTHLY / 30;
        anticipationCost = Math.round(sale.total_cents * (dailyRate * daysAnticipated / 100));
      }
      const gatewayFee = sale.gateway_fee_cents || estimatedGatewayFee;
      const platformGain = sale.splits.platform_fee;
      const interestProfit = sale.interest_cents;
      const totalPlatformProfit = platformGain + interestProfit;

      return [
        sale.order_number,
        format(new Date(sale.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR }),
        sale.status,
        sale.source,
        sale.organization_name || '-',
        sale.lead_name || '-',
        getPaymentMethodLabel(sale.payment_method),
        sale.payment_installments,
        (sale.total_cents / 100).toFixed(2).replace('.', ','),
        (sale.subtotal_cents / 100).toFixed(2).replace('.', ','),
        (sale.interest_cents / 100).toFixed(2).replace('.', ','),
        (gatewayFee / 100).toFixed(2).replace('.', ','),
        (anticipationCost / 100).toFixed(2).replace('.', ','),
        (sale.splits.affiliate / 100).toFixed(2).replace('.', ','),
        (sale.splits.coproducer / 100).toFixed(2).replace('.', ','),
        (sale.splits.industry / 100).toFixed(2).replace('.', ','),
        (sale.splits.factory / 100).toFixed(2).replace('.', ','),
        (platformGain / 100).toFixed(2).replace('.', ','),
        (sale.splits.tenant / 100).toFixed(2).replace('.', ','),
        (platformGain / 100).toFixed(2).replace('.', ','),
        (interestProfit / 100).toFixed(2).replace('.', ','),
        (totalPlatformProfit / 100).toFixed(2).replace('.', ','),
        sale.gateway_transaction_id || '-',
        buildPagarmeUrl(sale.gateway_transaction_id) || '-'
      ];
    });

    const csvContent = [
      headers.join(';'),
      ...rows.map(row => row.join(';'))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `gateway-vendas-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();

    setIsExporting(false);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[400px] w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards with Gateway Data */}
      {totals && totals.count > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <Card className="border-l-4 border-l-blue-500">
            <CardHeader className="pb-1">
              <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <DollarSign className="h-3 w-3" />
                Valor Autorizado
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-lg font-bold">{formatCurrency(totals.totalValue)}</div>
              <p className="text-xs text-muted-foreground">{totals.count} vendas pagas</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-red-500">
            <CardHeader className="pb-1">
              <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <CreditCard className="h-3 w-3" />
                Processamento Gateway
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-lg font-bold text-red-600">-{formatCurrency(totals.gatewayFee)}</div>
              <p className="text-xs text-muted-foreground">~0.88% + R$ 0,09</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-amber-500">
            <CardHeader className="pb-1">
              <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Antecipação Est.
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-lg font-bold text-amber-600">-{formatCurrency(totals.anticipationCost)}</div>
              <p className="text-xs text-muted-foreground">~1.5%/mês (D+30→D+2)</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-purple-500">
            <CardHeader className="pb-1">
              <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Building2 className="h-3 w-3" />
                Ganho Gateway
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-lg font-bold text-purple-600">{formatCurrency(totals.platformRevenue)}</div>
              <p className="text-xs text-muted-foreground">Taxa plataforma (4.99%)</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-emerald-500">
            <CardHeader className="pb-1">
              <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Percent className="h-3 w-3" />
                Lucro Juros
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-lg font-bold text-emerald-600">{formatCurrency(totals.totalInterest)}</div>
              <p className="text-xs text-muted-foreground">Parcelamento cartão</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-green-500">
            <CardHeader className="pb-1">
              <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                Lucro Total
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-lg font-bold text-green-600">
                {formatCurrency(totals.platformRevenue + totals.totalInterest - totals.gatewayFee - totals.anticipationCost)}
              </div>
              <p className="text-xs text-muted-foreground">Gateway + Juros - Custos</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Partner Costs Summary */}
      {totals && totals.count > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <UserCheck className="h-3 w-3 text-green-500" />
                Custo Afiliados
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-lg font-bold text-green-600">{formatCurrency(totals.affiliateCost)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Share2 className="h-3 w-3 text-cyan-500" />
                Custo Co-produtores
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-lg font-bold text-cyan-600">{formatCurrency(totals.coproducerCost)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Factory className="h-3 w-3 text-orange-500" />
                Custo Indústrias
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-lg font-bold text-orange-600">{formatCurrency(totals.industryCost)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Factory className="h-3 w-3 text-amber-600" />
                Custo Fábricas
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-lg font-bold text-amber-600">{formatCurrency(totals.factoryCost)}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Detailed Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Detalhamento Financeiro por Venda
              </CardTitle>
              <CardDescription>
                Dados completos de custos, splits e lucros — inclui link para Pagar.me
              </CardDescription>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleExportCSV}
              disabled={isExporting || !detailedSales?.length}
            >
              <Download className="h-4 w-4 mr-2" />
              Exportar CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[600px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 bg-background">Pedido</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead>Método</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right">Juros</TableHead>
                  <TableHead className="text-right text-red-600">Gateway</TableHead>
                  <TableHead className="text-right text-green-600">Afiliado</TableHead>
                  <TableHead className="text-right text-cyan-600">Co-prod</TableHead>
                  <TableHead className="text-right text-orange-600">Indústria</TableHead>
                  <TableHead className="text-right text-amber-600">Fábrica</TableHead>
                  <TableHead className="text-right text-purple-600">Plataforma</TableHead>
                  <TableHead className="text-right font-bold text-green-700">Lucro</TableHead>
                  <TableHead>Pagar.me</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detailedSales?.map((sale) => {
                  const estimatedGatewayFee = Math.round(sale.total_cents * 0.0088) + 9;
                  const gatewayFee = sale.gateway_fee_cents || estimatedGatewayFee;
                  const platformProfit = sale.splits.platform_fee + sale.interest_cents;
                  const pagarmeUrl = buildPagarmeUrl(sale.gateway_transaction_id);

                  return (
                    <TableRow key={sale.id}>
                      <TableCell className="font-mono text-sm sticky left-0 bg-background">
                        {sale.order_number}
                      </TableCell>
                      <TableCell className="text-sm whitespace-nowrap">
                        {format(new Date(sale.created_at), 'dd/MM HH:mm', { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-xs ${
                          sale.source === 'Loja' ? 'bg-blue-100 text-blue-700' :
                          sale.source === 'Landing' ? 'bg-green-100 text-green-700' :
                          'bg-purple-100 text-purple-700'
                        }`}>
                          {sale.source}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {getPaymentMethodLabel(sale.payment_method)}
                          {sale.payment_installments > 1 && ` ${sale.payment_installments}x`}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(sale.total_cents)}
                      </TableCell>
                      <TableCell className="text-right text-emerald-600">
                        {sale.interest_cents > 0 ? formatCurrency(sale.interest_cents) : '-'}
                      </TableCell>
                      <TableCell className="text-right text-red-600 text-xs">
                        -{formatCurrency(gatewayFee)}
                      </TableCell>
                      <TableCell className="text-right text-green-600 text-xs">
                        {sale.splits.affiliate > 0 ? formatCurrency(sale.splits.affiliate) : '-'}
                      </TableCell>
                      <TableCell className="text-right text-cyan-600 text-xs">
                        {sale.splits.coproducer > 0 ? formatCurrency(sale.splits.coproducer) : '-'}
                      </TableCell>
                      <TableCell className="text-right text-orange-600 text-xs">
                        {sale.splits.industry > 0 ? formatCurrency(sale.splits.industry) : '-'}
                      </TableCell>
                      <TableCell className="text-right text-amber-600 text-xs">
                        {sale.splits.factory > 0 ? formatCurrency(sale.splits.factory) : '-'}
                      </TableCell>
                      <TableCell className="text-right text-purple-600 font-medium">
                        {formatCurrency(sale.splits.platform_fee)}
                      </TableCell>
                      <TableCell className="text-right font-bold text-green-700">
                        {formatCurrency(platformProfit)}
                      </TableCell>
                      <TableCell>
                        {pagarmeUrl ? (
                          <a 
                            href={pagarmeUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                          >
                            <ExternalLink className="h-3 w-3" />
                            Ver
                          </a>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => onViewSale(sale.id)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {(!detailedSales || detailedSales.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={15} className="text-center text-muted-foreground py-8">
                      Nenhuma venda encontrada nos últimos 30 dias
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
