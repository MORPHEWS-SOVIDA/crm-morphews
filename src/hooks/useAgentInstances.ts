import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { agentsSupabase } from "@/integrations/agents-supabase/client";
import { toast } from "sonner";

export interface AgentInstance {
  id: string;
  agent_id: string;
  instance_name: string;
  instance_id: string;
  organization_id: string;
  is_active: boolean;
  created_at: string;
}

export function useAgentInstances(agentId?: string) {
  return useQuery({
    queryKey: ["agent-instances", agentId],
    queryFn: async () => {
      const { data, error } = await agentsSupabase
        .from("agent_instances")
        .select("*")
        .eq("agent_id", agentId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as AgentInstance[];
    },
    enabled: !!agentId,
  });
}

export function useCreateAgentInstance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (item: { agent_id: string; instance_name: string; instance_id: string; organization_id: string }) => {
      const { data, error } = await agentsSupabase
        .from("agent_instances")
        .insert(item)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["agent-instances", vars.agent_id] });
      toast.success("Instância vinculada!");
    },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });
}

export function useDeleteAgentInstance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, agentId }: { id: string; agentId: string }) => {
      const { error } = await agentsSupabase.from("agent_instances").delete().eq("id", id);
      if (error) throw error;
      return agentId;
    },
    onSuccess: (agentId) => {
      qc.invalidateQueries({ queryKey: ["agent-instances", agentId] });
      toast.success("Instância removida!");
    },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });
}
