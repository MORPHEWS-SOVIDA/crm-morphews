import { useState, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  FileSpreadsheet,
  Filter,
  ChevronDown,
  ChevronUp,
  Calendar,
  Loader2,
  Download,
  Printer,
  Check,
  AlertCircle,
  PackageCheck,
  UserCheck,
  X,
  ArrowLeft,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useSales, Sale, formatCurrency } from '@/hooks/useSales';
import { useUsers } from '@/hooks/useUsers';
import { useDeliveryRegions, useShippingCarriers } from '@/hooks/useDeliveryConfig';
import { useSaleClosingStatus } from '@/hooks/useSaleClosingStatus';
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

const DELIVERY_TYPE_LABELS: Record<string, string> = {
  pickup: 'Retirada Balcão',
  motoboy: 'Motoboy',
  carrier: 'Transportadora',
};

function escapeCSVField(value: any): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export default function SalesDetailedReportPage() {
  const { isLoading: authLoading, profile } = useAuth();
  const { data: tenantId, isLoading: tenantLoading } = useCurrentTenantId();
  const organizationId = profile?.organization_id ?? tenantId ?? null;

  const [filtersOpen, setFiltersOpen] = useState(true);
  
  // Date filters
  const today = new Date();
  const [dateField, setDateField] = useState('created_at');
  const [startDate, setStartDate] = useState(format(startOfMonth(today), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(today), 'yyyy-MM-dd'));
  
  // Status filters
  const [statusFilter, setStatusFilter] = useState('all');
  const [deliveryTypeFilter, setDeliveryTypeFilter] = useState('all');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('all');
  
  // Entity filters
  const [regionFilter, setRegionFilter] = useState('all');
  const [carrierFilter, setCarrierFilter] = useState('all');
  const [sellerFilter, setSellerFilter] = useState('all');
  
  // Search filters
  const [clientSearch, setClientSearch] = useState('');

  // Fetch data
  const { data: sales, isLoading: salesLoading } = useSales();
  const { data: users } = useUsers();
  const { data: deliveryRegions } = useDeliveryRegions();
  const { data: shippingCarriers } = useShippingCarriers();

  // Filter sales
  const filteredSales = useMemo(() => {
    if (!sales) return [];
    
    return sales.filter((sale) => {
      // Date filter
      const dateValue = sale[dateField as keyof typeof sale];
      if (dateValue && startDate && endDate) {
        const saleDate = typeof dateValue === 'string' ? parseISO(dateValue) : null;
        if (saleDate) {
          const start = parseISO(startDate);
          const end = parseISO(endDate);
          end.setHours(23, 59, 59, 999);
          if (saleDate < start || saleDate > end) return false;
        }
      }
      
      // Status filters
      if (statusFilter !== 'all' && sale.status !== statusFilter) return false;
      if (deliveryTypeFilter !== 'all' && sale.delivery_type !== deliveryTypeFilter) return false;
      if (paymentMethodFilter !== 'all' && sale.payment_method !== paymentMethodFilter) return false;
      
      // Entity filters
      if (regionFilter !== 'all' && sale.delivery_region_id !== regionFilter) return false;
      if (carrierFilter !== 'all' && sale.shipping_carrier_id !== carrierFilter) return false;
      if (sellerFilter !== 'all' && sale.seller_user_id !== sellerFilter) return false;
      
      // Search filters
      if (clientSearch) {
        const leadName = sale.lead?.name?.toLowerCase() || '';
        const leadWhatsapp = sale.lead?.whatsapp || '';
        if (!leadName.includes(clientSearch.toLowerCase()) && !leadWhatsapp.includes(clientSearch)) {
          return false;
        }
      }
      
      return true;
    });
  }, [
    sales, dateField, startDate, endDate,
    statusFilter, deliveryTypeFilter, paymentMethodFilter,
    regionFilter, carrierFilter, sellerFilter,
    clientSearch
  ]);

  // Get sale IDs for closing status lookup
  const saleIds = useMemo(() => filteredSales.map(s => s.id), [filteredSales]);
  const { data: closingStatus } = useSaleClosingStatus(saleIds);

  // Create user lookup map
  const userMap = useMemo(() => {
    const map: Record<string, string> = {};
    users?.forEach(u => {
      map[u.user_id] = `${u.first_name} ${u.last_name}`.trim();
    });
    return map;
  }, [users]);

  // Helper to get seller name
  const getSellerName = (sale: Sale) => {
    if (sale.seller_profile) {
      return `${sale.seller_profile.first_name} ${sale.seller_profile.last_name}`.trim();
    }
    if (sale.seller_user_id && userMap[sale.seller_user_id]) {
      return userMap[sale.seller_user_id];
    }
    return '—';
  };

  // Calculate commission info
  const getCommissionInfo = (sale: Sale) => {
    const saleCast = sale as any;
    const cents = saleCast.seller_commission_cents || 0;
    const percentage = saleCast.seller_commission_percentage || 0;
    
    return {
      cents,
      percentage,
      formatted: cents > 0 ? formatCurrency(cents) : '—',
      percentageFormatted: percentage > 0 ? `${percentage.toFixed(2)}%` : '—',
    };
  };

  // Calculate totals
  const totals = useMemo(() => {
    return filteredSales.reduce((acc, sale) => {
      const saleCast = sale as any;
      acc.totalValue += sale.total_cents;
      acc.totalShipping += sale.shipping_cost_cents;
      acc.totalCommission += saleCast.seller_commission_cents || 0;
      return acc;
    }, {
      totalValue: 0,
      totalShipping: 0,
      totalCommission: 0,
    });
  }, [filteredSales]);

  // Clear filters
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

  // Export to CSV
  const handleExportCSV = () => {
    const headers = [
      'Número da Venda',
      'Data da Venda',
      'Nome do Cliente',
      'WhatsApp do Cliente',
      'Status de Pago',
      'Data de Pago',
      'Forma de Pagamento',
      'Comprovante Anexado',
      'Status de Entregue',
      'Data de Entregue',
      'Vendedor',
      'Método de Entrega',
      'Valor Frete',
      'Comissão Vendedor (%)',
      'Comissão Vendedor (R$)',
      'Valor Total',
      'Foi Baixado?',
      'Confirmado Financeiro?',
      'Confirmado Thiago?',
    ];

    const rows = filteredSales.map(sale => {
      const saleCast = sale as any;
      const commission = getCommissionInfo(sale);
      const paymentMethod = saleCast.payment_method_data?.name || saleCast.payment_method || '—';
      const status = closingStatus?.[sale.id];
      const isPaid = sale.payment_status === 'paid_now';
      const isDelivered = sale.status === 'delivered';
      
      return [
        sale.romaneio_number || '—',
        format(parseISO(sale.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR }),
        sale.lead?.name || '—',
        sale.lead?.whatsapp || '—',
        isPaid ? 'Sim' : 'Não',
        sale.payment_confirmed_at ? format(parseISO(sale.payment_confirmed_at), 'dd/MM/yyyy', { locale: ptBR }) : '—',
        paymentMethod,
        sale.payment_proof_url ? 'Sim' : 'Não',
        isDelivered ? 'Sim' : 'Não',
        sale.delivered_at ? format(parseISO(sale.delivered_at), 'dd/MM/yyyy', { locale: ptBR }) : '—',
        getSellerName(sale),
        DELIVERY_TYPE_LABELS[sale.delivery_type] || sale.delivery_type,
        (sale.shipping_cost_cents / 100).toFixed(2).replace('.', ','),
        commission.percentage.toFixed(2).replace('.', ','),
        (commission.cents / 100).toFixed(2).replace('.', ','),
        (sale.total_cents / 100).toFixed(2).replace('.', ','),
        status?.wasClosed ? 'Sim' : 'Não',
        status?.confirmedByFinanceiro ? 'Sim' : 'Não',
        status?.confirmedByThiago ? 'Sim' : 'Não',
      ].map(escapeCSVField);
    });

    const csvContent = '\uFEFF' + [
      headers.join(';'),
      ...rows.map(row => row.join(';')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `relatorio_detalhado_${format(new Date(), 'yyyy-MM-dd_HHmm')}.csv`;
    link.click();
  };

  const handlePrint = () => window.print();

  // Loading states
  if (authLoading || tenantLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (!organizationId) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px] px-4">
          <div className="text-center max-w-md">
            <h1 className="text-lg font-semibold text-foreground">Sem empresa vinculada</h1>
            <p className="text-sm text-muted-foreground mt-2">
              Seu usuário não está vinculado a nenhuma organização.
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  if (salesLoading) {
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
                <FileSpreadsheet className="h-6 w-6" />
                Relatório Detalhado Super
              </h1>
              <p className="text-muted-foreground">
                {filteredSales.length} vendas selecionadas
              </p>
            </div>
          </div>
          
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={clearFilters} className="gap-2">
              <X className="h-4 w-4" />
              Limpar Filtros
            </Button>
            <Button variant="outline" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-2" />
              Imprimir
            </Button>
            <Button onClick={handleExportCSV}>
              <Download className="h-4 w-4 mr-2" />
              Exportar CSV
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 print:hidden">
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Total em Vendas</p>
              <p className="text-2xl font-bold text-primary">{formatCurrency(totals.totalValue)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Total Frete</p>
              <p className="text-2xl font-bold">{formatCurrency(totals.totalShipping)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Total Comissões</p>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(totals.totalCommission)}</p>
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
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DATE_FILTER_OPTIONS.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Data Início</Label>
                      <Input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Data Fim</Label>
                      <Input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                      />
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
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Tipo de Entrega</Label>
                      <Select value={deliveryTypeFilter} onValueChange={setDeliveryTypeFilter}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DELIVERY_TYPE_OPTIONS.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Método de Pagamento</Label>
                      <Select value={paymentMethodFilter} onValueChange={setPaymentMethodFilter}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PAYMENT_METHOD_OPTIONS.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
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
                        <SelectTrigger>
                          <SelectValue placeholder="Todos os Vendedores" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos os Vendedores</SelectItem>
                          {users?.map(u => (
                            <SelectItem key={u.user_id} value={u.user_id}>
                              {u.first_name} {u.last_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Região de Entrega</Label>
                      <Select value={regionFilter} onValueChange={setRegionFilter}>
                        <SelectTrigger>
                          <SelectValue placeholder="Todas as Regiões" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todas as Regiões</SelectItem>
                          {deliveryRegions?.map(r => (
                            <SelectItem key={r.id} value={r.id}>
                              {r.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Transportadora</Label>
                      <Select value={carrierFilter} onValueChange={setCarrierFilter}>
                        <SelectTrigger>
                          <SelectValue placeholder="Todas as Transportadoras" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todas as Transportadoras</SelectItem>
                          {shippingCarriers?.map(c => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Search */}
                <div className="space-y-4">
                  <h3 className="font-semibold">Busca</h3>
                  <div className="max-w-md">
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

        {/* Data Table */}
        <Card>
          <CardContent className="p-0">
            <ScrollArea className="h-[600px] print:h-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="whitespace-nowrap">Nº Venda</TableHead>
                    <TableHead className="whitespace-nowrap">Data Venda</TableHead>
                    <TableHead className="whitespace-nowrap">Cliente</TableHead>
                    <TableHead className="whitespace-nowrap">WhatsApp</TableHead>
                    <TableHead className="whitespace-nowrap">Pago?</TableHead>
                    <TableHead className="whitespace-nowrap">Data Pago</TableHead>
                    <TableHead className="whitespace-nowrap">Forma Pgto</TableHead>
                    <TableHead className="whitespace-nowrap">Comprovante?</TableHead>
                    <TableHead className="whitespace-nowrap">Entregue?</TableHead>
                    <TableHead className="whitespace-nowrap">Data Entrega</TableHead>
                    <TableHead className="whitespace-nowrap">Vendedor</TableHead>
                    <TableHead className="whitespace-nowrap">Entrega</TableHead>
                    <TableHead className="whitespace-nowrap text-right">Frete</TableHead>
                    <TableHead className="whitespace-nowrap text-right">Comissão %</TableHead>
                    <TableHead className="whitespace-nowrap text-right">Comissão R$</TableHead>
                    <TableHead className="whitespace-nowrap text-right">Valor Total</TableHead>
                    <TableHead className="whitespace-nowrap text-center">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="flex items-center justify-center gap-1">
                              <PackageCheck className="h-4 w-4" />
                              Baixado?
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Passou pela baixa (Motoboy/Balcão/Transportadora)</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableHead>
                    <TableHead className="whitespace-nowrap text-center">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="flex items-center justify-center gap-1">
                              <UserCheck className="h-4 w-4" />
                              Financeiro?
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Confirmado por usuário com permissão Financeiro</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableHead>
                    <TableHead className="whitespace-nowrap text-center">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="flex items-center justify-center gap-1">
                              <UserCheck className="h-4 w-4" />
                              Thiago?
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Confirmado por thiago@sonatura.com.br</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSales.map(sale => {
                    const saleCast = sale as any;
                    const commission = getCommissionInfo(sale);
                    const isPaid = sale.payment_status === 'paid_now';
                    const isDelivered = sale.status === 'delivered';
                    const hasProof = !!sale.payment_proof_url;
                    const paymentMethod = saleCast.payment_method_data?.name || saleCast.payment_method || '—';
                    const status = closingStatus?.[sale.id];
                    
                    return (
                      <TableRow key={sale.id}>
                        <TableCell className="font-mono text-sm">
                          #{sale.romaneio_number}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm">
                          {format(parseISO(sale.created_at), 'dd/MM/yy HH:mm', { locale: ptBR })}
                        </TableCell>
                        <TableCell className="max-w-[150px] truncate" title={sale.lead?.name}>
                          {sale.lead?.name || '—'}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {sale.lead?.whatsapp || '—'}
                        </TableCell>
                        <TableCell>
                          {isPaid ? (
                            <Check className="h-4 w-4 text-green-600" />
                          ) : (
                            <AlertCircle className="h-4 w-4 text-amber-500" />
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {sale.payment_confirmed_at
                            ? format(parseISO(sale.payment_confirmed_at), 'dd/MM/yy', { locale: ptBR })
                            : '—'}
                        </TableCell>
                        <TableCell className="text-sm max-w-[100px] truncate" title={paymentMethod}>
                          {paymentMethod}
                        </TableCell>
                        <TableCell>
                          {hasProof ? (
                            <Check className="h-4 w-4 text-green-600" />
                          ) : (
                            <AlertCircle className="h-4 w-4 text-muted-foreground" />
                          )}
                        </TableCell>
                        <TableCell>
                          {isDelivered ? (
                            <Check className="h-4 w-4 text-green-600" />
                          ) : (
                            <AlertCircle className="h-4 w-4 text-amber-500" />
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {sale.delivered_at
                            ? format(parseISO(sale.delivered_at), 'dd/MM/yy', { locale: ptBR })
                            : '—'}
                        </TableCell>
                        <TableCell className="text-sm max-w-[120px] truncate" title={getSellerName(sale)}>
                          {getSellerName(sale)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs whitespace-nowrap">
                            {DELIVERY_TYPE_LABELS[sale.delivery_type] || sale.delivery_type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {formatCurrency(sale.shipping_cost_cents)}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {commission.percentageFormatted}
                        </TableCell>
                        <TableCell className="text-right text-sm font-medium text-green-600">
                          {commission.formatted}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatCurrency(sale.total_cents)}
                        </TableCell>
                        <TableCell className="text-center">
                          {status?.wasClosed ? (
                            <Check className="h-4 w-4 text-green-600 mx-auto" />
                          ) : (
                            <AlertCircle className="h-4 w-4 text-muted-foreground mx-auto" />
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {status?.confirmedByFinanceiro ? (
                            <Check className="h-4 w-4 text-green-600 mx-auto" />
                          ) : (
                            <AlertCircle className="h-4 w-4 text-muted-foreground mx-auto" />
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {status?.confirmedByThiago ? (
                            <Check className="h-4 w-4 text-green-600 mx-auto" />
                          ) : (
                            <AlertCircle className="h-4 w-4 text-muted-foreground mx-auto" />
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
