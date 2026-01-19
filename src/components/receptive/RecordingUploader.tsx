import { useState, useRef } from 'react';
import { Upload, Loader2, Mic, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface RecordingUploaderProps {
  attendanceId: string;
  organizationId: string;
  onUploadComplete: (url: string, storagePath: string) => void;
  onCancel: () => void;
  isUploading: boolean;
  setIsUploading: (value: boolean) => void;
}

export function RecordingUploader({
  attendanceId,
  organizationId,
  onUploadComplete,
  onCancel,
  isUploading,
  setIsUploading,
}: RecordingUploaderProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/m4a', 'audio/mp4', 'audio/x-m4a'];
    if (!validTypes.includes(file.type) && !file.name.match(/\.(mp3|wav|ogg|m4a)$/i)) {
      toast.error('Formato não suportado. Use MP3, WAV, OGG ou M4A.');
      return;
    }

    // Validate file size (max 50MB)
    if (file.size > 50 * 1024 * 1024) {
      toast.error('Arquivo muito grande. Máximo 50MB.');
      return;
    }

    setSelectedFile(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);

    try {
      const fileExt = selectedFile.name.split('.').pop() || 'mp3';
      const fileName = `${organizationId}/${attendanceId}/${Date.now()}.${fileExt}`;

      // Upload to storage
      const { data, error: uploadError } = await supabase.storage
        .from('receptive-recordings')
        .upload(fileName, selectedFile, {
          contentType: selectedFile.type || 'audio/mpeg',
          cacheControl: '3600',
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw uploadError;
      }

      // Get signed URL for the file (valid for 1 hour - enough for transcription)
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from('receptive-recordings')
        .createSignedUrl(fileName, 3600); // 1 hour

      if (signedUrlError || !signedUrlData?.signedUrl) {
        console.error('Signed URL error:', signedUrlError);
        throw signedUrlError || new Error('Falha ao gerar URL de acesso');
      }

      // Save the path so we can delete later after transcription
      onUploadComplete(signedUrlData.signedUrl, fileName);
      toast.success('Gravação enviada com sucesso!');
    } catch (error: any) {
      console.error('Upload failed:', error);
      toast.error(error.message || 'Erro ao enviar gravação');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-3">
      <input
        type="file"
        ref={fileInputRef}
        accept="audio/*,.mp3,.wav,.ogg,.m4a"
        onChange={handleFileSelect}
        className="hidden"
      />

      {!selectedFile ? (
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            <Upload className="w-4 h-4 mr-2" />
            Selecionar Arquivo de Áudio
          </Button>
          <Button size="sm" variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 bg-muted px-3 py-1.5 rounded-md text-sm">
            <Mic className="w-4 h-4 text-muted-foreground" />
            <span className="max-w-[200px] truncate">{selectedFile.name}</span>
            <span className="text-muted-foreground">
              ({(selectedFile.size / 1024 / 1024).toFixed(1)} MB)
            </span>
            <button
              type="button"
              onClick={() => setSelectedFile(null)}
              className="text-muted-foreground hover:text-foreground"
              disabled={isUploading}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <Button
            size="sm"
            onClick={handleUpload}
            disabled={isUploading}
          >
            {isUploading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Enviando...
              </>
            ) : (
              'Enviar'
            )}
          </Button>
          <Button size="sm" variant="ghost" onClick={onCancel} disabled={isUploading}>
            Cancelar
          </Button>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Formatos aceitos: MP3, WAV, OGG, M4A (máx. 50MB)
      </p>
    </div>
  );
}
