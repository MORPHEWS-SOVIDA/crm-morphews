import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AgentLog {
  id: string;
  agent_id: string | null;
  conversation_id: string | null;
  organization_id: string | null;
  success: boolean | null;
  execution_time_ms: number | null;
  total_tokens: number | null;
  iterations: number | null;
  tools_used: any;
  error_message: string | null;
  created_at: string | null;
}

export function useAgentLogs(agentId?: string) {
  return useQuery({
    queryKey: ["agent-logs", agentId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("agent_logs_v2")
        .select("*")
        .eq("agent_id", agentId!)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as AgentLog[];
    },
    enabled: !!agentId,
  });
}
