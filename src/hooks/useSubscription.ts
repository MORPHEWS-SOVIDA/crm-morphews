import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";

export interface SubscriptionPlan {
  id: string;
  name: string;
  price_cents: number;
  max_users: number;
  max_leads: number | null;
  extra_user_price_cents: number;
  is_active: boolean;
  stripe_price_id: string | null;
}

export interface Subscription {
  id: string;
  organization_id: string;
  plan_id: string;
  status: string;
  current_period_start: string | null;
  current_period_end: string | null;
  extra_users: number;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
}

export function useSubscriptionPlans() {
  return useQuery({
    queryKey: ["subscription-plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscription_plans")
        .select("*")
        .eq("is_active", true)
        .order("price_cents", { ascending: true });

      if (error) throw error;
      return data as SubscriptionPlan[];
    },
  });
}

export function useCurrentSubscription() {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ["current-subscription", profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return null;

      const { data, error } = await supabase
        .from("subscriptions")
        .select("*, subscription_plans(*)")
        .eq("organization_id", profile.organization_id)
        .single();

      if (error && error.code !== "PGRST116") throw error;
      return data as (Subscription & { subscription_plans: SubscriptionPlan }) | null;
    },
    enabled: !!profile?.organization_id,
  });
}

export function useCreateCheckout() {
  const { session } = useAuth();

  return useMutation({
    mutationFn: async (planId: string) => {
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: {
          planId,
          successUrl: `${window.location.origin}/?subscription=success`,
          cancelUrl: `${window.location.origin}/planos`,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      if (data?.url) {
        window.location.href = data.url;
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao criar checkout",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useCustomerPortal() {
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("customer-portal", {
        body: {
          returnUrl: `${window.location.origin}/settings`,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      if (data?.url) {
        window.location.href = data.url;
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao acessar portal",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
