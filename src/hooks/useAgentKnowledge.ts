import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface AgentKnowledge {
  id: string;
  agent_id: string;
  question: string;
  answer: string;
  is_active: boolean;
  priority: number;
  created_at: string;
}

export function useAgentKnowledge(agentId?: string) {
  return useQuery({
    queryKey: ["agent-knowledge", agentId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("agent_knowledge_v2")
        .select("*")
        .eq("agent_id", agentId!)
        .order("priority", { ascending: false });
      if (error) throw error;
      return data as AgentKnowledge[];
    },
    enabled: !!agentId,
  });
}

export function useCreateAgentKnowledge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (item: { agent_id: string; question: string; answer: string }) => {
      const { data, error } = await (supabase as any)
        .from("agent_knowledge_v2")
        .insert(item)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["agent-knowledge", vars.agent_id] });
      toast.success("Conhecimento adicionado!");
    },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });
}

export function useDeleteAgentKnowledge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, agentId }: { id: string; agentId: string }) => {
      const { error } = await (supabase as any).from("agent_knowledge_v2").delete().eq("id", id);
      if (error) throw error;
      return agentId;
    },
    onSuccess: (agentId) => {
      qc.invalidateQueries({ queryKey: ["agent-knowledge", agentId] });
      toast.success("Conhecimento removido!");
    },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });
}
