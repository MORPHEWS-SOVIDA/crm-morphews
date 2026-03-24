import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
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
  Lock,
  Banknote,
  AlertCircle,
  Search,
  Filter,
  X,
  CheckCheck,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { formatCurrency } from '@/hooks/useSales';
import { calculateCategoryTotals } from '@/lib/paymentCategories';
import { PaymentCategoryTotals } from '@/components/expedition/PaymentCategoryTotals';
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
  useBulkConfirmDeliveryClosing,
  closingTypeConfig,
  canUserConfirmAdmin,
  type DeliveryClosing as DeliveryClosingType,
} from '@/hooks/useDeliveryClosings';
import { useAuth } from '@/hooks/useAuth';
import { useMyPermissions } from '@/hooks/useUserPermissions';

export default function PickupClosing() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { data: permissions } = useMyPermissions();
  const config = closingTypeConfig['pickup'];
  
  const initialTab = searchParams.get('tab') === 'historico' ? 'history' : 'new';
  const [activeTab, setActiveTab] = useState<'new' | 'history'>(initialTab);
  const [selectedSales, setSelectedSales] = useState<Set<string>>(new Set());
  const [viewingClosingId, setViewingClosingId] = useState<string | null>(null);
  const [cashConfirmDialogOpen, setCashConfirmDialogOpen] = useState(false);
  const [pendingCashClosingId, setPendingCashClosingId] = useState<string | null>(null);
  const [pendingCashClosingIds, setPendingCashClosingIds] = useState<string[]>([]);
  const [pendingCashAmount, setPendingCashAmount] = useState(0);
  const [isBulkCashConfirm, setIsBulkCashConfirm] = useState(false);
  const [confirmCreateDialogOpen, setConfirmCreateDialogOpen] = useState(false);
  const [confirmCreateMode, setConfirmCreateMode] = useState<'selected' | 'all'>('selected');

  // Filters for new tab
  const [searchTerm, setSearchTerm] = useState('');
  
  // Filters for history tab
  const [historyStatusFilter, setHistoryStatusFilter] = useState<string>('all');
  const [selectedClosings, setSelectedClosings] = useState<Set<string>>(new Set());
  const [bulkConfirming, setBulkConfirming] = useState(false);

  const { data: availableSales = [], isLoading: loadingSales } = useAvailableClosingSales('pickup');
  const { data: closings = [], isLoading: loadingClosings } = useDeliveryClosings('pickup');
  const { data: closingSales = [] } = useDeliveryClosingSales(viewingClosingId || undefined);
  const createClosing = useCreateDeliveryClosing();
  const confirmClosing = useConfirmDeliveryClosing();
  const bulkConfirmClosing = useBulkConfirmDeliveryClosing();

  const userEmail = user?.email?.toLowerCase();
  const canConfirmAuxiliar = permissions?.reports_view === true;
  const canConfirmAdmin = canUserConfirmAdmin(userEmail, 'pickup');

  // Sync tab with URL
  useEffect(() => {
    const tabParam = activeTab === 'history' ? 'historico' : null;
    if (tabParam) {
      setSearchParams({ tab: tabParam }, { replace: true });
    } else {
      searchParams.delete('tab');
      setSearchParams(searchParams, { replace: true });
    }
  }, [activeTab]);

  // Filter sales for new tab
  const filteredSales = useMemo(() => {
    if (!searchTerm) return availableSales;
    const search = searchTerm.toLowerCase();
    return availableSales.filter(sale => {
      const leadName = sale.lead?.name?.toLowerCase() || '';
      const romaneioNum = String(sale.romaneio_number || '');
      return leadName.includes(search) || romaneioNum.includes(search);
    });
  }, [availableSales, searchTerm]);

  // Filter closings for history tab
  const filteredClosings = useMemo(() => {
    if (historyStatusFilter === 'all') return closings;
    if (historyStatusFilter === 'pending') return closings.filter(c => c.status === 'pending');
    if (historyStatusFilter === 'confirmed_auxiliar') return closings.filter(c => c.status === 'confirmed_auxiliar');
    if (historyStatusFilter === 'confirmed_final') return closings.filter(c => c.status === 'confirmed_final');
    return closings;
  }, [closings, historyStatusFilter]);

  const pendingClosingsCount = useMemo(() => closings.filter(c => c.status !== 'confirmed_final').length, [closings]);

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

  const selectedSalesData = useMemo(() => {
    return availableSales.filter(s => selectedSales.has(s.id));
  }, [availableSales, selectedSales]);

  const totals = useMemo(() => {
    return calculateCategoryTotals(selectedSalesData);
  }, [selectedSalesData]);

  const handleCreateClosing = async () => {
    if (selectedSalesData.length === 0) {
      toast.error('Selecione pelo menos uma venda');
      return;
    }
    setConfirmCreateMode('selected');
    setConfirmCreateDialogOpen(true);
  };

  const handleCreateClosingAll = async () => {
    if (availableSales.length === 0) {
      toast.error('Nenhuma venda pendente');
      return;
    }
    setConfirmCreateMode('all');
    setConfirmCreateDialogOpen(true);
  };

  const handleConfirmCreate = async () => {
    setConfirmCreateDialogOpen(false);
    const salesToClose = confirmCreateMode === 'all' ? availableSales : selectedSalesData;
    
    try {
      const closing = await createClosing.mutateAsync({
        closingType: 'pickup',
        sales: salesToClose,
      });
      
      toast.success(`Fechamento #${closing.closing_number} criado com ${salesToClose.length} vendas!`);
      setSelectedSales(new Set());
      setViewingClosingId(closing.id);
      setActiveTab('history');
    } catch (error) {
      toast.error('Erro ao criar fechamento');
      console.error(error);
    }
  };

  const handleConfirm = async (closingId: string, type: 'auxiliar' | 'admin') => {
    if (type === 'auxiliar' && !canConfirmAuxiliar) {
      toast.error('Você não tem permissão para confirmar como auxiliar');
      return;
    }
    if (type === 'admin' && !canConfirmAdmin) {
      toast.error('Você não tem permissão para confirmar como admin');
      return;
    }

    try {
      await confirmClosing.mutateAsync({ closingId, closingType: 'pickup', type });
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
        closingType: 'pickup', 
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

  const toggleClosingSelection = (closingId: string) => {
    setSelectedClosings(prev => {
      const next = new Set(prev);
      if (next.has(closingId)) next.delete(closingId);
      else next.add(closingId);
      return next;
    });
  };

  const handleBulkConfirm = async (type: 'auxiliar' | 'admin') => {
    const closingsToConfirm = filteredClosings.filter(c => selectedClosings.has(c.id));
    if (closingsToConfirm.length === 0) return;

    const validIds = closingsToConfirm
      .filter(c => {
        if (type === 'auxiliar' && c.status !== 'pending') return false;
        if (type === 'admin' && c.status !== 'confirmed_auxiliar') return false;
        if (type === 'admin' && c.total_cash_cents > 0) return false;
        return true;
      })
      .map(c => c.id);

    if (validIds.length === 0) return;

    try {
      const result = await bulkConfirmClosing.mutateAsync({ closingIds: validIds, closingType: 'pickup', type });
      setSelectedClosings(new Set());
      if (result.successCount > 0) toast.success(`${result.successCount} fechamento(s) confirmado(s)!`);
      if (result.errorCount > 0) toast.error(`${result.errorCount} fechamento(s) falharam`);
    } catch (error: any) {
      toast.error(error?.message || 'Erro ao confirmar em lote');
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

  const colors = {
    gradient: 'from-purple-50 to-purple-100 dark:from-purple-950/30 dark:to-purple-900/20 border-purple-200',
    text: 'text-purple-600',
    title: 'text-purple-700',
    button: 'bg-purple-600 hover:bg-purple-700',
    selected: 'bg-purple-50 dark:bg-purple-950/30',
    ring: 'ring-purple-500',
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/expedicao')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Store className={`w-6 h-6 ${colors.text}`} />
              {config.title}
            </h1>
            <p className="text-muted-foreground">{config.subtitle}</p>
          </div>
          {/* Quick link to history */}
          {activeTab === 'new' && pendingClosingsCount > 0 && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                setActiveTab('history');
                setHistoryStatusFilter('pending');
              }}
              className="border-yellow-300 text-yellow-700 hover:bg-yellow-50"
            >
              <History className="w-4 h-4 mr-1" />
              {pendingClosingsCount} não conferido(s)
            </Button>
          )}
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
                  <Store className="w-16 h-16 mx-auto mb-4 opacity-30" />
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
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          placeholder="Buscar por cliente ou nº venda..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-9"
                        />
                      </div>
                      {searchTerm && (
                        <Button variant="ghost" size="icon" onClick={() => setSearchTerm('')} title="Limpar busca">
                          <X className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Selection controls + Batch button */}
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <p className="text-sm text-muted-foreground">
                    {searchTerm ? (
                      <>{filteredSales.length} de {availableSales.length} venda(s) • {selectedSales.size} selecionada(s)</>
                    ) : (
                      <>{availableSales.length} venda(s) disponível(eis) • {selectedSales.size} selecionada(s)</>
                    )}
                  </p>
                  <div className="flex gap-2">
                    <Button 
                      variant="default" 
                      size="sm" 
                      onClick={handleCreateClosingAll}
                      disabled={createClosing.isPending || availableSales.length === 0}
                      className={colors.button}
                    >
                      {createClosing.isPending ? (
                        <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                      ) : (
                        <CheckCheck className="w-4 h-4 mr-1" />
                      )}
                      Baixar Todas ({availableSales.length})
                    </Button>
                    <Button variant="outline" size="sm" onClick={selectAll}>
                      Selecionar {searchTerm ? 'Filtradas' : 'Todas'}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={clearSelection}>
                      Limpar
                    </Button>
                  </div>
                </div>

                {/* Sales list using SaleSelectionCard */}
                <Card>
                  <CardContent className="p-0">
                    {filteredSales.length === 0 ? (
                      <div className="py-12 text-center text-muted-foreground">
                        <Search className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p>Nenhuma venda encontrada</p>
                        <Button variant="link" onClick={() => setSearchTerm('')} className="mt-2">
                          Limpar busca
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
                            showTracking={false}
                            showProofLink={true}
                            showEditPayment={true}
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
            {/* History filters */}
            <Card className="bg-muted/30 mb-4">
              <CardContent className="py-3">
                <div className="flex flex-col md:flex-row gap-3 items-center">
                  <Select value={historyStatusFilter} onValueChange={setHistoryStatusFilter}>
                    <SelectTrigger className="w-full md:w-[220px]">
                      <Filter className="w-4 h-4 mr-2" />
                      <SelectValue placeholder="Filtrar por status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos ({closings.length})</SelectItem>
                      <SelectItem value="pending">⏳ Pendente ({closings.filter(c => c.status === 'pending').length})</SelectItem>
                      <SelectItem value="confirmed_auxiliar">✓ Auxiliar Confirmou ({closings.filter(c => c.status === 'confirmed_auxiliar').length})</SelectItem>
                      <SelectItem value="confirmed_final">✅ Confirmado ({closings.filter(c => c.status === 'confirmed_final').length})</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground flex-1">
                    {filteredClosings.length} fechamento(s)
                  </p>
                  {historyStatusFilter !== 'all' && (
                    <Button variant="ghost" size="sm" onClick={() => setHistoryStatusFilter('all')}>
                      <X className="w-4 h-4 mr-1" />
                      Limpar filtro
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Bulk selection bar */}
            {filteredClosings.some(c => c.status !== 'confirmed_final') && (
              <Card className="bg-primary/5 border-primary/20 mb-4">
                <CardContent className="py-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <Checkbox
                      checked={
                        filteredClosings.filter(c => c.status !== 'confirmed_final').length > 0 &&
                        filteredClosings.filter(c => c.status !== 'confirmed_final').every(c => selectedClosings.has(c.id))
                      }
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedClosings(new Set(filteredClosings.filter(c => c.status !== 'confirmed_final').map(c => c.id)));
                        } else {
                          setSelectedClosings(new Set());
                        }
                      }}
                    />
                    <span className="text-sm font-medium">
                      {selectedClosings.size > 0
                        ? `${selectedClosings.size} selecionado(s)`
                        : 'Selecionar todos pendentes'}
                    </span>
                    {selectedClosings.size > 0 && (
                      <>
                        {canConfirmAuxiliar && filteredClosings.some(c => selectedClosings.has(c.id) && c.status === 'pending') && (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleBulkConfirm('auxiliar')}
                            disabled={bulkConfirmClosing.isPending}
                          >
                            {bulkConfirmClosing.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <CheckCheck className="w-4 h-4 mr-1" />}
                            Confirmar Financeiro ({filteredClosings.filter(c => selectedClosings.has(c.id) && c.status === 'pending').length})
                          </Button>
                        )}
                        {canConfirmAdmin && filteredClosings.some(c => selectedClosings.has(c.id) && c.status === 'confirmed_auxiliar' && c.total_cash_cents === 0) && (
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700"
                            onClick={() => handleBulkConfirm('admin')}
                            disabled={bulkConfirmClosing.isPending}
                          >
                            {bulkConfirmClosing.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <CheckCheck className="w-4 h-4 mr-1" />}
                            Confirmar Relatório ({filteredClosings.filter(c => selectedClosings.has(c.id) && c.status === 'confirmed_auxiliar' && c.total_cash_cents === 0).length})
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => setSelectedClosings(new Set())}>
                          <X className="w-4 h-4 mr-1" />
                          Limpar
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {loadingClosings ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredClosings.length === 0 ? (
              <Card>
                <CardContent className="py-16 text-center text-muted-foreground">
                  <History className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <p className="text-lg font-medium">
                    {historyStatusFilter !== 'all' ? 'Nenhum fechamento com este status' : 'Nenhum fechamento realizado ainda'}
                  </p>
                  {historyStatusFilter !== 'all' && (
                    <Button variant="link" onClick={() => setHistoryStatusFilter('all')} className="mt-2">
                      Ver todos
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {filteredClosings.map(closing => (
                  <Card 
                    key={closing.id} 
                    className={`transition-all ${selectedClosings.has(closing.id) ? 'ring-2 ring-primary/40' : ''} ${viewingClosingId === closing.id ? `ring-2 ${colors.ring}` : ''}`}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <CardTitle className="text-lg flex items-center gap-2">
                          {closing.status !== 'confirmed_final' && (
                            <Checkbox
                              checked={selectedClosings.has(closing.id)}
                              onCheckedChange={() => toggleClosingSelection(closing.id)}
                            />
                          )}
                          <Store className="w-5 h-5" />
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
                          {viewingClosingId === closing.id ? 'Ocultar' : 'Ver Vendas'}
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handlePrint(closing)}>
                          <Printer className="w-4 h-4 mr-1" />
                          Imprimir
                        </Button>

                        {/* Auxiliar confirmation (requires reports_view permission) */}
                        {!closing.confirmed_at_auxiliar && canConfirmAuxiliar && (
                          <Button 
                            size="sm" 
                            variant="outline"
                            className="bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-300"
                            onClick={() => handleConfirm(closing.id, 'auxiliar')}
                            disabled={confirmClosing.isPending}
                          >
                            {confirmClosing.isPending ? (
                              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                            ) : (
                              <Lock className="w-4 h-4 mr-1" />
                            )}
                            Confirmar (Auxiliar)
                          </Button>
                        )}

                        {/* Admin (cash) confirmation - only show after auxiliar confirmed */}
                        {closing.confirmed_at_auxiliar && !closing.confirmed_at_admin && canConfirmAdmin && (
                          <>
                            {closing.total_cash_cents > 0 ? (
                              <Button 
                                size="sm" 
                                variant="outline"
                                className="bg-green-50 hover:bg-green-100 text-green-700 border-green-300"
                                onClick={() => handleOpenCashConfirm(closing)}
                                disabled={confirmClosing.isPending}
                              >
                                <Banknote className="w-4 h-4 mr-1" />
                                Conferir Dinheiro ({formatCurrency(closing.total_cash_cents)})
                              </Button>
                            ) : (
                              <Button 
                                size="sm" 
                                variant="outline"
                                className="bg-green-50 hover:bg-green-100 text-green-700 border-green-300"
                                onClick={() => handleConfirm(closing.id, 'admin')}
                                disabled={confirmClosing.isPending}
                              >
                                {confirmClosing.isPending ? (
                                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                                ) : (
                                  <Lock className="w-4 h-4 mr-1" />
                                )}
                                Confirmar Final
                              </Button>
                            )}
                          </>
                        )}
                      </div>

                      {/* Sales detail when viewing */}
                      {viewingClosingId === closing.id && closingSales.length > 0 && (
                        <div className="mt-4 border-t pt-4">
                          <h4 className="font-medium mb-2 text-sm">Vendas do Fechamento:</h4>
                          <div className="space-y-2 max-h-64 overflow-y-auto">
                            {closingSales.map(cs => (
                              <div key={cs.id} className="flex items-center justify-between p-2 bg-muted/50 rounded text-sm">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">#{cs.sale_number}</span>
                                  <span className="text-muted-foreground">{cs.lead_name}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Badge variant="secondary" className="text-xs">
                                    {cs.payment_method || 'N/A'}
                                  </Badge>
                                  <span className="font-medium">{formatCurrency(cs.total_cents || 0)}</span>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0"
                                    onClick={() => window.open(`/vendas/${cs.sale_id}`, '_blank')}
                                    title="Ver venda"
                                  >
                                    <Eye className="w-3 h-3" />
                                  </Button>
                                </div>
                              </div>
                            ))}
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

        {/* Cash confirmation dialog */}
        <Dialog open={cashConfirmDialogOpen} onOpenChange={setCashConfirmDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Banknote className="w-5 h-5 text-green-600" />
                Confirmar Recebimento de Dinheiro
              </DialogTitle>
              <DialogDescription>
                Confirme que você recebeu o dinheiro em espécie deste fechamento.
              </DialogDescription>
            </DialogHeader>
            
            <div className="py-6">
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">Valor em dinheiro a conferir:</p>
                <p className="text-4xl font-bold text-green-600">{formatCurrency(pendingCashAmount)}</p>
              </div>
              
              <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-amber-800">
                  Ao confirmar, você atesta que recebeu este valor em dinheiro. 
                  Esta ação não pode ser desfeita.
                </p>
              </div>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setCashConfirmDialogOpen(false)}>
                Cancelar
              </Button>
              <Button 
                className="bg-green-600 hover:bg-green-700"
                onClick={handleConfirmCash}
                disabled={confirmClosing.isPending}
              >
                {confirmClosing.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Banknote className="w-4 h-4 mr-2" />
                )}
                Confirmar Recebimento
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Confirm Create Closing Dialog */}
        <Dialog open={confirmCreateDialogOpen} onOpenChange={setConfirmCreateDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-yellow-500" />
                Confirmar Criação de Fechamento
              </DialogTitle>
              <DialogDescription>
                Você está prestes a criar um fechamento com{' '}
                <strong>{confirmCreateMode === 'all' ? availableSales.length : selectedSalesData.length} venda(s)</strong>.
                {confirmCreateMode === 'all' && (
                  <span className="block mt-2 text-yellow-600 font-medium">
                    ⚠️ Todas as vendas disponíveis serão incluídas neste fechamento.
                  </span>
                )}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmCreateDialogOpen(false)}>
                Cancelar
              </Button>
              <Button 
                className={colors.button}
                onClick={handleConfirmCreate}
                disabled={createClosing.isPending}
              >
                {createClosing.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <FileText className="w-4 h-4 mr-2" />
                )}
                Sim, Criar Fechamento
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
