import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { agentsSupabase, isAgentsSupabaseConfigured } from "@/integrations/agents-supabase/client";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

function getAgentsClient() {
  if (!agentsSupabase || !isAgentsSupabaseConfigured) {
    throw new Error("Supabase de Agentes não configurado.");
  }
  return agentsSupabase;
}

export interface AgentInstanceLink {
  id: string;
  agent_id: string;
  instance_name: string;
  instance_id: string;
  organization_id: string;
  is_active: boolean;
  working_days: string[] | null;
  working_hours_start: string | null;
  working_hours_end: string | null;
  created_at: string;
}

/** Get the agent linked to a specific WhatsApp instance */
export function useAgentForInstance(instanceId: string | null) {
  return useQuery({
    queryKey: ["agent-instance-link", instanceId],
    queryFn: async () => {
      if (!instanceId) return null;
      const client = getAgentsClient();
      const { data, error } = await client
        .from("agent_instances")
        .select("*, agents:agent_id(id, name, personality)")
        .eq("instance_id", instanceId)
        .eq("is_active", true)
        .maybeSingle();
      if (error) throw error;
      return data as (AgentInstanceLink & { agents: { id: string; name: string; personality: string } | null }) | null;
    },
    enabled: !!instanceId && isAgentsSupabaseConfigured,
  });
}

/** Link an agent to a WhatsApp instance (sets distribution_mode = 'agent' or 'agent_team') */
export function useLinkAgentToInstance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      agentId,
      instanceId,
      instanceName,
      organizationId,
      workingDays,
      workingHoursStart,
      workingHoursEnd,
    }: {
      agentId: string;
      instanceId: string;
      instanceName: string;
      organizationId: string;
      workingDays: string[];
      workingHoursStart: string;
      workingHoursEnd: string;
      teamId?: string | null;
    }) => {
      const client = getAgentsClient();

      // 1. Remove existing agent links for this instance
      await client
        .from("agent_instances")
        .delete()
        .eq("instance_id", instanceId);

      // 2. Create new link
      const { error } = await client
        .from("agent_instances")
        .insert({
          agent_id: agentId,
          instance_id: instanceId,
          instance_name: instanceName,
          organization_id: organizationId,
          is_active: true,
          working_days: workingDays,
          working_hours_start: workingHoursStart,
          working_hours_end: workingHoursEnd,
          ...(teamId ? { team_id: teamId } : {}),
        });
      if (error) throw error;

      // 3. Set distribution_mode based on whether it's a team or solo agent
      const mode = teamId ? "agent_team" : "agent";
      const { error: updateError } = await supabase
        .from("whatsapp_instances")
        .update({ distribution_mode: mode })
        .eq("id", instanceId);
      if (updateError) throw updateError;

      // 4. Remove v1 bot schedules (exclusivity)
      await supabase
        .from("instance_bot_schedules")
        .delete()
        .eq("instance_id", instanceId);

      return { instanceId };
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["agent-instance-link", result.instanceId] });
      qc.invalidateQueries({ queryKey: ["instance-bot-schedules", result.instanceId] });
      qc.invalidateQueries({ queryKey: ["instance-distribution-mode", result.instanceId] });
      qc.invalidateQueries({ queryKey: ["whatsapp-instances"] });
      toast.success("Agente IA 2.0 vinculado com sucesso!");
    },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });
}

/** Unlink agent from instance */
export function useUnlinkAgentFromInstance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (instanceId: string) => {
      const client = getAgentsClient();
      await client
        .from("agent_instances")
        .delete()
        .eq("instance_id", instanceId);
      return instanceId;
    },
    onSuccess: (instanceId) => {
      qc.invalidateQueries({ queryKey: ["agent-instance-link", instanceId] });
      qc.invalidateQueries({ queryKey: ["whatsapp-instances"] });
      toast.success("Agente desvinculado!");
    },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });
}
