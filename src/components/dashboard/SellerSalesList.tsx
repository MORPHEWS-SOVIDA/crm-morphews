import { useState, useMemo } from 'react';
import { ExternalLink, MessageCircle, ChevronLeft, ChevronRight, Loader2, Package, AlertCircle, DollarSign, TrendingUp } from 'lucide-react';
import { format, addMonths, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  useSellerSalesList, 
  SellerSaleItem,
  sellerSaleStatusLabels, 
  getSellerSaleStatusColor 
} from '@/hooks/useSellerSalesList';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';
import { formatCurrency } from '@/hooks/useSales';
import { motoboyTrackingLabels } from '@/hooks/useMotoboyTracking';
import { carrierTrackingLabels } from '@/hooks/useCarrierTracking';

// Melhor Envio tracking labels
const melhorEnvioTrackingLabels: Record<string, string> = {
  pending: 'Pendente',
  released: 'Liberado',
  posted: 'Postado',
  in_transit: 'Em Trânsito',
  delivered: 'Entregue',
  cancelled: 'Cancelado',
};

function DeliveryStatusBadge({ sale }: { sale: SellerSaleItem }) {
  // For motoboy deliveries
  if (sale.delivery_type === 'motoboy') {
    if (sale.motoboy_tracking_status) {
      const label = motoboyTrackingLabels[sale.motoboy_tracking_status as keyof typeof motoboyTrackingLabels] 
        || sale.motoboy_tracking_status;
      return <Badge variant="outline" className="text-xs">{label}</Badge>;
    }
    return <Badge variant="outline" className="text-xs">Motoboy</Badge>;
  }
  
  // For carrier deliveries - prioritize Melhor Envio tracking
  if (sale.delivery_type === 'carrier') {
    if (sale.melhor_envio_tracking_status) {
      const label = melhorEnvioTrackingLabels[sale.melhor_envio_tracking_status] 
        || sale.melhor_envio_tracking_status;
      return <Badge variant="outline" className="text-xs bg-purple-50 border-purple-200 text-purple-700">{label}</Badge>;
    }
    if (sale.carrier_tracking_status) {
      const label = carrierTrackingLabels[sale.carrier_tracking_status as keyof typeof carrierTrackingLabels] 
        || sale.carrier_tracking_status;
      return <Badge variant="outline" className="text-xs">{label}</Badge>;
    }
    return <Badge variant="outline" className="text-xs">Transportadora</Badge>;
  }
  
  // For pickup
  if (sale.delivery_type === 'pickup') {
    return <Badge variant="outline" className="text-xs">Balcão</Badge>;
  }
  
  return <Badge variant="outline" className="text-xs text-muted-foreground">-</Badge>;
}

function SaleRow({ sale }: { sale: SellerSaleItem }) {
  const isReturned = sale.status === 'returned';
  const isPaid = sale.payment_status === 'paid_now' || sale.payment_status === 'paid_in_delivery';
  
  // Build WhatsApp link
  const whatsappNumber = sale.lead_whatsapp?.replace(/\D/g, '');
  const whatsappLink = whatsappNumber 
    ? `https://wa.me/55${whatsappNumber}` 
    : null;
  
  return (
    <TableRow className={isReturned ? 'bg-red-50 dark:bg-red-950/30' : undefined}>
      {/* Romaneio + Ver */}
      <TableCell className="font-medium">
        <div className="flex items-center gap-2">
          <span className="text-sm">
            {sale.romaneio_number ? `#${sale.romaneio_number}` : '-'}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => window.open(`/vendas/${sale.id}`, '_blank')}
            title="Ver venda"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </Button>
        </div>
      </TableCell>
      
      {/* Cliente */}
      <TableCell>
        <span className="text-sm font-medium truncate max-w-[150px] block">
          {sale.lead_name}
        </span>
      </TableCell>
      
      {/* Produtos */}
      <TableCell>
        <span className="text-xs text-muted-foreground line-clamp-2 max-w-[200px]">
          {sale.products}
        </span>
      </TableCell>
      
      {/* Valor */}
      <TableCell>
        <span className="text-sm font-semibold text-primary">
          {formatCurrency(sale.total_cents)}
        </span>
      </TableCell>
      
      {/* Comissão % */}
      <TableCell>
        <Badge variant="outline" className="text-xs">
          {sale.commission_percentage.toFixed(1)}%
        </Badge>
        <span className="text-xs text-muted-foreground ml-1">
          ({formatCurrency(sale.commission_cents)})
        </span>
      </TableCell>
      
      {/* Status */}
      <TableCell>
        <Badge className={getSellerSaleStatusColor(sale.status, sale.payment_status)}>
          {sellerSaleStatusLabels[sale.status] || sale.status}
          {sale.status === 'delivered' && isPaid && ' ✓'}
        </Badge>
      </TableCell>
      
      {/* Status de Entrega */}
      <TableCell>
        <DeliveryStatusBadge sale={sale} />
      </TableCell>
      
      {/* Falar com Cliente */}
      <TableCell>
        {whatsappLink ? (
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-green-600 border-green-300 hover:bg-green-50"
            onClick={() => window.open(whatsappLink, '_blank')}
          >
            <MessageCircle className="w-4 h-4 mr-1" />
            WhatsApp
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground">-</span>
        )}
      </TableCell>
    </TableRow>
  );
}

function SalesSummary({ sales }: { sales: SellerSaleItem[] }) {
  const { totalSales, totalCommission } = useMemo(() => {
    return sales.reduce((acc, sale) => ({
      totalSales: acc.totalSales + (sale.total_cents || 0),
      totalCommission: acc.totalCommission + (sale.commission_cents || 0),
    }), { totalSales: 0, totalCommission: 0 });
  }, [sales]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
      {/* Total das Vendas */}
      <div className="flex items-center gap-4 p-4 rounded-lg bg-primary/10 border border-primary/20">
        <div className="p-3 rounded-full bg-primary/20">
          <DollarSign className="w-6 h-6 text-primary" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground font-medium">Total em Vendas</p>
          <p className="text-2xl font-bold text-primary">{formatCurrency(totalSales)}</p>
        </div>
      </div>
      
      {/* Total de Comissões */}
      <div className="flex items-center gap-4 p-4 rounded-lg bg-green-500/10 border border-green-500/20">
        <div className="p-3 rounded-full bg-green-500/20">
          <TrendingUp className="w-6 h-6 text-green-600" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground font-medium">Total em Comissões</p>
          <p className="text-2xl font-bold text-green-600">{formatCurrency(totalCommission)}</p>
        </div>
      </div>
    </div>
  );
}

export function SellerSalesList() {
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [statusFilter, setStatusFilter] = useState('all');
  const { user } = useAuth();
  const { tenantId, isLoading: isTenantLoading } = useTenant();
  
  const { data: sales, isLoading, error, isFetching, isStale } = useSellerSalesList({
    month: selectedMonth,
    statusFilter,
  });

  // Debug logs detalhados
  console.log('[SellerSalesList] Component State:', {
    userId: user?.id,
    userEmail: user?.email,
    tenantId,
    isTenantLoading,
    salesCount: sales?.length,
    isLoading,
    isFetching,
    isStale,
    error: error?.message,
    selectedMonth: format(selectedMonth, 'yyyy-MM'),
    statusFilter,
  });

  // Se tenant ainda está carregando, mostrar loading
  if (isTenantLoading) {
    return (
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Package className="w-5 h-5" />
            Minhas Vendas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <Loader2 className="w-12 h-12 text-muted-foreground mx-auto mb-3 animate-spin" />
            <p className="text-muted-foreground">
              Carregando organização...
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Se não tem user ou tenantId, mostrar mensagem apropriada
  if (!user || !tenantId) {
    return (
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Package className="w-5 h-5" />
            Minhas Vendas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <Loader2 className="w-12 h-12 text-muted-foreground mx-auto mb-3 animate-spin" />
            <p className="text-muted-foreground">
              Carregando informações do usuário...
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const handlePreviousMonth = () => {
    setSelectedMonth(prev => subMonths(prev, 1));
  };

  const handleNextMonth = () => {
    const nextMonth = addMonths(selectedMonth, 1);
    const now = new Date();
    if (nextMonth <= now) {
      setSelectedMonth(nextMonth);
    }
  };

  const isCurrentMonth = format(selectedMonth, 'yyyy-MM') === format(new Date(), 'yyyy-MM');

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Package className="w-5 h-5" />
            Minhas Vendas
          </CardTitle>
          
          <div className="flex items-center gap-3">
            {/* Month Selector */}
            <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handlePreviousMonth}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm font-medium px-3 min-w-[100px] text-center capitalize">
                {format(selectedMonth, 'MMMM yyyy', { locale: ptBR })}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleNextMonth}
                disabled={isCurrentMonth}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
            
            {/* Status Filter */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="returned">Voltou</SelectItem>
                <SelectItem value="dispatched">Despachado</SelectItem>
                <SelectItem value="separated">Separado</SelectItem>
                <SelectItem value="draft">Rascunho</SelectItem>
                <SelectItem value="delivered">Entregue</SelectItem>
                <SelectItem value="paid">Pago</SelectItem>
                <SelectItem value="cancelled">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <Package className="w-12 h-12 text-destructive mx-auto mb-3 opacity-50" />
            <p className="text-destructive font-medium mb-2">
              Erro ao carregar vendas
            </p>
            <p className="text-sm text-muted-foreground">
              {error instanceof Error ? error.message : 'Erro desconhecido'}
            </p>
          </div>
        ) : !sales || sales.length === 0 ? (
          <div className="text-center py-12">
            <Package className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
            <p className="text-muted-foreground">
              Nenhuma venda encontrada para este período
            </p>
            {/* Debug info - remover depois */}
            <p className="text-xs text-muted-foreground mt-4 opacity-50">
              Debug: user={user?.id?.slice(0, 8)}... tenant={tenantId?.slice(0, 8)}...
            </p>
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <SalesSummary sales={sales} />
            
            <div className="mb-3 text-sm text-muted-foreground">
              {sales.length} venda{sales.length !== 1 ? 's' : ''}
            </div>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">Nº Romaneio</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Produtos</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Comissão</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Entrega</TableHead>
                    <TableHead className="w-[120px]">Contato</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sales.map(sale => (
                    <SaleRow key={sale.id} sale={sale} />
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
