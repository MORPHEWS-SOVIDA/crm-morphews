import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { 
  Truck, 
  MapPin, 
  Phone, 
  Package,
  CheckCircle,
  Clock,
  Navigation,
  User,
  GripVertical,
  Calendar,
  Sun,
  Sunset,
  XCircle,
  ChevronRight,
  MessageCircle,
  RotateCcw,
} from 'lucide-react';
import { format, isToday, isTomorrow, parseISO, isAfter, isBefore, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  useMyDeliveries, 
  useUpdateSale, 
  formatCurrency, 
  getStatusLabel,
  DeliveryStatus,
  getDeliveryStatusLabel,
  Sale
} from '@/hooks/useSales';
import { useDeliveryReturnReasons } from '@/hooks/useDeliveryConfig';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Return reasons dialog
function NotDeliveredDialog({ 
  open, 
  onOpenChange, 
  sale, 
  onConfirm 
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void;
  sale: Sale | null;
  onConfirm: (reasonId: string, notes: string) => void;
}) {
  const { data: returnReasons = [] } = useDeliveryReturnReasons();
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [notes, setNotes] = useState('');

  const handleConfirm = () => {
    if (!selectedReason) {
      toast.error('Selecione um motivo');
      return;
    }
    onConfirm(selectedReason, notes);
    setSelectedReason('');
    setNotes('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-destructive flex items-center gap-2">
            <XCircle className="w-5 h-5" />
            Entrega não realizada
          </DialogTitle>
          <DialogDescription>
            Selecione o motivo pelo qual a entrega não foi concluída
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label>Cliente</Label>
            <p className="font-medium">{sale?.lead?.name}</p>
          </div>

          <div>
            <Label>Motivo *</Label>
            <Select value={selectedReason} onValueChange={setSelectedReason}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Selecione o motivo" />
              </SelectTrigger>
              <SelectContent>
                {returnReasons.map(reason => (
                  <SelectItem key={reason.id} value={reason.id}>
                    {reason.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Observações</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Detalhes adicionais..."
              className="mt-1"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={handleConfirm}>
            <RotateCcw className="w-4 h-4 mr-2" />
            Registrar Volta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Delivery card component with drag support
function DeliveryCard({ 
  sale, 
  onMarkDelivered, 
  onMarkNotDelivered,
  onOpenMaps,
  onOpenWhatsApp,
  isDragging
}: { 
  sale: Sale; 
  onMarkDelivered: () => void;
  onMarkNotDelivered: () => void;
  onOpenMaps: () => void;
  onOpenWhatsApp: () => void;
  isDragging?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: sale.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const getShiftIcon = (shift: string | null) => {
    switch(shift) {
      case 'morning': return <Sun className="w-4 h-4 text-amber-500" />;
      case 'afternoon': return <Sunset className="w-4 h-4 text-orange-500" />;
      default: return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getShiftLabel = (shift: string | null) => {
    switch(shift) {
      case 'morning': return 'Manhã';
      case 'afternoon': return 'Tarde';
      case 'full_day': return 'Dia todo';
      default: return '';
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-card border rounded-xl shadow-sm transition-all ${
        isDragging ? 'opacity-50 shadow-lg scale-105' : ''
      }`}
    >
      {/* Drag Handle + Header */}
      <div className="flex items-center gap-2 p-3 border-b bg-muted/30">
        <button
          {...attributes}
          {...listeners}
          className="touch-none p-1 hover:bg-muted rounded cursor-grab active:cursor-grabbing"
        >
          <GripVertical className="w-5 h-5 text-muted-foreground" />
        </button>
        
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-base truncate">{sale.lead?.name}</h3>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {getShiftIcon(sale.scheduled_delivery_shift)}
            <span>{getShiftLabel(sale.scheduled_delivery_shift)}</span>
            <span className="font-medium text-primary">
              {formatCurrency(sale.total_cents)}
            </span>
          </div>
        </div>

        <Badge variant="outline" className="text-xs">
          #{sale.romaneio_number?.toString().padStart(5, '0')}
        </Badge>
      </div>

      {/* Address Section */}
      <div className="p-3 space-y-3">
        {sale.lead?.street && (
          <div className="flex items-start gap-2 text-sm">
            <MapPin className="w-4 h-4 mt-0.5 text-primary flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-medium">
                {sale.lead.street}, {sale.lead.street_number}
                {sale.lead.complement && ` - ${sale.lead.complement}`}
              </p>
              <p className="text-muted-foreground">
                {sale.lead.neighborhood} - {sale.lead.city}/{sale.lead.state}
              </p>
              {sale.lead.cep && (
                <p className="text-xs text-muted-foreground">CEP: {sale.lead.cep}</p>
              )}
            </div>
          </div>
        )}

        {/* Delivery Notes */}
        {sale.lead?.delivery_notes && (
          <div className="p-2 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              <strong>Referência:</strong> {sale.lead.delivery_notes}
            </p>
          </div>
        )}

        {/* Products summary */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Package className="w-4 h-4" />
          <span>{sale.items?.length || 0} produto(s)</span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="p-3 pt-0 grid grid-cols-2 gap-2">
        {/* Top row: Maps and WhatsApp */}
        <Button 
          variant="outline" 
          size="sm"
          onClick={onOpenMaps}
          className="flex-1"
          disabled={!sale.lead?.street && !sale.lead?.google_maps_link}
        >
          <Navigation className="w-4 h-4 mr-1.5" />
          Mapa
        </Button>
        
        <Button 
          variant="outline" 
          size="sm"
          onClick={onOpenWhatsApp}
          className="flex-1"
        >
          <MessageCircle className="w-4 h-4 mr-1.5" />
          WhatsApp
        </Button>

        {/* Bottom row: Delivery actions */}
        <Button 
          variant="destructive"
          size="sm"
          onClick={onMarkNotDelivered}
          className="flex-1"
        >
          <XCircle className="w-4 h-4 mr-1.5" />
          Não Entregue
        </Button>

        <Button 
          size="sm"
          onClick={onMarkDelivered}
          className="flex-1 bg-green-600 hover:bg-green-700"
        >
          <CheckCircle className="w-4 h-4 mr-1.5" />
          Entregue
        </Button>
      </div>
    </div>
  );
}

// Group header component
function DateGroupHeader({ 
  date, 
  shift, 
  count 
}: { 
  date: string; 
  shift: string;
  count: number;
}) {
  const parsedDate = parseISO(date);
  
  let dateLabel = '';
  if (isToday(parsedDate)) {
    dateLabel = 'Hoje';
  } else if (isTomorrow(parsedDate)) {
    dateLabel = 'Amanhã';
  } else {
    dateLabel = format(parsedDate, "EEEE, dd 'de' MMMM", { locale: ptBR });
  }

  const getShiftBadge = () => {
    switch(shift) {
      case 'morning': 
        return <Badge className="bg-amber-100 text-amber-800 border-amber-200"><Sun className="w-3 h-3 mr-1" />Manhã</Badge>;
      case 'afternoon': 
        return <Badge className="bg-orange-100 text-orange-800 border-orange-200"><Sunset className="w-3 h-3 mr-1" />Tarde</Badge>;
      default: 
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Dia todo</Badge>;
    }
  };

  return (
    <div className="flex items-center justify-between py-3 px-1">
      <div className="flex items-center gap-2">
        <Calendar className="w-4 h-4 text-primary" />
        <span className="font-semibold text-base capitalize">{dateLabel}</span>
        {getShiftBadge()}
      </div>
      <Badge variant="outline">{count} entrega{count !== 1 ? 's' : ''}</Badge>
    </div>
  );
}

export default function MyDeliveries() {
  const navigate = useNavigate();
  const { data: deliveries = [], isLoading, refetch } = useMyDeliveries();
  const updateSale = useUpdateSale();

  const [notDeliveredDialogOpen, setNotDeliveredDialogOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [localOrder, setLocalOrder] = useState<Record<string, string[]>>({});

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Group deliveries by date and shift
  const groupedDeliveries = useMemo(() => {
    const pending = deliveries.filter(d => d.status === 'dispatched');
    
    // Sort by date, then shift (morning first), then position
    const sorted = [...pending].sort((a, b) => {
      // First by date
      const dateA = a.scheduled_delivery_date || '9999-12-31';
      const dateB = b.scheduled_delivery_date || '9999-12-31';
      if (dateA !== dateB) return dateA.localeCompare(dateB);
      
      // Then by shift
      const shiftOrder: Record<string, number> = { morning: 0, afternoon: 1, full_day: 2 };
      const shiftA = shiftOrder[a.scheduled_delivery_shift || 'full_day'] ?? 2;
      const shiftB = shiftOrder[b.scheduled_delivery_shift || 'full_day'] ?? 2;
      if (shiftA !== shiftB) return shiftA - shiftB;
      
      // Then by position
      return (a.delivery_position || 0) - (b.delivery_position || 0);
    });

    // Group by date+shift
    const groups: Record<string, Sale[]> = {};
    sorted.forEach(sale => {
      const date = sale.scheduled_delivery_date || 'sem-data';
      const shift = sale.scheduled_delivery_shift || 'full_day';
      const key = `${date}_${shift}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(sale);
    });

    // Apply local ordering if exists
    Object.keys(groups).forEach(key => {
      if (localOrder[key]) {
        groups[key].sort((a, b) => {
          const indexA = localOrder[key].indexOf(a.id);
          const indexB = localOrder[key].indexOf(b.id);
          return indexA - indexB;
        });
      }
    });

    return groups;
  }, [deliveries, localOrder]);

  const completedToday = useMemo(() => {
    return deliveries.filter(d => {
      if (d.status !== 'delivered' && d.status !== 'returned') return false;
      const deliveredAt = d.delivered_at || d.returned_at;
      if (!deliveredAt) return false;
      return isToday(new Date(deliveredAt));
    });
  }, [deliveries]);

  const handleDragEnd = useCallback(async (event: DragEndEvent, groupKey: string) => {
    const { active, over } = event;
    
    if (!over || active.id === over.id) return;

    const group = groupedDeliveries[groupKey];
    if (!group) return;

    const oldIndex = group.findIndex(s => s.id === active.id);
    const newIndex = group.findIndex(s => s.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    const newOrder = arrayMove(group, oldIndex, newIndex);
    
    // Update local state immediately
    setLocalOrder(prev => ({
      ...prev,
      [groupKey]: newOrder.map(s => s.id)
    }));

    // Save positions to database
    try {
      const updates = newOrder.map((sale, index) => 
        supabase
          .from('sales')
          .update({ delivery_position: index })
          .eq('id', sale.id)
      );
      await Promise.all(updates);
    } catch (error) {
      console.error('Erro ao salvar ordem:', error);
      toast.error('Erro ao salvar a ordem das entregas');
    }
  }, [groupedDeliveries]);

  const openMaps = (sale: Sale) => {
    // Prefer google_maps_link if available
    if (sale.lead?.google_maps_link) {
      window.open(sale.lead.google_maps_link, '_blank');
      return;
    }
    
    if (!sale.lead?.street) return;
    const address = encodeURIComponent(
      `${sale.lead.street}, ${sale.lead.street_number}, ${sale.lead.neighborhood}, ${sale.lead.city}, ${sale.lead.state}`
    );
    window.open(`https://www.google.com/maps/search/?api=1&query=${address}`, '_blank');
  };

  const openWhatsApp = (phone: string) => {
    const cleanPhone = phone.replace(/\D/g, '');
    const formattedPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
    window.open(`https://wa.me/${formattedPhone}`, '_blank');
  };

  const handleMarkDelivered = async (sale: Sale) => {
    await updateSale.mutateAsync({
      id: sale.id,
      data: {
        status: 'delivered',
        delivery_status: 'delivered_normal',
      }
    });
  };

  const handleMarkNotDelivered = async (reasonId: string, notes: string) => {
    if (!selectedSale) return;

    await updateSale.mutateAsync({
      id: selectedSale.id,
      data: {
        status: 'returned',
        return_reason_id: reasonId,
        return_notes: notes || null,
      } as any
    });

    setNotDeliveredDialogOpen(false);
    setSelectedSale(null);
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="space-y-4 p-4">
          <Skeleton className="h-12 w-48" />
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      </Layout>
    );
  }

  const pendingCount = Object.values(groupedDeliveries).flat().length;

  return (
    <Layout>
      <div className="space-y-4 pb-24 lg:pb-8">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm py-4 px-1 -mx-1 border-b">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">
                <Truck className="w-5 h-5 text-primary" />
                Minhas Entregas
              </h1>
              <p className="text-sm text-muted-foreground">
                {pendingCount} pendente{pendingCount !== 1 ? 's' : ''} • Arraste para reordenar
              </p>
            </div>
          </div>
        </div>

        {/* Empty State */}
        {pendingCount === 0 && (
          <Card className="py-12">
            <CardContent className="flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Truck className="w-8 h-8 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Nenhuma entrega pendente</h3>
              <p className="text-muted-foreground text-sm">
                Todas as entregas foram concluídas!
              </p>
            </CardContent>
          </Card>
        )}

        {/* Grouped Deliveries */}
        {Object.entries(groupedDeliveries).map(([groupKey, sales]) => {
          const [date, shift] = groupKey.split('_');
          
          return (
            <div key={groupKey} className="space-y-2">
              <DateGroupHeader 
                date={date} 
                shift={shift} 
                count={sales.length} 
              />
              
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={(event) => handleDragEnd(event, groupKey)}
              >
                <SortableContext
                  items={sales.map(s => s.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-3">
                    {sales.map((sale) => (
                      <DeliveryCard
                        key={sale.id}
                        sale={sale}
                        onMarkDelivered={() => handleMarkDelivered(sale)}
                        onMarkNotDelivered={() => {
                          setSelectedSale(sale);
                          setNotDeliveredDialogOpen(true);
                        }}
                        onOpenMaps={() => openMaps(sale)}
                        onOpenWhatsApp={() => openWhatsApp(sale.lead?.whatsapp || '')}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </div>
          );
        })}

        {/* Completed Today */}
        {completedToday.length > 0 && (
          <div className="space-y-2 mt-8">
            <div className="flex items-center gap-2 py-3">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span className="font-semibold">Concluídas hoje</span>
              <Badge variant="secondary">{completedToday.length}</Badge>
            </div>
            
            <div className="space-y-2">
              {completedToday.map((sale) => (
                <Card key={sale.id} className="opacity-75">
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium">{sale.lead?.name}</h3>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          {sale.status === 'returned' ? (
                            <Badge variant="destructive" className="text-xs">Voltou</Badge>
                          ) : (
                            <Badge className="bg-green-100 text-green-800 text-xs">Entregue</Badge>
                          )}
                          {(sale.delivered_at || sale.returned_at) && (
                            <span>
                              às {format(new Date(sale.delivered_at || sale.returned_at!), "HH:mm")}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="font-semibold">{formatCurrency(sale.total_cents)}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Not Delivered Dialog */}
      <NotDeliveredDialog
        open={notDeliveredDialogOpen}
        onOpenChange={setNotDeliveredDialogOpen}
        sale={selectedSale}
        onConfirm={handleMarkNotDelivered}
      />
    </Layout>
  );
}
