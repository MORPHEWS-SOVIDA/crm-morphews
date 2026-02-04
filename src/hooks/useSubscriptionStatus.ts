import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface SubscriptionStatus {
  has_subscription: boolean;
  status: string | null;
  plan_name: string | null;
  is_trial: boolean;
  trial_ends_at: string | null;
  trial_expired: boolean;
  days_remaining: number | null;
}

export function useSubscriptionStatus() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["subscription-status", user?.id],
    queryFn: async (): Promise<SubscriptionStatus> => {
      const { data, error } = await supabase.rpc("get_my_subscription_status");

      if (error) {
        console.error("Error fetching subscription status:", error);
        // Return default state on error
        return {
          has_subscription: false,
          status: null,
          plan_name: null,
          is_trial: false,
          trial_ends_at: null,
          trial_expired: false,
          days_remaining: null,
        };
      }

      // Cast through unknown since RPC returns jsonb
      return data as unknown as SubscriptionStatus;
    },
    enabled: !!user,
    staleTime: 60_000, // 1 minute
    refetchInterval: 5 * 60_000, // Refetch every 5 minutes
  });
}

export function useIsTrialExpired() {
  const { data: status, isLoading } = useSubscriptionStatus();
  
  return {
    isTrialExpired: status?.trial_expired ?? false,
    isLoading,
    daysRemaining: status?.days_remaining ?? null,
    isTrial: status?.is_trial ?? false,
    planName: status?.plan_name ?? null,
    trialEndsAt: status?.trial_ends_at ? new Date(status.trial_ends_at) : null,
  };
}
