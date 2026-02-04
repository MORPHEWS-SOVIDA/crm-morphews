import { useState } from 'react';
import { Tag, Download, Printer, ExternalLink, Package, Copy, RefreshCw, Share2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useMelhorEnvioConfig, useSaleMelhorEnvioLabel, MelhorEnvioLabel } from '@/hooks/useMelhorEnvio';
import { MelhorEnvioLabelGenerator } from '@/components/melhorenvio/MelhorEnvioLabelGenerator';
import { formatCurrency } from '@/hooks/useSales';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

interface MelhorEnvioLabelSectionProps {
  sale: any;
  isCancelled?: boolean;
}

// Helper to check if a tracking code is a real carrier code (not UUID)
function isRealTrackingCode(code: string | null | undefined, orderId?: string | null): boolean {
  if (!code) return false;
  // UUIDs have format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
  if (code.includes('-') && code.length === 36) return false;
  // If code equals the order ID, it's not real
  if (orderId && code === orderId) return false;
  // Real Correios codes: 2 letters + 9 digits + 2 letters (e.g., AB123456789BR)
  const correiosFormat = /^[A-Z]{2}[0-9]{9}[A-Z]{2}$/i;
  if (correiosFormat.test(code)) return true;
  // Other carriers might have different formats - if it's not a UUID, consider it real
  return !code.includes('-');
}

// Generate tracking URL based on carrier
function getTrackingUrl(trackingCode: string, companyName?: string | null): string {
  const isCorreios = companyName?.toLowerCase().includes('correios');
  if (isCorreios) {
    return `https://www.melhorrastreio.com.br/rastreio/${trackingCode}`;
  }
  // Generic tracking for other carriers
  return `https://www.melhorrastreio.com.br/rastreio/${trackingCode}`;
}

export function MelhorEnvioLabelSection({ sale, isCancelled }: MelhorEnvioLabelSectionProps) {
  const { data: config, isLoading: configLoading } = useMelhorEnvioConfig();
  const { data: label, isLoading: labelLoading } = useSaleMelhorEnvioLabel(sale?.id);
  const [showGenerator, setShowGenerator] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const queryClient = useQueryClient();

  // Only show for carrier delivery type
  if (sale?.delivery_type !== 'carrier') return null;

  const isConfigured = config?.is_active;

  if (configLoading || labelLoading) {
    return (
      <div className="p-4 bg-muted/50 rounded-lg animate-pulse">
        <div className="h-20" />
      </div>
    );
  }

  // Handler to refresh tracking code from Melhor Envio
  const handleRefreshTracking = async () => {
    if (!label?.melhor_envio_order_id) return;
    
    setRefreshing(true);
    try {
      const { data, error } = await supabase.functions.invoke('melhor-envio-refresh-tracking', {
        body: { 
          order_id: label.melhor_envio_order_id,
          label_id: label.id 
        },
      });

      if (error) throw error;

      if (data?.tracking_code && data.tracking_code !== label.tracking_code) {
        toast.success(`Código atualizado: ${data.tracking_code}`);
        queryClient.invalidateQueries({ queryKey: ['melhor-envio-label-sale'] });
        queryClient.invalidateQueries({ queryKey: ['sales'] });
      } else {
        toast.info('Código de rastreio ainda não disponível. Aguarde a postagem física.');
      }
    } catch (err) {
      console.error('[MelhorEnvio] Refresh error:', err);
      toast.error('Não foi possível atualizar o código de rastreio');
    } finally {
      setRefreshing(false);
    }
  };

  // Handler to copy tracking code
  const handleCopyTracking = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('Código copiado!');
  };

  // Handler to share tracking via WhatsApp
  const handleShareTracking = (code: string, companyName?: string | null) => {
    const clientName = sale?.leads?.name || sale?.lead?.name || 'Cliente';
    const firstName = clientName.split(' ')[0];
    const trackingUrl = getTrackingUrl(code, companyName);
    
    const message = encodeURIComponent(
      `Olá ${firstName}! 📦\n\nSeu pedido foi enviado!\n\n` +
      `🔍 Código de rastreio: ${code}\n` +
      `📍 Acompanhe aqui: ${trackingUrl}\n\n` +
      `Qualquer dúvida, estamos à disposição! 😊`
    );
    
    const phone = sale?.leads?.whatsapp || sale?.lead?.whatsapp;
    if (phone) {
      const cleanPhone = phone.replace(/\D/g, '');
      window.open(`https://wa.me/${cleanPhone}?text=${message}`, '_blank');
    } else {
      // Copy message to clipboard if no phone
      navigator.clipboard.writeText(decodeURIComponent(message));
      toast.success('Mensagem copiada! Cole no WhatsApp do cliente.');
    }
  };

  // Handler to download PDF
  const handleDownloadPdf = async (url: string, trackingCode: string) => {
    try {
      // Fetch the PDF and trigger download
      const response = await fetch(url);
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `etiqueta-${trackingCode}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
      toast.success('Download iniciado!');
    } catch {
      // Fallback: open in new tab
      window.open(url, '_blank');
    }
  };

  // If label exists, show label info
  if (label) {
    const hasRealTrackingCode = isRealTrackingCode(label.tracking_code, label.melhor_envio_order_id);
    const isPosted = !!label.posted_at;
    const displayCode = hasRealTrackingCode ? label.tracking_code : null;
    
    return (
      <div className="space-y-4">
        {/* Main Tracking Display */}
        <div className={`p-4 rounded-lg border ${
          hasRealTrackingCode 
            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
            : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
        }`}>
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Tag className={`w-4 h-4 ${hasRealTrackingCode ? 'text-green-600' : 'text-amber-600'}`} />
              <span className={`font-medium ${hasRealTrackingCode ? 'text-green-700 dark:text-green-400' : 'text-amber-700 dark:text-amber-400'}`}>
                {hasRealTrackingCode ? 'Código de Rastreio' : 'Etiqueta Gerada'}
              </span>
            </div>
            <div className="flex gap-1.5">
              <Badge className={isPosted 
                ? 'bg-green-100 text-green-700 border-green-300' 
                : 'bg-amber-100 text-amber-700 border-amber-300'
              }>
                {isPosted ? 'Postada' : 'Aguardando Postagem'}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {label.company_name} - {label.service_name}
              </Badge>
            </div>
          </div>

          {/* Tracking Code Display */}
          {hasRealTrackingCode ? (
            <div className="bg-white dark:bg-background rounded-lg p-3 border border-green-200 dark:border-green-700">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground mb-1">Código de Rastreio</p>
                  <p className="text-xl font-mono font-bold text-green-700 dark:text-green-400 tracking-wider">
                    {displayCode}
                  </p>
                </div>
                <div className="flex gap-1">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-9 w-9 text-green-600 hover:bg-green-100"
                          onClick={() => handleCopyTracking(displayCode!)}
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Copiar código</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-9 w-9 text-green-600 hover:bg-green-100"
                          onClick={() => handleShareTracking(displayCode!, label.company_name)}
                        >
                          <Share2 className="w-4 h-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Enviar para cliente (WhatsApp)</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-9 w-9 text-green-600 hover:bg-green-100"
                          onClick={() => window.open(getTrackingUrl(displayCode!, label.company_name), '_blank')}
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Ver rastreio online</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-background rounded-lg p-3 border border-amber-200 dark:border-amber-700">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground mb-1">ID do Pedido (Melhor Envio)</p>
                  <p className="text-sm font-mono text-muted-foreground">
                    {label.melhor_envio_order_id?.slice(0, 8)}...
                  </p>
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                    ⏳ O código de rastreio será disponibilizado após a postagem física
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-2"
                  onClick={handleRefreshTracking}
                  disabled={refreshing}
                >
                  {refreshing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  Atualizar
                </Button>
              </div>
            </div>
          )}

          {/* Label Details */}
          <div className="grid grid-cols-2 gap-2 mt-3 text-sm">
            <div>
              <span className="text-muted-foreground text-xs">Gerada em:</span>
              <p className="text-sm">{format(new Date(label.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p>
            </div>
            {label.declared_value_cents && label.declared_value_cents > 0 && (
              <div>
                <span className="text-muted-foreground text-xs">Valor declarado:</span>
                <p className="text-sm">{formatCurrency(label.declared_value_cents)}</p>
              </div>
            )}
            {label.weight_grams && (
              <div>
                <span className="text-muted-foreground text-xs">Peso:</span>
                <p className="text-sm">{label.weight_grams}g</p>
              </div>
            )}
          </div>

          <Separator className="my-3" />

          {/* Action Buttons */}
          <div className="flex gap-2">
            {label.label_pdf_url && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 gap-2"
                  onClick={() => window.open(label.label_pdf_url!, '_blank')}
                >
                  <Printer className="w-4 h-4" />
                  Imprimir
                </Button>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-9 w-9"
                        onClick={() => handleDownloadPdf(
                          label.label_pdf_url!, 
                          hasRealTrackingCode ? label.tracking_code : label.melhor_envio_order_id?.slice(0, 8) || 'etiqueta'
                        )}
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Baixar PDF</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // No label yet - show generate button
  return (
    <>
      <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
        <div className="flex items-center gap-2 mb-3">
          <Package className="w-4 h-4 text-amber-600" />
          <span className="text-sm font-medium text-amber-700 dark:text-amber-400">
            Etiqueta de Envio
          </span>
        </div>

        {!isConfigured ? (
          <p className="text-sm text-muted-foreground mb-3">
            Configure a integração com o Melhor Envio para gerar etiquetas.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground mb-3">
            Gere a etiqueta de envio para esta venda.
          </p>
        )}

        <Button
          size="sm"
          onClick={() => setShowGenerator(true)}
          disabled={!isConfigured || isCancelled}
          className="w-full"
        >
          <Tag className="w-4 h-4 mr-2" />
          Gerar Etiqueta
        </Button>
      </div>

      {/* Generator Dialog */}
      <Dialog open={showGenerator} onOpenChange={setShowGenerator}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="w-5 h-5" />
              Gerar Etiqueta - Melhor Envio
            </DialogTitle>
          </DialogHeader>
          <MelhorEnvioLabelGenerator
            sale={sale}
            onSuccess={() => setShowGenerator(false)}
            onCancel={() => setShowGenerator(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
