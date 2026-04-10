import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface FollowupSuggestion {
  id: string;
  lead_id: string;
  conversation_id: string | null;
  trigger_type: string;
  generated_message: string | null;
  status: string;
  scheduled_for: string;
  created_at: string;
  whatsapp_instance_id: string | null;
  ai_model_used: string | null;
  lead: {
    id: string;
    name: string;
    whatsapp: string | null;
  } | null;
  conversation: {
    id: string;
    contact_name: string | null;
    contact_phone: string | null;
    instance_id: string | null;
  } | null;
}

export function useFollowupSuggestions(organizationId?: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["followup-suggestions", organizationId],
    queryFn: async (): Promise<FollowupSuggestion[]> => {
      const { data, error } = await supabase.functions.invoke("super-ia-context", {
        body: { action: "get_pending_followups", organizationId },
      });
      if (error) throw error;
      return data?.followups || [];
    },
    enabled: !!organizationId,
    refetchInterval: 30000,
  });

  const sendFollowup = useMutation({
    mutationFn: async ({ followupId, editedMessage }: { followupId: string; editedMessage?: string }) => {
      const { data, error } = await supabase.functions.invoke("super-ia-context", {
        body: { action: "send_followup", followupId, editedMessage },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast.success("Follow-up enviado!");
      queryClient.invalidateQueries({ queryKey: ["followup-suggestions"] });
    },
    onError: (error: Error) => {
      toast.error(`Erro ao enviar: ${error.message}`);
    },
  });

  const rejectFollowup = useMutation({
    mutationFn: async (followupId: string) => {
      const { data, error } = await supabase.functions.invoke("super-ia-context", {
        body: { action: "reject_followup", followupId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Sugestão descartada");
      queryClient.invalidateQueries({ queryKey: ["followup-suggestions"] });
    },
    onError: (error: Error) => {
      toast.error(`Erro: ${error.message}`);
    },
  });

  return {
    suggestions: query.data || [],
    isLoading: query.isLoading,
    count: query.data?.length || 0,
    sendFollowup,
    rejectFollowup,
    refetch: query.refetch,
  };
}
