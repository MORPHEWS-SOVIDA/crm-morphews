import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface BotTeam {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  initial_bot_id: string | null;
  fallback_bot_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface BotTeamMember {
  id: string;
  team_id: string;
  bot_id: string;
  organization_id: string;
  role: string;
  created_at: string;
}

export interface BotTeamRoute {
  id: string;
  team_id: string;
  organization_id: string;
  target_bot_id: string;
  route_type: string;
  keywords: string[] | null;
  intent_description: string | null;
  priority: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface BotTeamWithDetails extends BotTeam {
  initial_bot?: { id: string; name: string; avatar_url: string | null } | null;
  fallback_bot?: { id: string; name: string; avatar_url: string | null } | null;
  members_count?: number;
  routes_count?: number;
}

// Fetch all bot teams for the organization
export function useBotTeams() {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ["bot-teams", profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return [];

      const { data, error } = await supabase
        .from("bot_teams")
        .select(`
          *,
          initial_bot:ai_bots!bot_teams_initial_bot_id_fkey(id, name, avatar_url),
          fallback_bot:ai_bots!bot_teams_fallback_bot_id_fkey(id, name, avatar_url)
        `)
        .eq("organization_id", profile.organization_id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Get member and route counts
      const teamsWithCounts = await Promise.all(
        (data || []).map(async (team) => {
          const [membersResult, routesResult] = await Promise.all([
            supabase
              .from("bot_team_members")
              .select("id", { count: "exact", head: true })
              .eq("team_id", team.id),
            supabase
              .from("bot_team_routes")
              .select("id", { count: "exact", head: true })
              .eq("team_id", team.id),
          ]);

          return {
            ...team,
            members_count: membersResult.count || 0,
            routes_count: routesResult.count || 0,
          } as BotTeamWithDetails;
        })
      );

      return teamsWithCounts;
    },
    enabled: !!profile?.organization_id,
  });
}

// Fetch a single bot team with full details
export function useBotTeam(teamId: string | null) {
  return useQuery({
    queryKey: ["bot-team", teamId],
    queryFn: async () => {
      if (!teamId) return null;

      const { data, error } = await supabase
        .from("bot_teams")
        .select(`
          *,
          initial_bot:ai_bots!bot_teams_initial_bot_id_fkey(id, name, avatar_url),
          fallback_bot:ai_bots!bot_teams_fallback_bot_id_fkey(id, name, avatar_url)
        `)
        .eq("id", teamId)
        .single();

      if (error) throw error;
      return data as BotTeamWithDetails;
    },
    enabled: !!teamId,
  });
}

// Fetch team members
export function useBotTeamMembers(teamId: string | null) {
  return useQuery({
    queryKey: ["bot-team-members", teamId],
    queryFn: async () => {
      if (!teamId) return [];

      const { data, error } = await supabase
        .from("bot_team_members")
        .select(`
          *,
          bot:ai_bots(id, name, avatar_url, service_type, is_active)
        `)
        .eq("team_id", teamId);

      if (error) throw error;
      return data;
    },
    enabled: !!teamId,
  });
}

// Fetch team routes
export function useBotTeamRoutes(teamId: string | null) {
  return useQuery({
    queryKey: ["bot-team-routes", teamId],
    queryFn: async () => {
      if (!teamId) return [];

      const { data, error } = await supabase
        .from("bot_team_routes")
        .select(`
          *,
          target_bot:ai_bots(id, name, avatar_url, service_type)
        `)
        .eq("team_id", teamId)
        .order("priority", { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: !!teamId,
  });
}

// Create a new bot team
export function useCreateBotTeam() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async (data: {
      name: string;
      description?: string;
      initial_bot_id?: string;
      fallback_bot_id?: string;
      member_bot_ids?: string[];
    }) => {
      if (!profile?.organization_id) throw new Error("Sem organização");

      // Create the team
      const { data: team, error: teamError } = await supabase
        .from("bot_teams")
        .insert({
          organization_id: profile.organization_id,
          name: data.name,
          description: data.description || null,
          initial_bot_id: data.initial_bot_id || null,
          fallback_bot_id: data.fallback_bot_id || null,
        })
        .select()
        .single();

      if (teamError) throw teamError;

      // Add members if provided
      if (data.member_bot_ids && data.member_bot_ids.length > 0) {
        const members = data.member_bot_ids.map((botId) => ({
          team_id: team.id,
          bot_id: botId,
          organization_id: profile.organization_id,
          role: "specialist",
        }));

        const { error: membersError } = await supabase
          .from("bot_team_members")
          .insert(members);

        if (membersError) throw membersError;
      }

      return team;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bot-teams"] });
      toast.success("Time de Robôs criado com sucesso!");
    },
    onError: (error: Error) => {
      toast.error("Erro ao criar time: " + error.message);
    },
  });
}

// Update a bot team
export function useUpdateBotTeam() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: Partial<BotTeam> & { id: string }) => {
      const { error } = await supabase
        .from("bot_teams")
        .update(updates)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["bot-teams"] });
      queryClient.invalidateQueries({ queryKey: ["bot-team", variables.id] });
      toast.success("Time atualizado!");
    },
    onError: (error: Error) => {
      toast.error("Erro ao atualizar: " + error.message);
    },
  });
}

// Delete a bot team
export function useDeleteBotTeam() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("bot_teams").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bot-teams"] });
      toast.success("Time removido!");
    },
    onError: (error: Error) => {
      toast.error("Erro ao remover: " + error.message);
    },
  });
}

// Add a member to a team
export function useAddBotTeamMember() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async ({
      teamId,
      botId,
      role = "specialist",
    }: {
      teamId: string;
      botId: string;
      role?: string;
    }) => {
      if (!profile?.organization_id) throw new Error("Sem organização");

      const { error } = await supabase.from("bot_team_members").insert({
        team_id: teamId,
        bot_id: botId,
        organization_id: profile.organization_id,
        role,
      });

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["bot-team-members", variables.teamId],
      });
      queryClient.invalidateQueries({ queryKey: ["bot-teams"] });
      toast.success("Robô adicionado ao time!");
    },
    onError: (error: Error) => {
      toast.error("Erro ao adicionar: " + error.message);
    },
  });
}

// Remove a member from a team
export function useRemoveBotTeamMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      teamId,
      memberId,
    }: {
      teamId: string;
      memberId: string;
    }) => {
      const { error } = await supabase
        .from("bot_team_members")
        .delete()
        .eq("id", memberId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["bot-team-members", variables.teamId],
      });
      queryClient.invalidateQueries({ queryKey: ["bot-teams"] });
      toast.success("Robô removido do time!");
    },
    onError: (error: Error) => {
      toast.error("Erro ao remover: " + error.message);
    },
  });
}

// Add a route to a team
export function useAddBotTeamRoute() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async ({
      teamId,
      targetBotId,
      routeType,
      keywords,
      intentDescription,
      priority = 0,
    }: {
      teamId: string;
      targetBotId: string;
      routeType: "keyword" | "intent";
      keywords?: string[];
      intentDescription?: string;
      priority?: number;
    }) => {
      if (!profile?.organization_id) throw new Error("Sem organização");

      const { error } = await supabase.from("bot_team_routes").insert({
        team_id: teamId,
        target_bot_id: targetBotId,
        organization_id: profile.organization_id,
        route_type: routeType,
        keywords: keywords || null,
        intent_description: intentDescription || null,
        priority,
      });

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["bot-team-routes", variables.teamId],
      });
      queryClient.invalidateQueries({ queryKey: ["bot-teams"] });
      toast.success("Rota adicionada!");
    },
    onError: (error: Error) => {
      toast.error("Erro ao adicionar rota: " + error.message);
    },
  });
}

// Update a route
export function useUpdateBotTeamRoute() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      teamId,
      ...updates
    }: Partial<BotTeamRoute> & { id: string; teamId: string }) => {
      const { error } = await supabase
        .from("bot_team_routes")
        .update(updates)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["bot-team-routes", variables.teamId],
      });
      toast.success("Rota atualizada!");
    },
    onError: (error: Error) => {
      toast.error("Erro ao atualizar rota: " + error.message);
    },
  });
}

// Delete a route
export function useDeleteBotTeamRoute() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      teamId,
    }: {
      id: string;
      teamId: string;
    }) => {
      const { error } = await supabase
        .from("bot_team_routes")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["bot-team-routes", variables.teamId],
      });
      queryClient.invalidateQueries({ queryKey: ["bot-teams"] });
      toast.success("Rota removida!");
    },
    onError: (error: Error) => {
      toast.error("Erro ao remover rota: " + error.message);
    },
  });
}
