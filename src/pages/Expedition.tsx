import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { SmartLayout } from '@/components/layout/SmartLayout';
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
import { DispatchConfirmationDialog } from '@/components/expedition/DispatchConfirmationDialog';
import { useAuth } from '@/hooks/useAuth';

type TabFilter = 'todo' | 'draft' | 'printed' | 'separated' | 'dispatched' | 'returned' | 'carrier-no-tracking' | 'carrier-tracking' | 'pickup' | 'delivered' | 'cancelled';
type SortOrder = 'created' | 'delivery';

// Status colors for sale cards
const STATUS_BG_COLORS: Record<string, string> = {
  draft: '', // No background
  pending_expedition: 'bg-blue-50 dark:bg-blue-950/30 border-blue-200', // Light blue
  dispatched: 'bg-pink-50 dark:bg-pink-950/30 border-pink-200', // Light pink
  returned: 'bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200', // Light yellow
  'carrier-no-tracking': 'bg-orange-50 dark:bg-orange-950/30 border-orange-200', // Light orange
  'carrier-tracking': 'bg-red-50 dark:bg-red-950/30 border-red-200', // Light red/vermillion
  pickup: 'bg-purple-50 dark:bg-purple-950/30 border-purple-200', // Light purple for pickup
};

// Button colors for stats cards
const STATUS_BUTTON_COLORS: Record<string, { text: string; bg: string; border: string }> = {
  draft: { text: 'text-gray-700 dark:text-gray-300', bg: '', border: '' },
  printed: { text: 'text-blue-700 dark:text-blue-300', bg: 'bg-blue-50 dark:bg-blue-950/30', border: 'border-blue-200 dark:border-blue-800' },
  dispatched: { text: 'text-pink-700 dark:text-pink-300', bg: 'bg-pink-50 dark:bg-pink-950/30', border: 'border-pink-200 dark:border-pink-800' },
  returned: { text: 'text-yellow-700 dark:text-yellow-300', bg: 'bg-yellow-50 dark:bg-yellow-950/30', border: 'border-yellow-200 dark:border-yellow-800' },
  'carrier-no-tracking': { text: 'text-orange-700 dark:text-orange-300', bg: 'bg-orange-50 dark:bg-orange-950/30', border: 'border-orange-200 dark:border-orange-800' },
  'carrier-tracking': { text: 'text-red-700 dark:text-red-300', bg: 'bg-red-50 dark:bg-red-950/30', border: 'border-red-200 dark:border-red-800' },
  pickup: { text: 'text-purple-700 dark:text-purple-300', bg: 'bg-purple-50 dark:bg-purple-950/30', border: 'border-purple-200 dark:border-purple-800' },
};

export default function Expedition() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { profile, user } = useAuth();
  const organizationId = profile?.organization_id || null;
  const { data: sales = [], isLoading, error } = useExpeditionSales();
  const { data: regions = [] } = useDeliveryRegions();
  const { data: members = [] } = useTenantMembers();
  const { data: carriers = [] } = useShippingCarriers();
  const { data: trackingStatuses = [] } = useMotoboyTrackingStatuses();
  const updateSale = useUpdateSale();
  const updateMotoboyTracking = useUpdateMotoboyTracking();
  const updateCarrierTracking = useUpdateCarrierTracking();

  // Avoid spamming toast on retries
  const shownErrorRef = useRef<string | null>(null);
  useEffect(() => {
    if (!error) return;
    const msg = (error as any)?.message || 'Erro ao carregar vendas da expedição';
    if (shownErrorRef.current === msg) return;
    shownErrorRef.current = msg;
    console.error('[Expedicao] fetch error', error);
    toast.error('Falha ao carregar vendas. Atualize a página.');
  }, [error]);

  // State
  const [activeTab, setActiveTabState] = useState<TabFilter>('printed');
  const [sortOrder, setSortOrder] = useState<SortOrder>('delivery');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSales, setSelectedSales] = useState<Set<string>>(new Set());
  const [trackingInputs, setTrackingInputs] = useState<Record<string, string>>({});
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  // Optimistic UI: track sales being marked as printed
  const [optimisticPrinted, setOptimisticPrinted] = useState<Set<string>>(new Set());
  
  // Conference state per sale - tracks if all items have been checked
  const [conferenceStatus, setConferenceStatus] = useState<Record<string, boolean>>({});
  
  // Dispatch confirmation dialog state
  const [dispatchConfirmDialog, setDispatchConfirmDialog] = useState<{
    open: boolean;
    saleId: string | null;
    motoboyId?: string;
  }>({ open: false, saleId: null });

  // Handle tab change (local only - filtering is client-side)
  const setActiveTab = useCallback((tab: TabFilter) => {
    setActiveTabState(tab);
  }, []);

  const stats = useExpeditionStats(sales);

  // Get motoboy tracking status labels (custom or default)
  const getMotoboyStatusLabel = useCallback((status: MotoboyTrackingStatus): string => {
    const customStatus = trackingStatuses.find(s => s.status_key === status);
    return customStatus?.label || motoboyTrackingLabels[status] || status;
  }, [trackingStatuses]);

  // Helper to get sale's category for coloring
  const getSaleCategory = useCallback((sale: Sale): string => {
    if (sale.delivery_type === 'carrier' && sale.tracking_code && sale.status !== 'delivered' && sale.status !== 'cancelled') {
      return 'carrier-tracking';
    }
    if (sale.delivery_type === 'carrier' && !sale.tracking_code && sale.status !== 'cancelled' && sale.status !== 'delivered') {
      return 'carrier-no-tracking';
    }
    if (sale.status === 'pending_expedition') return 'printed';
    return sale.status;
  }, []);

  // Global search across ALL sales (ignoring tab filter)
  const globalSearchResults = useMemo(() => {
    if (!searchQuery.trim()) return null;
    
    const query = searchQuery.toLowerCase();
    const results = sales.filter(s => 
      s.lead?.name?.toLowerCase().includes(query) ||
      s.lead?.whatsapp?.includes(query) ||
      s.romaneio_number?.toString().includes(query) ||
      s.lead?.neighborhood?.toLowerCase().includes(query) ||
      s.lead?.city?.toLowerCase().includes(query) ||
      s.seller_profile?.first_name?.toLowerCase().includes(query) ||
      s.seller_profile?.last_name?.toLowerCase().includes(query) ||
      (s as any).delivery_region?.name?.toLowerCase().includes(query) ||
      s.items?.some((item: any) => item.requisition_number?.toLowerCase().includes(query))
    );
    
    return results;
  }, [sales, searchQuery]);

  // Filter and sort sales
  const filteredSales = useMemo(() => {
    // If searching, show global results instead of tab-filtered results
    if (searchQuery.trim() && globalSearchResults) {
      return globalSearchResults.sort((a, b) => {
        if (sortOrder === 'created') {
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        }
        const aStr = a.scheduled_delivery_date || '9999-12-31';
        const bStr = b.scheduled_delivery_date || '9999-12-31';
        return aStr.localeCompare(bStr);
      });
    }

    let filtered = [...sales];

    // Tab filter
    switch (activeTab) {
      case 'todo':
        // A FAZER: RASCUNHO + IMPRESSO + DESPACHADO + CORREIOS
        filtered = filtered.filter(s => 
          s.status === 'draft' || 
          s.status === 'pending_expedition' || 
          s.status === 'dispatched' ||
          (s.delivery_type === 'carrier' && s.status !== 'cancelled' && s.status !== 'delivered')
        );
        break;
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
        filtered = filtered.filter(s => s.delivery_type === 'carrier' && !s.tracking_code && s.status !== 'cancelled' && s.status !== 'delivered');
        break;
      case 'carrier-tracking':
        filtered = filtered.filter(s => s.delivery_type === 'carrier' && s.tracking_code && s.status !== 'delivered' && s.status !== 'cancelled');
        break;
      case 'pickup':
        // Retirada no Balcão - only pending pickups (not delivered or cancelled)
        filtered = filtered.filter(s => s.delivery_type === 'pickup' && s.status !== 'delivered' && s.status !== 'cancelled');
        break;
      case 'delivered':
        filtered = filtered.filter(s => s.status === 'delivered');
        break;
      case 'cancelled':
        filtered = filtered.filter(s => s.status === 'cancelled');
        break;
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
  }, [sales, activeTab, searchQuery, sortOrder, globalSearchResults]);

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

      // Keep checkpoints in sync for SaleDetail "Etapas da Venda"
      if (user?.id) {
        const { data: existing } = await supabase
          .from('sale_checkpoints')
          .select('id')
          .eq('sale_id', saleId)
          .eq('checkpoint_type', 'printed')
          .maybeSingle();

        if (existing?.id) {
          await supabase
            .from('sale_checkpoints')
            .update({ completed_at: new Date().toISOString(), completed_by: user.id })
            .eq('id', existing.id);
        } else if (organizationId) {
          await supabase.from('sale_checkpoints').insert({
            sale_id: saleId,
            organization_id: organizationId,
            checkpoint_type: 'printed',
            completed_at: new Date().toISOString(),
            completed_by: user.id,
          });
        }

        // Refresh checkpoints UI everywhere
        queryClient.invalidateQueries({ queryKey: ['sale-checkpoints', saleId] });
      }

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

  // Check if sale can be dispatched - validates business rules
  const canDispatchSale = useCallback((sale: Sale): { allowed: boolean; reason?: string } => {
    // Rule 1: Motoboy deliveries must have a motoboy selected
    if (sale.delivery_type === 'motoboy' && !sale.assigned_delivery_user_id) {
      return { 
        allowed: false, 
        reason: 'Selecione um motoboy antes de despachar esta venda.' 
      };
    }
    
    // Rule 2: Sale must be marked as "separated" (pending_expedition) before dispatching
    // Note: status 'pending_expedition' means it was printed AND separated
    if (sale.status !== 'pending_expedition') {
      return { 
        allowed: false, 
        reason: 'A venda precisa estar marcada como "Pedido Separado" antes de despachar.' 
      };
    }
    
    return { allowed: true };
  }, []);
  
  // Handle dispatch attempt - validates rules and shows confirmation if needed
  const handleDispatchAttempt = useCallback((sale: Sale) => {
    const { allowed, reason } = canDispatchSale(sale);
    
    if (!allowed) {
      toast.error(reason || 'Não é possível despachar esta venda.');
      return;
    }
    
    // Check if items were conference (all checked)
    const allItemsChecked = conferenceStatus[sale.id] ?? false;
    
    if (!allItemsChecked) {
      // Show confirmation dialog
      setDispatchConfirmDialog({
        open: true,
        saleId: sale.id,
        motoboyId: sale.assigned_delivery_user_id || undefined,
      });
      return;
    }
    
    // All validations passed - dispatch directly
    handleDispatch(sale.id, sale.assigned_delivery_user_id || undefined, false);
  }, [canDispatchSale, conferenceStatus]);
  
  // Execute dispatch with optional skip conference flag
  const handleDispatch = async (saleId: string, motoboyId?: string, skippedConference: boolean = false) => {
    setIsUpdating(saleId);
    try {
      await updateSale.mutateAsync({
        id: saleId,
        data: {
          status: 'dispatched' as any,
          assigned_delivery_user_id: motoboyId || null,
          motoboy_tracking_status: 'expedition_ready' as any,
        },
      });

      // Ensure checkpoint "Despachado" is checked in SaleDetail
      if (user?.id) {
        const { data: existing } = await supabase
          .from('sale_checkpoints')
          .select('id')
          .eq('sale_id', saleId)
          .eq('checkpoint_type', 'dispatched')
          .maybeSingle();

        if (existing?.id) {
          await supabase
            .from('sale_checkpoints')
            .update({ completed_at: new Date().toISOString(), completed_by: user.id })
            .eq('id', existing.id);
        } else if (organizationId) {
          await supabase.from('sale_checkpoints').insert({
            sale_id: saleId,
            organization_id: organizationId,
            checkpoint_type: 'dispatched',
            completed_at: new Date().toISOString(),
            completed_by: user.id,
          });
        }
        
        // Record in history whether conference was skipped
        if (organizationId) {
          await supabase.from('sale_checkpoint_history').insert({
            sale_id: saleId,
            organization_id: organizationId,
            checkpoint_type: 'dispatched',
            action: skippedConference ? 'dispatched_without_conference' : 'dispatched_with_conference',
            changed_by: user.id,
            notes: skippedConference 
              ? 'Despachado SEM conferência de itens - usuário optou por prosseguir sem verificar quantidades'
              : 'Despachado COM conferência de itens completa',
          });
        }

        queryClient.invalidateQueries({ queryKey: ['sale-checkpoints', saleId] });
      }

      // Register motoboy tracking only for motoboy deliveries
      const { data: saleRow } = await supabase
        .from('sales')
        .select('delivery_type')
        .eq('id', saleId)
        .maybeSingle();

      if (saleRow?.delivery_type === 'motoboy') {
        await updateMotoboyTracking.mutateAsync({
          saleId,
          status: 'expedition_ready',
          assignedMotoboyId: motoboyId || null,
        });
      }

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
      toast.success(`Status atualizado: ${getMotoboyStatusLabel(status)}`);
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
      // Use the central mutation so timestamps/stock/history stay consistent
      await updateSale.mutateAsync({
        id: saleId,
        data: { status: newStatus as any },
      });

      // Keep checkpoints in sync for "Entregue"
      if (newStatus === 'delivered' && user?.id) {
        const { data: existing } = await supabase
          .from('sale_checkpoints')
          .select('id')
          .eq('sale_id', saleId)
          .eq('checkpoint_type', 'delivered')
          .maybeSingle();

        if (existing?.id) {
          await supabase
            .from('sale_checkpoints')
            .update({ completed_at: new Date().toISOString(), completed_by: user.id })
            .eq('id', existing.id);
        } else if (organizationId) {
          await supabase.from('sale_checkpoints').insert({
            sale_id: saleId,
            organization_id: organizationId,
            checkpoint_type: 'delivered',
            completed_at: new Date().toISOString(),
            completed_by: user.id,
          });
        }

        queryClient.invalidateQueries({ queryKey: ['sale-checkpoints', saleId] });
      }

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
  const getShiftLabel = (shift?: string | null) => {
    if (shift === 'morning') return 'MANHÃ';
    if (shift === 'afternoon') return 'TARDE';
    return '';
  };

  const getDeliveryBadge = (sale: Sale) => {
    const deliveryDate = sale.scheduled_delivery_date ? parseISO(sale.scheduled_delivery_date) : null;
    const shiftLabel = getShiftLabel(sale.scheduled_delivery_shift);
    
    if (!deliveryDate) {
      return <Badge variant="outline" className="text-xs">Sem data</Badge>;
    }

    if (isToday(deliveryDate)) {
      return (
        <Badge className="bg-red-500 text-white text-xs animate-pulse">
          HOJE {shiftLabel && `• ${shiftLabel}`}
        </Badge>
      );
    }
    if (isTomorrow(deliveryDate)) {
      return (
        <Badge className="bg-orange-500 text-white text-xs">
          AMANHÃ {shiftLabel && `• ${shiftLabel}`}
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-xs">
        {format(deliveryDate, 'dd/MM', { locale: ptBR })} {shiftLabel && `• ${shiftLabel}`}
      </Badge>
    );
  };

  // Get status label for global search
  const getStatusLabel = useCallback((sale: Sale): string => {
    const category = getSaleCategory(sale);
    const labels: Record<string, string> = {
      draft: '👀 Rascunho',
      printed: '🖨️ Impresso',
      pending_expedition: '🖨️ Impresso',
      dispatched: '🚚 Despachado',
      returned: '⚠️ Voltou',
      delivered: '✅ Entregue',
      cancelled: '❌ Cancelado',
      'carrier-no-tracking': '📦 Correio s/ Rastreio',
      'carrier-tracking': '📮 Correio c/ Rastreio',
    };
    return labels[category] || sale.status;
  }, [getSaleCategory]);

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
      <SmartLayout>
        <div className="container max-w-7xl py-6 space-y-4">
          <Skeleton className="h-10 w-64" />
          <div className="grid grid-cols-4 gap-2">
            {[1,2,3,4].map(i => <Skeleton key={i} className="h-20" />)}
          </div>
          <Skeleton className="h-96" />
        </div>
      </SmartLayout>
    );
  }

  return (
    <SmartLayout>
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
            <Button variant="outline" onClick={() => navigate('/expedicao/etiquetas-correios')}>
              <Package className="w-4 h-4 mr-2" />
              Etiquetas Correios
            </Button>
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

        {/* Stats Cards - Row 1: Primary button + Status filters */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
          {/* A FAZER - Primary Button */}
          <Card 
            className={`cursor-pointer transition-all col-span-2 ${
              activeTab === 'todo' 
                ? 'ring-2 ring-primary bg-primary/10' 
                : 'bg-gradient-to-r from-primary/5 to-primary/10 hover:from-primary/10 hover:to-primary/20'
            }`}
            onClick={() => setActiveTab('todo')}
          >
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-primary">
                {stats.draft + stats.printed + stats.dispatched + stats.carrierNoTracking + stats.carrierWithTracking}
              </p>
              <p className="text-sm font-semibold text-primary">📋 A FAZER</p>
            </CardContent>
          </Card>
          
          {/* Individual status buttons with matching colors */}
          <Card 
            className={`cursor-pointer transition-all ${
              activeTab === 'draft' ? 'ring-2 ring-primary' : ''
            }`}
            onClick={() => setActiveTab('draft')}
          >
            <CardContent className="p-3 text-center">
              <p className="text-xl font-bold text-gray-700 dark:text-gray-300">{stats.draft}</p>
              <p className="text-xs text-gray-600 dark:text-gray-400">👀 Rascunho</p>
            </CardContent>
          </Card>
          <Card 
            className={`cursor-pointer transition-all ${STATUS_BUTTON_COLORS.printed.bg} ${STATUS_BUTTON_COLORS.printed.border} ${
              activeTab === 'printed' ? 'ring-2 ring-primary' : ''
            }`}
            onClick={() => setActiveTab('printed')}
          >
            <CardContent className="p-3 text-center">
              <p className={`text-xl font-bold ${STATUS_BUTTON_COLORS.printed.text}`}>{stats.printed}</p>
              <p className="text-xs text-blue-600 dark:text-blue-400">🖨️ Impresso</p>
            </CardContent>
          </Card>
          <Card 
            className={`cursor-pointer transition-all ${STATUS_BUTTON_COLORS.dispatched.bg} ${STATUS_BUTTON_COLORS.dispatched.border} ${
              activeTab === 'dispatched' ? 'ring-2 ring-primary' : ''
            }`}
            onClick={() => setActiveTab('dispatched')}
          >
            <CardContent className="p-3 text-center">
              <p className={`text-xl font-bold ${STATUS_BUTTON_COLORS.dispatched.text}`}>{stats.dispatched}</p>
              <p className="text-xs text-pink-600 dark:text-pink-400">🚚 Despachado</p>
            </CardContent>
          </Card>
          <Card 
            className={`cursor-pointer transition-all ${STATUS_BUTTON_COLORS.returned.bg} ${STATUS_BUTTON_COLORS.returned.border} ${
              activeTab === 'returned' ? 'ring-2 ring-primary' : ''
            }`}
            onClick={() => setActiveTab('returned')}
          >
            <CardContent className="p-3 text-center">
              <p className={`text-xl font-bold ${STATUS_BUTTON_COLORS.returned.text}`}>{stats.returned}</p>
              <p className="text-xs text-yellow-700 dark:text-yellow-400">⚠️ Voltou</p>
            </CardContent>
          </Card>
          <Card 
            className={`cursor-pointer transition-all ${
              activeTab === 'delivered' ? 'ring-2 ring-primary' : ''
            }`}
            onClick={() => setActiveTab('delivered')}
          >
            <CardContent className="p-3 text-center">
              <p className="text-xl font-bold text-green-700 dark:text-green-300">{stats.delivered}</p>
              <p className="text-xs text-green-600 dark:text-green-400">✅ Entregue</p>
            </CardContent>
          </Card>
          <Card 
            className={`cursor-pointer transition-all ${
              activeTab === 'cancelled' ? 'ring-2 ring-primary' : ''
            }`}
            onClick={() => setActiveTab('cancelled')}
          >
            <CardContent className="p-3 text-center">
              <p className="text-xl font-bold text-gray-500 dark:text-gray-500">{stats.cancelled}</p>
              <p className="text-xs text-gray-500 dark:text-gray-500">❌ Cancelado</p>
            </CardContent>
          </Card>
        </div>

        {/* Stats Cards - Row 2: Carrier tracking + Pickup */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          <Card 
            className={`cursor-pointer transition-all ${STATUS_BUTTON_COLORS['carrier-no-tracking'].bg} ${STATUS_BUTTON_COLORS['carrier-no-tracking'].border} ${
              activeTab === 'carrier-no-tracking' ? 'ring-2 ring-primary' : ''
            }`}
            onClick={() => setActiveTab('carrier-no-tracking')}
          >
            <CardContent className="p-3 text-center">
              <p className={`text-xl font-bold ${STATUS_BUTTON_COLORS['carrier-no-tracking'].text}`}>{stats.carrierNoTracking}</p>
              <p className="text-xs text-orange-600 dark:text-orange-400">📦 S/ Rastreio</p>
            </CardContent>
          </Card>
          <Card 
            className={`cursor-pointer transition-all ${STATUS_BUTTON_COLORS['carrier-tracking'].bg} ${STATUS_BUTTON_COLORS['carrier-tracking'].border} ${
              activeTab === 'carrier-tracking' ? 'ring-2 ring-primary' : ''
            }`}
            onClick={() => setActiveTab('carrier-tracking')}
          >
            <CardContent className="p-3 text-center">
              <p className={`text-xl font-bold ${STATUS_BUTTON_COLORS['carrier-tracking'].text}`}>{stats.carrierWithTracking}</p>
              <p className="text-xs text-red-600 dark:text-red-400">📮 Correio c/ Rastreio</p>
            </CardContent>
          </Card>
          <Card 
            className={`cursor-pointer transition-all ${STATUS_BUTTON_COLORS.pickup.bg} ${STATUS_BUTTON_COLORS.pickup.border} ${
              activeTab === 'pickup' ? 'ring-2 ring-primary' : ''
            }`}
            onClick={() => setActiveTab('pickup')}
          >
            <CardContent className="p-3 text-center">
              <p className={`text-xl font-bold ${STATUS_BUTTON_COLORS.pickup.text}`}>{stats.pickup}</p>
              <p className="text-xs text-purple-600 dark:text-purple-400">🏪 Retirada</p>
            </CardContent>
          </Card>
          {stats.tomorrowPrep > 0 && (
            <Card className="bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
              <CardContent className="p-3 text-center">
                <p className="text-xl font-bold text-amber-700 dark:text-amber-300">{stats.tomorrowPrep}</p>
                <p className="text-xs text-amber-600 dark:text-amber-400">🌅 Amanhã</p>
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

              const saleCategory = getSaleCategory(sale);
              const statusBgColor = STATUS_BG_COLORS[saleCategory] || '';
              const sellerName = sale.seller_profile ? `${sale.seller_profile.first_name || ''} ${sale.seller_profile.last_name || ''}`.trim() : null;
              const regionName = (sale as any).delivery_region?.name;
              const requisitionNumbers = sale.items?.filter((i: any) => i.requisition_number).map((i: any) => i.requisition_number) || [];

              return (
                <Card 
                  key={sale.id} 
                  className={`transition-all ${
                    isOptimisticPrinted
                      ? 'bg-green-50/50 dark:bg-green-950/20 border-green-300'
                      : isSelected 
                        ? 'ring-2 ring-primary bg-primary/5' 
                        : isTodaySale
                          ? `border-l-4 border-l-red-500 ${statusBgColor || 'bg-red-50/30 dark:bg-red-950/10'}`
                          : isTomorrowSale
                            ? `border-l-4 border-l-orange-400 ${statusBgColor || 'bg-orange-50/30 dark:bg-orange-950/10'}`
                            : statusBgColor
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
                        {/* Header Row 1 */}
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <Badge variant="outline" className="font-mono text-xs">
                            #{sale.romaneio_number?.toString().padStart(5, '0')}
                          </Badge>
                          {/* Show status when searching globally */}
                          {searchQuery.trim() && (
                            <Badge variant="secondary" className="text-xs">
                              {getStatusLabel(sale)}
                            </Badge>
                          )}
                          {getDeliveryBadge(sale)}
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

                        {/* Header Row 2: Region, City, Bairro, Seller */}
                        <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground mb-2">
                          {regionName && <span className="font-medium text-primary/80">📍 {regionName}</span>}
                          {sale.lead?.city && <span>• {sale.lead.city}</span>}
                          {sale.lead?.neighborhood && <span>• {sale.lead.neighborhood}</span>}
                          {sellerName && <span className="ml-auto">👤 {sellerName}</span>}
                        </div>

                        {/* Requisition Numbers for Manipulated Products */}
                        {requisitionNumbers.length > 0 && (
                          <div className="flex items-center gap-1 flex-wrap mb-2">
                            <span className="text-xs font-medium text-amber-700 dark:text-amber-400">🧪 Requisições:</span>
                            {requisitionNumbers.map((req: string, idx: number) => (
                              <Badge key={idx} variant="outline" className="text-xs font-mono bg-amber-50 dark:bg-amber-950/30 border-amber-300">
                                {req}
                              </Badge>
                            ))}
                          </div>
                        )}

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
                              quantity: i.quantity,
                              requisition_number: i.requisition_number
                            }))}
                            saleId={sale.id}
                            organizationId={organizationId}
                            stage={sale.status === 'returned' ? 'return' : sale.status === 'dispatched' ? 'dispatch' : 'separation'}
                            showHistory={true}
                            allowAdditionalConference={true}
                            onAllChecked={(allChecked) => {
                              setConferenceStatus(prev => {
                                if (prev[sale.id] === allChecked) return prev;
                                return { ...prev, [sale.id]: allChecked };
                              });
                            }}
                          />
                        )}

                        {/* Delivery Observation - seller notes for expedition/motoboy */}
                        {((sale as any).observation_1 || (sale as any).observation_2) && (
                          <div className="p-2 bg-yellow-50 dark:bg-yellow-950/30 rounded-lg border border-yellow-400 dark:border-yellow-700 mb-2">
                            <p className="text-sm text-yellow-800 dark:text-yellow-200">
                              <strong>⚠️ Obs Entrega:</strong> {(sale as any).observation_1}
                              {(sale as any).observation_2 && ` | ${(sale as any).observation_2}`}
                            </p>
                          </div>
                        )}
                        {sale.payment_proof_url && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs bg-green-50 border-green-300 text-green-700 hover:bg-green-100"
                            onClick={async () => {
                              const { openStorageFile } = await import('@/lib/storage-utils');
                              openStorageFile(sale.payment_proof_url!);
                            }}
                          >
                            <FileText className="w-3 h-3 mr-1" />
                            Comprovante de Pagamento
                          </Button>
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

                          {/* Status actions - hide for pickup (they go straight to delivered) */}
                          {sale.delivery_type !== 'pickup' && sale.status === 'draft' && !isOptimisticPrinted && (
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
                          
                          {sale.delivery_type !== 'pickup' && isOptimisticPrinted && sale.status === 'draft' && (
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
                                        {getMotoboyStatusLabel(status)}
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

                          {/* Quick actions for Pickup (Retirada no Balcão) */}
                          {sale.delivery_type === 'pickup' && sale.status !== 'delivered' && sale.status !== 'cancelled' && (
                            <div className="flex items-center gap-1 flex-wrap">
                              <Button
                                variant="default"
                                size="sm"
                                className="h-7 text-xs bg-green-600 hover:bg-green-700"
                                onClick={() => handleUpdateSaleStatus(sale.id, 'delivered')}
                                disabled={isBeingUpdated}
                              >
                                {isBeingUpdated ? (
                                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                ) : (
                                  <CheckCircle2 className="w-3 h-3 mr-1" />
                                )}
                              ✓ Entregue
                              </Button>
                              {sale.payment_proof_url && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs text-green-600 border-green-300"
                                  onClick={async () => {
                                    const { openStorageFile } = await import('@/lib/storage-utils');
                                    openStorageFile(sale.payment_proof_url!);
                                  }}
                                >
                                  <FileText className="w-3 h-3 mr-1" />
                                  Comprovante
                                </Button>
                              )}
                            </div>
                          )}

                          {/* Dispatch button - hide for pickup, only show for pending_expedition (separated) */}
                          {sale.delivery_type !== 'pickup' && sale.status === 'pending_expedition' && (
                            <Button
                              variant="default"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => handleDispatchAttempt(sale)}
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
                            onClick={() => window.open(`/vendas/${sale.id}`, '_blank')}
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
        
        {/* Dispatch Confirmation Dialog */}
        <DispatchConfirmationDialog
          open={dispatchConfirmDialog.open}
          onOpenChange={(open) => setDispatchConfirmDialog(prev => ({ ...prev, open }))}
          onGoBackToCheck={() => {
            // Just close the dialog - user will check items manually
            setDispatchConfirmDialog({ open: false, saleId: null });
          }}
          onConfirmWithoutCheck={() => {
            if (dispatchConfirmDialog.saleId) {
              handleDispatch(dispatchConfirmDialog.saleId, dispatchConfirmDialog.motoboyId, true);
            }
            setDispatchConfirmDialog({ open: false, saleId: null });
          }}
        />
      </div>
    </SmartLayout>
  );
}
