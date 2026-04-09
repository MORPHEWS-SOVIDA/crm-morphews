import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface FollowupQueueItem {
  id: string;
  organization_id: string;
  lead_id: string;
  conversation_id: string | null;
  trigger_type: string;
  context_snapshot: any;
  generated_message: string | null;
  status: string;
  scheduled_for: string;
  sent_at: string | null;
  error_message: string | null;
  ai_model_used: string | null;
  tokens_used: number | null;
  created_at: string;
}

export interface SuperIAStats {
  queue_pending: number;
  sent_24h: number;
  sent_7d: number;
  total_preferences_learned: number;
  total_summaries: number;
  queue_items: any[];
}

export function useSuperIAStats(organizationId?: string) {
  return useQuery({
    queryKey: ["super-ia-stats", organizationId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("super-ia-context", {
        body: { action: "get_dashboard_stats", organizationId },
      });
      if (error) throw error;
      return data.stats as SuperIAStats;
    },
    enabled: !!organizationId,
    refetchInterval: 30000,
  });
}

export function useFollowupQueue(organizationId?: string) {
  return useQuery({
    queryKey: ["followup-queue", organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_followup_queue" as any)
        .select("*")
        .eq("organization_id", organizationId!)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as unknown as FollowupQueueItem[];
    },
    enabled: !!organizationId,
  });
}

export function useFollowupConfig(organizationId?: string) {
  return useQuery({
    queryKey: ["followup-config", organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organizations")
        .select("ai_followup_config")
        .eq("id", organizationId!)
        .single();
      if (error) throw error;
      return (data as any)?.ai_followup_config || {};
    },
    enabled: !!organizationId,
  });
}

export function useUpdateFollowupConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      organizationId,
      config,
    }: {
      organizationId: string;
      config: any;
    }) => {
      const { error } = await supabase
        .from("organizations")
        .update({ ai_followup_config: config } as any)
        .eq("id", organizationId);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["followup-config", vars.organizationId] });
    },
  });
}

export function useLeadMemory(leadId?: string) {
  return useQuery({
    queryKey: ["lead-memory", leadId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("lead-memory-analyze", {
        body: { action: "get_context", leadId },
      });
      if (error) throw error;
      return data.context;
    },
    enabled: !!leadId,
  });
}
