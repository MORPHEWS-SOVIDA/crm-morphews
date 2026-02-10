import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface SatisfactionRating {
  id: string;
  organization_id: string;
  conversation_id: string;
  instance_id: string;
  assigned_user_id: string | null;
  lead_id: string | null;
  rating: number | null;
  raw_response: string | null;
  closed_at: string;
  responded_at: string | null;
  is_pending_review: boolean;
  reviewed_at: string | null;
  reviewed_by: string | null;
  review_notes: string | null;
  created_at: string;
}

export interface NPSMetrics {
  total_responses: number;
  promoters: number;
  detractors: number;
  passives: number;
  nps_score: number;
  avg_rating: number;
  pending_reviews: number;
  by_user?: Array<{
    user_id: string;
    total: number;
    avg_rating: number;
    detractors: number;
  }>;
}

export function useOrgNPSMetrics(days: number = 30) {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ["org-nps-metrics", profile?.organization_id, days],
    queryFn: async () => {
      if (!profile?.organization_id) return null;

      const { data, error } = await supabase.rpc("get_org_nps_metrics", {
        p_organization_id: profile.organization_id,
        p_days: days
      });

      if (error) throw error;
      return data as unknown as NPSMetrics;
    },
    enabled: !!profile?.organization_id,
    refetchInterval: 60000,
  });
}

export function useInstanceNPSMetrics(instanceId: string | null, days: number = 30) {
  return useQuery({
    queryKey: ["instance-nps-metrics", instanceId, days],
    queryFn: async () => {
      if (!instanceId) return null;

      const { data, error } = await supabase.rpc("get_instance_nps_metrics", {
        p_instance_id: instanceId,
        p_days: days
      });

      if (error) throw error;
      return data as unknown as NPSMetrics;
    },
    enabled: !!instanceId,
  });
}

export function usePendingSatisfactionReviews() {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ["pending-satisfaction-reviews", profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return [];

      const { data, error } = await supabase
        .from("conversation_satisfaction_ratings")
        .select(`
          *,
          leads(name, whatsapp),
          profiles:assigned_user_id(first_name, last_name)
        `)
        .eq("organization_id", profile.organization_id)
        .eq("is_pending_review", true)
        .order("closed_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data;
    },
    enabled: !!profile?.organization_id,
  });
}

export function useMarkRatingAsReviewed() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async ({ 
      ratingId, 
      notes 
    }: { 
      ratingId: string; 
      notes?: string;
    }) => {
      const { error } = await supabase
        .from("conversation_satisfaction_ratings")
        .update({
          is_pending_review: false,
          reviewed_at: new Date().toISOString(),
          reviewed_by: profile?.user_id,
          review_notes: notes || null
        })
        .eq("id", ratingId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-satisfaction-reviews"] });
      queryClient.invalidateQueries({ queryKey: ["org-nps-metrics"] });
      toast.success("Avaliação marcada como revisada");
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao marcar como revisada");
    },
  });
}

export function useSatisfactionRatings(filters?: {
  instanceId?: string;
  userId?: string;
  minRating?: number;
  maxRating?: number;
  days?: number;
}) {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ["satisfaction-ratings", profile?.organization_id, filters],
    queryFn: async () => {
      if (!profile?.organization_id) return [];

      let query = supabase
        .from("conversation_satisfaction_ratings")
        .select(`
          *,
          leads(name, whatsapp),
          profiles:assigned_user_id(first_name, last_name),
          whatsapp_instances(name)
        `)
        .eq("organization_id", profile.organization_id)
        .order("closed_at", { ascending: false });

      if (filters?.instanceId) {
        query = query.eq("instance_id", filters.instanceId);
      }

      if (filters?.userId) {
        query = query.eq("assigned_user_id", filters.userId);
      }

      if (filters?.minRating !== undefined) {
        query = query.gte("rating", filters.minRating);
      }

      if (filters?.maxRating !== undefined) {
        query = query.lte("rating", filters.maxRating);
      }

      if (filters?.days) {
        const since = new Date();
        since.setDate(since.getDate() - filters.days);
        query = query.gte("closed_at", since.toISOString());
      }

      const { data, error } = await query.limit(100);

      if (error) throw error;
      return data;
    },
    enabled: !!profile?.organization_id,
  });
}
