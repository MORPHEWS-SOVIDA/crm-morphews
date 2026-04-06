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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { extractStorageFilePath } from '@/lib/storage-utils';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

type NoAttachReason = 'no_file' | 'no_call_recording' | 'other_method';
type ConfirmationMethod = 'call' | 'whatsapp' | 'in_person' | 'motoboy_informed';

interface SellerDeliveryProofDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  saleId: string;
  onConfirm: (proofUrls: string[], deliveryDate: string, confirmationMethod?: string, noAttachReason?: string) => Promise<void> | void;
  isLoading?: boolean;
}

const noAttachReasonLabels: Record<NoAttachReason, string> = {
  no_file: 'Não tenho como anexar',
  no_call_recording: 'Fiz uma ligação e não tenho como baixar minha ligação',
  other_method: 'Fiz de outra forma',
};

const confirmationMethodLabels: Record<ConfirmationMethod, string> = {
  call: 'Por ligação',
  whatsapp: 'Por WhatsApp',
  in_person: 'Pessoalmente',
  motoboy_informed: 'Motoboy me informou',
};

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
  const [deliveryDate, setDeliveryDate] = useState<Date>(new Date());
  const [noAttachReason, setNoAttachReason] = useState<NoAttachReason | null>(null);
  const [confirmationMethod, setConfirmationMethod] = useState<ConfirmationMethod | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasFiles = files.length > 0;
  const skippingAttach = noAttachReason !== null;

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

    // If adding files, clear skip reason
    if (validFiles.length > 0) {
      setNoAttachReason(null);
    }

    setFiles(prev => [...prev, ...validFiles]);
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

  const handleSelectNoAttach = (reason: NoAttachReason) => {
    setNoAttachReason(reason);
    // Clear files when choosing not to attach
    previews.forEach(p => { if (p !== 'audio') URL.revokeObjectURL(p); });
    setFiles([]);
    setPreviews([]);
  };

  const canSubmit = () => {
    if (hasFiles) return true;
    if (skippingAttach && confirmationMethod) return true;
    return false;
  };

  const handleSubmit = async () => {
    if (!canSubmit()) {
      if (skippingAttach && !confirmationMethod) {
        toast.error('Selecione como você confirmou a entrega');
      } else {
        toast.error('Anexe arquivos ou selecione um motivo');
      }
      return;
    }

    setUploading(true);
    const uploadedPaths: string[] = [];
    try {
      const urls: string[] = [];

      if (hasFiles) {
        for (const file of files) {
          const ext = file.name.split('.').pop() || 'bin';
          const path = `${saleId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
          const { error } = await supabase.storage
            .from('delivery-proofs')
            .upload(path, file);
          if (error) throw error;
          uploadedPaths.push(path);

          const { data: urlData } = supabase.storage
            .from('delivery-proofs')
            .getPublicUrl(path);
          urls.push(urlData.publicUrl);
        }
      }

      await onConfirm(
        urls,
        format(deliveryDate, 'yyyy-MM-dd'),
        confirmationMethod || undefined,
        noAttachReason || undefined,
      );
      toast.success('Entrega confirmada pelo vendedor');
      handleClose(false);
    } catch (err) {
      if (uploadedPaths.length > 0) {
        const { error: cleanupError } = await supabase.storage
          .from('delivery-proofs')
          .remove(uploadedPaths.map(path => extractStorageFilePath(path, 'delivery-proofs')));
        if (cleanupError) console.error('Cleanup error:', cleanupError);
      }
      console.error('Upload error:', err);
      toast.error(err instanceof Error ? err.message : 'Erro ao enviar arquivos');
    } finally {
      setUploading(false);
    }
  };

  const handleClose = (val: boolean) => {
    if (!val) {
      previews.forEach(p => { if (p !== 'audio') URL.revokeObjectURL(p); });
      setFiles([]);
      setPreviews([]);
      setDeliveryDate(new Date());
      setNoAttachReason(null);
      setConfirmationMethod(null);
    }
    onOpenChange(val);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            📱 Confirmar Entrega pelo Vendedor
          </DialogTitle>
          <DialogDescription>
            Anexe print da conversa no WhatsApp ou gravação de ligação, ou indique o motivo caso não possua comprovante.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Data de entrega */}
          <div>
            <Label className="text-sm font-medium">Data que o cliente recebeu *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal mt-1",
                    !deliveryDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {deliveryDate ? format(deliveryDate, "dd/MM/yyyy", { locale: ptBR }) : 'Selecionar data'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={deliveryDate}
                  onSelect={(d) => d && setDeliveryDate(d)}
                  disabled={(date) => date > new Date()}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Comprovantes (opcional agora) */}
          <div>
            <Label className="text-sm font-medium">Comprovante(s)</Label>
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
              disabled={skippingAttach}
            >
              <Upload className="w-4 h-4 mr-2" />
              Selecionar Arquivos
            </Button>
          </div>

          {/* Preview dos arquivos */}
          {hasFiles && (
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

          {/* Opções de não anexar */}
          {!hasFiles && (
            <div className="space-y-2 border rounded-lg p-3 bg-muted/20">
              <Label className="text-sm font-medium text-muted-foreground">
                Não tem comprovante? Selecione o motivo:
              </Label>
              <RadioGroup
                value={noAttachReason || ''}
                onValueChange={(v) => handleSelectNoAttach(v as NoAttachReason)}
              >
                {(Object.entries(noAttachReasonLabels) as [NoAttachReason, string][]).map(([key, label]) => (
                  <div key={key} className="flex items-center space-x-2">
                    <RadioGroupItem value={key} id={`no-attach-${key}`} />
                    <Label htmlFor={`no-attach-${key}`} className="text-sm cursor-pointer">
                      {label}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
          )}

          {/* Método de confirmação (aparece quando não tem anexo) */}
          {skippingAttach && (
            <div className="space-y-2 border rounded-lg p-3 bg-muted/20">
              <Label className="text-sm font-medium">
                Como você confirmou essa entrega? *
              </Label>
              <RadioGroup
                value={confirmationMethod || ''}
                onValueChange={(v) => setConfirmationMethod(v as ConfirmationMethod)}
              >
                {(Object.entries(confirmationMethodLabels) as [ConfirmationMethod, string][]).map(([key, label]) => (
                  <div key={key} className="flex items-center space-x-2">
                    <RadioGroupItem value={key} id={`confirm-method-${key}`} />
                    <Label htmlFor={`confirm-method-${key}`} className="text-sm cursor-pointer">
                      {label}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)} disabled={uploading}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit() || uploading || isLoading}
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
