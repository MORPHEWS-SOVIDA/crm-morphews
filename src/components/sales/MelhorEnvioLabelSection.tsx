import { useState } from 'react';
import { Tag, Download, Printer, ExternalLink, Package, Copy, RefreshCw, Share2, Loader2, Truck, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  const [downloading, setDownloading] = useState(false);
  const [manualTrackingCode, setManualTrackingCode] = useState('');
  const [savingManualCode, setSavingManualCode] = useState(false);
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

  // Handler to download/print PDF - tries storage URL first, then direct URL, then edge function
  const handleDownloadPdf = async (
    orderId: string, 
    trackingCode: string, 
    directUrl?: string | null,
    storagePdfUrl?: string | null
  ) => {
    if (!orderId && !directUrl && !storagePdfUrl) {
      toast.error('ID do pedido não encontrado');
      return;
    }

    // Priority 1: Use our storage URL (doesn't require Melhor Envio login)
    if (storagePdfUrl) {
      window.open(storagePdfUrl, '_blank');
      toast.success('Abrindo etiqueta...');
      return;
    }

    // Priority 2: If we have a direct URL from Melhor Envio, try it
    // Note: This may require login on their site - not ideal
    if (directUrl) {
      window.open(directUrl, '_blank');
      toast.success('Abrindo etiqueta...');
      return;
    }

    setDownloading(true);
    try {
      const { data, error } = await supabase.functions.invoke('melhor-envio-label', {
        body: { 
          action: 'download_pdf',
          organization_id: sale?.organization_id,
          order_id: orderId,
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Erro ao baixar PDF');

      // Convert base64 to blob and download
      const byteCharacters = atob(data.pdf_base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/pdf' });
      
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `etiqueta-${trackingCode || orderId.slice(0, 8)}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
      
      toast.success('Download iniciado!');
    } catch (err) {
      console.error('[MelhorEnvio] PDF download error:', err);
      // Fallback: open Melhor Envio panel for manual download
      const panelUrl = `https://melhorenvio.com.br/painel/pedidos/${orderId}`;
      toast.error('Erro na conexão. Abrindo painel do Melhor Envio...');
      window.open(panelUrl, '_blank');
    } finally {
      setDownloading(false);
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
            {label.melhor_envio_order_id && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 gap-2"
                  onClick={() => handleDownloadPdf(
                    label.melhor_envio_order_id!,
                    hasRealTrackingCode ? label.tracking_code : label.melhor_envio_order_id?.slice(0, 8) || 'etiqueta',
                    label.label_pdf_url,
                    (label as any).storage_pdf_url
                  )}
                  disabled={downloading}
                >
                  {downloading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Printer className="w-4 h-4" />
                  )}
                  {downloading ? 'Baixando...' : 'Imprimir'}
                </Button>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-9 w-9"
                        onClick={() => handleDownloadPdf(
                          label.melhor_envio_order_id!,
                          hasRealTrackingCode ? label.tracking_code : label.melhor_envio_order_id?.slice(0, 8) || 'etiqueta',
                          label.label_pdf_url,
                          (label as any).storage_pdf_url
                        )}
                        disabled={downloading}
                      >
                        {downloading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Download className="w-4 h-4" />
                        )}
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

  // Save manual tracking code to the sale
  const handleSaveManualTracking = async () => {
    if (!manualTrackingCode.trim() || !sale?.id) return;
    
    setSavingManualCode(true);
    try {
      const { error } = await supabase
        .from('sales')
        .update({ 
          tracking_code: manualTrackingCode.trim(),
        })
        .eq('id', sale.id);

      if (error) throw error;
      
      toast.success('Código de rastreio salvo!');
      setManualTrackingCode('');
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['melhor-envio-label-sale'] });
    } catch (err) {
      console.error('Error saving tracking code:', err);
      toast.error('Erro ao salvar código de rastreio');
    } finally {
      setSavingManualCode(false);
    }
  };

  // If sale already has a manual tracking code (not from Melhor Envio)
  if (!label && sale?.tracking_code) {
    const code = sale.tracking_code;
    const hasReal = isRealTrackingCode(code);
    
    if (hasReal) {
      return (
        <div className="p-4 rounded-lg border bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Tag className="w-4 h-4 text-green-600" />
              <span className="font-medium text-green-700 dark:text-green-400">Código de Rastreio (Manual)</span>
            </div>
            <Badge variant="outline" className="text-xs">
              {sale.shipping_carrier?.name || 'Transportadora'}
            </Badge>
          </div>
          <div className="bg-white dark:bg-background rounded-lg p-3 border border-green-200 dark:border-green-700">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-xs text-muted-foreground mb-1">Código de Rastreio</p>
                <p className="text-xl font-mono font-bold text-green-700 dark:text-green-400 tracking-wider">
                  {code}
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
                        onClick={() => handleCopyTracking(code)}
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
                        onClick={() => handleShareTracking(code)}
                      >
                        <Share2 className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Enviar para cliente</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-9 w-9 text-green-600 hover:bg-green-100"
                        onClick={() => window.open(getTrackingUrl(code), '_blank')}
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
        </div>
      );
    }
  }

  // No label yet - show options
  return (
    <>
      <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800 space-y-4">
        <div className="flex items-center gap-2">
          <Package className="w-4 h-4 text-amber-600" />
          <span className="text-sm font-medium text-amber-700 dark:text-amber-400">
            Etiqueta / Rastreio de Envio
          </span>
        </div>

        {/* Option 1: Melhor Envio (if configured) */}
        {isConfigured && (
          <div>
            <Button
              size="sm"
              onClick={() => setShowGenerator(true)}
              disabled={isCancelled}
              className="w-full"
            >
              <Tag className="w-4 h-4 mr-2" />
              Gerar Etiqueta (Melhor Envio)
            </Button>
          </div>
        )}

        {/* Separator if both options available */}
        {isConfigured && (
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-amber-200 dark:border-amber-700" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-amber-50 dark:bg-amber-900/20 px-2 text-amber-500">ou</span>
            </div>
          </div>
        )}

        {/* Option 2: Manual tracking code (always available) */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400">
            <Truck className="w-4 h-4" />
            Código de Rastreio Manual
          </Label>
          <p className="text-xs text-muted-foreground">
            Cole o código de rastreio de qualquer transportadora
          </p>
          <div className="flex gap-2">
            <Input
              value={manualTrackingCode}
              onChange={(e) => setManualTrackingCode(e.target.value.toUpperCase())}
              placeholder="Ex: AB123456789BR"
              className="bg-white dark:bg-background"
              disabled={isCancelled}
            />
            <Button
              size="sm"
              variant="default"
              onClick={handleSaveManualTracking}
              disabled={!manualTrackingCode.trim() || savingManualCode || isCancelled}
            >
              {savingManualCode ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-1" />
              )}
              Salvar
            </Button>
          </div>
        </div>
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
