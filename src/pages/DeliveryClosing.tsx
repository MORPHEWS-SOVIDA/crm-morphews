import React, { useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SaleSelectionCard } from '@/components/expedition/SaleSelectionCard';
import { 
  Store, 
  FileText, 
  Loader2,
  Receipt,
  History,
  Eye,
  Printer,
  ArrowLeft,
  CheckCircle,
  Bike,
  Truck,
  Lock,
  Banknote,
  AlertCircle,
  Search,
  Filter,
  X,
  User,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { formatCurrency } from '@/hooks/useSales';
import { useAuth } from '@/hooks/useAuth';
import { calculateCategoryTotals, getCategoryConfig } from '@/lib/paymentCategories';
import { PaymentCategoryTotals, PaymentCategoryBadges } from '@/components/expedition/PaymentCategoryTotals';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  useAvailableClosingSales,
  useDeliveryClosings,
  useDeliveryClosingSales,
  useCreateDeliveryClosing,
  useConfirmDeliveryClosing,
  formatPaymentMethod,
  closingTypeConfig,
  canUserConfirmAdmin,
  type ClosingType,
  type DeliveryClosing as DeliveryClosingType,
} from '@/hooks/useDeliveryClosings';
import { useMyPermissions } from '@/hooks/useUserPermissions';

const iconMap = {
  Store: Store,
  Bike: Bike,
  Truck: Truck,
};

interface DeliveryClosingPageProps {
  closingType: ClosingType;
}

export default function DeliveryClosingPage({ closingType }: DeliveryClosingPageProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: permissions } = useMyPermissions();
  const config = closingTypeConfig[closingType];
  const IconComponent = iconMap[config.icon as keyof typeof iconMap] || Store;
  
  const [activeTab, setActiveTab] = useState<'new' | 'history'>('new');
  const [selectedSales, setSelectedSales] = useState<Set<string>>(new Set());
  const [viewingClosingId, setViewingClosingId] = useState<string | null>(null);
  const [cashConfirmDialogOpen, setCashConfirmDialogOpen] = useState(false);
  const [pendingCashClosingId, setPendingCashClosingId] = useState<string | null>(null);
  const [pendingCashAmount, setPendingCashAmount] = useState(0);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sellerFilter, setSellerFilter] = useState<string>('all');

  const { data: availableSales = [], isLoading: loadingSales } = useAvailableClosingSales(closingType);
  const { data: closings = [], isLoading: loadingClosings } = useDeliveryClosings(closingType);
  const { data: closingSales = [] } = useDeliveryClosingSales(viewingClosingId || undefined);
  const createClosing = useCreateDeliveryClosing();
  const confirmClosing = useConfirmDeliveryClosing();

  const userEmail = user?.email?.toLowerCase();
  // Auxiliar confirmation now uses reports_view permission (Financeiro)
  const canConfirmAuxiliar = permissions?.reports_view === true;
  // Admin confirmation still uses email check
  const canConfirmAdmin = canUserConfirmAdmin(userEmail, closingType);

  const toggleSale = (saleId: string) => {
    setSelectedSales(prev => {
      const newSet = new Set(prev);
      if (newSet.has(saleId)) {
        newSet.delete(saleId);
      } else {
        newSet.add(saleId);
      }
      return newSet;
    });
  };

  const selectAll = () => {
    setSelectedSales(new Set(filteredSales.map(s => s.id)));
  };

  const clearSelection = () => {
    setSelectedSales(new Set());
  };
  
  // Get unique sellers for filter dropdown
  const uniqueSellers = useMemo(() => {
    const sellers = new Map<string, string>();
    availableSales.forEach(sale => {
      if (sale.seller_user_id && sale.seller_profile) {
        const name = `${sale.seller_profile.first_name || ''} ${sale.seller_profile.last_name || ''}`.trim();
        if (name) sellers.set(sale.seller_user_id, name);
      }
    });
    return Array.from(sellers.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [availableSales]);

  // Filter sales based on search and filters
  const filteredSales = useMemo(() => {
    return availableSales.filter(sale => {
      // Search filter
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        const leadName = sale.lead?.name?.toLowerCase() || '';
        const romaneioNum = String(sale.romaneio_number || '');
        const trackingCode = sale.tracking_code?.toLowerCase() || '';
        
        if (!leadName.includes(search) && !romaneioNum.includes(search) && !trackingCode.includes(search)) {
          return false;
        }
      }
      
      // Status filter for carrier
      if (statusFilter !== 'all') {
        if (statusFilter === 'delivered') {
          // Has delivery_status = 'entregue' or carrier_tracking_status = 'delivered'
          const deliveryStatus = String(sale.delivery_status || '').toLowerCase();
          const trackingStatus = String(sale.carrier_tracking_status || '').toLowerCase();
          const isDelivered = deliveryStatus === 'entregue' || 
            trackingStatus === 'delivered' ||
            trackingStatus === 'entregue';
          if (!isDelivered) return false;
        } else if (statusFilter === 'not_printed') {
          // Doesn't have a label or tracking code
          const hasLabel = sale.tracking_code || sale.melhor_envio_label;
          if (hasLabel) return false;
        } else if (statusFilter === 'pending') {
          // Has label but not delivered yet
          const hasLabel = sale.tracking_code || sale.melhor_envio_label;
          const deliveryStatus = String(sale.delivery_status || '').toLowerCase();
          const trackingStatus = String(sale.carrier_tracking_status || '').toLowerCase();
          const isDelivered = deliveryStatus === 'entregue' || 
            trackingStatus === 'delivered' ||
            trackingStatus === 'entregue';
          if (!hasLabel || isDelivered) return false;
        }
      }
      
      // Seller filter
      if (sellerFilter !== 'all' && sale.seller_user_id !== sellerFilter) {
        return false;
      }
      
      return true;
    });
  }, [availableSales, searchTerm, statusFilter, sellerFilter]);

  const selectedSalesData = useMemo(() => {
    return availableSales.filter(s => selectedSales.has(s.id));
  }, [availableSales, selectedSales]);

  const totals = useMemo(() => {
    return calculateCategoryTotals(selectedSalesData);
  }, [selectedSalesData]);
  
  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setSellerFilter('all');
  };
  
  const hasActiveFilters = searchTerm || statusFilter !== 'all' || sellerFilter !== 'all';

  const handleCreateClosing = async () => {
    if (selectedSalesData.length === 0) {
      toast.error('Selecione pelo menos uma venda');
      return;
    }

    try {
      const closing = await createClosing.mutateAsync({
        closingType,
        sales: selectedSalesData,
      });
      
      toast.success(`Fechamento #${closing.closing_number} criado com sucesso!`);
      setSelectedSales(new Set());
      setViewingClosingId(closing.id);
      setActiveTab('history');
    } catch (error) {
      toast.error('Erro ao criar fechamento');
      console.error(error);
    }
  };

  const handleConfirm = async (closingId: string, type: 'auxiliar' | 'admin') => {
    // Check permission
    if (type === 'auxiliar' && !canConfirmAuxiliar) {
      toast.error('Você não tem permissão para confirmar como auxiliar');
      return;
    }
    if (type === 'admin' && !canConfirmAdmin) {
      toast.error('Você não tem permissão para confirmar como admin');
      return;
    }

    try {
      await confirmClosing.mutateAsync({ closingId, closingType, type });
      toast.success(type === 'auxiliar' ? 'Confirmado pelo auxiliar!' : 'Confirmação final realizada!');
    } catch (error) {
      toast.error('Erro ao confirmar');
      console.error(error);
    }
  };

  const handleOpenCashConfirm = (closing: DeliveryClosingType) => {
    setPendingCashClosingId(closing.id);
    setPendingCashAmount(closing.total_cash_cents);
    setCashConfirmDialogOpen(true);
  };

  const handleConfirmCash = async () => {
    if (!pendingCashClosingId) return;
    
    try {
      await confirmClosing.mutateAsync({ 
        closingId: pendingCashClosingId, 
        closingType, 
        type: 'admin' 
      });
      toast.success('Dinheiro conferido e fechamento confirmado!');
      setCashConfirmDialogOpen(false);
      setPendingCashClosingId(null);
    } catch (error) {
      toast.error('Erro ao confirmar');
      console.error(error);
    }
  };

  const handlePrint = (closing: DeliveryClosingType) => {
    window.open(config.printPath(closing.id), '_blank', 'noopener');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">⏳ Pendente</Badge>;
      case 'confirmed_auxiliar':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300">✓ Auxiliar Confirmou</Badge>;
      case 'confirmed_final':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">✅ Confirmado</Badge>;
      default:
        return null;
    }
  };

  const colorClasses = {
    purple: {
      gradient: 'from-purple-50 to-purple-100 dark:from-purple-950/30 dark:to-purple-900/20 border-purple-200',
      text: 'text-purple-600',
      title: 'text-purple-700',
      button: 'bg-purple-600 hover:bg-purple-700',
      selected: 'bg-purple-50 dark:bg-purple-950/30',
      ring: 'ring-purple-500',
    },
    orange: {
      gradient: 'from-orange-50 to-orange-100 dark:from-orange-950/30 dark:to-orange-900/20 border-orange-200',
      text: 'text-orange-600',
      title: 'text-orange-700',
      button: 'bg-orange-600 hover:bg-orange-700',
      selected: 'bg-orange-50 dark:bg-orange-950/30',
      ring: 'ring-orange-500',
    },
    blue: {
      gradient: 'from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/20 border-blue-200',
      text: 'text-blue-600',
      title: 'text-blue-700',
      button: 'bg-blue-600 hover:bg-blue-700',
      selected: 'bg-blue-50 dark:bg-blue-950/30',
      ring: 'ring-blue-500',
    },
  };

  const colors = colorClasses[config.color as keyof typeof colorClasses] || colorClasses.purple;

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/expedicao')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <IconComponent className={`w-6 h-6 ${colors.text}`} />
              {config.title}
            </h1>
            <p className="text-muted-foreground">{config.subtitle}</p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'new' | 'history')}>
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="new" className="gap-2">
              <FileText className="w-4 h-4" />
              Novo Fechamento
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2">
              <History className="w-4 h-4" />
              Histórico ({closings.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="new" className="mt-6">
            {loadingSales ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : availableSales.length === 0 ? (
              <Card>
                <CardContent className="py-16 text-center text-muted-foreground">
                  <IconComponent className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <p className="text-lg font-medium">{config.emptyMessage}</p>
                  <p className="text-sm">Vendas precisam estar marcadas como entregues</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {/* Filters */}
                <Card className="bg-muted/30">
                  <CardContent className="py-3">
                    <div className="flex flex-col md:flex-row gap-3">
                      {/* Search */}
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          placeholder="Buscar por cliente, nº venda ou rastreio..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-9"
                        />
                      </div>
                      
                      {/* Status Filter (only for carrier) */}
                      {closingType === 'carrier' && (
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                          <SelectTrigger className="w-full md:w-[200px]">
                            <Filter className="w-4 h-4 mr-2" />
                            <SelectValue placeholder="Status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todos os Status</SelectItem>
                            <SelectItem value="not_printed">🖨️ Sem Etiqueta</SelectItem>
                            <SelectItem value="pending">📦 Com Etiqueta</SelectItem>
                            <SelectItem value="delivered">✅ Entregue</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                      
                      {/* Seller Filter */}
                      {uniqueSellers.length > 1 && (
                        <Select value={sellerFilter} onValueChange={setSellerFilter}>
                          <SelectTrigger className="w-full md:w-[180px]">
                            <SelectValue placeholder="Vendedor" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todos Vendedores</SelectItem>
                            {uniqueSellers.map(([id, name]) => (
                              <SelectItem key={id} value={id}>{name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      
                      {/* Clear Filters */}
                      {hasActiveFilters && (
                        <Button variant="ghost" size="icon" onClick={clearFilters} title="Limpar filtros">
                          <X className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Selection controls */}
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    {hasActiveFilters ? (
                      <>{filteredSales.length} de {availableSales.length} venda(s) • {selectedSales.size} selecionada(s)</>
                    ) : (
                      <>{availableSales.length} venda(s) disponível(eis) • {selectedSales.size} selecionada(s)</>
                    )}
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={selectAll}>
                      Selecionar {hasActiveFilters ? 'Filtradas' : 'Todas'}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={clearSelection}>
                      Limpar
                    </Button>
                  </div>
                </div>

                {/* Sales list */}
                <Card>
                  <CardContent className="p-0">
                    {filteredSales.length === 0 ? (
                      <div className="py-12 text-center text-muted-foreground">
                        <Search className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p>Nenhuma venda encontrada com os filtros aplicados</p>
                        <Button variant="link" onClick={clearFilters} className="mt-2">
                          Limpar filtros
                        </Button>
                      </div>
                    ) : (
                      <div className="divide-y">
                        {filteredSales.map(sale => (
                          <SaleSelectionCard
                            key={sale.id}
                            sale={sale}
                            isSelected={selectedSales.has(sale.id)}
                            onToggle={() => toggleSale(sale.id)}
                            selectedBgClass={colors.selected}
                            showTracking={closingType === 'carrier'}
                            showProofLink={closingType === 'motoboy' || closingType === 'carrier'}
                            showEditPayment={closingType === 'motoboy' || closingType === 'carrier'}
                            showEditSale={!!permissions?.sales_report_view}
                          />
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Totals summary */}
                {selectedSales.size > 0 && (
                  <div className="space-y-4">
                    <Separator />
                    <PaymentCategoryTotals 
                      total={totals.total}
                      byCategory={totals.byCategory}
                      colorConfig={{
                        gradient: colors.gradient,
                        text: colors.text,
                        title: colors.title,
                      }}
                    />

                    <Button 
                      className={`w-full ${colors.button}`}
                      size="lg"
                      onClick={handleCreateClosing}
                      disabled={createClosing.isPending}
                    >
                      {createClosing.isPending ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <FileText className="w-4 h-4 mr-2" />
                      )}
                      Gerar Fechamento ({selectedSales.size} vendas)
                    </Button>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="history" className="mt-6">
            {loadingClosings ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : closings.length === 0 ? (
              <Card>
                <CardContent className="py-16 text-center text-muted-foreground">
                  <History className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <p className="text-lg font-medium">Nenhum fechamento realizado ainda</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {closings.map(closing => (
                  <Card 
                    key={closing.id} 
                    className={`transition-all ${viewingClosingId === closing.id ? `ring-2 ${colors.ring}` : ''}`}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <IconComponent className="w-5 h-5" />
                          Fechamento #{closing.closing_number}
                        </CardTitle>
                        {getStatusBadge(closing.status)}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {format(parseISO(closing.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        {closing.creator_profile && (
                          <span> • por {closing.creator_profile.first_name} {closing.creator_profile.last_name}</span>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0 space-y-4">
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 text-sm">
                        <div>
                          <span className="text-muted-foreground">Vendas:</span>{' '}
                          <span className="font-medium">{closing.total_sales}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Total:</span>{' '}
                          <span className={`font-semibold ${colors.text}`}>{formatCurrency(closing.total_amount_cents)}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">💳 Cartão:</span>{' '}
                          <span className="font-medium">{formatCurrency(closing.total_card_cents)}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">📱 PIX:</span>{' '}
                          <span className="font-medium">{formatCurrency(closing.total_pix_cents)}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">💵 Dinheiro:</span>{' '}
                          <span className="font-medium">{formatCurrency(closing.total_cash_cents)}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">📄 Outros:</span>{' '}
                          <span className="font-medium">{formatCurrency(closing.total_other_cents)}</span>
                        </div>
                      </div>

                      {/* Confirmations status */}
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        {closing.confirmed_at_auxiliar ? (
                          <Badge variant="outline" className="bg-blue-50 text-blue-700">
                            ✓ Auxiliar: {closing.auxiliar_profile?.first_name} ({format(parseISO(closing.confirmed_at_auxiliar), "dd/MM HH:mm")})
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-yellow-600">
                            ⏳ Aguardando Auxiliar
                          </Badge>
                        )}
                        {closing.confirmed_at_admin ? (
                          <Badge variant="outline" className="bg-green-50 text-green-700">
                            ✅ Admin: {closing.admin_profile?.first_name} ({format(parseISO(closing.confirmed_at_admin), "dd/MM HH:mm")})
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-gray-500">
                            ⏳ Aguardando Conferência Final
                          </Badge>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex flex-wrap gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setViewingClosingId(viewingClosingId === closing.id ? null : closing.id)}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          {viewingClosingId === closing.id ? 'Ocultar Vendas' : 'Ver Vendas'}
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handlePrint(closing)}>
                          <Printer className="w-4 h-4 mr-1" />
                          Imprimir
                        </Button>
                        
                        {/* Confirm Auxiliar Button - Now uses Financeiro permission */}
                        {closing.status === 'pending' && (
                          canConfirmAuxiliar ? (
                            <Button 
                              variant="secondary" 
                              size="sm"
                              onClick={() => handleConfirm(closing.id, 'auxiliar')}
                              disabled={confirmClosing.isPending}
                            >
                              <CheckCircle className="w-4 h-4 mr-1" />
                              Confirmar (Financeiro)
                            </Button>
                          ) : (
                            <Button variant="outline" size="sm" disabled className="opacity-50">
                              <Lock className="w-4 h-4 mr-1" />
                              Confirmar (Financeiro)
                            </Button>
                          )
                        )}
                        
                        {/* Admin Buttons - Two separate confirmations */}
                        {closing.status === 'confirmed_auxiliar' && canConfirmAdmin && (
                          <>
                            {/* Confirm Report Button */}
                            <Button 
                              size="sm"
                              variant="outline"
                              className="border-blue-400 text-blue-700 hover:bg-blue-50"
                              onClick={() => handleConfirm(closing.id, 'admin')}
                              disabled={confirmClosing.isPending || closing.total_cash_cents > 0}
                            >
                              <CheckCircle className="w-4 h-4 mr-1" />
                              Confirmar Relatório
                            </Button>

                            {/* Confirm Cash Button - Only if there's cash */}
                            {closing.total_cash_cents > 0 && (
                              <Button 
                                size="sm"
                                className="bg-green-600 hover:bg-green-700"
                                onClick={() => handleOpenCashConfirm(closing)}
                                disabled={confirmClosing.isPending}
                              >
                                <Banknote className="w-4 h-4 mr-1" />
                                Conferir Dinheiro ({formatCurrency(closing.total_cash_cents)})
                              </Button>
                            )}
                          </>
                        )}

                        {/* Admin locked button when not authorized */}
                        {closing.status === 'confirmed_auxiliar' && !canConfirmAdmin && (
                          <Button variant="outline" size="sm" disabled className="opacity-50">
                            <Lock className="w-4 h-4 mr-1" />
                            Aguardando Admin
                          </Button>
                        )}
                      </div>

                      {/* Sales detail - same format as new closing */}
                      {viewingClosingId === closing.id && closingSales.length > 0 && (
                        <div className="mt-4 border-t pt-4">
                          <h4 className="font-medium mb-2 text-sm">Vendas incluídas:</h4>
                          <div className="space-y-2 max-h-[500px] overflow-y-auto">
                            {closingSales.map(sale => {
                              // Check if tracking code is valid (not UUID)
                              const isValidTrackingCode = sale.tracking_code && 
                                !sale.tracking_code.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
                              
                              return (
                                <div key={sale.id} className="p-3 bg-muted/30 rounded-lg border space-y-2">
                                  {/* Line 1: Sale number + Client + View Button */}
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-bold text-primary">#{sale.sale_number}</span>
                                    <span className="font-medium truncate max-w-[200px]">{sale.lead_name || 'Cliente'}</span>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-6 px-2 text-xs"
                                      onClick={() => window.open(`/vendas/${sale.sale_id}`, '_blank')}
                                    >
                                      <Eye className="w-3 h-3 mr-1" />
                                      Ver Venda
                                    </Button>
                                    <span className="ml-auto font-semibold">{formatCurrency(sale.total_cents || 0)}</span>
                                  </div>
                                  
                                  {/* Line 2: Payment + Date + Seller */}
                                  <div className="flex items-center gap-2 text-sm flex-wrap">
                                    <Badge variant="outline" className="text-xs">
                                      {formatPaymentMethod(sale.payment_method)}
                                    </Badge>
                                    {sale.created_at && (
                                      <span className="text-xs text-muted-foreground">
                                        Venda: {format(parseISO(sale.created_at), "dd/MM/yy", { locale: ptBR })}
                                      </span>
                                    )}
                                    {sale.delivered_at && (
                                      <span className="text-xs text-muted-foreground">
                                        Entregue: {format(parseISO(sale.delivered_at), "dd/MM HH:mm", { locale: ptBR })}
                                      </span>
                                    )}
                                    {sale.seller_profile?.first_name && (
                                      <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700">
                                        <User className="w-3 h-3 mr-1" />
                                        {sale.seller_profile.first_name}
                                      </Badge>
                                    )}
                                  </div>
                                  
                                  {/* Line 3: Tracking (for carrier) */}
                                  {closingType === 'carrier' && (
                                    <div className="flex items-center gap-2 flex-wrap">
                                      {sale.delivery_status && (
                                        <Badge 
                                          variant="outline" 
                                          className={`text-xs ${
                                            sale.delivery_status.startsWith('delivered') 
                                              ? 'bg-green-100 text-green-700 border-green-300' 
                                              : 'bg-yellow-100 text-yellow-700 border-yellow-300'
                                          }`}
                                        >
                                          {sale.delivery_status.startsWith('delivered') ? '✅ Entregue' : '⏳ Pendente'}
                                        </Badge>
                                      )}
                                      {isValidTrackingCode && (
                                        <>
                                          <Badge variant="outline" className="text-xs bg-indigo-50 border-indigo-300 text-indigo-700">
                                            📦 {sale.tracking_code}
                                          </Badge>
                                          <Button
                                            variant="default"
                                            size="sm"
                                            className="h-6 px-2 text-xs bg-yellow-500 hover:bg-yellow-600 text-black font-semibold"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              window.open(`https://rastreamento.correios.com.br/app/index.php?objeto=${sale.tracking_code}`, '_blank');
                                            }}
                                          >
                                            📦 Rastrear
                                          </Button>
                                        </>
                                      )}
                                      {sale.melhor_envio_label?.company_name && (
                                        <span className="text-xs text-muted-foreground">
                                          {sale.melhor_envio_label.company_name} - {sale.melhor_envio_label.service_name}
                                        </span>
                                      )}
                                      {!isValidTrackingCode && sale.melhor_envio_label?.id && (
                                        <Badge variant="outline" className="text-xs bg-amber-100 text-amber-700 border-amber-300">
                                          🏷️ Etiqueta gerada (aguardando postagem)
                                        </Badge>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Cash Confirmation Dialog */}
        <Dialog open={cashConfirmDialogOpen} onOpenChange={setCashConfirmDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Banknote className="w-5 h-5 text-green-600" />
                Confirmar Recebimento em Dinheiro
              </DialogTitle>
              <DialogDescription>
                Você está confirmando que recebeu o valor em dinheiro deste fechamento.
              </DialogDescription>
            </DialogHeader>
            
            <div className="py-6">
              <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
                <p className="text-sm text-green-700 mb-2">Valor total em dinheiro</p>
                <p className="text-4xl font-bold text-green-700">
                  {formatCurrency(pendingCashAmount)}
                </p>
              </div>
              
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-yellow-800">
                    Ao confirmar, você atesta que conferiu e recebeu este valor em espécie.
                  </p>
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setCashConfirmDialogOpen(false)}>
                Cancelar
              </Button>
              <Button 
                className="bg-green-600 hover:bg-green-700"
                onClick={handleConfirmCash}
                disabled={confirmClosing.isPending}
              >
                {confirmClosing.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                <Banknote className="w-4 h-4 mr-2" />
                Confirmar Recebimento
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}

// Wrapper components for each route
export function MotoboyClosingPage() {
  return <DeliveryClosingPage closingType="motoboy" />;
}

export function CarrierClosingPage() {
  return <DeliveryClosingPage closingType="carrier" />;
}
