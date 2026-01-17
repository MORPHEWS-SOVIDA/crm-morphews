import React, { useState, useMemo, useCallback } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  Package,
  Printer,
  Search,
  AlertTriangle,
  Clock,
  Truck,
  CheckCircle2,
  RotateCcw,
  MapPin,
  Calendar,
  Sun,
  Sunset,
  Eye,
  Send,
  FileText,
  ChevronDown,
  Sparkles,
  PackageCheck,
  PackageX,
  Loader2,
} from 'lucide-react';
import { format, parseISO, isToday, isTomorrow, startOfDay, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  useExpeditionSales,
  useExpeditionStats,
  getSuggestedMotoboy,
} from '@/hooks/useExpeditionSales';
import { useUpdateSale, formatCurrency, Sale } from '@/hooks/useSales';
import { useDeliveryRegions, type DeliveryRegion } from '@/hooks/useDeliveryConfig';
import { useTenantMembers } from '@/hooks/multi-tenant';
import { useShippingCarriers } from '@/hooks/useDeliveryConfig';
import { 
  useMotoboyTrackingStatuses, 
  useUpdateMotoboyTracking,
  motoboyTrackingLabels, 
  motoboyTrackingOrder,
  MotoboyTrackingStatus 
} from '@/hooks/useMotoboyTracking';
import {
  useUpdateCarrierTracking,
  carrierTrackingLabels,
  carrierTrackingOrder,
  type CarrierTrackingStatus,
} from '@/hooks/useCarrierTracking';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { ProductConference } from '@/components/expedition/ProductConference';
import { useAuth } from '@/hooks/useAuth';

type TabFilter = 'draft' | 'printed' | 'separated' | 'dispatched' | 'returned' | 'carrier-no-tracking';
type SortOrder = 'created' | 'delivery';

export default function Expedition() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const organizationId = profile?.organization_id || null;
  const { data: sales = [], isLoading, refetch } = useExpeditionSales();
  const { data: regions = [] } = useDeliveryRegions();
  const { data: members = [] } = useTenantMembers();
  const { data: carriers = [] } = useShippingCarriers();
  const { data: trackingStatuses = [] } = useMotoboyTrackingStatuses();
  const updateSale = useUpdateSale();
  const updateMotoboyTracking = useUpdateMotoboyTracking();
  const updateCarrierTracking = useUpdateCarrierTracking();

  // State
  const [activeTab, setActiveTabState] = useState<TabFilter>('draft');
  const [sortOrder, setSortOrder] = useState<SortOrder>('delivery');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSales, setSelectedSales] = useState<Set<string>>(new Set());
  const [trackingInputs, setTrackingInputs] = useState<Record<string, string>>({});
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  // Optimistic UI: track sales being marked as printed
  const [optimisticPrinted, setOptimisticPrinted] = useState<Set<string>>(new Set());

  // Handle tab change with refetch
  const setActiveTab = useCallback((tab: TabFilter) => {
    setActiveTabState(tab);
    refetch();
  }, [refetch]);

  const stats = useExpeditionStats(sales);

  // Get status labels (custom or default)
  const getStatusLabel = useCallback((status: MotoboyTrackingStatus): string => {
    const customStatus = trackingStatuses.find(s => s.status_key === status);
    return customStatus?.label || motoboyTrackingLabels[status] || status;
  }, [trackingStatuses]);

  // Filter and sort sales
  const filteredSales = useMemo(() => {
    let filtered = [...sales];
    const today = startOfDay(new Date());
    const tomorrow = addDays(today, 1);

    // Tab filter
    switch (activeTab) {
      case 'draft':
        filtered = filtered.filter(s => s.status === 'draft');
        break;
      case 'printed':
        filtered = filtered.filter(s => s.status === 'pending_expedition');
        break;
      case 'dispatched':
        filtered = filtered.filter(s => s.status === 'dispatched');
        break;
      case 'returned':
        filtered = filtered.filter(s => s.status === 'returned');
        break;
      case 'carrier-no-tracking':
        filtered = filtered.filter(s => s.delivery_type === 'carrier' && !s.tracking_code && s.status !== 'cancelled');
        break;
    }

    // Search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(s => 
        s.lead?.name?.toLowerCase().includes(query) ||
        s.lead?.whatsapp?.includes(query) ||
        s.romaneio_number?.toString().includes(query)
      );
    }

    // Sort
    return filtered.sort((a, b) => {
      if (sortOrder === 'created') {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      } else {
        // Sort by delivery date, putting "today" first, then "tomorrow", then rest
        const dateA = a.scheduled_delivery_date ? parseISO(a.scheduled_delivery_date) : null;
        const dateB = b.scheduled_delivery_date ? parseISO(b.scheduled_delivery_date) : null;

        if (dateA && isToday(dateA) && (!dateB || !isToday(dateB))) return -1;
        if (dateB && isToday(dateB) && (!dateA || !isToday(dateA))) return 1;
        if (dateA && isTomorrow(dateA) && (!dateB || !isTomorrow(dateB))) return -1;
        if (dateB && isTomorrow(dateB) && (!dateA || !isTomorrow(dateA))) return 1;

        const aStr = a.scheduled_delivery_date || '9999-12-31';
        const bStr = b.scheduled_delivery_date || '9999-12-31';
        return aStr.localeCompare(bStr);
      }
    });
  }, [sales, activeTab, searchQuery, sortOrder]);

  // Select/deselect
  const toggleSelect = (id: string) => {
    setSelectedSales(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedSales(new Set(filteredSales.map(s => s.id)));
  };

  const deselectAll = () => {
    setSelectedSales(new Set());
  };

  // Actions - Fixed: use 'thermal' format for thermal print
  const handlePrintRomaneio = (saleId: string, format: 'a5' | 'a5x2' | 'thermal') => {
    window.open(`/vendas/${saleId}/romaneio?format=${format}&auto=true`, '_blank', 'noopener');
  };

  const handleBatchPrint = (format: 'a5' | 'a5x2' | 'thermal') => {
    const ids = selectedSales.size > 0 ? Array.from(selectedSales) : filteredSales.map(s => s.id);
    if (ids.length === 0) {
      toast.error('Nenhuma venda para imprimir');
      return;
    }
    // Open batch print page with all IDs
    window.open(`/romaneios/lote?ids=${ids.join(',')}&format=${format}&auto=true`, '_blank', 'noopener');
    toast.success(`Abrindo ${ids.length} romaneios para impressão`);
  };

  const handleMarkAsPrinted = async (saleId: string) => {
    // Optimistic update - immediately show as printed
    setOptimisticPrinted(prev => new Set(prev).add(saleId));
    setIsUpdating(saleId);
    
    try {
      await updateSale.mutateAsync({
        id: saleId,
        data: { status: 'pending_expedition' as any },
      });
      toast.success('Marcado como impresso');
    } catch (error) {
      // Revert optimistic update on error
      setOptimisticPrinted(prev => {
        const next = new Set(prev);
        next.delete(saleId);
        return next;
      });
      toast.error('Erro ao atualizar status');
    } finally {
      setIsUpdating(null);
    }
  };

  const handleDispatch = async (saleId: string, motoboyId?: string) => {
    setIsUpdating(saleId);
    try {
      const updateData: any = {
        status: 'dispatched',
        dispatched_at: new Date().toISOString(),
        motoboy_tracking_status: 'expedition_ready', // Auto-set status when dispatching
      };
      if (motoboyId) {
        updateData.assigned_delivery_user_id = motoboyId;
      }
      await updateSale.mutateAsync({
        id: saleId,
        data: updateData,
      });
      
      // Also register in tracking history
      await updateMotoboyTracking.mutateAsync({ 
        saleId, 
        status: 'expedition_ready',
        assignedMotoboyId: motoboyId || null
      });
      
      toast.success('Venda despachada!');
    } catch (error) {
      toast.error('Erro ao despachar');
    } finally {
      setIsUpdating(null);
    }
  };

  const handleSaveTracking = async (saleId: string) => {
    const tracking = trackingInputs[saleId];
    if (!tracking?.trim()) {
      toast.error('Informe o código de rastreio');
      return;
    }
    setIsUpdating(saleId);
    try {
      await supabase
        .from('sales')
        .update({ tracking_code: tracking.trim() })
        .eq('id', saleId);
      queryClient.invalidateQueries({ queryKey: ['expedition-sales'] });
      queryClient.invalidateQueries({ queryKey: ['sale', saleId] });
      toast.success('Rastreio salvo!');
      setTrackingInputs(prev => ({ ...prev, [saleId]: '' }));
    } catch (error) {
      toast.error('Erro ao salvar rastreio');
    } finally {
      setIsUpdating(null);
    }
  };

  const handleAssignMotoboy = async (saleId: string, userId: string | null) => {
    setIsUpdating(saleId);
    try {
      await supabase
        .from('sales')
        .update({ assigned_delivery_user_id: userId })
        .eq('id', saleId);
      queryClient.invalidateQueries({ queryKey: ['expedition-sales'] });
      queryClient.invalidateQueries({ queryKey: ['sale', saleId] });
      toast.success('Motoboy atribuído');
    } catch (error) {
      toast.error('Erro ao atribuir motoboy');
    } finally {
      setIsUpdating(null);
    }
  };

  const handleUpdateMotoboyStatus = async (saleId: string, status: MotoboyTrackingStatus) => {
    setIsUpdating(saleId);
    try {
      await updateMotoboyTracking.mutateAsync({ saleId, status });
      queryClient.invalidateQueries({ queryKey: ['expedition-sales'] });
      queryClient.invalidateQueries({ queryKey: ['sale', saleId] });
      queryClient.invalidateQueries({ queryKey: ['motoboy-tracking-history', saleId] });
      toast.success(`Status atualizado: ${getStatusLabel(status)}`);
    } catch (error) {
      toast.error('Erro ao atualizar status');
    } finally {
      setIsUpdating(null);
    }
  };

  const handleUpdateCarrierSubStatus = async (saleId: string, status: CarrierTrackingStatus) => {
    setIsUpdating(saleId);
    try {
      await updateCarrierTracking.mutateAsync({ saleId, status });
      // Invalidate all related queries
      queryClient.invalidateQueries({ queryKey: ['expedition-sales'] });
      queryClient.invalidateQueries({ queryKey: ['sale', saleId] });
      queryClient.invalidateQueries({ queryKey: ['carrier-tracking-history', saleId] });
      toast.success(`Status atualizado: ${carrierTrackingLabels[status]}`);
    } catch (error) {
      toast.error('Erro ao atualizar status');
    } finally {
      setIsUpdating(null);
    }
  };

  const handleUpdateSaleStatus = async (saleId: string, newStatus: 'delivered' | 'returned') => {
    setIsUpdating(saleId);
    try {
      await supabase
        .from('sales')
        .update({ status: newStatus })
        .eq('id', saleId);
      // Invalidate all related queries so all pages stay in sync
      queryClient.invalidateQueries({ queryKey: ['expedition-sales'] });
      queryClient.invalidateQueries({ queryKey: ['sale', saleId] });
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['sale-checkpoints', saleId] });
      toast.success(newStatus === 'delivered' ? 'Marcado como entregue!' : 'Marcado como voltou');
    } catch (error) {
      toast.error('Erro ao atualizar status');
    } finally {
      setIsUpdating(null);
    }
  };

  // Helpers
  const getDeliveryBadge = (sale: Sale) => {
    const deliveryDate = sale.scheduled_delivery_date ? parseISO(sale.scheduled_delivery_date) : null;
    
    if (!deliveryDate) {
      return <Badge variant="outline" className="text-xs">Sem data</Badge>;
    }

    if (isToday(deliveryDate)) {
      return <Badge className="bg-red-500 text-white text-xs animate-pulse">HOJE</Badge>;
    }
    if (isTomorrow(deliveryDate)) {
      return <Badge className="bg-orange-500 text-white text-xs">AMANHÃ</Badge>;
    }
    return (
      <Badge variant="outline" className="text-xs">
        {format(deliveryDate, 'dd/MM', { locale: ptBR })}
      </Badge>
    );
  };

  const getShiftIcon = (shift?: string | null) => {
    if (shift === 'morning') return <Sun className="w-3 h-3 text-yellow-500" />;
    if (shift === 'afternoon') return <Sunset className="w-3 h-3 text-orange-500" />;
    return null;
  };

  const getDeliveryTypeBadge = (sale: Sale) => {
    if (sale.delivery_type === 'motoboy') {
      return <Badge variant="secondary" className="text-xs">🛵 Motoboy</Badge>;
    }
    if (sale.delivery_type === 'carrier') {
      const carrier = carriers.find(c => c.id === sale.shipping_carrier_id);
      return <Badge variant="secondary" className="text-xs">📦 {carrier?.name || 'Correio'}</Badge>;
    }
    if (sale.delivery_type === 'pickup') {
      return <Badge variant="secondary" className="text-xs">🏪 Retirada</Badge>;
    }
    return null;
  };

  const getMemberName = (userId?: string | null) => {
    if (!userId) return null;
    const member = members.find(m => m.user_id === userId);
    return member ? `${member.profile?.first_name || ''} ${member.profile?.last_name || ''}`.trim() : null;
  };

  const getRegionUsers = useCallback((regionId?: string | null) => {
    if (!regionId) return members;
    const region = (regions as DeliveryRegion[]).find(r => r.id === regionId);
    if (!region?.assigned_users?.length) return members;
    const assignedIds = new Set(region.assigned_users.map(u => u.user_id));
    return members.filter(m => assignedIds.has(m.user_id));
  }, [regions, members]);

  if (isLoading) {
    return (
      <Layout>
        <div className="container max-w-7xl py-6 space-y-4">
          <Skeleton className="h-10 w-64" />
          <div className="grid grid-cols-4 gap-2">
            {[1,2,3,4].map(i => <Skeleton key={i} className="h-20" />)}
          </div>
          <Skeleton className="h-96" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container max-w-7xl py-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Package className="w-5 h-5 text-primary" />
              Central de Expedição
            </h1>
            <p className="text-sm text-muted-foreground">
              Gerencie todas as vendas para despacho
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate('/relatorios/expedicao')}>
              <FileText className="w-4 h-4 mr-2" />
              Relatório
            </Button>
          </div>
        </div>

        {/* Alert Cards */}
        {(stats.urgentToday > 0 || stats.carrierNoTracking > 0 || stats.returned > 0) && (
          <div className="grid gap-2 sm:grid-cols-3">
            {stats.urgentToday > 0 && (
              <Card className="border-red-300 bg-red-50 dark:bg-red-950/30">
                <CardContent className="p-3 flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                  <div>
                    <p className="font-semibold text-red-700 dark:text-red-400">{stats.urgentToday} rascunhos para HOJE</p>
                    <p className="text-xs text-red-600 dark:text-red-500">Precisam sair urgente!</p>
                  </div>
                </CardContent>
              </Card>
            )}
            {stats.carrierNoTracking > 0 && (
              <Card className="border-orange-300 bg-orange-50 dark:bg-orange-950/30">
                <CardContent className="p-3 flex items-center gap-3">
                  <PackageX className="w-5 h-5 text-orange-600" />
                  <div>
                    <p className="font-semibold text-orange-700 dark:text-orange-400">{stats.carrierNoTracking} correios sem rastreio</p>
                    <p className="text-xs text-orange-600 dark:text-orange-500">Adicione os códigos</p>
                  </div>
                </CardContent>
              </Card>
            )}
            {stats.returned > 0 && (
              <Card className="border-red-300 bg-red-50 dark:bg-red-950/30">
                <CardContent className="p-3 flex items-center gap-3">
                  <RotateCcw className="w-5 h-5 text-red-600" />
                  <div>
                    <p className="font-semibold text-red-700 dark:text-red-400">{stats.returned} vendas voltaram</p>
                    <p className="text-xs text-red-600 dark:text-red-500">Ação necessária</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
          <Card 
            className={`cursor-pointer transition-all ${activeTab === 'draft' ? 'ring-2 ring-primary' : ''}`}
            onClick={() => setActiveTab('draft')}
          >
            <CardContent className="p-3 text-center">
              <p className="text-xl font-bold text-gray-700 dark:text-gray-300">{stats.draft}</p>
              <p className="text-xs text-gray-600 dark:text-gray-400">👀 Rascunho</p>
            </CardContent>
          </Card>
          <Card 
            className={`cursor-pointer transition-all ${activeTab === 'printed' ? 'ring-2 ring-primary' : ''}`}
            onClick={() => setActiveTab('printed')}
          >
            <CardContent className="p-3 text-center">
              <p className="text-xl font-bold text-blue-700 dark:text-blue-300">{stats.printed}</p>
              <p className="text-xs text-blue-600 dark:text-blue-400">🖨️ Impresso</p>
            </CardContent>
          </Card>
          <Card 
            className={`cursor-pointer transition-all ${activeTab === 'dispatched' ? 'ring-2 ring-primary' : ''}`}
            onClick={() => setActiveTab('dispatched')}
          >
            <CardContent className="p-3 text-center">
              <p className="text-xl font-bold text-indigo-700 dark:text-indigo-300">{stats.dispatched}</p>
              <p className="text-xs text-indigo-600 dark:text-indigo-400">🛵 Despachado</p>
            </CardContent>
          </Card>
          <Card 
            className={`cursor-pointer transition-all ${activeTab === 'returned' ? 'ring-2 ring-primary' : ''}`}
            onClick={() => setActiveTab('returned')}
          >
            <CardContent className="p-3 text-center">
              <p className="text-xl font-bold text-red-700 dark:text-red-300">{stats.returned}</p>
              <p className="text-xs text-red-600 dark:text-red-400">⚠️ Voltou</p>
            </CardContent>
          </Card>
          <Card 
            className={`cursor-pointer transition-all ${activeTab === 'carrier-no-tracking' ? 'ring-2 ring-primary' : ''}`}
            onClick={() => setActiveTab('carrier-no-tracking')}
          >
            <CardContent className="p-3 text-center">
              <p className="text-xl font-bold text-orange-700 dark:text-orange-300">{stats.carrierNoTracking}</p>
              <p className="text-xs text-orange-600 dark:text-orange-400">📦 S/ Rastreio</p>
            </CardContent>
          </Card>
          {stats.tomorrowPrep > 0 && (
            <Card className="bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-800">
              <CardContent className="p-3 text-center">
                <p className="text-xl font-bold text-yellow-700 dark:text-yellow-300">{stats.tomorrowPrep}</p>
                <p className="text-xs text-yellow-600 dark:text-yellow-400">🌅 Amanhã</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Toolbar */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-3">
              {/* Search */}
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, telefone ou romaneio..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-9"
                />
              </div>

              {/* Sort */}
              <Select value={sortOrder} onValueChange={(v) => setSortOrder(v as SortOrder)}>
                <SelectTrigger className="w-[180px] h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="delivery">Por data de entrega</SelectItem>
                  <SelectItem value="created">Por data de lançamento</SelectItem>
                </SelectContent>
              </Select>

              {/* Selection */}
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={selectAll}>
                  Selec. Todos
                </Button>
                {selectedSales.size > 0 && (
                  <Button variant="ghost" size="sm" onClick={deselectAll}>
                    Limpar ({selectedSales.size})
                  </Button>
                )}
              </div>

              {/* Batch Print */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="default" size="sm">
                    <Printer className="w-4 h-4 mr-2" />
                    Imprimir {selectedSales.size > 0 ? `(${selectedSales.size})` : 'Todos'}
                    <ChevronDown className="w-4 h-4 ml-2" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleBatchPrint('a5')}>
                    A5 - Meia folha
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleBatchPrint('a5x2')}>
                    A5x2 - Duas cópias
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleBatchPrint('thermal')}>
                    T - Térmico 80mm
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardContent>
        </Card>

        {/* Sales List */}
        {filteredSales.length === 0 ? (
          <Card className="py-12">
            <CardContent className="flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <PackageCheck className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Nenhuma venda nesta categoria</h3>
              <p className="text-muted-foreground text-sm">
                {activeTab === 'draft' ? 'Todas as vendas já foram processadas!' : 'Selecione outra aba para ver mais vendas'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {filteredSales.map((sale) => {
              const suggestedMotoboy = sale.delivery_type === 'motoboy' && !sale.assigned_delivery_user_id
                ? getSuggestedMotoboy(sale, regions, members)
                : null;
              const regionUsers = getRegionUsers(sale.delivery_region_id);
              const isSelected = selectedSales.has(sale.id);
              const deliveryDate = sale.scheduled_delivery_date ? parseISO(sale.scheduled_delivery_date) : null;
              const isTodaySale = deliveryDate && isToday(deliveryDate);
              const isTomorrowSale = deliveryDate && isTomorrow(deliveryDate);
              const isBeingUpdated = isUpdating === sale.id;
              const isOptimisticPrinted = optimisticPrinted.has(sale.id);

              return (
                <Card 
                  key={sale.id} 
                  className={`transition-all ${
                    isOptimisticPrinted
                      ? 'bg-green-50/50 dark:bg-green-950/20 border-green-300'
                      : isSelected 
                        ? 'ring-2 ring-primary bg-primary/5' 
                        : isTodaySale
                          ? 'border-l-4 border-l-red-500 bg-red-50/30 dark:bg-red-950/10'
                          : isTomorrowSale
                            ? 'border-l-4 border-l-orange-400 bg-orange-50/30 dark:bg-orange-950/10'
                            : ''
                  }`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      {/* Checkbox */}
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleSelect(sale.id)}
                        className="mt-1"
                      />

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        {/* Header */}
                        <div className="flex items-center gap-2 flex-wrap mb-2">
                          <Badge variant="outline" className="font-mono text-xs">
                            #{sale.romaneio_number?.toString().padStart(5, '0')}
                          </Badge>
                          {getDeliveryBadge(sale)}
                          {getShiftIcon(sale.scheduled_delivery_shift)}
                          {getDeliveryTypeBadge(sale)}
                          <span className="font-semibold truncate">{sale.lead?.name}</span>
                          <span className="text-sm font-medium text-primary">
                            {formatCurrency(sale.total_cents)}
                          </span>
                          {sale.assigned_delivery_user_id && (
                            <Badge variant="outline" className="text-xs">
                              🛵 {getMemberName(sale.assigned_delivery_user_id)}
                            </Badge>
                          )}
                        </div>

                        {/* Address */}
                        {sale.lead?.street && (
                          <p className="text-xs text-muted-foreground mb-2">
                            <MapPin className="w-3 h-3 inline mr-1" />
                            {sale.lead.street}, {sale.lead.street_number} - {sale.lead.neighborhood}, {sale.lead.city}
                          </p>
                        )}

                        {/* Products with Conference Checkboxes */}
                        {sale.items && sale.items.length > 0 && (
                          <ProductConference 
                            items={sale.items.map(i => ({
                              id: i.id,
                              product_name: i.product_name,
                              quantity: i.quantity
                            }))}
                            saleId={sale.id}
                            organizationId={organizationId}
                            stage={sale.status === 'returned' ? 'return' : sale.status === 'dispatched' ? 'dispatch' : 'separation'}
                            showHistory={true}
                            allowAdditionalConference={true}
                          />
                        )}

                        {/* Actions Row */}
                        <div className="flex flex-wrap items-center gap-2 pt-3 mt-3 border-t">
                          {/* Print buttons */}
                          <div className="flex gap-1">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="h-7 text-xs px-2"
                              onClick={() => handlePrintRomaneio(sale.id, 'a5')}
                            >
                              A5
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="h-7 text-xs px-2"
                              onClick={() => handlePrintRomaneio(sale.id, 'a5x2')}
                            >
                              A5x2
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="h-7 text-xs px-2"
                              onClick={() => handlePrintRomaneio(sale.id, 'thermal')}
                            >
                              T
                            </Button>
                          </div>

                          {/* Status actions */}
                          {sale.status === 'draft' && !isOptimisticPrinted && (
                            <Button
                              variant="secondary"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => handleMarkAsPrinted(sale.id)}
                              disabled={isBeingUpdated}
                            >
                              {isBeingUpdated ? (
                                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                              ) : (
                                <Printer className="w-3 h-3 mr-1" />
                              )}
                              Marcar Impresso
                            </Button>
                          )}
                          
                          {isOptimisticPrinted && sale.status === 'draft' && (
                            <Badge className="bg-green-600 text-white text-xs">
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              Impresso ✓
                            </Badge>
                          )}

                          {/* Motoboy selection and status for motoboy deliveries */}
                          {sale.delivery_type === 'motoboy' && sale.status !== 'delivered' && (
                            <div className="flex items-center gap-1 flex-wrap">
                              {/* Motoboy selector */}
                              <Select
                                value={sale.assigned_delivery_user_id || 'none'}
                                onValueChange={(v) => handleAssignMotoboy(sale.id, v === 'none' ? null : v)}
                              >
                                <SelectTrigger className="h-7 text-xs w-[130px]">
                                  <SelectValue placeholder="Motoboy..." />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">Sem motoboy</SelectItem>
                                  {regionUsers.map(m => (
                                    <SelectItem key={m.user_id} value={m.user_id}>
                                      {m.profile?.first_name} {m.profile?.last_name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              
                              {/* AI Suggestion */}
                              {suggestedMotoboy && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-xs text-primary"
                                  onClick={() => handleAssignMotoboy(sale.id, suggestedMotoboy.user_id)}
                                  title={`Sugestão IA: ${suggestedMotoboy.name}`}
                                >
                                  <Sparkles className="w-3 h-3 mr-1" />
                                  {suggestedMotoboy.name.split(' ')[0]}
                                </Button>
                              )}
                              
                              {/* Motoboy tracking status - show for dispatched */}
                              {sale.status === 'dispatched' && (
                                <Select
                                  value={sale.motoboy_tracking_status || ''}
                                  onValueChange={(v) => handleUpdateMotoboyStatus(sale.id, v as MotoboyTrackingStatus)}
                                >
                                  <SelectTrigger className="h-7 text-xs w-[150px]">
                                    <SelectValue placeholder="Status entrega..." />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {motoboyTrackingOrder.map(status => (
                                      <SelectItem key={status} value={status}>
                                        {getStatusLabel(status)}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
                            </div>
                          )}

                          {/* Carrier tracking and status */}
                          {sale.delivery_type === 'carrier' && (
                            <div className="flex items-center gap-1 flex-wrap">
                              {sale.tracking_code ? (
                                <Badge variant="outline" className="text-xs">
                                  🔗 {sale.tracking_code}
                                </Badge>
                              ) : (
                                <>
                                  <Input
                                    placeholder="Rastreio..."
                                    value={trackingInputs[sale.id] || ''}
                                    onChange={(e) => setTrackingInputs(prev => ({ ...prev, [sale.id]: e.target.value }))}
                                    className="h-7 text-xs w-[140px]"
                                  />
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    className="h-7 text-xs"
                                    onClick={() => handleSaveTracking(sale.id)}
                                    disabled={isBeingUpdated}
                                  >
                                    Salvar
                                  </Button>
                                </>
                              )}
                              
                              {/* Carrier sub-status selector (logistics tracking) */}
                              <Select
                                value={sale.carrier_tracking_status || ''}
                                onValueChange={(v) => handleUpdateCarrierSubStatus(sale.id, v as CarrierTrackingStatus)}
                              >
                                <SelectTrigger className="h-7 text-xs w-[180px]">
                                  <SelectValue placeholder="Status correio..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {carrierTrackingOrder.map(status => (
                                    <SelectItem key={status} value={status}>
                                      {carrierTrackingLabels[status]}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}

                          {/* Quick action: Mark as handed to motoboy */}
                          {sale.status === 'dispatched' && sale.delivery_type === 'motoboy' && 
                           sale.motoboy_tracking_status !== 'handed_to_motoboy' && 
                           sale.motoboy_tracking_status !== 'with_motoboy' &&
                           sale.motoboy_tracking_status !== 'delivered' &&
                           sale.motoboy_tracking_status !== 'returned' && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs text-cyan-600 border-cyan-300 hover:bg-cyan-50"
                              onClick={() => handleUpdateMotoboyStatus(sale.id, 'handed_to_motoboy' as MotoboyTrackingStatus)}
                              disabled={isBeingUpdated}
                            >
                              <Package className="w-3 h-3 mr-1" />
                              Entregar ao Motoboy
                            </Button>
                          )}

                          {/* Status buttons for dispatched sales - Entregue / Voltou */}
                          {sale.status === 'dispatched' && (
                            <div className="flex items-center gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs text-green-600 border-green-300 hover:bg-green-50"
                                onClick={() => handleUpdateSaleStatus(sale.id, 'delivered')}
                                disabled={isBeingUpdated}
                              >
                                <CheckCircle2 className="w-3 h-3 mr-1" />
                                Entregue
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs text-orange-600 border-orange-300 hover:bg-orange-50"
                                onClick={() => handleUpdateSaleStatus(sale.id, 'returned')}
                                disabled={isBeingUpdated}
                              >
                                <RotateCcw className="w-3 h-3 mr-1" />
                                Voltou
                              </Button>
                            </div>
                          )}

                          {/* Dispatch button */}
                          {(sale.status === 'draft' || sale.status === 'pending_expedition') && !isOptimisticPrinted && (
                            <Button
                              variant="default"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => handleDispatch(sale.id, sale.assigned_delivery_user_id || undefined)}
                              disabled={isBeingUpdated}
                            >
                              {isBeingUpdated ? (
                                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                              ) : (
                                <Send className="w-3 h-3 mr-1" />
                              )}
                              Despachar
                            </Button>
                          )}

                          {/* View sale */}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs ml-auto"
                            onClick={() => navigate(`/vendas/${sale.id}`)}
                          >
                            <Eye className="w-3 h-3 mr-1" />
                            Ver
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
