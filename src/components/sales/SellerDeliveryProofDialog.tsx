import { useState, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Upload, Image, Mic, X, Loader2, CalendarIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface SellerDeliveryProofDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  saleId: string;
  onConfirm: (proofUrls: string[]) => void;
  isLoading?: boolean;
}

export function SellerDeliveryProofDialog({
  open,
  onOpenChange,
  saleId,
  onConfirm,
  isLoading,
}: SellerDeliveryProofDialogProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    const validFiles = selectedFiles.filter(f => {
      const isImage = f.type.startsWith('image/');
      const isAudio = f.type.startsWith('audio/');
      if (!isImage && !isAudio) {
        toast.error(`Arquivo "${f.name}" não é imagem nem áudio`);
        return false;
      }
      if (f.size > 20 * 1024 * 1024) {
        toast.error(`Arquivo "${f.name}" excede 20MB`);
        return false;
      }
      return true;
    });

    setFiles(prev => [...prev, ...validFiles]);

    // Generate previews for images
    validFiles.forEach(f => {
      if (f.type.startsWith('image/')) {
        const url = URL.createObjectURL(f);
        setPreviews(prev => [...prev, url]);
      } else {
        setPreviews(prev => [...prev, 'audio']);
      }
    });

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (index: number) => {
    if (previews[index] && previews[index] !== 'audio') {
      URL.revokeObjectURL(previews[index]);
    }
    setFiles(prev => prev.filter((_, i) => i !== index));
    setPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (files.length === 0) {
      toast.error('Anexe pelo menos 1 arquivo (print ou áudio)');
      return;
    }

    setUploading(true);
    try {
      const urls: string[] = [];
      for (const file of files) {
        const ext = file.name.split('.').pop() || 'bin';
        const path = `${saleId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error } = await supabase.storage
          .from('delivery-proofs')
          .upload(path, file);
        if (error) throw error;

        const { data: urlData } = supabase.storage
          .from('delivery-proofs')
          .getPublicUrl(path);
        urls.push(urlData.publicUrl);
      }

      // Save proof URLs to sales table
      await supabase
        .from('sales')
        .update({
          seller_delivery_proof_urls: urls,
        } as any)
        .eq('id', saleId);

      onConfirm(urls);
      // Cleanup
      previews.forEach(p => { if (p !== 'audio') URL.revokeObjectURL(p); });
      setFiles([]);
      setPreviews([]);
    } catch (err) {
      console.error('Upload error:', err);
      toast.error('Erro ao enviar arquivos');
    } finally {
      setUploading(false);
    }
  };

  const handleClose = (val: boolean) => {
    if (!val) {
      previews.forEach(p => { if (p !== 'audio') URL.revokeObjectURL(p); });
      setFiles([]);
      setPreviews([]);
    }
    onOpenChange(val);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            📱 Confirmar Entrega pelo Vendedor
          </DialogTitle>
          <DialogDescription>
            Anexe print da conversa no WhatsApp ou gravação de ligação confirmando a entrega com o cliente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium">Comprovante(s) *</Label>
            <p className="text-xs text-muted-foreground mb-2">
              Aceita: imagens (print screen) ou áudios (gravação de ligação)
            </p>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,audio/*"
              multiple
              className="hidden"
              onChange={handleFileChange}
            />

            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-4 h-4 mr-2" />
              Selecionar Arquivos
            </Button>
          </div>

          {files.length > 0 && (
            <div className="space-y-2">
              {files.map((file, i) => (
                <div key={i} className="flex items-center gap-2 p-2 rounded border bg-muted/30">
                  {file.type.startsWith('image/') ? (
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Image className="w-4 h-4 text-blue-500 shrink-0" />
                      {previews[i] && previews[i] !== 'audio' && (
                        <img src={previews[i]} alt="" className="w-10 h-10 rounded object-cover" />
                      )}
                      <span className="text-sm truncate">{file.name}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Mic className="w-4 h-4 text-green-500 shrink-0" />
                      <span className="text-sm truncate">{file.name}</span>
                    </div>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 shrink-0"
                    onClick={() => removeFile(i)}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)} disabled={uploading}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={files.length === 0 || uploading || isLoading}
          >
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Enviando...
              </>
            ) : (
              'Confirmar Entrega'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
