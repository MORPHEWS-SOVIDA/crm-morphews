import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, Square, Loader2, X, MicOff } from 'lucide-react';
import { toast } from 'sonner';

interface AudioRecorderProps {
  onAudioReady: (base64: string, mimeType: string) => void;
  isRecording: boolean;
  setIsRecording: (val: boolean) => void;
}

// Check if OGG is supported (required for WhatsApp)
function isOggSupported(): boolean {
  if (typeof MediaRecorder === 'undefined') return false;
  // Chrome/Edge/Firefox support OGG with opus
  return MediaRecorder.isTypeSupported('audio/ogg; codecs=opus') || 
         MediaRecorder.isTypeSupported('audio/ogg');
}

export function AudioRecorder({ onAudioReady, isRecording, setIsRecording }: AudioRecorderProps) {
  const [recordingTime, setRecordingTime] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    // Check browser support on mount
    setIsSupported(isOggSupported());
  }, []);

  const startRecording = async () => {
    if (!isOggSupported()) {
      toast.error('Seu navegador não suporta gravação de áudio no formato OGG. Use Chrome, Edge ou Firefox.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      // Force OGG format for WhatsApp compatibility
      let mimeType = 'audio/ogg; codecs=opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/ogg';
      }
      
      console.log('[AudioRecorder] Starting recording with mimeType:', mimeType);
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        console.log('[AudioRecorder] Recording stopped, processing...');
        
        // Check if recording was cancelled (empty chunks)
        if (chunksRef.current.length === 0) {
          console.log('[AudioRecorder] Recording was cancelled, no data to process');
          setIsProcessing(false);
          return;
        }
        
        setIsProcessing(true);
        
        // Always use audio/ogg for the blob (WhatsApp compatibility)
        const blob = new Blob(chunksRef.current, { type: 'audio/ogg' });
        
        console.log('[AudioRecorder] Created blob:', {
          size: blob.size,
          type: blob.type
        });
        
        // Convert to base64
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result as string;
          console.log('[AudioRecorder] Audio ready, sending with mimeType: audio/ogg');
          onAudioReady(base64, 'audio/ogg');
          setIsProcessing(false);
        };
        reader.onerror = () => {
          console.error('[AudioRecorder] Error reading audio blob');
          toast.error('Erro ao processar áudio');
          setIsProcessing(false);
        };
        reader.readAsDataURL(blob);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      // Timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('[AudioRecorder] Error starting recording:', error);
      toast.error('Erro ao acessar microfone. Verifique as permissões.');
    }
  };

  const stopRecording = () => {
    console.log('[AudioRecorder] Stopping recording...');
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      // Stop all tracks
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    }
  };

  const cancelRecording = () => {
    console.log('[AudioRecorder] Cancelling recording...');
    // Clear chunks BEFORE stopping so onstop handler knows it was cancelled
    chunksRef.current = [];
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    // Stop all tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (isProcessing) {
    return (
      <Button variant="ghost" size="icon" disabled className="h-9 w-9">
        <Loader2 className="h-5 w-5 animate-spin" />
      </Button>
    );
  }

  if (isRecording) {
    return (
      <div className="flex items-center gap-2 bg-red-50 dark:bg-red-950/30 rounded-lg px-3 py-1.5">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          <span className="text-sm font-medium text-red-600 dark:text-red-400">
            {formatTime(recordingTime)}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={cancelRecording}
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </Button>
        <Button
          variant="default"
          size="icon"
          onClick={stopRecording}
          className="h-8 w-8 bg-red-500 hover:bg-red-600"
        >
          <Square className="h-4 w-4 fill-current" />
        </Button>
      </div>
    );
  }

  // Show disabled state if OGG not supported
  if (!isSupported) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled
        className="h-9 w-9"
        title="Gravação de áudio não suportada neste navegador"
      >
        <MicOff className="h-5 w-5 text-muted-foreground" />
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={startRecording}
      className="h-9 w-9"
    >
      <Mic className="h-5 w-5 text-muted-foreground" />
    </Button>
  );
}
