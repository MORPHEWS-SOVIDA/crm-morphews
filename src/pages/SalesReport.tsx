import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format, startOfMonth, endOfMonth, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  FileText,
  Printer,
  Filter,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  Package,
  Truck,
  DollarSign,
  Users,
  Calendar,
  Search,
  X,
  Loader2,
} from "lucide-react";
import { useSales } from "@/hooks/useSales";
import { useUsers } from "@/hooks/useUsers";
import { useDeliveryRegions, useShippingCarriers } from "@/hooks/useDeliveryConfig";
import { useAuth } from "@/hooks/useAuth";
import { useCurrentTenantId } from "@/hooks/useTenant";

const STATUS_OPTIONS = [
  { value: "all", label: "Todos os Status" },
  { value: "draft", label: "Rascunho" },
  { value: "pending_expedition", label: "Aguardando Expedição" },
  { value: "dispatched", label: "Despachado" },
  { value: "delivered", label: "Entregue" },
  { value: "payment_pending", label: "Aguardando Pagamento" },
  { value: "payment_confirmed", label: "Pagamento Confirmado" },
  { value: "cancelled", label: "Cancelado" },
];

const DELIVERY_STATUS_OPTIONS = [
  { value: "all", label: "Todos os Status de Entrega" },
  { value: "pending", label: "Pendente" },
  { value: "delivered_normal", label: "Entregue Normal" },
  { value: "delivered_missing_prescription", label: "Falta Receita" },
  { value: "delivered_no_money", label: "Sem Dinheiro" },
  { value: "delivered_no_card_limit", label: "Sem Limite no Cartão" },
  { value: "delivered_customer_absent", label: "Cliente Ausente" },
  { value: "delivered_customer_denied", label: "Cliente Recusou" },
  { value: "delivered_customer_gave_up", label: "Cliente Desistiu" },
  { value: "delivered_wrong_product", label: "Produto Errado" },
  { value: "delivered_missing_product", label: "Falta Produto" },
  { value: "delivered_insufficient_address", label: "Endereço Insuficiente" },
  { value: "delivered_wrong_time", label: "Horário Errado" },
  { value: "delivered_other", label: "Outro" },
];

const DELIVERY_TYPE_OPTIONS = [
  { value: "all", label: "Todos os Tipos" },
  { value: "pickup", label: "Retirada Balcão" },
  { value: "motoboy", label: "Motoboy" },
  { value: "carrier", label: "Transportadora" },
];

const SHIFT_OPTIONS = [
  { value: "all", label: "Todos os Turnos" },
  { value: "morning", label: "Manhã" },
  { value: "afternoon", label: "Tarde" },
  { value: "full_day", label: "Dia Todo" },
];

const PAYMENT_METHOD_OPTIONS = [
  { value: "all", label: "Todos os Métodos" },
  { value: "pix", label: "PIX" },
  { value: "credit_card", label: "Cartão de Crédito" },
  { value: "debit_card", label: "Cartão de Débito" },
  { value: "cash", label: "Dinheiro" },
  { value: "bank_transfer", label: "Transferência" },
  { value: "boleto", label: "Boleto" },
];

const DATE_FILTER_OPTIONS = [
  { value: "created_at", label: "Data de Criação" },
  { value: "scheduled_delivery_date", label: "Data de Entrega Agendada" },
  { value: "delivered_at", label: "Data de Entrega Realizada" },
  { value: "payment_confirmed_at", label: "Data de Confirmação Pagamento" },
];

export default function SalesReport() {
  const navigate = useNavigate();
  const { isLoading: authLoading, profile } = useAuth();
  const { data: tenantId, isLoading: tenantLoading } = useCurrentTenantId();
  const organizationId = profile?.organization_id ?? tenantId ?? null;

  const [filtersOpen, setFiltersOpen] = useState(true);
  const [selectedSales, setSelectedSales] = useState<string[]>([]);
  
  // Date filters
  const today = new Date();
  const [dateField, setDateField] = useState("created_at");
  const [startDate, setStartDate] = useState(format(startOfMonth(today), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(endOfMonth(today), "yyyy-MM-dd"));
  
  // Status filters
  const [statusFilter, setStatusFilter] = useState("all");
  const [deliveryStatusFilter, setDeliveryStatusFilter] = useState("all");
  const [deliveryTypeFilter, setDeliveryTypeFilter] = useState("all");
  const [shiftFilter, setShiftFilter] = useState("all");
  const [paymentMethodFilter, setPaymentMethodFilter] = useState("all");
  
  // Entity filters
  const [regionFilter, setRegionFilter] = useState("all");
  const [carrierFilter, setCarrierFilter] = useState("all");
  const [sellerFilter, setSellerFilter] = useState("all");
  const [deliveryUserFilter, setDeliveryUserFilter] = useState("all");
  
  // Search filters
  const [clientSearch, setClientSearch] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [stateFilter, setStateFilter] = useState("");

  // Fetch data
  const { data: sales, isLoading: salesLoading, error: salesError } = useSales();
  const { data: users } = useUsers();
  const { data: deliveryRegions } = useDeliveryRegions();
  const { data: shippingCarriers } = useShippingCarriers();

  // Filter sales - MUST be before any early returns to follow React hooks rules
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
      if (statusFilter !== "all" && sale.status !== statusFilter) return false;
      if (deliveryStatusFilter !== "all" && sale.delivery_status !== deliveryStatusFilter) return false;
      if (deliveryTypeFilter !== "all" && sale.delivery_type !== deliveryTypeFilter) return false;
      if (shiftFilter !== "all" && sale.scheduled_delivery_shift !== shiftFilter) return false;
      if (paymentMethodFilter !== "all" && sale.payment_method !== paymentMethodFilter) return false;
      
      // Entity filters
      if (regionFilter !== "all" && sale.delivery_region_id !== regionFilter) return false;
      if (carrierFilter !== "all" && sale.shipping_carrier_id !== carrierFilter) return false;
      if (sellerFilter !== "all" && sale.seller_user_id !== sellerFilter) return false;
      if (deliveryUserFilter !== "all" && sale.assigned_delivery_user_id !== deliveryUserFilter) return false;
      
      // Search filters
      if (clientSearch) {
        const leadName = sale.lead?.name?.toLowerCase() || "";
        const leadWhatsapp = sale.lead?.whatsapp || "";
        if (!leadName.includes(clientSearch.toLowerCase()) && !leadWhatsapp.includes(clientSearch)) {
          return false;
        }
      }
      
      if (cityFilter && sale.lead?.city?.toLowerCase() !== cityFilter.toLowerCase()) return false;
      if (stateFilter && sale.lead?.state?.toLowerCase() !== stateFilter.toLowerCase()) return false;
      
      return true;
    });
  }, [
    sales, dateField, startDate, endDate,
    statusFilter, deliveryStatusFilter, deliveryTypeFilter, shiftFilter, paymentMethodFilter,
    regionFilter, carrierFilter, sellerFilter, deliveryUserFilter,
    clientSearch, cityFilter, stateFilter
  ]);

  // Calculate totals - MUST be before any early returns
  const totals = useMemo(() => {
    const totalSales = filteredSales.length;
    const totalValue = filteredSales.reduce((sum, s) => sum + (s.total_cents || 0), 0);
    const totalDiscount = filteredSales.reduce((sum, s) => sum + (s.discount_cents || 0), 0);
    const totalShipping = filteredSales.reduce((sum, s) => sum + (s.shipping_cost_cents || 0), 0);
    const avgTicket = totalSales > 0 ? totalValue / totalSales : 0;
    
    const byStatus = filteredSales.reduce((acc, s) => {
      acc[s.status] = (acc[s.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const byDeliveryType = filteredSales.reduce((acc, s) => {
      acc[s.delivery_type] = (acc[s.delivery_type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return { totalSales, totalValue, totalDiscount, totalShipping, avgTicket, byStatus, byDeliveryType };
  }, [filteredSales]);

  // Get unique cities and states from sales - MUST be before any early returns
  const uniqueCities = useMemo(() => {
    const cities = new Set<string>();
    sales?.forEach(s => {
      if (s.lead?.city) cities.add(s.lead.city);
    });
    return Array.from(cities).sort();
  }, [sales]);

  const uniqueStates = useMemo(() => {
    const states = new Set<string>();
    sales?.forEach(s => {
      if (s.lead?.state) states.add(s.lead.state);
    });
    return Array.from(states).sort();
  }, [sales]);

  // Helper functions
  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(cents / 100);
  };

  const getStatusLabel = (status: string) => {
    return STATUS_OPTIONS.find(s => s.value === status)?.label || status;
  };

  const getDeliveryTypeLabel = (type: string) => {
    return DELIVERY_TYPE_OPTIONS.find(t => t.value === type)?.label || type;
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedSales(filteredSales.map(s => s.id));
    } else {
      setSelectedSales([]);
    }
  };

  const handleSelectSale = (saleId: string, checked: boolean) => {
    if (checked) {
      setSelectedSales(prev => [...prev, saleId]);
    } else {
      setSelectedSales(prev => prev.filter(id => id !== saleId));
    }
  };

  const handlePrintSelected = () => {
    if (selectedSales.length === 0) return;

    // Abre 1 romaneio por venda (evita rota inexistente e funciona em qualquer ambiente)
    selectedSales.forEach((saleId, idx) => {
      setTimeout(() => {
        window.open(`/vendas/${saleId}/romaneio?auto=true`, "_blank");
      }, idx * 150);
    });
  };

  const clearFilters = () => {
    setDateField("created_at");
    setStartDate(format(startOfMonth(today), "yyyy-MM-dd"));
    setEndDate(format(endOfMonth(today), "yyyy-MM-dd"));
    setStatusFilter("all");
    setDeliveryStatusFilter("all");
    setDeliveryTypeFilter("all");
    setShiftFilter("all");
    setPaymentMethodFilter("all");
    setRegionFilter("all");
    setCarrierFilter("all");
    setSellerFilter("all");
    setDeliveryUserFilter("all");
    setClientSearch("");
    setCityFilter("");
    setStateFilter("");
  };

  // Show loading state while auth/tenant is loading
  if (authLoading || tenantLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  // If user isn't linked to any organization/tenant, avoid blank screen
  if (!organizationId) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px] px-4">
          <div className="text-center max-w-md">
            <h1 className="text-lg font-semibold text-foreground">Sem empresa vinculada</h1>
            <p className="text-sm text-muted-foreground mt-2">
              Seu usuário não está vinculado a nenhuma organização. Peça para um administrador te adicionar em uma empresa.
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  // Show loading while sales data is loading
  if (salesLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (salesError) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px] px-4">
          <div className="text-center max-w-md">
            <h1 className="text-lg font-semibold text-foreground">Erro ao carregar relatório</h1>
            <p className="text-sm text-muted-foreground mt-2">
              Não foi possível carregar as vendas. Tente novamente em alguns instantes.
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <FileText className="h-6 w-6" />
              Relatório de Vendas
            </h1>
            <p className="text-muted-foreground">
              Análise detalhada das vendas com filtros avançados
            </p>
          </div>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={clearFilters}
              className="gap-2"
            >
              <X className="h-4 w-4" />
              Limpar Filtros
            </Button>
            <Button
              onClick={handlePrintSelected}
              disabled={selectedSales.length === 0}
              className="gap-2"
            >
              <Printer className="h-4 w-4" />
              Imprimir Selecionados ({selectedSales.length})
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Vendas</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totals.totalSales}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Valor Total</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totals.totalValue)}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ticket Médio</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totals.avgTicket)}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Descontos</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{formatCurrency(totals.totalDiscount)}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Frete</CardTitle>
              <Truck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totals.totalShipping)}</div>
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
                    Filtros Avançados
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
                  <h3 className="font-semibold">Status</h3>
                  <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
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
                      <Label>Status de Entrega</Label>
                      <Select value={deliveryStatusFilter} onValueChange={setDeliveryStatusFilter}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DELIVERY_STATUS_OPTIONS.map(opt => (
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
                      <Label>Turno de Entrega</Label>
                      <Select value={shiftFilter} onValueChange={setShiftFilter}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SHIFT_OPTIONS.map(opt => (
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
                  <h3 className="font-semibold flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Responsáveis e Regiões
                  </h3>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <div className="space-y-2">
                      <Label>Vendedor</Label>
                      <Select value={sellerFilter} onValueChange={setSellerFilter}>
                        <SelectTrigger>
                          <SelectValue placeholder="Todos os vendedores" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos os Vendedores</SelectItem>
                          {users?.map(user => (
                            <SelectItem key={user.user_id} value={user.user_id}>
                              {user.first_name} {user.last_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Entregador</Label>
                      <Select value={deliveryUserFilter} onValueChange={setDeliveryUserFilter}>
                        <SelectTrigger>
                          <SelectValue placeholder="Todos os entregadores" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos os Entregadores</SelectItem>
                          {users?.map(user => (
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
                        <SelectTrigger>
                          <SelectValue placeholder="Todas as regiões" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todas as Regiões</SelectItem>
                          {deliveryRegions?.map(region => (
                            <SelectItem key={region.id} value={region.id}>
                              {region.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Transportadora</Label>
                      <Select value={carrierFilter} onValueChange={setCarrierFilter}>
                        <SelectTrigger>
                          <SelectValue placeholder="Todas as transportadoras" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todas as Transportadoras</SelectItem>
                          {shippingCarriers?.map(carrier => (
                            <SelectItem key={carrier.id} value={carrier.id}>
                              {carrier.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Search Filters */}
                <div className="space-y-4">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Search className="h-4 w-4" />
                    Busca
                  </h3>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <Label>Cliente (Nome ou WhatsApp)</Label>
                      <Input
                        placeholder="Buscar cliente..."
                        value={clientSearch}
                        onChange={(e) => setClientSearch(e.target.value)}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Cidade</Label>
                      <Select
                        value={cityFilter || "all"}
                        onValueChange={(v) => setCityFilter(v === "all" ? "" : v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Todas as cidades" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todas as Cidades</SelectItem>
                          {uniqueCities.map((city) => (
                            <SelectItem key={city} value={city}>
                              {city}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Estado</Label>
                      <Select
                        value={stateFilter || "all"}
                        onValueChange={(v) => setStateFilter(v === "all" ? "" : v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Todos os estados" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos os Estados</SelectItem>
                          {uniqueStates.map((state) => (
                            <SelectItem key={state} value={state}>
                              {state}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Results Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Resultados ({filteredSales.length} vendas)</span>
              <div className="flex items-center gap-2 text-sm font-normal">
                <Checkbox
                  checked={selectedSales.length === filteredSales.length && filteredSales.length > 0}
                  onCheckedChange={handleSelectAll}
                />
                <span className="text-muted-foreground">Selecionar todos</span>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {filteredSales.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma venda encontrada com os filtros selecionados.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12"></TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Vendedor</TableHead>
                      <TableHead>Tipo Entrega</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSales.map((sale) => (
                      <TableRow key={sale.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedSales.includes(sale.id)}
                            onCheckedChange={(checked) => handleSelectSale(sale.id, checked as boolean)}
                          />
                        </TableCell>
                        <TableCell>
                          {format(parseISO(sale.created_at), "dd/MM/yyyy", { locale: ptBR })}
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{sale.lead?.name || "—"}</div>
                            <div className="text-sm text-muted-foreground">
                              {sale.lead?.city && sale.lead?.state 
                                ? `${sale.lead.city}/${sale.lead.state}` 
                                : ""}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {sale.seller_profile 
                            ? `${sale.seller_profile.first_name} ${sale.seller_profile.last_name}`
                            : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {getDeliveryTypeLabel(sale.delivery_type)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {getStatusLabel(sale.status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(sale.total_cents)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => navigate(`/vendas/${sale.id}`)}
                            >
                              Ver
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                window.open(`/vendas/${sale.id}/romaneio?auto=true`, "_blank")
                              }
                              aria-label="Imprimir romaneio"
                            >
                              <Printer className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
