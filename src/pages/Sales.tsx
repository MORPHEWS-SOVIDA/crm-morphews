import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Plus, 
  Search,
  ShoppingCart,
  Eye,
  Truck,
  CreditCard,
  Package,
  Clock,
  CheckCircle,
  XCircle,
  User,
  Printer,
  Bike,
  Building2,
  Calendar,
  Filter,
  RotateCcw,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { 
  useSales, 
  SaleStatus, 
  DeliveryType,
  formatCurrency, 
  getStatusLabel, 
  getStatusColor 
} from '@/hooks/useSales';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { normalizeText } from '@/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

const STATUS_TABS: { value: SaleStatus | 'all'; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: 'all', label: 'Todas', icon: ShoppingCart },
  { value: 'draft', label: 'Rascunho', icon: Clock },
  { value: 'pending_expedition', label: 'Expedição', icon: Package },
  { value: 'dispatched', label: 'Despachado', icon: Truck },
  { value: 'returned', label: 'Voltou', icon: RotateCcw },
  { value: 'delivered', label: 'Entregue', icon: CheckCircle },
  { value: 'payment_pending', label: 'Pgto Pendente', icon: CreditCard },
  { value: 'payment_confirmed', label: 'Confirmado', icon: CheckCircle },
  { value: 'cancelled', label: 'Cancelado', icon: XCircle },
];

const DELIVERY_TYPE_OPTIONS: { value: DeliveryType | 'all'; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: 'all', label: 'Todos', icon: Truck },
  { value: 'motoboy', label: 'Motoboy', icon: Bike },
  { value: 'carrier', label: 'Transportadora', icon: Truck },
  { value: 'pickup', label: 'Balcão', icon: Building2 },
];

function getDeliveryTypeLabel(type: DeliveryType): string {
  const labels: Record<DeliveryType, string> = {
    motoboy: 'Motoboy',
    carrier: 'Transportadora',
    pickup: 'Balcão',
  };
  return labels[type] || type;
}

function getDeliveryTypeIcon(type: DeliveryType) {
  switch (type) {
    case 'motoboy':
      return <Bike className="w-3.5 h-3.5" />;
    case 'carrier':
      return <Truck className="w-3.5 h-3.5" />;
    case 'pickup':
      return <Building2 className="w-3.5 h-3.5" />;
    default:
      return null;
  }
}

export default function Sales() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<SaleStatus | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  
  // New filters
  const [sellerFilter, setSellerFilter] = useState<string>('all');
  const [deliveryTypeFilter, setDeliveryTypeFilter] = useState<DeliveryType | 'all'>('all');
  const [deliveryDateFilter, setDeliveryDateFilter] = useState<string>('');
  
  const { data: sales = [], isLoading } = useSales(
    activeTab !== 'all' ? { status: activeTab } : undefined
  );

  // Get unique sellers from sales
  const sellers = useMemo(() => {
    const sellerMap = new Map<string, string>();
    sales.forEach(sale => {
      if (sale.seller_user_id && sale.seller_profile) {
        const name = `${sale.seller_profile.first_name} ${sale.seller_profile.last_name}`.trim();
        sellerMap.set(sale.seller_user_id, name);
      }
    });
    return Array.from(sellerMap.entries()).map(([id, name]) => ({ id, name }));
  }, [sales]);

  const filteredSales = useMemo(() => {
    return sales.filter(sale => {
      // Search filter
      if (searchTerm) {
        const search = normalizeText(searchTerm);
        const matchesSearch = (
          normalizeText(sale.lead?.name || '').includes(search) ||
          sale.lead?.whatsapp?.includes(searchTerm)
        );
        if (!matchesSearch) return false;
      }
      
      // Seller filter
      if (sellerFilter !== 'all' && sale.seller_user_id !== sellerFilter) {
        return false;
      }
      
      // Delivery type filter
      if (deliveryTypeFilter !== 'all' && sale.delivery_type !== deliveryTypeFilter) {
        return false;
      }
      
      // Delivery date filter
      if (deliveryDateFilter && sale.scheduled_delivery_date !== deliveryDateFilter) {
        return false;
      }
      
      return true;
    });
  }, [sales, searchTerm, sellerFilter, deliveryTypeFilter, deliveryDateFilter]);

  const getStatusIcon = (status: SaleStatus) => {
    const tab = STATUS_TABS.find(t => t.value === status);
    if (tab) {
      const Icon = tab.icon;
      return <Icon className="w-4 h-4" />;
    }
    return null;
  };

  const hasActiveFilters = sellerFilter !== 'all' || deliveryTypeFilter !== 'all' || deliveryDateFilter !== '';

  const clearFilters = () => {
    setSellerFilter('all');
    setDeliveryTypeFilter('all');
    setDeliveryDateFilter('');
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Vendas</h1>
            <p className="text-muted-foreground">Gerencie suas vendas e romaneios</p>
          </div>
          <Button onClick={() => navigate('/vendas/nova')}>
            <Plus className="w-4 h-4 mr-2" />
            Nova Venda
          </Button>
        </div>

        {/* Search and Filters */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por cliente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            
            <Collapsible open={showFilters} onOpenChange={setShowFilters}>
              <CollapsibleTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Filter className="w-4 h-4" />
                  Filtros
                  {hasActiveFilters && (
                    <Badge variant="secondary" className="ml-1">
                      {[sellerFilter !== 'all', deliveryTypeFilter !== 'all', deliveryDateFilter !== ''].filter(Boolean).length}
                    </Badge>
                  )}
                  {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </Button>
              </CollapsibleTrigger>
            </Collapsible>
          </div>

          <Collapsible open={showFilters} onOpenChange={setShowFilters}>
            <CollapsibleContent>
              <Card>
                <CardContent className="pt-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Seller Filter */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Vendedor</label>
                      <Select value={sellerFilter} onValueChange={setSellerFilter}>
                        <SelectTrigger>
                          <SelectValue placeholder="Todos vendedores" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos vendedores</SelectItem>
                          {sellers.map((seller) => (
                            <SelectItem key={seller.id} value={seller.id}>
                              {seller.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Delivery Type Filter */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Método de Entrega</label>
                      <Select value={deliveryTypeFilter} onValueChange={(v) => setDeliveryTypeFilter(v as DeliveryType | 'all')}>
                        <SelectTrigger>
                          <SelectValue placeholder="Todos métodos" />
                        </SelectTrigger>
                        <SelectContent>
                          {DELIVERY_TYPE_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              <div className="flex items-center gap-2">
                                <option.icon className="w-4 h-4" />
                                {option.label}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Delivery Date Filter */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Data de Entrega</label>
                      <Input
                        type="date"
                        value={deliveryDateFilter}
                        onChange={(e) => setDeliveryDateFilter(e.target.value)}
                      />
                    </div>

                    {/* Clear Filters */}
                    <div className="flex items-end">
                      <Button 
                        variant="ghost" 
                        onClick={clearFilters}
                        disabled={!hasActiveFilters}
                        className="w-full"
                      >
                        Limpar Filtros
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </CollapsibleContent>
          </Collapsible>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as SaleStatus | 'all')}>
          <TabsList className="flex-wrap h-auto gap-1">
            {STATUS_TABS.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value} className="gap-2">
                <tab.icon className="w-4 h-4" />
                <span className="hidden sm:inline">{tab.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value={activeTab} className="mt-6">
            {isLoading ? (
              <div className="grid gap-4">
                {[1, 2, 3].map(i => (
                  <Card key={i}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        <Skeleton className="h-12 w-12 rounded-full" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-4 w-1/3" />
                          <Skeleton className="h-3 w-1/4" />
                        </div>
                        <Skeleton className="h-6 w-24" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : filteredSales.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <ShoppingCart className="w-12 h-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">Nenhuma venda encontrada</h3>
                  <p className="text-muted-foreground mb-4">
                    {searchTerm || hasActiveFilters ? 'Tente outros filtros' : 'Crie sua primeira venda'}
                  </p>
                  {!searchTerm && !hasActiveFilters && (
                    <Button onClick={() => navigate('/vendas/nova')}>
                      <Plus className="w-4 h-4 mr-2" />
                      Nova Venda
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {filteredSales.map((sale) => (
                  <Card key={sale.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                        {/* Client Avatar */}
                        <div className="hidden lg:flex h-12 w-12 rounded-full bg-primary/10 items-center justify-center flex-shrink-0">
                          <User className="w-6 h-6 text-primary" />
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-sm bg-primary/10 text-primary px-2 py-0.5 rounded">
                              #{sale.romaneio_number}
                            </span>
                            <h3 className="font-medium truncate">{sale.lead?.name || 'Cliente'}</h3>
                            <Badge className={getStatusColor(sale.status)}>
                              {getStatusIcon(sale.status)}
                              <span className="ml-1">{getStatusLabel(sale.status)}</span>
                            </Badge>
                          </div>
                          
                          {/* Additional Info Row */}
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                            {/* Seller */}
                            {sale.seller_profile && (
                              <span className="flex items-center gap-1">
                                <User className="w-3.5 h-3.5" />
                                <span className="font-medium text-foreground">Vendido por:</span>
                                {sale.seller_profile.first_name} {sale.seller_profile.last_name}
                              </span>
                            )}
                            
                            {/* Delivery Type */}
                            <span className="flex items-center gap-1">
                              {getDeliveryTypeIcon(sale.delivery_type)}
                              <span className="font-medium text-foreground">Entrega:</span>
                              {getDeliveryTypeLabel(sale.delivery_type)}
                            </span>
                            
                            {/* Scheduled Delivery Date */}
                            {sale.scheduled_delivery_date && (
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3.5 h-3.5" />
                                <span className="font-medium text-foreground">Agendado:</span>
                                {format(new Date(sale.scheduled_delivery_date + 'T00:00:00'), "dd/MM/yyyy", { locale: ptBR })}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span>{sale.lead?.whatsapp}</span>
                            <span>•</span>
                            <span>
                              {format(new Date(sale.created_at), "dd MMM yyyy 'às' HH:mm", { locale: ptBR })}
                            </span>
                          </div>
                        </div>

                        {/* Total */}
                        <div className="text-right flex-shrink-0">
                          <p className="text-lg font-bold text-primary">
                            {formatCurrency(sale.total_cents)}
                          </p>
                          {sale.discount_cents > 0 && (
                            <p className="text-xs text-green-600">
                              -{formatCurrency(sale.discount_cents)} desc.
                            </p>
                          )}
                        </div>

                        {/* Actions - Always visible */}
                        <div className="flex items-center gap-1">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => navigate(`/vendas/${sale.id}`)}
                            className="gap-1"
                          >
                            <Eye className="w-4 h-4" />
                            <span className="hidden sm:inline">Ver</span>
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => navigate(`/vendas/${sale.id}/romaneio`)}
                            className="gap-1"
                          >
                            <Printer className="w-4 h-4" />
                            <span className="hidden sm:inline">Imprimir</span>
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
