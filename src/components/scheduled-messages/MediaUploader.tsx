import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { 
  Image, 
  Paperclip, 
  Mic, 
  X, 
  Loader2, 
  Play,
  Square,
  FileIcon,
  MicOff
} from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface MediaUploaderProps {
  mediaType: 'image' | 'audio' | 'document' | null;
  mediaUrl: string | null;
  mediaFilename: string | null;
  onMediaChange: (data: {
    media_type: 'image' | 'audio' | 'document' | null;
    media_url: string | null;
    media_filename: string | null;
  }) => void;
  organizationId: string;
  disabled?: boolean;
}

// Get the best supported audio format for recording
function getBestAudioFormat(): { mimeType: string; supported: boolean } {
  if (typeof MediaRecorder === 'undefined') {
    return { mimeType: '', supported: false };
  }

  const formats = [
    'audio/ogg; codecs=opus',
    'audio/ogg',
    'audio/webm; codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/mpeg',
  ];

  for (const format of formats) {
    if (MediaRecorder.isTypeSupported(format)) {
      return { mimeType: format, supported: true };
    }
  }

  return { mimeType: '', supported: false };
}

export function MediaUploader({
  mediaType,
  mediaUrl,
  mediaFilename,
  onMediaChange,
  organizationId,
  disabled = false,
}: MediaUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  
  const imageInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const uploadToStorage = async (file: Blob, filename: string): Promise<string | null> => {
    try {
      const timestamp = Date.now();
      const safeName = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
      const path = `${organizationId}/${timestamp}_${safeName}`;
      
      const { error } = await supabase.storage
        .from('scheduled-messages-media')
        .upload(path, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from('scheduled-messages-media')
        .getPublicUrl(path);

      return urlData.publicUrl;
    } catch (error) {
      console.error('Upload error:', error);
      throw error;
    }
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Selecione um arquivo de imagem');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Imagem muito grande (máx. 10MB)');
      return;
    }

    setIsUploading(true);
    try {
      const url = await uploadToStorage(file, file.name);
      if (url) {
        onMediaChange({
          media_type: 'image',
          media_url: url,
          media_filename: file.name,
        });
        toast.success('Imagem anexada');
        setIsPopoverOpen(false);
      }
    } catch (error) {
      toast.error('Erro ao fazer upload da imagem');
    } finally {
      setIsUploading(false);
      if (imageInputRef.current) imageInputRef.current.value = '';
    }
  };

  const handleDocumentSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
      toast.error('Arquivo muito grande (máx. 20MB)');
      return;
    }

    setIsUploading(true);
    try {
      const url = await uploadToStorage(file, file.name);
      if (url) {
        onMediaChange({
          media_type: 'document',
          media_url: url,
          media_filename: file.name,
        });
        toast.success('Arquivo anexado');
        setIsPopoverOpen(false);
      }
    } catch (error) {
      toast.error('Erro ao fazer upload do arquivo');
    } finally {
      setIsUploading(false);
      if (documentInputRef.current) documentInputRef.current.value = '';
    }
  };

  const startRecording = async () => {
    const formatInfo = getBestAudioFormat();
    
    if (!formatInfo.supported) {
      toast.error('Seu navegador não suporta gravação de áudio');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType: formatInfo.mimeType });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        if (chunksRef.current.length === 0) {
          return;
        }
        
        setIsUploading(true);
        
        const recordedMimeType = formatInfo.mimeType.split(';')[0];
        const extension = recordedMimeType.includes('ogg') ? 'ogg' : 
                         recordedMimeType.includes('webm') ? 'webm' : 
                         recordedMimeType.includes('mp4') ? 'm4a' : 'audio';
        const blob = new Blob(chunksRef.current, { type: recordedMimeType });
        
        try {
          const filename = `audio_${Date.now()}.${extension}`;
          const url = await uploadToStorage(blob, filename);
          if (url) {
            onMediaChange({
              media_type: 'audio',
              media_url: url,
              media_filename: filename,
            });
            toast.success('Áudio gravado e anexado');
            setIsPopoverOpen(false);
          }
        } catch (error) {
          toast.error('Erro ao salvar áudio');
        } finally {
          setIsUploading(false);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Error starting recording:', error);
      toast.error('Erro ao acessar microfone');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    }
  };

  const cancelRecording = () => {
    chunksRef.current = [];
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
  };

  const removeMedia = () => {
    onMediaChange({
      media_type: null,
      media_url: null,
      media_filename: null,
    });
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const audioSupported = getBestAudioFormat().supported;

  // Show current media preview
  if (mediaUrl && mediaType) {
    return (
      <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
        {mediaType === 'image' && (
          <div className="flex items-center gap-2">
            <img 
              src={mediaUrl} 
              alt="Preview" 
              className="h-10 w-10 object-cover rounded"
            />
            <span className="text-sm truncate max-w-[150px]">{mediaFilename}</span>
          </div>
        )}
        {mediaType === 'audio' && (
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 bg-primary/10 rounded flex items-center justify-center">
              <Mic className="h-5 w-5 text-primary" />
            </div>
            <span className="text-sm truncate max-w-[150px]">{mediaFilename}</span>
          </div>
        )}
        {mediaType === 'document' && (
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 bg-primary/10 rounded flex items-center justify-center">
              <FileIcon className="h-5 w-5 text-primary" />
            </div>
            <span className="text-sm truncate max-w-[150px]">{mediaFilename}</span>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={removeMedia}
          disabled={disabled}
          className="h-7 w-7 ml-auto"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  // Recording state
  if (isRecording) {
    return (
      <div className="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-950/30 rounded-md">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          <span className="text-sm font-medium text-red-600 dark:text-red-400">
            Gravando: {formatTime(recordingTime)}
          </span>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={cancelRecording}
            className="h-7 w-7"
          >
            <X className="h-4 w-4" />
          </Button>
          <Button
            variant="default"
            size="icon"
            onClick={stopRecording}
            className="h-7 w-7 bg-red-500 hover:bg-red-600"
          >
            <Square className="h-3 w-3 fill-current" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="file"
        ref={imageInputRef}
        onChange={handleImageSelect}
        accept="image/*"
        className="hidden"
      />
      <input
        type="file"
        ref={documentInputRef}
        onChange={handleDocumentSelect}
        accept=".pdf,.doc,.docx,.xls,.xlsx,.txt"
        className="hidden"
      />
      
      <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            disabled={disabled || isUploading}
            className="gap-2"
          >
            {isUploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Paperclip className="h-4 w-4" />
            )}
            Anexar mídia
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-48 p-2" align="start">
          <div className="flex flex-col gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="justify-start gap-2"
              onClick={() => imageInputRef.current?.click()}
            >
              <Image className="h-4 w-4" />
              Imagem
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="justify-start gap-2"
              onClick={() => documentInputRef.current?.click()}
            >
              <FileIcon className="h-4 w-4" />
              Documento
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="justify-start gap-2"
              onClick={startRecording}
              disabled={!audioSupported}
            >
              {audioSupported ? (
                <Mic className="h-4 w-4" />
              ) : (
                <MicOff className="h-4 w-4 text-muted-foreground" />
              )}
              Gravar áudio
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
