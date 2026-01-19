import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface TranscribeParams {
  attendanceId: string;
  audioUrl: string;
  storagePath?: string; // If provided, delete from storage after transcription
}

interface CallQualityScore {
  // Individual scores 1-10
  proper_greeting_score: number;
  asked_needs_score: number;
  followed_script_score: number;
  offered_kits_score: number;
  handled_objections_score: number;
  clear_next_steps_score: number;
  // Overall
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
    mutationFn: async ({ attendanceId, audioUrl, storagePath }: TranscribeParams): Promise<TranscribeResult> => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const accessToken = session?.access_token;
      if (!accessToken) {
        throw new Error('Sessão expirada. Faça login novamente e tente transcrever.');
      }

      const endpoint = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/transcribe-call`;

      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ attendanceId, audioUrl, storagePath }),
      });

      if (!resp.ok) {
        let message = resp.statusText || 'Erro ao transcrever áudio';
        try {
          const parsed = await resp.json();
          message = parsed?.error || parsed?.message || message;
          if (parsed?.details) message = `${message} (${parsed.details})`;
        } catch {
          try {
            const t = await resp.text();
            if (t) message = t;
          } catch {
            // ignore
          }
        }
        throw new Error(String(message));
      }

      const data = (await resp.json()) as TranscribeResult;

      if ((data as any)?.error) {
        throw new Error((data as any).error);
      }

      return data;
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
