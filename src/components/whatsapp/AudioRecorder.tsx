import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, Square, Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AudioRecorderProps {
  onAudioReady: (base64: string, mimeType: string) => void;
  isRecording: boolean;
  setIsRecording: (val: boolean) => void;
}

export function AudioRecorder({ onAudioReady, isRecording, setIsRecording }: AudioRecorderProps) {
  const [recordingTime, setRecordingTime] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        setIsProcessing(true);
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        
        // Convert to base64
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result as string;
          onAudioReady(base64, 'audio/webm');
          setIsProcessing(false);
        };
        reader.readAsDataURL(blob);

        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      // Timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Error starting recording:', error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      // Clear chunks so nothing is sent
      chunksRef.current = [];
    }
    setIsRecording(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
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
