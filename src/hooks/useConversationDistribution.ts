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
      // Buscar dados da conversa
      const { data: conv, error: convError } = await supabase
        .from("whatsapp_conversations")
        .select(`
          instance_id, 
          phone_number, 
          lead_id, 
          assigned_user_id,
          organization_id
        `)
        .eq("id", conversationId)
        .single();

      if (convError || !conv) {
        console.error('[closeConversation] Error fetching conversation:', convError);
        throw new Error('Conversa não encontrada');
      }

      // Buscar configurações da organização SEPARADAMENTE para garantir que funcione
      const { data: orgData, error: orgError } = await supabase
        .from("organizations")
        .select(`
          satisfaction_survey_enabled,
          satisfaction_survey_on_manual_close,
          satisfaction_survey_message
        `)
        .eq("id", conv.organization_id)
        .single();

      if (orgError) {
        console.error('[closeConversation] Error fetching org config:', orgError);
      }
      
      const shouldSendSurvey = orgData?.satisfaction_survey_enabled && 
                               orgData?.satisfaction_survey_on_manual_close;
      
      console.log('[closeConversation] Config:', { 
        conversationId,
        shouldSendSurvey,
        enabled: orgData?.satisfaction_survey_enabled,
        onManualClose: orgData?.satisfaction_survey_on_manual_close,
        hasInstance: !!conv.instance_id,
        hasPhone: !!conv.phone_number
      });
      
      if (shouldSendSurvey && conv.instance_id && conv.phone_number) {
        // Enviar mensagem de pesquisa via edge function
        const surveyMessage = orgData?.satisfaction_survey_message || 
          "De 0 a 10, como você avalia este atendimento? Sua resposta nos ajuda a melhorar! 🙏";
        
        console.log('[closeConversation] Sending NPS survey to:', conv.phone_number);
        
        const sendResult = await supabase.functions.invoke("evolution-send-message", {
          body: {
            instanceId: conv.instance_id,
            phone: conv.phone_number,
            message: surveyMessage,
          },
        });
        
        console.log('[closeConversation] Send result:', sendResult);
        
        // Atualizar conversa para aguardar resposta
        const now = new Date();
        
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
        await supabase
          .from("conversation_satisfaction_ratings")
          .insert({
            organization_id: conv.organization_id,
            instance_id: conv.instance_id,
            conversation_id: conversationId,
            lead_id: conv.lead_id,
            assigned_user_id: conv.assigned_user_id,
            closed_at: now.toISOString(),
            is_pending_review: false,
          });
        
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

  // Reativar conversa encerrada
  const reactivateConversation = useMutation({
    mutationFn: async ({ conversationId, userId }: { conversationId: string; userId: string }) => {
      // 1. Buscar dados da conversa para obter lead_id e organization_id
      const { data: conv, error: convError } = await supabase
        .from("whatsapp_conversations")
        .select("lead_id, organization_id, assigned_user_id")
        .eq("id", conversationId)
        .single();

      if (convError || !conv) {
        throw new Error('Conversa não encontrada');
      }

      // 2. Reativar a conversa - mudar status para assigned e atribuir ao usuário
      const now = new Date().toISOString();
      const { error: updateError } = await supabase
        .from("whatsapp_conversations")
        .update({
          status: 'assigned',
          assigned_user_id: userId,
          assigned_at: now,
          closed_at: null,
          updated_at: now,
        })
        .eq("id", conversationId);

      if (updateError) throw updateError;

      // 3. Se o lead existir, atualizar responsabilidade e registrar histórico
      if (conv.lead_id) {
        // Atualizar lead_responsibles
        await supabase
          .from('lead_responsibles')
          .upsert({
            lead_id: conv.lead_id,
            user_id: userId,
            is_primary: true,
            organization_id: conv.organization_id,
          }, { onConflict: 'lead_id,user_id' });

        // Atualizar assigned_to do lead
        await supabase
          .from('leads')
          .update({ assigned_to: userId })
          .eq('id', conv.lead_id);

        // Registrar no histórico de transferências
        await supabase
          .from('lead_ownership_transfers')
          .insert({
            organization_id: conv.organization_id,
            lead_id: conv.lead_id,
            from_user_id: conv.assigned_user_id || null,
            to_user_id: userId,
            transferred_by: userId,
            transfer_reason: 'reativacao_conversa',
            notes: 'Conversa reativada via WhatsApp Chat',
          });

        // Verificar se o lead tem etapa de funil, caso não tenha, buscar default
        const { data: lead } = await supabase
          .from('leads')
          .select('funnel_stage_id')
          .eq('id', conv.lead_id)
          .single();

        if (!lead?.funnel_stage_id) {
          // Buscar configuração padrão de etapa do funil
          const { data: orgConfig } = await supabase
            .from('organizations')
            .select('default_stage_whatsapp, default_stage_fallback')
            .eq('id', conv.organization_id)
            .single();

          const defaultStage = orgConfig?.default_stage_whatsapp || orgConfig?.default_stage_fallback;

          // Atribuir etapa ao lead se encontrada
          if (defaultStage) {
            await supabase
              .from('leads')
              .update({ funnel_stage_id: defaultStage })
              .eq('id', conv.lead_id);
          }
        }
      }

      return { conversationId, leadId: conv.lead_id };
    },
    onSuccess: ({ leadId }) => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-conversations'] });
      if (leadId) {
        queryClient.invalidateQueries({ queryKey: ['leads', leadId] });
        queryClient.invalidateQueries({ queryKey: ['lead-responsibles', leadId] });
        queryClient.invalidateQueries({ queryKey: ['lead-ownership-history', leadId] });
      }
      toast.success('Conversa reativada! Agora você pode responder.');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao reativar conversa');
    }
  });

  // Encerrar conversa SEM enviar pesquisa NPS (com auditoria)
  const closeConversationWithoutNPS = useMutation({
    mutationFn: async ({ 
      conversationId, 
      reason 
    }: { 
      conversationId: string; 
      reason?: string 
    }) => {
      // Buscar dados da conversa
      const { data: conv, error: convError } = await supabase
        .from("whatsapp_conversations")
        .select("organization_id")
        .eq("id", conversationId)
        .single();

      if (convError || !conv) {
        throw new Error('Conversa não encontrada');
      }

      // Encerrar conversa marcando que NPS foi pulado
      const now = new Date().toISOString();
      const { error } = await supabase
        .from("whatsapp_conversations")
        .update({
          status: "closed",
          closed_at: now,
          skip_nps_at: now,
          skip_nps_by: profile?.user_id,
          skip_nps_reason: reason || null,
          awaiting_satisfaction_response: false,
        })
        .eq("id", conversationId);

      if (error) throw error;
      return { success: true, skippedNPS: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-conversations'] });
      toast.success('Atendimento encerrado (sem pesquisa NPS)');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao encerrar conversa');
    }
  });

  return {
    claimConversation,
    transferConversation,
    closeConversation,
    closeConversationWithoutNPS,
    updateConversationStatus,
    reactivateConversation,
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
