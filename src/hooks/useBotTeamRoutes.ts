import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Json } from "@/integrations/supabase/types";

export interface CrmConditions {
  has_purchase?: boolean;
  is_new_lead?: boolean;
  has_open_ticket?: boolean;
  no_purchase?: boolean;
}

export interface TimeConditions {
  outside_business_hours?: boolean;
  days_of_week?: number[];
}

export interface AdvancedRouteData {
  teamId: string;
  targetBotId: string;
  conditionType: string;
  keywords?: string[];
  intentDescription?: string;
  crmConditions?: CrmConditions;
  sentimentConditions?: string[];
  timeConditions?: TimeConditions;
  conditionLabel?: string;
  priority?: number;
}

// Add an advanced route to a team (with new condition types)
export function useAddAdvancedBotTeamRoute() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async ({
      teamId,
      targetBotId,
      conditionType,
      keywords,
      intentDescription,
      crmConditions,
      sentimentConditions,
      timeConditions,
      conditionLabel,
      priority = 0,
    }: AdvancedRouteData) => {
      if (!profile?.organization_id) throw new Error("Sem organização");

      // Determine route_type for backwards compatibility
      const routeType = conditionType === "keyword" ? "keyword" : 
                        conditionType === "intent" ? "intent" : "keyword";

      const { error } = await supabase.from("bot_team_routes").insert({
        team_id: teamId,
        target_bot_id: targetBotId,
        organization_id: profile.organization_id,
        route_type: routeType,
        condition_type: conditionType,
        keywords: keywords || null,
        intent_description: intentDescription || null,
        crm_conditions: (crmConditions as unknown as Json) || null,
        sentiment_conditions: sentimentConditions || null,
        time_conditions: (timeConditions as unknown as Json) || null,
        condition_label: conditionLabel || null,
        priority,
      });

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["bot-team-routes", variables.teamId],
      });
      queryClient.invalidateQueries({ queryKey: ["bot-teams"] });
      toast.success("Condição de ativação adicionada!");
    },
    onError: (error: Error) => {
      toast.error("Erro ao adicionar condição: " + error.message);
    },
  });
}

// Fetch routes grouped by target bot
export function useRoutesGroupedByBot(teamId: string | null, routes: any[] | undefined) {
  // Group routes by target_bot_id
  if (!routes) return {};
  
  return routes.reduce((acc, route) => {
    const botId = route.target_bot_id;
    if (!acc[botId]) {
      acc[botId] = [];
    }
    acc[botId].push(route);
    return acc;
  }, {} as Record<string, any[]>);
}
