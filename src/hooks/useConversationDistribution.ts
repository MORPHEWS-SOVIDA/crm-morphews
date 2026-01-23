import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

export type ConversationStatus = 'pending' | 'autodistributed' | 'assigned' | 'closed';

export interface ConversationAssignment {
  id: string;
  conversation_id: string;
  from_user_id: string | null;
  to_user_id: string | null;
  action: string;
  assigned_by: string | null;
  notes: string | null;
  created_at: string;
}

/**
 * Hook para gerenciar distribuição de conversas WhatsApp
 */
export function useConversationDistribution() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  // Buscar configurações da organização para NPS
  const { data: orgSettings } = useQuery({
    queryKey: ["org-nps-settings", profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return null;
      const { data } = await supabase
        .from("organizations")
        .select("satisfaction_survey_enabled, satisfaction_survey_on_manual_close, satisfaction_survey_message")
        .eq("id", profile.organization_id)
        .single();
      return data;
    },
    enabled: !!profile?.organization_id,
  });

  // Assumir conversa (claim) - funciona para pendente E autodistribuído
  const claimConversation = useMutation({
    mutationFn: async ({ conversationId, userId }: { conversationId: string; userId: string }) => {
      const { data, error } = await supabase.rpc('claim_whatsapp_conversation', {
        p_conversation_id: conversationId,
        p_user_id: userId
      });

      if (error) throw error;
      
      const result = data as { success: boolean; error?: string };
      if (!result.success) {
        throw new Error(result.error || 'Não foi possível assumir a conversa');
      }

      // Após assumir com sucesso, verificar se o briefing automático está ativo
      try {
        // Buscar dados da conversa e configurações da organização
        const { data: conv } = await supabase
          .from("whatsapp_conversations")
          .select(`
            lead_id,
            contact_name,
            whatsapp_instances!inner(
              organization_id,
              organizations!inner(
                whatsapp_ai_seller_briefing_enabled
              )
            )
          `)
          .eq("id", conversationId)
          .single();

        const orgConfig = (conv?.whatsapp_instances as any)?.organizations;
        const shouldSendBriefing = orgConfig?.whatsapp_ai_seller_briefing_enabled && conv?.lead_id;

        console.log('[claimConversation] Briefing check:', {
          conversationId,
          leadId: conv?.lead_id,
          briefingEnabled: orgConfig?.whatsapp_ai_seller_briefing_enabled,
          shouldSendBriefing
        });

        if (shouldSendBriefing) {
          // Disparar geração do briefing de forma assíncrona (não bloquear a UI)
          supabase.functions.invoke("lead-memory-analyze", {
            body: {
              action: "briefing",
              leadId: conv.lead_id,
              conversationId,
              contactName: conv.contact_name || undefined
            }
          }).then(briefingResult => {
            if (briefingResult.data?.briefing) {
              // Briefing gerado - exibir como toast informativo para o vendedor
              console.log('[claimConversation] Briefing generated:', briefingResult.data.briefing.substring(0, 100));
              toast.info("📋 Briefing do lead carregado!", { 
                duration: 5000,
                description: "Verifique o resumo na aba do lead"
              });
            }
          }).catch(briefingError => {
            console.warn('[claimConversation] Briefing generation failed:', briefingError);
            // Não bloqueia o fluxo, apenas loga o erro
          });
        }
      } catch (briefingCheckError) {
        console.warn('[claimConversation] Error checking briefing settings:', briefingCheckError);
        // Continua normalmente, briefing é feature opcional
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-conversations'] });
      toast.success('Conversa assumida com sucesso!');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao assumir conversa');
    }
  });

  // Transferir conversa
  const transferConversation = useMutation({
    mutationFn: async ({ 
      conversationId, 
      toUserId, 
      notes 
    }: { 
      conversationId: string; 
      toUserId: string; 
      notes?: string;
    }) => {
      const { data, error } = await supabase.rpc('transfer_whatsapp_conversation', {
        p_conversation_id: conversationId,
        p_to_user_id: toUserId,
        p_notes: notes || null
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-conversations'] });
      toast.success('Conversa transferida!');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao transferir conversa');
    }
  });

  // Encerrar conversa (com opção de enviar pesquisa NPS)
  const closeConversation = useMutation({
    mutationFn: async (conversationId: string) => {
      // Buscar dados da conversa E as configurações da organização diretamente
      const { data: conv } = await supabase
        .from("whatsapp_conversations")
        .select(`
          instance_id, 
          phone_number, 
          lead_id, 
          assigned_user_id,
          whatsapp_instances!inner(
            organization_id,
            organizations!inner(
              satisfaction_survey_enabled,
              satisfaction_survey_on_manual_close,
              satisfaction_survey_message
            )
          )
        `)
        .eq("id", conversationId)
        .single();
      
      // Extrair configurações da organização da conversa
      const orgConfig = (conv?.whatsapp_instances as any)?.organizations;
      const shouldSendSurvey = orgConfig?.satisfaction_survey_enabled && 
                               orgConfig?.satisfaction_survey_on_manual_close;
      
      console.log('[closeConversation] Config:', { 
        conversationId,
        shouldSendSurvey,
        enabled: orgConfig?.satisfaction_survey_enabled,
        onManualClose: orgConfig?.satisfaction_survey_on_manual_close,
        hasInstance: !!conv?.instance_id,
        hasPhone: !!conv?.phone_number
      });
      
      if (shouldSendSurvey && conv?.instance_id && conv?.phone_number) {
        // Enviar mensagem de pesquisa via edge function
        const surveyMessage = orgConfig?.satisfaction_survey_message || 
          "De 0 a 10, como você avalia este atendimento? Sua resposta nos ajuda a melhorar! 🙏";
        
        console.log('[closeConversation] Sending NPS survey to:', conv.phone_number);
        
        const sendResult = await supabase.functions.invoke("evolution-send-message", {
          body: {
            instanceId: conv.instance_id,
            to: conv.phone_number,
            message: surveyMessage,
          },
        });
        
        console.log('[closeConversation] Send result:', sendResult);
        
        // Atualizar conversa para aguardar resposta
        const now = new Date();
        const orgId = (conv.whatsapp_instances as any)?.organization_id;
        
        await supabase
          .from("whatsapp_conversations")
          .update({
            status: "closed",
            closed_at: now.toISOString(),
            awaiting_satisfaction_response: true,
            satisfaction_sent_at: now.toISOString(),
          })
          .eq("id", conversationId);
        
        // Criar registro na tabela de ratings
        if (orgId) {
          await supabase
            .from("conversation_satisfaction_ratings")
            .insert({
              organization_id: orgId,
              instance_id: conv.instance_id,
              conversation_id: conversationId,
              lead_id: conv.lead_id,
              assigned_user_id: conv.assigned_user_id,
              closed_at: now.toISOString(),
              is_pending_review: false,
            });
        }
        
        return { success: true, surveySent: true };
      }

      // Encerramento normal sem pesquisa
      const { data, error } = await supabase.rpc('close_whatsapp_conversation', {
        p_conversation_id: conversationId
      });

      if (error) throw error;
      return { success: true, surveySent: false };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-conversations'] });
      if (result?.surveySent) {
        toast.success('Atendimento encerrado! Pesquisa de satisfação enviada.');
      } else {
        toast.success('Atendimento encerrado!');
      }
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao encerrar conversa');
    }
  });

  // Atualizar status manualmente (para admins)
  const updateConversationStatus = useMutation({
    mutationFn: async ({ 
      conversationId, 
      status,
      assignedUserId
    }: { 
      conversationId: string; 
      status: ConversationStatus;
      assignedUserId?: string | null;
    }) => {
      const updateData: Record<string, any> = {
        status,
        updated_at: new Date().toISOString()
      };

      if (status === 'assigned' && assignedUserId) {
        updateData.assigned_user_id = assignedUserId;
        updateData.assigned_at = new Date().toISOString();
      } else if (status === 'pending') {
        updateData.assigned_user_id = null;
        updateData.assigned_at = null;
        updateData.designated_user_id = null;
        updateData.designated_at = null;
      } else if (status === 'closed') {
        updateData.closed_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('whatsapp_conversations')
        .update(updateData)
        .eq('id', conversationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-conversations'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao atualizar status');
    }
  });

  return {
    claimConversation,
    transferConversation,
    closeConversation,
    updateConversationStatus,
  };
}

/**
 * Mapeamento de status para labels em português
 */
export const statusLabels: Record<ConversationStatus, string> = {
  pending: 'Pendente',
  autodistributed: 'Pra você',
  assigned: 'Atribuído',
  closed: 'Encerrado'
};

export const statusColors: Record<ConversationStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  autodistributed: 'bg-blue-100 text-blue-800 border-blue-300',
  assigned: 'bg-green-100 text-green-800 border-green-300',
  closed: 'bg-gray-100 text-gray-600 border-gray-300'
};
