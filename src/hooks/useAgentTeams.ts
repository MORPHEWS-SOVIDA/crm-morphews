import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { agentsSupabase, isAgentsSupabaseConfigured } from "@/integrations/agents-supabase/client";
import { toast } from "sonner";

function getClient() {
  if (!agentsSupabase || !isAgentsSupabaseConfigured) {
    throw new Error("Supabase de Agentes não configurado.");
  }
  return agentsSupabase;
}

export interface AgentTeam {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  maestro_agent_id: string | null;
  fallback_agent_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  maestro?: { id: string; name: string } | null;
  fallback?: { id: string; name: string } | null;
}

export interface AgentTeamRoute {
  id: string;
  team_id: string;
  target_agent_id: string;
  route_type: string; // keyword | intent | fallback
  keywords: string[] | null;
  intent_description: string | null;
  priority: number;
  is_active: boolean;
  created_at: string;
  target_agent?: { id: string; name: string } | null;
}

export interface AgentTeamFormData {
  name: string;
  description?: string;
  maestro_agent_id: string;
  fallback_agent_id?: string;
}

export interface AgentTeamRouteFormData {
  team_id: string;
  target_agent_id: string;
  route_type: string;
  keywords?: string[];
  intent_description?: string;
  priority: number;
}

// ─── Teams CRUD ───

export function useAgentTeams(organizationId?: string) {
  return useQuery({
    queryKey: ["agent-teams", organizationId],
    queryFn: async () => {
      const client = getClient();
      const { data, error } = await client
        .from("agent_teams")
        .select("*, maestro:maestro_agent_id(id, name), fallback:fallback_agent_id(id, name)")
        .eq("organization_id", organizationId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as AgentTeam[];
    },
    enabled: !!organizationId,
  });
}

export function useCreateAgentTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (team: AgentTeamFormData & { organization_id: string }) => {
      const client = getClient();
      const { data, error } = await client
        .from("agent_teams")
        .insert(team)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agent-teams"] });
      toast.success("Time criado com sucesso!");
    },
    onError: (e: Error) => toast.error("Erro ao criar time: " + e.message),
  });
}

export function useUpdateAgentTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<AgentTeam> & { id: string }) => {
      const client = getClient();
      const { data, error } = await client
        .from("agent_teams")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agent-teams"] });
      toast.success("Time atualizado!");
    },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });
}

export function useDeleteAgentTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const client = getClient();
      const { error } = await client.from("agent_teams").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agent-teams"] });
      toast.success("Time removido!");
    },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });
}

// ─── Routes CRUD ───

export function useAgentTeamRoutes(teamId?: string | null) {
  return useQuery({
    queryKey: ["agent-team-routes", teamId],
    queryFn: async () => {
      const client = getClient();
      const { data, error } = await client
        .from("agent_team_routes")
        .select("*, target_agent:target_agent_id(id, name)")
        .eq("team_id", teamId!)
        .order("priority", { ascending: true });
      if (error) throw error;
      return data as AgentTeamRoute[];
    },
    enabled: !!teamId,
  });
}

export function useCreateAgentTeamRoute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (route: AgentTeamRouteFormData) => {
      const client = getClient();
      const { data, error } = await client
        .from("agent_team_routes")
        .insert(route)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["agent-team-routes", data.team_id] });
      toast.success("Rota adicionada!");
    },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });
}

export function useDeleteAgentTeamRoute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, teamId }: { id: string; teamId: string }) => {
      const client = getClient();
      const { error } = await client.from("agent_team_routes").delete().eq("id", id);
      if (error) throw error;
      return teamId;
    },
    onSuccess: (teamId) => {
      qc.invalidateQueries({ queryKey: ["agent-team-routes", teamId] });
      toast.success("Rota removida!");
    },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });
}
