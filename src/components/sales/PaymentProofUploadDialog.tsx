import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Camera, Upload, Loader2, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useUpdateSale } from '@/hooks/useSales';

interface PaymentProofUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  saleId: string;
  organizationId: string;
}

export function PaymentProofUploadDialog({
  open,
  onOpenChange,
  saleId,
  organizationId,
}: PaymentProofUploadDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const updateSale = useUpdateSale();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(f));
  };

  const handleClose = (val: boolean) => {
    if (!val) {
      if (preview) URL.revokeObjectURL(preview);
      setFile(null);
      setPreview(null);
    }
    onOpenChange(val);
  };

  const handleSubmit = async () => {
    if (!file) {
      toast.error('Selecione ou tire uma foto do comprovante');
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `${organizationId}/${saleId}/payment-proof-${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from('sales-documents')
        .upload(path, file, { upsert: false });
      if (uploadErr) throw uploadErr;

      const { data: signed, error: signedErr } = await supabase.storage
        .from('sales-documents')
        .createSignedUrl(path, 60 * 60 * 24 * 365 * 5); // 5 anos
      if (signedErr) throw signedErr;

      await updateSale.mutateAsync({
        id: saleId,
        data: {
          payment_proof_url: signed.signedUrl,
          proof_source: 'manual_upload',
          missing_payment_proof: false,
        } as any,
      });

      toast.success('✅ Comprovante anexado com sucesso!');
      handleClose(false);
    } catch (err) {
      console.error('Erro upload comprovante:', err);
      toast.error(err instanceof Error ? err.message : 'Erro ao enviar comprovante');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Anexar Comprovante de Pagamento</DialogTitle>
          <DialogDescription>
            Tire uma foto ou selecione uma imagem do comprovante de pagamento.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!preview ? (
            <div className="grid grid-cols-2 gap-3">
              <Button
                type="button"
                variant="outline"
                className="h-32 flex-col gap-2"
                onClick={() => cameraInputRef.current?.click()}
              >
                <Camera className="h-8 w-8" />
                <span className="text-sm">Tirar foto</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-32 flex-col gap-2"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-8 w-8" />
                <span className="text-sm">Galeria</span>
              </Button>
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleFileChange}
              />
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
          ) : (
            <div className="relative">
              {file?.type.startsWith('image/') ? (
                <img
                  src={preview}
                  alt="Comprovante"
                  className="w-full max-h-80 object-contain rounded-lg border"
                />
              ) : (
                <div className="p-8 text-center border rounded-lg bg-muted">
                  <p className="text-sm font-medium">{file?.name}</p>
                </div>
              )}
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute top-2 right-2 h-8 w-8"
                onClick={() => {
                  if (preview) URL.revokeObjectURL(preview);
                  setFile(null);
                  setPreview(null);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)} disabled={uploading}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!file || uploading}>
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Enviando...
              </>
            ) : (
              'Salvar comprovante'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
