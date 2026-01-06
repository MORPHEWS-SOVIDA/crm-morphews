import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, Square, Loader2, X, MicOff } from 'lucide-react';
import { toast } from 'sonner';

interface AudioRecorderProps {
  onAudioReady: (base64: string, mimeType: string) => void;
  isRecording: boolean;
  setIsRecording: (val: boolean) => void;
}

// Get the best supported audio format for recording
function getBestAudioFormat(): { mimeType: string; supported: boolean } {
  if (typeof MediaRecorder === 'undefined') {
    console.log('[AudioRecorder] MediaRecorder not available');
    return { mimeType: '', supported: false };
  }

  // Try formats in order of preference for WhatsApp compatibility
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
      console.log('[AudioRecorder] Supported format found:', format);
      return { mimeType: format, supported: true };
    }
  }

  console.log('[AudioRecorder] No supported audio format found');
  return { mimeType: '', supported: false };
}

export function AudioRecorder({ onAudioReady, isRecording, setIsRecording }: AudioRecorderProps) {
  const [recordingTime, setRecordingTime] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const [supportedFormat, setSupportedFormat] = useState<string>('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    // Check browser support on mount
    const formatInfo = getBestAudioFormat();
    setIsSupported(formatInfo.supported);
    setSupportedFormat(formatInfo.mimeType);
    
    console.log('[AudioRecorder] Browser support check:', {
      supported: formatInfo.supported,
      format: formatInfo.mimeType,
      userAgent: navigator.userAgent
    });
  }, []);

  const startRecording = async () => {
    const formatInfo = getBestAudioFormat();
    
    if (!formatInfo.supported) {
      toast.error('Seu navegador não suporta gravação de áudio. Use Chrome, Edge ou Firefox.');
      return;
    }

    try {
      console.log('[AudioRecorder] Requesting microphone access...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      console.log('[AudioRecorder] Starting recording with mimeType:', formatInfo.mimeType);
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType: formatInfo.mimeType });
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
        
        // Use the format we recorded in
        const recordedMimeType = formatInfo.mimeType.split(';')[0]; // Get base mime type
        const blob = new Blob(chunksRef.current, { type: recordedMimeType });
        
        console.log('[AudioRecorder] Created blob:', {
          size: blob.size,
          type: blob.type,
          recordedFormat: formatInfo.mimeType
        });
        
        // Convert to base64
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result as string;
          // Send with the actual recorded mime type - server will handle conversion if needed
          console.log('[AudioRecorder] Audio ready, sending with mimeType:', recordedMimeType);
          onAudioReady(base64, recordedMimeType);
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
      toast.error('Erro ao acessar microfone. Verifique as permissões do navegador.');
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

  // Show disabled state if no audio format is supported
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
