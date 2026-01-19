import React, { useState, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { SmartLayout } from '@/components/layout/SmartLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
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
  Upload,
  DollarSign,
  AlertTriangle,
  CreditCard,
  Camera,
  MapPinned,
  ClipboardCheck,
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
import { 
  useMotoboyTrackingStatuses, 
  useUpdateMotoboyTracking,
  getMotoboyStatusLabel,
  motoboyTrackingOrder,
  motoboyTrackingLabels,
  type MotoboyTrackingStatus 
} from '@/hooks/useMotoboyTracking';
import { useAuth } from '@/hooks/useAuth';
import { ProductConference } from '@/components/expedition/ProductConference';
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

// Return reasons dialog with photo and location capture
function NotDeliveredDialog({ 
  open, 
  onOpenChange, 
  sale, 
  onConfirm 
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void;
  sale: Sale | null;
  onConfirm: (reasonId: string, notes: string, photoFile: File | null, location: {lat: number, lng: number} | null) => void;
}) {
  const { data: returnReasons = [] } = useDeliveryReturnReasons();
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [location, setLocation] = useState<{lat: number, lng: number} | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('Geolocalização não suportada pelo navegador');
      return;
    }

    setIsGettingLocation(true);
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
        setIsGettingLocation(false);
        toast.success('Localização capturada!');
      },
      (error) => {
        setIsGettingLocation(false);
        switch(error.code) {
          case error.PERMISSION_DENIED:
            setLocationError('Permissão de localização negada');
            break;
          case error.POSITION_UNAVAILABLE:
            setLocationError('Localização indisponível');
            break;
          case error.TIMEOUT:
            setLocationError('Tempo esgotado ao obter localização');
            break;
          default:
            setLocationError('Erro ao obter localização');
        }
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleConfirm = () => {
    if (!selectedReason) {
      toast.error('Selecione um motivo');
      return;
    }
    onConfirm(selectedReason, notes, photoFile, location);
    // Reset states
    setSelectedReason('');
    setNotes('');
    setPhotoFile(null);
    setPhotoPreview(null);
    setLocation(null);
    setLocationError(null);
  };

  const handleClose = () => {
    onOpenChange(false);
    setSelectedReason('');
    setNotes('');
    setPhotoFile(null);
    setPhotoPreview(null);
    setLocation(null);
    setLocationError(null);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-destructive flex items-center gap-2">
            <XCircle className="w-5 h-5" />
            Entrega não realizada
          </DialogTitle>
          <DialogDescription>
            Registre os detalhes da tentativa de entrega
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

          {/* Photo capture */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Camera className="w-4 h-4" />
              Foto da casa do cliente
              <span className="text-xs text-muted-foreground">(opcional)</span>
            </Label>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handlePhotoChange}
              className="hidden"
            />
            {photoPreview ? (
              <div className="relative">
                <img 
                  src={photoPreview} 
                  alt="Foto da casa" 
                  className="w-full h-32 object-cover rounded-lg border"
                />
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2 h-6 w-6"
                  onClick={() => {
                    setPhotoFile(null);
                    setPhotoPreview(null);
                    if (photoInputRef.current) photoInputRef.current.value = '';
                  }}
                >
                  <XCircle className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => photoInputRef.current?.click()}
              >
                <Camera className="w-4 h-4 mr-2" />
                Tirar foto
              </Button>
            )}
          </div>

          {/* Location capture */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <MapPinned className="w-4 h-4" />
              Localização atual
              <span className="text-xs text-muted-foreground">(opcional)</span>
            </Label>
            {location ? (
              <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span className="text-sm font-medium text-green-700 dark:text-green-300">
                      Localização capturada
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs"
                    onClick={() => setLocation(null)}
                  >
                    Limpar
                  </Button>
                </div>
                <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                  {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
                </p>
              </div>
            ) : (
              <>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleGetLocation}
                  disabled={isGettingLocation}
                >
                  {isGettingLocation ? (
                    <>
                      <Clock className="w-4 h-4 mr-2 animate-spin" />
                      Obtendo localização...
                    </>
                  ) : (
                    <>
                      <MapPinned className="w-4 h-4 mr-2" />
                      Capturar localização
                    </>
                  )}
                </Button>
                {locationError && (
                  <p className="text-xs text-destructive">{locationError}</p>
                )}
              </>
            )}
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

          {/* Warning about missing proof */}
          {!photoFile && !location && (
            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Sem foto e localização, a venda ficará marcada como "Voltou sem comprovação". 
                  Recomendamos registrar para comprovar a tentativa de entrega.
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose}>
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
  onUploadPaymentProof,
  isDragging,
  isUploadingProof,
  motoboyStatuses,
  onUpdateMotoboyStatus,
  organizationId
}: { 
  sale: Sale; 
  onMarkDelivered: () => void;
  onMarkNotDelivered: () => void;
  onOpenMaps: () => void;
  onOpenWhatsApp: () => void;
  onUploadPaymentProof: (file: File) => Promise<void>;
  isDragging?: boolean;
  isUploadingProof?: boolean;
  motoboyStatuses?: { status_key: string; label: string; is_active: boolean }[];
  onUpdateMotoboyStatus?: (status: MotoboyTrackingStatus) => void;
  organizationId?: string | null;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await onUploadPaymentProof(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  
  // Get payment status info
  const getPaymentStatusInfo = () => {
    const hasProof = !!sale.payment_proof_url;
    switch (sale.payment_status) {
      case 'paid_now':
        return { 
          label: 'Pago', 
          icon: CheckCircle, 
          className: 'bg-green-100 text-green-700 border-green-200',
          showUpload: false 
        };
      case 'will_pay_before':
        return hasProof 
          ? { 
              label: 'Comprovante anexado', 
              icon: CheckCircle, 
              className: 'bg-green-100 text-green-700 border-green-200',
              showUpload: false 
            }
          : { 
              label: 'Aguardando pagamento', 
              icon: AlertTriangle, 
              className: 'bg-amber-100 text-amber-700 border-amber-200',
              showUpload: true 
            };
      case 'not_paid':
      default:
        return hasProof 
          ? { 
              label: 'Comprovante anexado', 
              icon: CheckCircle, 
              className: 'bg-green-100 text-green-700 border-green-200',
              showUpload: false 
            }
          : { 
              label: 'Não pago', 
              icon: DollarSign, 
              className: 'bg-slate-100 text-slate-700 border-slate-200',
              showUpload: true 
            };
    }
  };
  
  const paymentInfo = getPaymentStatusInfo();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: sale.id });

  const isCompleted = sale.status === 'delivered' || sale.status === 'returned';
  const isDelivered = sale.status === 'delivered';
  const isReturned = sale.status === 'returned';

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : isCompleted ? 0.85 : 1,
  };

  // Completed items don't need drag
  const dragHandleProps = isCompleted ? {} : { ...attributes, ...listeners };

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
      } ${
        isDelivered 
          ? 'border-l-4 border-l-green-500 bg-green-50/50 dark:bg-green-950/20' 
          : isReturned 
            ? 'border-l-4 border-l-red-500 bg-red-50/50 dark:bg-red-950/20' 
            : ''
      }`}
    >
      {/* Drag Handle + Header */}
      <div className="flex items-center gap-2 p-3 border-b bg-muted/30">
        {!isCompleted && (
          <button
            {...dragHandleProps}
            className="touch-none p-1 hover:bg-muted rounded cursor-grab active:cursor-grabbing"
          >
            <GripVertical className="w-5 h-5 text-muted-foreground" />
          </button>
        )}
        {isCompleted && (
          <div className="p-1">
            {isDelivered ? (
              <CheckCircle className="w-5 h-5 text-green-600" />
            ) : (
              <XCircle className="w-5 h-5 text-red-600" />
            )}
          </div>
        )}
        
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

        {/* Sale Observation for Delivery */}
        {((sale as any).observation_1 || (sale as any).observation_2) && (
          <div className="p-2 bg-yellow-50 dark:bg-yellow-950/30 rounded-lg border border-yellow-400 dark:border-yellow-700">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              <strong>⚠️ Obs Entrega:</strong> {(sale as any).observation_1}
              {(sale as any).observation_2 && ` | ${(sale as any).observation_2}`}
            </p>
          </div>
        )}

        {/* Products with Conference for Motoboy */}
        {sale.items && sale.items.length > 0 && !isCompleted && organizationId && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-primary">
              <ClipboardCheck className="w-4 h-4" />
              <span>Confira os produtos que está levando:</span>
            </div>
            <ProductConference 
              items={sale.items.map(i => ({
                id: i.id,
                product_name: i.product_name,
                quantity: i.quantity
              }))}
              saleId={sale.id}
              organizationId={organizationId}
              stage="dispatch"
              showHistory={true}
              compactMode={true}
            />
          </div>
        )}

        {/* Products summary - show for completed or when no organizationId */}
        {sale.items && sale.items.length > 0 && (isCompleted || !organizationId) && (
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Package className="w-4 h-4 text-primary" />
              <span>{sale.items?.reduce((sum, i) => sum + i.quantity, 0) || 0} produto(s)</span>
            </div>
            <ul className="ml-6 text-xs text-muted-foreground space-y-0.5">
              {sale.items.map((item, idx) => (
                <li key={idx}>
                  {item.quantity}x {item.product_name}
                </li>
              ))}
            </ul>
          </div>
        )}
        
        {/* Payment status */}
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={`text-xs ${paymentInfo.className}`}>
            <paymentInfo.icon className="w-3 h-3 mr-1" />
            {paymentInfo.label}
          </Badge>
        </div>
        
        {/* Upload payment proof button for motoboy */}
        {paymentInfo.showUpload && (
          <div>
            <input 
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf"
              onChange={handleFileChange}
              className="hidden"
            />
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingProof}
            >
              <Upload className="w-3.5 h-3.5 mr-1.5" />
              {isUploadingProof ? 'Enviando...' : 'Anexar comprovante de pagamento'}
            </Button>
          </div>
        )}

        {/* Motoboy Quick Confirmation Button - "Recebeu esse pedido?" */}
        {sale.delivery_type === 'motoboy' && onUpdateMotoboyStatus && !isCompleted && (
          <div className="space-y-3 pt-2 border-t">
            {/* Show "Recebeu esse pedido?" if status is handed_to_motoboy or expedition_ready */}
            {((sale as any).motoboy_tracking_status === 'handed_to_motoboy' || 
              (sale as any).motoboy_tracking_status === 'expedition_ready') && (
              <div className="p-3 bg-primary/10 rounded-lg border border-primary/20">
                <p className="text-sm font-medium text-primary mb-2">
                  📦 Recebeu esse pedido?
                </p>
                <Button
                  size="sm"
                  className="w-full bg-primary hover:bg-primary/90"
                  onClick={() => onUpdateMotoboyStatus('with_motoboy' as MotoboyTrackingStatus)}
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Sim, recebi o pedido!
                </Button>
              </div>
            )}
            
            {/* Status selector for other updates */}
            <div className="space-y-2">
              <Label className="text-xs font-medium flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5" />
                Atualizar status:
              </Label>
              <Select 
                value={(sale as any).motoboy_tracking_status || ''} 
                onValueChange={(value) => onUpdateMotoboyStatus(value as MotoboyTrackingStatus)}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Selecione o status..." />
                </SelectTrigger>
                <SelectContent>
                  {motoboyTrackingOrder.map(statusKey => {
                    // Get custom label if available from tenant config
                    const customStatus = motoboyStatuses?.find(s => s.status_key === statusKey);
                    const isActive = customStatus ? customStatus.is_active : true;
                    if (!isActive) return null;
                    
                    const label = customStatus?.label || motoboyTrackingLabels[statusKey];
                    const isDeliveredOrReturned = statusKey === 'delivered' || statusKey === 'returned';
                    
                    return (
                      <SelectItem 
                        key={statusKey} 
                        value={statusKey}
                        className={isDeliveredOrReturned ? 'font-semibold' : ''}
                      >
                        {label}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons - Only show for pending deliveries */}
      {!isCompleted && (
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
      )}

      {/* Show status badge for completed items */}
      {isCompleted && (
        <div className="p-3 pt-0 flex items-center justify-between text-sm">
          <Badge className={isDelivered ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}>
            {isDelivered ? 'Entregue' : 'Voltou'}
          </Badge>
          {(sale.delivered_at || sale.returned_at) && (
            <span className="text-muted-foreground text-xs">
              às {format(new Date(sale.delivered_at || sale.returned_at!), "HH:mm")}
            </span>
          )}
        </div>
      )}
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
  const { profile } = useAuth();
  const { data: motoboyStatuses = [] } = useMotoboyTrackingStatuses();
  const updateMotoboyTracking = useUpdateMotoboyTracking();

  const organizationId = profile?.organization_id || null;

  const [notDeliveredDialogOpen, setNotDeliveredDialogOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [localOrder, setLocalOrder] = useState<Record<string, string[]>>({});
  const [uploadingSaleId, setUploadingSaleId] = useState<string | null>(null);

  // Handle motoboy status update
  const handleUpdateMotoboyStatus = useCallback(async (saleId: string, status: MotoboyTrackingStatus) => {
    try {
      // If it's delivered or returned, also update sale status
      if (status === 'delivered') {
        await updateSale.mutateAsync({
          id: saleId,
          data: { status: 'delivered', delivery_status: 'delivered_normal' }
        });
      } else if (status === 'returned') {
        await updateSale.mutateAsync({
          id: saleId,
          data: { status: 'returned' }
        });
      }
      
      await updateMotoboyTracking.mutateAsync({ saleId, status });
      toast.success(`Status atualizado: ${motoboyTrackingLabels[status]}`);
    } catch (error) {
      toast.error('Erro ao atualizar status');
    }
  }, [updateMotoboyTracking, updateSale]);

  // Handle payment proof upload by motoboy
  const handleUploadPaymentProof = useCallback(async (saleId: string, file: File) => {
    setUploadingSaleId(saleId);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${saleId}/payment-proof-${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('sales-documents')
        .upload(fileName, file);
      
      if (uploadError) throw uploadError;
      
      // Update sale with payment proof URL
      await updateSale.mutateAsync({
        id: saleId,
        data: {
          payment_proof_url: fileName,
        }
      });
      
      toast.success('Comprovante enviado com sucesso!');
      refetch();
    } catch (error) {
      console.error('Erro ao enviar comprovante:', error);
      toast.error('Erro ao enviar comprovante');
    } finally {
      setUploadingSaleId(null);
    }
  }, [updateSale, refetch]);

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

  // Group deliveries by date and shift - now includes delivered/returned for visibility
  const groupedDeliveries = useMemo(() => {
    // Include all deliveries, not just pending
    const allDeliveries = deliveries.filter(d => 
      d.status === 'dispatched' || d.status === 'delivered' || d.status === 'returned'
    );
    
    // Sort by date, then shift (morning first), then position
    const sorted = [...allDeliveries].sort((a, b) => {
      // First by date
      const dateA = a.scheduled_delivery_date || '9999-12-31';
      const dateB = b.scheduled_delivery_date || '9999-12-31';
      if (dateA !== dateB) return dateA.localeCompare(dateB);
      
      // Then by shift
      const shiftOrder: Record<string, number> = { morning: 0, afternoon: 1, full_day: 2 };
      const shiftA = shiftOrder[a.scheduled_delivery_shift || 'full_day'] ?? 2;
      const shiftB = shiftOrder[b.scheduled_delivery_shift || 'full_day'] ?? 2;
      if (shiftA !== shiftB) return shiftA - shiftB;
      
      // Put pending first, then delivered, then returned
      const statusOrder: Record<string, number> = { dispatched: 0, delivered: 1, returned: 2 };
      const statusA = statusOrder[a.status] ?? 3;
      const statusB = statusOrder[b.status] ?? 3;
      if (statusA !== statusB) return statusA - statusB;
      
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

    // Apply local ordering if exists (only for pending items)
    Object.keys(groups).forEach(key => {
      if (localOrder[key]) {
        const pendingItems = groups[key].filter(s => s.status === 'dispatched');
        const completedItems = groups[key].filter(s => s.status !== 'dispatched');
        
        pendingItems.sort((a, b) => {
          const indexA = localOrder[key].indexOf(a.id);
          const indexB = localOrder[key].indexOf(b.id);
          return indexA - indexB;
        });
        
        groups[key] = [...pendingItems, ...completedItems];
      }
    });

    return groups;
  }, [deliveries, localOrder]);


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

  const handleMarkNotDelivered = async (
    reasonId: string, 
    notes: string, 
    photoFile: File | null, 
    location: {lat: number, lng: number} | null
  ) => {
    if (!selectedSale) return;

    let returnPhotoUrl: string | null = null;

    // Upload photo if provided
    if (photoFile) {
      try {
        const fileExt = photoFile.name.split('.').pop();
        const fileName = `${selectedSale.id}/return-photo-${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('sales-documents')
          .upload(fileName, photoFile);
        
        if (uploadError) throw uploadError;
        returnPhotoUrl = fileName;
      } catch (error) {
        console.error('Erro ao enviar foto:', error);
        toast.error('Erro ao enviar foto, mas o registro será salvo');
      }
    }

    await updateSale.mutateAsync({
      id: selectedSale.id,
      data: {
        status: 'returned',
        return_reason_id: reasonId,
        return_notes: notes || null,
        return_photo_url: returnPhotoUrl,
        return_latitude: location?.lat || null,
        return_longitude: location?.lng || null,
      } as any
    });

    setNotDeliveredDialogOpen(false);
    setSelectedSale(null);
  };

  if (isLoading) {
    return (
      <SmartLayout>
        <div className="space-y-4 p-4">
          <Skeleton className="h-12 w-48" />
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      </SmartLayout>
    );
  }

  const allDeliveries = Object.values(groupedDeliveries).flat();
  const pendingCount = allDeliveries.filter(d => d.status === 'dispatched').length;
  const completedCount = allDeliveries.filter(d => d.status !== 'dispatched').length;

  return (
    <SmartLayout>
      <div className="space-y-4 pb-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Truck className="w-5 h-5 text-primary" />
              Minhas Entregas
            </h1>
            <p className="text-sm text-muted-foreground">
              {pendingCount} pendente{pendingCount !== 1 ? 's' : ''} 
              {completedCount > 0 && ` • ${completedCount} concluída${completedCount !== 1 ? 's' : ''}`}
              {pendingCount > 0 && ' • Arraste para reordenar'}
            </p>
          </div>
        </div>

        {/* Empty State - only show when no deliveries at all */}
        {allDeliveries.length === 0 && (
          <Card className="py-12">
            <CardContent className="flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Truck className="w-8 h-8 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Nenhuma entrega</h3>
              <p className="text-muted-foreground text-sm">
                Você não possui entregas atribuídas
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
                        onUploadPaymentProof={(file) => handleUploadPaymentProof(sale.id, file)}
                        isUploadingProof={uploadingSaleId === sale.id}
                        motoboyStatuses={motoboyStatuses}
                        onUpdateMotoboyStatus={(status) => handleUpdateMotoboyStatus(sale.id, status)}
                        organizationId={organizationId}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </div>
          );
        })}
      </div>

      {/* Not Delivered Dialog */}
      <NotDeliveredDialog
        open={notDeliveredDialogOpen}
        onOpenChange={setNotDeliveredDialogOpen}
        sale={selectedSale}
        onConfirm={handleMarkNotDelivered}
      />
    </SmartLayout>
  );
}
