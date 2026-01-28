import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface TranscribeParams {
  messageId: string;
  organizationId: string;
  mediaUrl: string;
}

export function useTranscribeAudioMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ messageId, organizationId, mediaUrl }: TranscribeParams) => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error('Sessão expirada. Faça login novamente.');
      }

      // Mark as processing immediately for UI feedback
      await supabase
        .from('whatsapp_messages')
        .update({ transcription_status: 'processing' })
        .eq('id', messageId);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/transcribe-audio-message`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            messageId,
            organizationId,
            mediaUrl,
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = 'Erro ao transcrever áudio';
        try {
          const parsed = JSON.parse(errorText);
          errorMessage = parsed.error || parsed.message || errorMessage;
        } catch {
          if (errorText) errorMessage = errorText;
        }
        throw new Error(errorMessage);
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-messages'] });
      toast.success('Transcrição concluída!');
    },
    onError: (error: Error) => {
      console.error('Transcription error:', error);
      if (error.message.includes('Insufficient energy') || error.message.includes('energia')) {
        toast.error('Energia IA insuficiente para transcrição');
      } else {
        toast.error(error.message || 'Erro ao transcrever áudio');
      }
    },
  });
}
