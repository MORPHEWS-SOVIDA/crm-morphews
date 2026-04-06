import { useState, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import {
  ArrowLeft,
  Printer,
  Filter,
  Calendar,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Users,
  Package,
  ExternalLink,
  Loader2,
  X,
  Percent,
  Download,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { useUsers } from '@/hooks/useUsers';
import { useDeliveryRegions, useShippingCarriers } from '@/hooks/useDeliveryConfig';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentTenantId } from '@/hooks/useTenant';

const STATUS_OPTIONS = [
  { value: 'all', label: 'Todos os Status' },
  { value: 'draft', label: 'Rascunho' },
  { value: 'pending_expedition', label: 'Aguardando Expedição' },
  { value: 'dispatched', label: 'Despachado' },
  { value: 'delivered', label: 'Entregue' },
  { value: 'payment_pending', label: 'Aguardando Pagamento' },
  { value: 'payment_confirmed', label: 'Pagamento Confirmado' },
  { value: 'closed', label: 'Baixado' },
  { value: 'finalized', label: 'Finalizado' },
  { value: 'cancelled', label: 'Cancelado' },
];

const DELIVERY_TYPE_OPTIONS = [
  { value: 'all', label: 'Todos os Tipos' },
  { value: 'pickup', label: 'Retirada Balcão' },
  { value: 'motoboy', label: 'Motoboy' },
  { value: 'carrier', label: 'Transportadora' },
];

const PAYMENT_METHOD_OPTIONS = [
  { value: 'all', label: 'Todos os Métodos' },
  { value: 'pix', label: 'PIX' },
  { value: 'credit_card', label: 'Cartão de Crédito' },
  { value: 'debit_card', label: 'Cartão de Débito' },
  { value: 'cash', label: 'Dinheiro' },
  { value: 'bank_transfer', label: 'Transferência' },
  { value: 'boleto', label: 'Boleto' },
];

const DATE_FILTER_OPTIONS = [
  { value: 'created_at', label: 'Data de Criação' },
  { value: 'scheduled_delivery_date', label: 'Data de Entrega Agendada' },
  { value: 'delivered_at', label: 'Data de Entrega Realizada' },
  { value: 'payment_confirmed_at', label: 'Data de Confirmação Pagamento' },
];

interface SaleWithItems {
  id: string;
  created_at: string;
  delivered_at: string | null;
  total_cents: number;
  status: string;
  payment_status: string;
  seller_user_id: string;
  seller_commission_cents: number | null;
  delivery_type: string | null;
  payment_method: string | null;
  delivery_region_id: string | null;
  shipping_carrier_id: string | null;
  lead: { name: string; whatsapp: string | null } | null;
  items: {
    id: string;
    product_name: string;
    quantity: number;
    total_cents: number;
    commission_cents: number | null;
    commission_percentage: number | null;
  }[];
}

interface SellerCommissionData {
  userId: string;
  name: string;
  totalSales: number;
  totalSalesValue: number;
  totalCommission: number;
  pendingCommission: number;
  paidCommission: number;
  sales: SaleWithItems[];
}

export default function CommissionReportPage() {
  const { isLoading: authLoading } = useAuth();
  const { tenantId } = useTenant();
  const { data: users = [] } = useUsers();
  const { data: deliveryRegions } = useDeliveryRegions();
  const { data: shippingCarriers } = useShippingCarriers();

  // Report display
  const [reportType, setReportType] = useState<'synthetic' | 'analytical'>('synthetic');
  const [expandedSellers, setExpandedSellers] = useState<Set<string>>(new Set());
  const [expandedSales, setExpandedSales] = useState<Set<string>>(new Set());
  const [filtersOpen, setFiltersOpen] = useState(true);

  // Filters — same as detalhado-super
  const today = new Date();
  const [dateField, setDateField] = useState('created_at');
  const [startDate, setStartDate] = useState(format(startOfMonth(today), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(today), 'yyyy-MM-dd'));
  const [statusFilter, setStatusFilter] = useState('all');
  const [deliveryTypeFilter, setDeliveryTypeFilter] = useState('all');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('all');
  const [regionFilter, setRegionFilter] = useState('all');
  const [carrierFilter, setCarrierFilter] = useState('all');
  const [sellerFilter, setSellerFilter] = useState('all');
  const [clientSearch, setClientSearch] = useState('');

  // Fetch sales with items
  const { data: salesData, isLoading } = useQuery({
    queryKey: ['commission-report-page', tenantId, dateField, startDate, endDate, statusFilter],
    queryFn: async () => {
      if (!tenantId) return [];

      const startISO = new Date(startDate + 'T00:00:00').toISOString();
      const endISO = new Date(endDate + 'T23:59:59.999').toISOString();

      const buildQuery = () => {
        let query = supabase
          .from('sales')
          .select(`
            id,
            created_at,
            delivered_at,
            total_cents,
            status,
            payment_status,
            seller_user_id,
            seller_commission_cents,
            delivery_type,
            payment_method,
            delivery_region_id,
            shipping_carrier_id,
            leads (name, whatsapp),
            sale_items (
              id,
              product_name,
              quantity,
              total_cents,
              commission_cents,
              commission_percentage
            )
          `)
          .eq('organization_id', tenantId)
          .neq('status', 'cancelled');

        if (statusFilter !== 'all') {
          query = query.eq('status', statusFilter as any);
        }

        query = query
          .gte(dateField, startISO)
          .lte(dateField, endISO)
          .order(dateField, { ascending: false });

        return query;
      };

      let data: any[] = [];
      let from = 0;
      const pageSize = 1000;

      while (true) {
        const { data: batch, error } = await buildQuery().range(from, from + pageSize - 1);
        if (error) throw error;
        if (!batch?.length) break;
        data = data.concat(batch);
        if (batch.length < pageSize) break;
        from += pageSize;
      }

      return (data || []).map((sale: any) => ({
        ...sale,
        lead: sale.leads,
        items: sale.sale_items || [],
      })) as SaleWithItems[];
    },
    enabled: !!tenantId,
  });

  // Get default commission percentages
  const { data: memberCommissions } = useQuery({
    queryKey: ['member-commissions', tenantId],
    queryFn: async () => {
      if (!tenantId) return {};
      const { data } = await supabase
        .from('organization_members')
        .select('user_id, commission_percentage')
        .eq('organization_id', tenantId);
      const map: Record<string, number> = {};
      (data || []).forEach((m: any) => {
        map[m.user_id] = Number(m.commission_percentage) || 0;
      });
      return map;
    },
    enabled: !!tenantId,
  });

  // Client-side filters
  const filteredSales = useMemo(() => {
    if (!salesData) return [];
    return salesData.filter((sale) => {
      if (deliveryTypeFilter !== 'all' && sale.delivery_type !== deliveryTypeFilter) return false;
      if (paymentMethodFilter !== 'all' && sale.payment_method !== paymentMethodFilter) return false;
      if (regionFilter !== 'all' && sale.delivery_region_id !== regionFilter) return false;
      if (carrierFilter !== 'all' && sale.shipping_carrier_id !== carrierFilter) return false;
      if (sellerFilter !== 'all' && sale.seller_user_id !== sellerFilter) return false;
      if (clientSearch) {
        const leadName = sale.lead?.name?.toLowerCase() || '';
        const leadWhatsapp = sale.lead?.whatsapp || '';
        if (!leadName.includes(clientSearch.toLowerCase()) && !leadWhatsapp.includes(clientSearch)) {
          return false;
        }
      }
      return true;
    });
  }, [salesData, deliveryTypeFilter, paymentMethodFilter, regionFilter, carrierFilter, sellerFilter, clientSearch]);

  // Process by seller
  const sellerData = useMemo(() => {
    const sellersMap = new Map<string, SellerCommissionData>();

    filteredSales.forEach((sale) => {
      if (!sale.seller_user_id) return;

      const seller = users.find((u) => u.user_id === sale.seller_user_id);
      const sellerName = seller
        ? `${seller.first_name} ${seller.last_name}`.trim() || 'Vendedor sem nome'
        : 'Vendedor Desconhecido';

      if (!sellersMap.has(sale.seller_user_id)) {
        sellersMap.set(sale.seller_user_id, {
          userId: sale.seller_user_id,
          name: sellerName,
          totalSales: 0,
          totalSalesValue: 0,
          totalCommission: 0,
          pendingCommission: 0,
          paidCommission: 0,
          sales: [],
        });
      }

      const sellerInfo = sellersMap.get(sale.seller_user_id)!;
      sellerInfo.totalSales++;
      sellerInfo.totalSalesValue += sale.total_cents;
      sellerInfo.sales.push(sale);

      let saleCommission = 0;
      if (sale.items && sale.items.length > 0) {
        saleCommission = sale.items.reduce(
          (sum, item) => sum + (item.commission_cents || 0),
          0
        );
      }
      if (saleCommission === 0) {
        const defaultPercentage = memberCommissions?.[sale.seller_user_id] || 0;
        saleCommission = Math.round(sale.total_cents * (defaultPercentage / 100));
      }

      sellerInfo.totalCommission += saleCommission;
      if (sale.status === 'finalized') {
        sellerInfo.paidCommission += saleCommission;
      } else {
        sellerInfo.pendingCommission += saleCommission;
      }
    });

    return Array.from(sellersMap.values()).sort(
      (a, b) => b.totalCommission - a.totalCommission
    );
  }, [filteredSales, users, memberCommissions]);

  // Totals
  const totals = useMemo(() => {
    return sellerData.reduce(
      (acc, seller) => ({
        totalSales: acc.totalSales + seller.totalSales,
        totalValue: acc.totalValue + seller.totalSalesValue,
        totalCommission: acc.totalCommission + seller.totalCommission,
        pendingCommission: acc.pendingCommission + seller.pendingCommission,
        paidCommission: acc.paidCommission + seller.paidCommission,
      }),
      { totalSales: 0, totalValue: 0, totalCommission: 0, pendingCommission: 0, paidCommission: 0 }
    );
  }, [sellerData]);

  const formatCurrency = (cents: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);

  const getStatusBadge = (status: string, paymentStatus: string) => {
    if (status === 'finalized') {
      return <Badge className="bg-purple-100 text-purple-800 border-purple-300">✓ Finalizado</Badge>;
    }
    if (status === 'delivered' && (paymentStatus === 'paid_now' || paymentStatus === 'paid_in_delivery')) {
      return <Badge className="bg-green-100 text-green-800 border-green-300">Pago</Badge>;
    }
    return <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300">Pendente</Badge>;
  };

  const openSale = (saleId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(`/vendas/${saleId}`, '_blank');
  };

  const toggleSeller = (userId: string) => {
    setExpandedSellers((prev) => {
      const next = new Set(prev);
      next.has(userId) ? next.delete(userId) : next.add(userId);
      return next;
    });
  };

  const toggleSale = (saleId: string) => {
    setExpandedSales((prev) => {
      const next = new Set(prev);
      next.has(saleId) ? next.delete(saleId) : next.add(saleId);
      return next;
    });
  };

  const clearFilters = () => {
    setDateField('created_at');
    setStartDate(format(startOfMonth(today), 'yyyy-MM-dd'));
    setEndDate(format(endOfMonth(today), 'yyyy-MM-dd'));
    setStatusFilter('all');
    setDeliveryTypeFilter('all');
    setPaymentMethodFilter('all');
    setRegionFilter('all');
    setCarrierFilter('all');
    setSellerFilter('all');
    setClientSearch('');
  };

  const handlePrint = () => window.print();

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between print:hidden">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link to="/relatorios/vendas">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <Percent className="h-6 w-6" />
                Relatório de Comissões
              </h1>
              <p className="text-muted-foreground">
                Acompanhe as comissões dos vendedores
              </p>
            </div>
          </div>

          <div className="flex gap-2 flex-wrap">
            <Tabs
              value={reportType}
              onValueChange={(v) => setReportType(v as 'synthetic' | 'analytical')}
            >
              <TabsList>
                <TabsTrigger value="synthetic">Sintético</TabsTrigger>
                <TabsTrigger value="analytical">Analítico</TabsTrigger>
              </TabsList>
            </Tabs>
            <Button variant="outline" onClick={clearFilters} className="gap-2">
              <X className="h-4 w-4" />
              Limpar Filtros
            </Button>
            <Button variant="outline" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-2" />
              Imprimir
            </Button>
          </div>
        </div>

        {/* Print Header */}
        <div className="hidden print:block text-center mb-4">
          <h1 className="text-xl font-bold">Relatório de Comissões</h1>
          <p className="text-sm text-muted-foreground">
            {startDate} a {endDate}
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-5 print:grid-cols-5">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total de Vendas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totals.totalSales}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Valor Total Vendido</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{formatCurrency(totals.totalValue)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Comissões Totais</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{formatCurrency(totals.totalCommission)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">A Pagar (Finalizadas)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{formatCurrency(totals.paidCommission)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pendentes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">{formatCurrency(totals.pendingCommission)}</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Filter className="h-5 w-5" />
                    Filtros
                  </CardTitle>
                  {filtersOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                </div>
              </CardHeader>
            </CollapsibleTrigger>

            <CollapsibleContent>
              <CardContent className="space-y-6">
                {/* Date Filters */}
                <div className="space-y-4">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Período
                  </h3>
                  <div className="grid gap-4 md:grid-cols-4">
                    <div className="space-y-2">
                      <Label>Filtrar por</Label>
                      <Select value={dateField} onValueChange={setDateField}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {DATE_FILTER_OPTIONS.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Data Início</Label>
                      <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Data Fim</Label>
                      <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                    </div>
                  </div>
                </div>

                {/* Status Filters */}
                <div className="space-y-4">
                  <h3 className="font-semibold">Status e Tipos</h3>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <Label>Status da Venda</Label>
                      <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Tipo de Entrega</Label>
                      <Select value={deliveryTypeFilter} onValueChange={setDeliveryTypeFilter}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {DELIVERY_TYPE_OPTIONS.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Método de Pagamento</Label>
                      <Select value={paymentMethodFilter} onValueChange={setPaymentMethodFilter}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {PAYMENT_METHOD_OPTIONS.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Entity Filters */}
                <div className="space-y-4">
                  <h3 className="font-semibold">Responsáveis e Regiões</h3>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <Label>Vendedor</Label>
                      <Select value={sellerFilter} onValueChange={setSellerFilter}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos os Vendedores</SelectItem>
                          {users.map((user) => (
                            <SelectItem key={user.user_id} value={user.user_id}>
                              {user.first_name} {user.last_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Região de Entrega</Label>
                      <Select value={regionFilter} onValueChange={setRegionFilter}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todas as Regiões</SelectItem>
                          {(deliveryRegions || []).map((r: any) => (
                            <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Transportadora</Label>
                      <Select value={carrierFilter} onValueChange={setCarrierFilter}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todas as Transportadoras</SelectItem>
                          {(shippingCarriers || []).map((c: any) => (
                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Client search */}
                <div className="space-y-4">
                  <h3 className="font-semibold">Busca</h3>
                  <div className="space-y-2">
                    <Label>Cliente (Nome ou WhatsApp)</Label>
                    <Input
                      placeholder="Buscar cliente..."
                      value={clientSearch}
                      onChange={(e) => setClientSearch(e.target.value)}
                    />
                  </div>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Content */}
        {sellerData.length === 0 ? (
          <Card className="p-8 text-center">
            <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium">Nenhuma venda encontrada</h3>
            <p className="text-muted-foreground">Não há vendas para os filtros selecionados.</p>
          </Card>
        ) : reportType === 'synthetic' ? (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vendedor</TableHead>
                  <TableHead className="text-center">Vendas</TableHead>
                  <TableHead className="text-right">Valor Vendido</TableHead>
                  <TableHead className="text-right">Comissão Total</TableHead>
                  <TableHead className="text-right">A Pagar</TableHead>
                  <TableHead className="text-right">Pendente</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sellerData.map((seller) => (
                  <TableRow key={seller.userId}>
                    <TableCell className="font-medium">{seller.name}</TableCell>
                    <TableCell className="text-center">{seller.totalSales}</TableCell>
                    <TableCell className="text-right">{formatCurrency(seller.totalSalesValue)}</TableCell>
                    <TableCell className="text-right font-medium text-green-600">{formatCurrency(seller.totalCommission)}</TableCell>
                    <TableCell className="text-right text-blue-600">{formatCurrency(seller.paidCommission)}</TableCell>
                    <TableCell className="text-right text-amber-600">{formatCurrency(seller.pendingCommission)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/50 font-bold">
                  <TableCell>TOTAL</TableCell>
                  <TableCell className="text-center">{totals.totalSales}</TableCell>
                  <TableCell className="text-right">{formatCurrency(totals.totalValue)}</TableCell>
                  <TableCell className="text-right text-green-600">{formatCurrency(totals.totalCommission)}</TableCell>
                  <TableCell className="text-right text-blue-600">{formatCurrency(totals.paidCommission)}</TableCell>
                  <TableCell className="text-right text-amber-600">{formatCurrency(totals.pendingCommission)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </Card>
        ) : (
          <div className="space-y-4">
            {sellerData.map((seller) => (
              <Card key={seller.userId}>
                <Collapsible
                  open={expandedSellers.has(seller.userId)}
                  onOpenChange={() => toggleSeller(seller.userId)}
                >
                  <CollapsibleTrigger className="w-full">
                    <CardHeader className="flex flex-row items-center justify-between py-4">
                      <div className="flex items-center gap-3">
                        {expandedSellers.has(seller.userId) ? (
                          <ChevronDown className="w-5 h-5" />
                        ) : (
                          <ChevronRight className="w-5 h-5" />
                        )}
                        <div className="text-left">
                          <h3 className="font-semibold">{seller.name}</h3>
                          <p className="text-sm text-muted-foreground">
                            {seller.totalSales} vendas • {formatCurrency(seller.totalSalesValue)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-green-600">{formatCurrency(seller.totalCommission)}</div>
                        <p className="text-xs text-muted-foreground">A pagar: {formatCurrency(seller.paidCommission)}</p>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <CardContent className="pt-0">
                      <div className="space-y-2">
                        {seller.sales.map((sale) => {
                          const saleCommission = sale.items.reduce(
                            (sum, item) => sum + (item.commission_cents || 0),
                            0
                          ) || Math.round(
                            sale.total_cents * ((memberCommissions?.[sale.seller_user_id] || 0) / 100)
                          );

                          return (
                            <Collapsible
                              key={sale.id}
                              open={expandedSales.has(sale.id)}
                              onOpenChange={() => toggleSale(sale.id)}
                            >
                              <CollapsibleTrigger className="w-full">
                                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                                  <div className="flex items-center gap-3">
                                    {expandedSales.has(sale.id) ? (
                                      <ChevronDown className="w-4 h-4" />
                                    ) : (
                                      <ChevronRight className="w-4 h-4" />
                                    )}
                                    <div className="text-left flex items-center gap-2">
                                      <button
                                        onClick={(e) => openSale(sale.id, e)}
                                        className="font-medium text-primary hover:underline flex items-center gap-1"
                                      >
                                        {sale.lead?.name || 'Cliente'}
                                        <ExternalLink className="w-3 h-3" />
                                      </button>
                                      <span className="text-sm text-muted-foreground">
                                        {format(parseISO(sale.created_at), 'dd/MM/yyyy')}
                                      </span>
                                    </div>
                                    {getStatusBadge(sale.status, sale.payment_status)}
                                  </div>
                                  <div className="text-right">
                                    <span className="font-medium">{formatCurrency(sale.total_cents)}</span>
                                    <span className="text-sm text-green-600 ml-4">
                                      Comissão: {formatCurrency(saleCommission)}
                                    </span>
                                  </div>
                                </div>
                              </CollapsibleTrigger>

                              <CollapsibleContent>
                                <div className="ml-8 mt-2 space-y-1">
                                  {sale.items.map((item) => (
                                    <div
                                      key={item.id}
                                      className="flex items-center justify-between p-2 rounded bg-background border text-sm"
                                    >
                                      <div className="flex items-center gap-2">
                                        <Package className="w-4 h-4 text-muted-foreground" />
                                        <span>{item.quantity}x {item.product_name}</span>
                                      </div>
                                      <div className="flex items-center gap-4">
                                        <span>{formatCurrency(item.total_cents)}</span>
                                        <span className="text-green-600 min-w-[100px] text-right">
                                          {item.commission_cents
                                            ? formatCurrency(item.commission_cents)
                                            : item.commission_percentage
                                            ? `${item.commission_percentage}%`
                                            : '-'}
                                        </span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </CollapsibleContent>
                            </Collapsible>
                          );
                        })}
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            ))}

            {/* Totals Card */}
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-lg">TOTAL GERAL</span>
                  <div className="flex items-center gap-8">
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Vendas</p>
                      <p className="font-bold">{totals.totalSales}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Valor Vendido</p>
                      <p className="font-bold text-primary">{formatCurrency(totals.totalValue)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">A Pagar</p>
                      <p className="font-bold text-green-600">{formatCurrency(totals.paidCommission)}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </Layout>
  );
}
