import { useParams, useNavigate, Link } from 'react-router-dom';
import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  ArrowLeft,
  CheckCircle2,
  Package,
  MapPin,
  Phone,
  CreditCard,
  Camera,
  FileCheck,
  AlertTriangle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  User,
  FlaskConical,
} from 'lucide-react';
import {
  useSale,
  formatCurrency,
  getStatusLabel,
  getStatusColor,
} from '@/hooks/useSales';
import { SaleScanValidation } from '@/components/serial-labels/SaleScanValidation';
import {
  useToggleSaleCheckpoint,
  useSaleCheckpoints,
  getCheckpointStatus,
} from '@/hooks/useSaleCheckpoints';
import { SaleCheckpointsCard } from '@/components/sales/SaleCheckpointsCard';
import { SaleClosingInfoCard } from '@/components/sales/SaleClosingInfoCard';
import { MotoboyTrackingCard } from '@/components/sales/MotoboyTrackingCard';
import { CarrierTrackingCard } from '@/components/sales/CarrierTrackingCard';
import { PaymentProofUploadDialog } from '@/components/sales/PaymentProofUploadDialog';
import {
  hasPaymentProof,
  resolveProofSource,
  getProofBadge,
} from '@/lib/paymentProof';
import { useSalePayments } from '@/hooks/useSalePayments';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function ExpeditionValidatePage() {
  const { saleId } = useParams<{ saleId: string }>();
  const navigate = useNavigate();
  const { data: sale, isLoading } = useSale(saleId);
  const { data: checkpoints = [] } = useSaleCheckpoints(saleId || '');
  const { data: salePayments = [] } = useSalePayments(saleId);
  const toggleMutation = useToggleSaleCheckpoint();
  const [scanComplete, setScanComplete] = useState(false);
  const [showProofDialog, setShowProofDialog] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  if (isLoading) {
    return (
      <div className="p-4 max-w-lg mx-auto">
        <Skeleton className="h-[600px] w-full" />
      </div>
    );
  }

  if (!sale) {
    return (
      <div className="p-4 max-w-lg mx-auto text-center">
        <p className="text-muted-foreground">Venda não encontrada</p>
        <Button onClick={() => navigate('/expedicao')} className="mt-4">
          <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
        </Button>
      </div>
    );
  }

  const saleItems = (sale.items || []).map((item) => ({
    id: item.id,
    product_id: item.product_id,
    product_name: item.product_name,
    quantity: item.quantity,
    requisition_number: item.requisition_number || null,
    notes: item.notes || null,
  }));

  const totalUnits = saleItems.reduce((sum, item) => sum + item.quantity, 0);
  const separatedStatus = getCheckpointStatus(checkpoints, 'pending_expedition');

  // Manipulados (com requisition_number)
  const manipulados = saleItems.filter((i) => i.requisition_number);

  // Endereço
  const lead = sale.lead;
  const addressParts = [
    lead?.street,
    lead?.street_number,
    lead?.complement,
    lead?.neighborhood,
    lead?.city,
    lead?.state,
    lead?.cep,
  ].filter(Boolean);
  const fullAddress = addressParts.join(', ');
  const mapsUrl = lead?.google_maps_link
    ? lead.google_maps_link
    : fullAddress
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`
    : null;
  const wazeUrl = fullAddress
    ? `https://waze.com/ul?q=${encodeURIComponent(fullAddress)}&navigate=yes`
    : null;

  // Pagamento
  const proofPresent = hasPaymentProof(sale as any);
  const proofSource = resolveProofSource(sale as any);
  const proofBadge = getProofBadge(proofSource);
  const paymentMethodName =
    salePayments[0]?.payment_method_name || sale.payment_method || 'Não definido';

  const handleScanComplete = async () => {
    setScanComplete(true);
    if (!separatedStatus.isCompleted) {
      try {
        await toggleMutation.mutateAsync({
          saleId: sale.id,
          checkpointType: 'pending_expedition',
          complete: true,
          notes: 'Validado via scan de etiquetas seriais (mobile)',
        });
        toast.success('✅ Pedido validado e marcado como SEPARADO!');
      } catch {
        toast.error('Erro ao marcar como separado');
      }
    }
  };

  const statusLabel = getStatusLabel(sale.status as any);
  const statusColor = getStatusColor(sale.status as any);

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4 pb-20">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/expedicao')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-lg font-bold">Validar Expedição</h1>
          <p className="text-sm text-muted-foreground">
            Romaneio #{sale.romaneio_number} ·{' '}
            {format(new Date(sale.created_at), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link to={`/vendas/${sale.id}`}>
            <ExternalLink className="h-3.5 w-3.5 mr-1" />
            Completo
          </Link>
        </Button>
      </div>

      {/* Status & cliente */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center justify-between gap-2">
            <span className="flex-1 truncate">{lead?.name || 'Cliente'}</span>
            <Badge className={statusColor}>{statusLabel}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-4 text-sm">
            <span className="flex items-center gap-1 text-muted-foreground">
              <Package className="h-4 w-4" />
              {saleItems.length} produto(s), {totalUnits} un.
            </span>
            <span className="font-bold text-foreground">
              {formatCurrency(sale.total_cents)}
            </span>
          </div>

          {/* Telefone */}
          {lead?.whatsapp && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" asChild>
                <a href={`tel:${lead.whatsapp}`}>
                  <Phone className="h-4 w-4 mr-1" />
                  Ligar
                </a>
              </Button>
              <Button variant="outline" size="sm" className="flex-1" asChild>
                <a
                  href={`https://wa.me/${lead.whatsapp.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  WhatsApp
                </a>
              </Button>
            </div>
          )}

          <Separator />

          {/* Lista produtos */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase text-muted-foreground">
              Produtos
            </p>
            {saleItems.map((item) => (
              <div key={item.id} className="text-sm border-l-2 border-primary/30 pl-2">
                <div className="flex justify-between gap-2">
                  <span className="flex-1">{item.product_name}</span>
                  <span className="font-medium shrink-0">{item.quantity}x</span>
                </div>
                {item.requisition_number && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                    <FlaskConical className="h-3 w-3 inline mr-1" />
                    Manipulado · Req: {item.requisition_number}
                  </p>
                )}
                {item.notes && (
                  <p className="text-xs text-muted-foreground mt-0.5 italic">
                    {item.notes}
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* Manipulados destaque */}
          {manipulados.length > 0 && (
            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-lg p-3">
              <p className="text-xs font-bold text-amber-800 dark:text-amber-300 mb-1">
                ⚗️ {manipulados.length} manipulado(s) neste pedido
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-400">
                Confirme as requisições antes de despachar.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Endereço & Mapa */}
      {(fullAddress || lead?.delivery_notes) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Endereço de entrega
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {fullAddress && (
              <p className="text-sm">{fullAddress}</p>
            )}
            {lead?.delivery_notes && (
              <p className="text-xs text-muted-foreground italic">
                💬 {lead.delivery_notes}
              </p>
            )}
            <div className="grid grid-cols-2 gap-2">
              {mapsUrl && (
                <Button variant="default" size="sm" asChild>
                  <a href={mapsUrl} target="_blank" rel="noopener noreferrer">
                    <MapPin className="h-4 w-4 mr-1" />
                    Google Maps
                  </a>
                </Button>
              )}
              {wazeUrl && (
                <Button variant="outline" size="sm" asChild>
                  <a href={wazeUrl} target="_blank" rel="noopener noreferrer">
                    Waze
                  </a>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pagamento */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Pagamento
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Forma:</span>
            <span className="font-medium">{paymentMethodName}</span>
          </div>
          {salePayments.length > 1 && (
            <div className="text-xs text-muted-foreground">
              {salePayments.length} formas de pagamento (split)
            </div>
          )}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Status:</span>
            <Badge variant={sale.payment_confirmed_at ? 'default' : 'outline'}>
              {sale.payment_confirmed_at ? '✓ Confirmado' : 'Pendente'}
            </Badge>
          </div>

          {sale.payment_notes && (
            <p className="text-xs text-muted-foreground italic">
              💬 {sale.payment_notes}
            </p>
          )}

          {/* Comprovante */}
          {proofPresent ? (
            <div className="space-y-2">
              {proofBadge && (
                <Badge variant="outline" className={proofBadge.className}>
                  {proofBadge.icon} {proofBadge.label}
                </Badge>
              )}
              {sale.payment_proof_url && (
                <Button variant="outline" size="sm" className="w-full" asChild>
                  <a
                    href={sale.payment_proof_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <FileCheck className="h-4 w-4 mr-1" />
                    Ver comprovante
                  </a>
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs"
                onClick={() => setShowProofDialog(true)}
              >
                <Camera className="h-3.5 w-3.5 mr-1" />
                Substituir comprovante
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 text-xs bg-amber-50 dark:bg-amber-950/20 p-2 rounded">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>Sem comprovante de pagamento</span>
              </div>
              <Button
                variant="default"
                size="sm"
                className="w-full"
                onClick={() => setShowProofDialog(true)}
              >
                <Camera className="h-4 w-4 mr-1" />
                Tirar foto do comprovante
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Scan validation */}
      {scanComplete || separatedStatus.isCompleted ? (
        <Card className="border-green-500 bg-green-50 dark:bg-green-950/20">
          <CardContent className="pt-6 text-center space-y-2">
            <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto" />
            <h2 className="text-lg font-bold text-green-700">Pedido Separado!</h2>
            <p className="text-xs text-muted-foreground">
              Conferência concluída.
            </p>
          </CardContent>
        </Card>
      ) : (
        <SaleScanValidation
          saleId={sale.id}
          saleNumber={sale.romaneio_number}
          saleItems={saleItems}
          mode="separation"
          onComplete={handleScanComplete}
        />
      )}

      {/* Status, fechamento, rastreio - colapsável */}
      <Button
        variant="outline"
        className="w-full"
        onClick={() => setShowAdvanced((v) => !v)}
      >
        {showAdvanced ? (
          <>
            <ChevronUp className="h-4 w-4 mr-2" />
            Ocultar status e rastreamento
          </>
        ) : (
          <>
            <ChevronDown className="h-4 w-4 mr-2" />
            Status, fechamento e rastreamento
          </>
        )}
      </Button>

      {showAdvanced && (
        <div className="space-y-4">
          {/* Checkpoints/status com histórico de quem fez */}
          <SaleCheckpointsCard
            saleId={sale.id}
            saleStatus={sale.status}
            isCancelled={sale.status === 'cancelled'}
            deliveryRegionId={sale.delivery_region_id}
            closedAt={sale.closed_at}
            finalizedAt={sale.finalized_at}
            saleItems={saleItems}
            romaneioNumber={sale.romaneio_number}
          />

          {/* Em qual fechamento foi posto */}
          <SaleClosingInfoCard saleId={sale.id} />

          {/* Rastreio motoboy */}
          {sale.delivery_type === 'motoboy' && (
            <MotoboyTrackingCard
              saleId={sale.id}
              currentStatus={sale.motoboy_tracking_status as any}
              isCancelled={sale.status === 'cancelled'}
              deliveryRegionId={sale.delivery_region_id}
              assignedMotoboyId={sale.assigned_delivery_user_id}
            />
          )}

          {/* Rastreio transportadora */}
          {sale.delivery_type === 'carrier' && (
            <CarrierTrackingCard
              saleId={sale.id}
              currentStatus={sale.carrier_tracking_status as any}
              trackingCode={sale.tracking_code}
              isCancelled={sale.status === 'cancelled'}
              sale={sale}
            />
          )}
        </div>
      )}

      {/* Dialog upload comprovante */}
      <PaymentProofUploadDialog
        open={showProofDialog}
        onOpenChange={setShowProofDialog}
        saleId={sale.id}
        organizationId={sale.organization_id}
      />
    </div>
  );
}
