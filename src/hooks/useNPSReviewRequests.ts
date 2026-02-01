import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface NPSReviewRequest {
  id: string;
  conversation_id: string;
  rating: number | null;
  ai_original_rating: number | null;
  final_rating: number | null;
  raw_response: string | null;
  classification_source: string | null;
  classification_reasoning: string | null;
  review_requested: boolean;
  review_requested_at: string | null;
  review_requested_by: string | null;
  review_request_reason: string | null;
  is_pending_review: boolean | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  review_notes: string | null;
  closed_at: string;
  leads?: { name: string | null; whatsapp_number: string | null } | null;
  profiles?: { first_name: string | null; last_name: string | null } | null;
  requester_profile?: { first_name: string | null; last_name: string | null } | null;
  whatsapp_instances?: { name: string; display_name_for_team: string | null } | null;
}

export function useNPSReviewRequests() {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ["nps-review-requests", profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return [];

      const { data, error } = await supabase
        .from("conversation_satisfaction_ratings")
        .select(`
          id,
          conversation_id,
          rating,
          ai_original_rating,
          final_rating,
          raw_response,
          classification_source,
          classification_reasoning,
          review_requested,
          review_requested_at,
          review_requested_by,
          review_request_reason,
          is_pending_review,
          reviewed_at,
          reviewed_by,
          review_notes,
          closed_at,
          leads(name, whatsapp_number),
          profiles:assigned_user_id(first_name, last_name),
          requester_profile:review_requested_by(first_name, last_name),
          whatsapp_instances:instance_id(name, display_name_for_team)
        `)
        .eq("organization_id", profile.organization_id)
        .eq("review_requested", true)
        .order("review_requested_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      return (data || []) as unknown as NPSReviewRequest[];
    },
    enabled: !!profile?.organization_id,
  });
}

export function useApproveNPSReview() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async ({ 
      ratingId, 
      newRating, 
      notes 
    }: { 
      ratingId: string; 
      newRating: number | null;
      notes?: string;
    }) => {
      // Get current rating first to preserve ai_original_rating
      const { data: current } = await supabase
        .from("conversation_satisfaction_ratings")
        .select("rating, ai_original_rating")
        .eq("id", ratingId)
        .single();

      const { error } = await supabase
        .from("conversation_satisfaction_ratings")
        .update({
          rating: newRating,
          final_rating: newRating,
          ai_original_rating: current?.ai_original_rating ?? current?.rating,
          is_pending_review: false,
          review_requested: false,
          reviewed_at: new Date().toISOString(),
          reviewed_by: profile?.user_id,
          review_notes: notes || null,
          classification_source: "manual",
        })
        .eq("id", ratingId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Nota atualizada com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["nps-review-requests"] });
      queryClient.invalidateQueries({ queryKey: ["satisfaction-ratings-full"] });
      queryClient.invalidateQueries({ queryKey: ["org-nps-metrics-full"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao atualizar nota");
    },
  });
}

export function useDismissNPSReview() {
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
          review_requested: false,
          reviewed_at: new Date().toISOString(),
          reviewed_by: profile?.user_id,
          review_notes: notes || "Solicitação rejeitada - nota original mantida",
        })
        .eq("id", ratingId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Solicitação de revisão rejeitada");
      queryClient.invalidateQueries({ queryKey: ["nps-review-requests"] });
      queryClient.invalidateQueries({ queryKey: ["satisfaction-ratings-full"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao rejeitar solicitação");
    },
  });
}
