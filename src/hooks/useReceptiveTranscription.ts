import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface TranscribeParams {
  attendanceId: string;
  audioUrl: string;
}

interface CallQualityScore {
  followed_script: boolean;
  offered_kits: boolean;
  proper_greeting: boolean;
  asked_needs: boolean;
  handled_objections: boolean;
  clear_next_steps: boolean;
  overall_score: number;
  summary: string;
  improvements: string[];
}

interface TranscribeResult {
  success: boolean;
  transcription: string;
  callQualityScore: CallQualityScore | null;
}

export function useTranscribeCall() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ attendanceId, audioUrl }: TranscribeParams): Promise<TranscribeResult> => {
      const { data, error } = await supabase.functions.invoke('transcribe-call', {
        body: { attendanceId, audioUrl },
      });

      if (error) {
        throw new Error(error.message || 'Erro ao transcrever áudio');
      }

      if (data.error) {
        throw new Error(data.error);
      }

      return data as TranscribeResult;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['lead-receptive-history'] });
      toast.success('Transcrição concluída!');
    },
    onError: (error: Error) => {
      console.error('Transcription error:', error);
      if (error.message.includes('Rate limit')) {
        toast.error('Limite de requisições excedido. Tente novamente em alguns minutos.');
      } else if (error.message.includes('Payment required')) {
        toast.error('Créditos de IA insuficientes. Entre em contato com o suporte.');
      } else {
        toast.error(error.message || 'Erro ao transcrever áudio');
      }
    },
  });
}

export function useUpdateAttendanceRecording() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ attendanceId, recordingUrl }: { attendanceId: string; recordingUrl: string }) => {
      const { error } = await supabase
        .from('receptive_attendances')
        .update({ call_recording_url: recordingUrl })
        .eq('id', attendanceId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-receptive-history'] });
      toast.success('URL da gravação salva!');
    },
    onError: () => {
      toast.error('Erro ao salvar URL da gravação');
    },
  });
}
