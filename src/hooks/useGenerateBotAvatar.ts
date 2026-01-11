import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useTenant } from "./useTenant";

interface GenerateAvatarParams {
  botId: string;
  name: string;
  gender: 'male' | 'female' | 'neutral';
  ageRange: '18-25' | '26-35' | '36-50' | '50+';
  serviceType: string;
  brazilianState?: string;
  personalityDescription?: string;
}

export function useGenerateBotAvatar() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();
  
  return useMutation({
    mutationFn: async (params: GenerateAvatarParams) => {
      const { data, error } = await supabase.functions.invoke('generate-bot-avatar', {
        body: params
      });

      if (error) {
        throw new Error(error.message || 'Erro ao gerar avatar');
      }

      if (data.error) {
        throw new Error(data.error);
      }

      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['ai-bots', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['ai-bot', variables.botId] });
      toast.success('Avatar gerado com sucesso! ✨');
    },
    onError: (error: Error) => {
      if (error.message.includes('Rate limit')) {
        toast.error('Limite de requisições atingido. Tente novamente em alguns minutos.');
      } else if (error.message.includes('Payment required')) {
        toast.error('Créditos insuficientes. Adicione créditos ao workspace.');
      } else {
        toast.error(`Erro ao gerar avatar: ${error.message}`);
      }
    },
  });
}
