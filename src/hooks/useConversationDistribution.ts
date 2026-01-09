import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type ConversationStatus = 'pending' | 'assigned' | 'closed';

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

  // Assumir conversa (claim)
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

  // Encerrar conversa
  const closeConversation = useMutation({
    mutationFn: async (conversationId: string) => {
      const { data, error } = await supabase.rpc('close_whatsapp_conversation', {
        p_conversation_id: conversationId
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-conversations'] });
      toast.success('Atendimento encerrado!');
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
  assigned: 'Atribuído',
  closed: 'Encerrado'
};

export const statusColors: Record<ConversationStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  assigned: 'bg-green-100 text-green-800 border-green-300',
  closed: 'bg-gray-100 text-gray-600 border-gray-300'
};
