import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Package, 
  Printer, 
  Truck, 
  CheckCircle, 
  Clock, 
  AlertTriangle,
  MapPin,
  RotateCcw,
  Download,
  ExternalLink,
  Copy,
  Tag,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { useMelhorEnvioLabelDownload } from '@/hooks/useMelhorEnvioLabelDownload';
import { Loader2 } from 'lucide-react';

interface OrderExpeditionStatusViewerProps {
  saleId: string | null;
  trackingCode?: string | null;
  carrier?: string | null;
}

// Sale status labels and colors
const saleStatusConfig: Record<string, { label: string; icon: React.ReactNode; color: string; bgColor: string }> = {
  draft: { 
    label: 'Rascunho', 
    icon: <Package className="h-4 w-4" />, 
    color: 'text-gray-600', 
    bgColor: 'bg-gray-100 dark:bg-gray-800' 
  },
  pending_expedition: { 
    label: 'Impresso / Em Separação', 
    icon: <Printer className="h-4 w-4" />, 
    color: 'text-blue-600', 
    bgColor: 'bg-blue-50 dark:bg-blue-900/30' 
  },
  dispatched: { 
    label: 'Despachado', 
    icon: <Truck className="h-4 w-4" />, 
    color: 'text-pink-600', 
    bgColor: 'bg-pink-50 dark:bg-pink-900/30' 
  },
  delivered: { 
    label: 'Entregue', 
    icon: <CheckCircle className="h-4 w-4" />, 
    color: 'text-green-600', 
    bgColor: 'bg-green-50 dark:bg-green-900/30' 
  },
  returned: { 
    label: 'Voltou', 
    icon: <RotateCcw className="h-4 w-4" />, 
    color: 'text-yellow-600', 
    bgColor: 'bg-yellow-50 dark:bg-yellow-900/30' 
  },
  cancelled: { 
    label: 'Cancelado', 
    icon: <AlertTriangle className="h-4 w-4" />, 
    color: 'text-red-600', 
    bgColor: 'bg-red-50 dark:bg-red-900/30' 
  },
};

// Carrier tracking status labels and icons
const carrierTrackingConfig: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  waiting_post: { 
    label: 'Aguardando postagem', 
    icon: <Clock className="h-4 w-4" />, 
    color: 'text-gray-500' 
  },
  posted: { 
    label: 'Postado', 
    icon: <Truck className="h-4 w-4" />, 
    color: 'text-blue-600' 
  },
  in_destination_city: { 
    label: 'Na cidade de destino', 
    icon: <MapPin className="h-4 w-4" />, 
    color: 'text-purple-600' 
  },
  attempt_1_failed: { 
    label: '1ª tentativa falhou', 
    icon: <AlertTriangle className="h-4 w-4" />, 
    color: 'text-orange-500' 
  },
  attempt_2_failed: { 
    label: '2ª tentativa falhou', 
    icon: <AlertTriangle className="h-4 w-4" />, 
    color: 'text-orange-600' 
  },
  attempt_3_failed: { 
    label: '3ª tentativa falhou', 
    icon: <AlertTriangle className="h-4 w-4" />, 
    color: 'text-red-500' 
  },
  waiting_pickup: { 
    label: 'Aguardando retirada', 
    icon: <Package className="h-4 w-4" />, 
    color: 'text-amber-600' 
  },
  returning_to_sender: { 
    label: 'Retornando ao remetente', 
    icon: <RotateCcw className="h-4 w-4" />, 
    color: 'text-red-600' 
  },
  delivered: { 
    label: 'Entregue', 
    icon: <CheckCircle className="h-4 w-4" />, 
    color: 'text-green-600' 
  },
};

export function OrderExpeditionStatusViewer({ saleId, trackingCode, carrier }: OrderExpeditionStatusViewerProps) {
  // Fetch linked sale data for expedition status
  const { data: saleData, isLoading } = useQuery({
    queryKey: ['order-expedition-status', saleId],
    enabled: !!saleId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales')
        .select(`
          id,
          status,
          delivery_type,
          carrier_tracking_status,
          tracking_code,
          updated_at,
          organization_id,
          melhor_envio_labels:melhor_envio_labels(
            id,
            tracking_code,
            company_name,
            service_name,
            label_pdf_url,
            status,
            created_at,
            melhor_envio_order_id
          ),
          correios_labels:correios_labels(
            id,
            tracking_code,
            service_name,
            label_pdf_url,
            status,
            created_at
          )
        `)
        .eq('id', saleId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });

  const { downloadLabel, isDownloading: isDownloadingLabel } = useMelhorEnvioLabelDownload();

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Código copiado!');
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  // If no linked sale, show only the basic tracking info from ecommerce_orders
  if (!saleId || !saleData) {
    return (
      <div className="space-y-4">
        <div className="p-4 bg-muted/50 rounded-lg border">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Package className="h-4 w-4" />
            <span className="text-sm">Sem vínculo com expedição</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Este pedido ainda não possui uma venda vinculada no sistema de expedição.
          </p>
        </div>

        {/* Show basic tracking if available */}
        {trackingCode && (
          <div className="p-4 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground mb-1">Código de Rastreio</p>
            <div className="flex items-center justify-between">
              <p className="font-mono font-medium">{trackingCode}</p>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => copyToClipboard(trackingCode)}>
                  <Copy className="h-4 w-4" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => window.open(`https://www.linkcorreios.com.br/?id=${trackingCode}`, '_blank')}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            </div>
            {carrier && (
              <p className="text-sm text-muted-foreground mt-2">
                Transportadora: <span className="font-medium text-foreground">{carrier}</span>
              </p>
            )}
          </div>
        )}
      </div>
    );
  }

  const statusConfig = saleStatusConfig[saleData.status] || saleStatusConfig.draft;
  const carrierConfig = saleData.carrier_tracking_status 
    ? carrierTrackingConfig[saleData.carrier_tracking_status] 
    : null;

  // Get label data (prefer Melhor Envio, fallback to Correios)
  const melhorEnvioLabel = saleData.melhor_envio_labels?.[0];
  const correiosLabel = saleData.correios_labels?.[0];
  const labelData = melhorEnvioLabel || correiosLabel;
  const finalTrackingCode = labelData?.tracking_code || saleData.tracking_code || trackingCode;

  return (
    <div className="space-y-4">
      {/* Expedition Status Card */}
      <div className={`p-4 rounded-lg border ${statusConfig.bgColor}`}>
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-full bg-background ${statusConfig.color}`}>
            {statusConfig.icon}
          </div>
          <div className="flex-1">
            <p className="text-sm text-muted-foreground">Status da Expedição</p>
            <p className={`font-semibold ${statusConfig.color}`}>{statusConfig.label}</p>
          </div>
          {saleData.delivery_type && (
            <Badge variant="outline" className="text-xs">
              {saleData.delivery_type === 'carrier' ? 'Transportadora' :
               saleData.delivery_type === 'motoboy' ? 'Motoboy' :
               saleData.delivery_type === 'pickup' ? 'Retirada' : 'Outro'}
            </Badge>
          )}
        </div>
      </div>

      {/* Carrier Tracking Status (only for carrier deliveries) */}
      {saleData.delivery_type === 'carrier' && carrierConfig && (
        <div className="p-4 rounded-lg border bg-muted/30">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-full bg-background ${carrierConfig.color}`}>
              {carrierConfig.icon}
            </div>
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">Status do Rastreio</p>
              <p className={`font-semibold ${carrierConfig.color}`}>{carrierConfig.label}</p>
            </div>
          </div>
        </div>
      )}

      {/* Tracking Code and Label Info */}
      {finalTrackingCode && (
        <>
          <Separator />
          <div className="space-y-3">
            {/* Tracking Code */}
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div>
                <p className="text-xs text-muted-foreground">Código de Rastreio</p>
                <p className="font-mono font-medium">{finalTrackingCode}</p>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => copyToClipboard(finalTrackingCode)}>
                  <Copy className="h-4 w-4" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => {
                    // Use /app/correios/ for Correios carriers, otherwise generic /app/rastreio/
                    const companyName = melhorEnvioLabel?.company_name || correiosLabel?.service_name || '';
                    const carrier = companyName.toLowerCase().includes('correios') ? 'correios' : 'rastreio';
                    window.open(`https://www.melhorrastreio.com.br/app/${carrier}/${finalTrackingCode}`, '_blank');
                  }}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Label Info */}
            {labelData && (
              <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Tag className="h-4 w-4 text-green-600" />
                    <div>
                      <p className="text-xs text-muted-foreground">Etiqueta Gerada</p>
                      <p className="text-sm font-medium text-green-700 dark:text-green-400">
                        {melhorEnvioLabel ? `${melhorEnvioLabel.company_name} - ${melhorEnvioLabel.service_name}` : correiosLabel?.service_name || 'Correios'}
                      </p>
                    </div>
                  </div>
                  {melhorEnvioLabel?.melhor_envio_order_id ? (
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="text-green-600 border-green-300 hover:bg-green-100"
                      onClick={() => downloadLabel(
                        melhorEnvioLabel.melhor_envio_order_id!, 
                        melhorEnvioLabel.tracking_code, 
                        saleData.organization_id
                      )}
                      disabled={isDownloadingLabel(melhorEnvioLabel.melhor_envio_order_id)}
                    >
                      {isDownloadingLabel(melhorEnvioLabel.melhor_envio_order_id) ? (
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4 mr-1" />
                      )}
                      PDF
                    </Button>
                  ) : labelData?.label_pdf_url && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="text-green-600 border-green-300 hover:bg-green-100"
                      onClick={() => window.open(labelData.label_pdf_url!, '_blank')}
                    >
                      <Download className="h-4 w-4 mr-1" />
                      PDF
                    </Button>
                  )}
                </div>
                {labelData.created_at && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Gerada em {format(new Date(labelData.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* No tracking yet */}
      {!finalTrackingCode && saleData.delivery_type === 'carrier' && (
        <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-600" />
            <span className="text-sm text-amber-700 dark:text-amber-400">
              Etiqueta ainda não gerada
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            A etiqueta será gerada no módulo de Expedição.
          </p>
        </div>
      )}

      {/* Last Update */}
      {saleData.updated_at && (
        <p className="text-xs text-muted-foreground text-center">
          Última atualização: {format(new Date(saleData.updated_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
        </p>
      )}
    </div>
  );
}
