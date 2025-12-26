import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
} from '@/components/ui/dialog';
import { 
  Truck, 
  MapPin, 
  Phone, 
  Package,
  CheckCircle,
  Clock,
  Navigation,
  User
} from 'lucide-react';
import { format } from 'date-fns';
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

const DELIVERY_STATUS_OPTIONS: { value: DeliveryStatus; label: string }[] = [
  { value: 'delivered_normal', label: 'Normal' },
  { value: 'delivered_missing_prescription', label: 'Falta receita' },
  { value: 'delivered_no_money', label: 'Cliente sem dinheiro' },
  { value: 'delivered_no_card_limit', label: 'Cliente sem limite cartão' },
  { value: 'delivered_customer_absent', label: 'Cliente ausente' },
  { value: 'delivered_customer_denied', label: 'Cliente disse que não pediu' },
  { value: 'delivered_customer_gave_up', label: 'Cliente desistiu' },
  { value: 'delivered_wrong_product', label: 'Produto enviado errado' },
  { value: 'delivered_missing_product', label: 'Produto faltante' },
  { value: 'delivered_insufficient_address', label: 'Endereço insuficiente' },
  { value: 'delivered_wrong_time', label: 'Motoboy foi em horário errado' },
  { value: 'delivered_other', label: 'Outros' },
];

export default function MyDeliveries() {
  const navigate = useNavigate();
  const { data: deliveries = [], isLoading } = useMyDeliveries();
  const updateSale = useUpdateSale();

  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [deliveryStatus, setDeliveryStatus] = useState<DeliveryStatus>('delivered_normal');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);

  const pendingDeliveries = deliveries.filter(d => d.status === 'dispatched');
  const completedDeliveries = deliveries.filter(d => d.status === 'delivered');

  const openDeliveryDialog = (sale: Sale) => {
    setSelectedSale(sale);
    setDeliveryStatus('delivered_normal');
    setDeliveryNotes('');
    setDialogOpen(true);
  };

  const handleMarkDelivered = async () => {
    if (!selectedSale) return;

    await updateSale.mutateAsync({
      id: selectedSale.id,
      data: {
        status: 'delivered',
        delivery_status: deliveryStatus,
        delivery_notes: deliveryNotes || null,
      }
    });

    setDialogOpen(false);
    setSelectedSale(null);
  };

  const openMaps = (sale: Sale) => {
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

  if (isLoading) {
    return (
      <Layout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-48" />
          <div className="grid gap-4">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-40" />
            ))}
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Truck className="w-6 h-6" />
            Minhas Entregas
          </h1>
          <p className="text-muted-foreground">
            Gerencie suas entregas pendentes e concluídas
          </p>
        </div>

        {/* Pending Deliveries */}
        <div>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-orange-500" />
            Pendentes ({pendingDeliveries.length})
          </h2>

          {pendingDeliveries.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-8">
                <Truck className="w-12 h-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Nenhuma entrega pendente</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {pendingDeliveries.map((sale) => (
                <Card key={sale.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <User className="w-4 h-4 text-muted-foreground" />
                          <h3 className="font-semibold">{sale.lead?.name}</h3>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Phone className="w-4 h-4" />
                          {sale.lead?.whatsapp}
                        </div>
                      </div>
                      <Badge className="bg-orange-100 text-orange-700">
                        {getStatusLabel(sale.status)}
                      </Badge>
                    </div>

                    {sale.lead?.street && (
                      <div className="flex items-start gap-2 mb-4 p-3 bg-muted/50 rounded-lg">
                        <MapPin className="w-4 h-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                        <div className="text-sm">
                          <p>{sale.lead.street}, {sale.lead.street_number}</p>
                          {sale.lead.complement && <p>{sale.lead.complement}</p>}
                          <p>{sale.lead.neighborhood} - {sale.lead.city}/{sale.lead.state}</p>
                          {sale.lead.cep && <p className="text-muted-foreground">CEP: {sale.lead.cep}</p>}
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <Package className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">{sale.items?.length || 0} produto(s)</span>
                      </div>
                      <span className="font-bold text-primary">
                        {formatCurrency(sale.total_cents)}
                      </span>
                    </div>

                    <div className="flex gap-2">
                      {sale.lead?.street && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => openMaps(sale)}
                        >
                          <Navigation className="w-4 h-4 mr-2" />
                          Abrir Mapa
                        </Button>
                      )}
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => openWhatsApp(sale.lead?.whatsapp || '')}
                      >
                        <Phone className="w-4 h-4 mr-2" />
                        WhatsApp
                      </Button>
                      <Button 
                        size="sm"
                        className="ml-auto"
                        onClick={() => openDeliveryDialog(sale)}
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Marcar Entrega
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Completed Deliveries */}
        {completedDeliveries.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              Concluídas Hoje ({completedDeliveries.length})
            </h2>

            <div className="grid gap-4">
              {completedDeliveries.map((sale) => (
                <Card key={sale.id} className="opacity-75">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold">{sale.lead?.name}</h3>
                        <p className="text-sm text-muted-foreground">{sale.lead?.whatsapp}</p>
                        {sale.delivery_status && (
                          <Badge variant="secondary" className="mt-1">
                            {getDeliveryStatusLabel(sale.delivery_status)}
                          </Badge>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="font-bold">{formatCurrency(sale.total_cents)}</p>
                        {sale.delivered_at && (
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(sale.delivered_at), "HH:mm", { locale: ptBR })}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Delivery Status Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Como foi a entrega?</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label>Cliente</Label>
              <p className="font-medium">{selectedSale?.lead?.name}</p>
              <p className="text-sm text-muted-foreground">{formatCurrency(selectedSale?.total_cents || 0)}</p>
            </div>

            <div>
              <Label>Status da Entrega</Label>
              <Select 
                value={deliveryStatus} 
                onValueChange={(v) => setDeliveryStatus(v as DeliveryStatus)}
              >
                <SelectTrigger className="mt-1">
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

            {(deliveryStatus === 'delivered_other' || deliveryStatus !== 'delivered_normal') && (
              <div>
                <Label>Observações</Label>
                <Textarea
                  value={deliveryNotes}
                  onChange={(e) => setDeliveryNotes(e.target.value)}
                  placeholder="Descreva detalhes da entrega..."
                  className="mt-1"
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleMarkDelivered}
              disabled={updateSale.isPending}
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Confirmar Entrega
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
