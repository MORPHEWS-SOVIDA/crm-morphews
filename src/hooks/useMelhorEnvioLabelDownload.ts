import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/**
 * Hook for downloading Melhor Envio labels via Edge Function proxy.
 * This avoids CORS issues and doesn't require the user to be logged into Melhor Envio.
 */
export function useMelhorEnvioLabelDownload() {
  const [downloading, setDownloading] = useState<string | null>(null);

  const downloadLabel = async (
    orderId: string, 
    trackingCode: string | null, 
    organizationId: string
  ): Promise<boolean> => {
    if (!orderId) {
      toast.error('ID do pedido não encontrado');
      return false;
    }

    if (!organizationId) {
      toast.error('Organização não identificada');
      return false;
    }

    setDownloading(orderId);
    try {
      const { data, error } = await supabase.functions.invoke('melhor-envio-label', {
        body: { 
          action: 'download_pdf',
          organization_id: organizationId,
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
      return true;
    } catch (err) {
      console.error('[MelhorEnvio] PDF download error:', err);
      toast.error('Erro ao baixar etiqueta. Tente novamente.');
      return false;
    } finally {
      setDownloading(null);
    }
  };

  return {
    downloadLabel,
    downloading,
    isDownloading: (orderId: string) => downloading === orderId,
  };
}
