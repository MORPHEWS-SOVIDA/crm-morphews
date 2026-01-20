import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";

// Public-facing plan data (no sensitive Stripe IDs)
export interface SubscriptionPlan {
  id: string;
  name: string;
  price_cents: number;
  max_users: number;
  max_leads: number | null;
  extra_user_price_cents: number;
  is_active: boolean;
  included_whatsapp_instances: number;
  extra_instance_price_cents: number;
  extra_energy_price_cents: number;
  monthly_energy?: number | null;
}

// Full plan data including Stripe IDs (for authenticated users with access)
export interface SubscriptionPlanFull extends SubscriptionPlan {
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
  extra_whatsapp_instances: number;
  extra_energy_packs: number;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
}

export function useSubscriptionPlans() {
  return useQuery({
    queryKey: ["subscription-plans-public"],
    queryFn: async () => {
      // Use the public view that hides sensitive Stripe IDs
      // The view is not in auto-generated types, so we cast through unknown
      const { data, error } = await supabase
        .from("subscription_plans_public" as any)
        .select("*")
        .order("price_cents", { ascending: true });

      if (error) throw error;
      return (data as unknown) as SubscriptionPlan[];
    },
  });
}

// Fetch a specific plan by ID (for direct checkout links - includes non-public and inactive plans)
export function useSubscriptionPlanById(planId: string | null) {
  return useQuery({
    queryKey: ["subscription-plan-by-id", planId],
    queryFn: async () => {
      if (!planId) return null;
      
      // Fetch directly from the table to get plans even if not visible on site or inactive
      // This is for direct checkout links - the plan just needs to exist
      const { data, error } = await supabase
        .from("subscription_plans")
        .select("id, name, price_cents, max_users, max_leads, extra_user_price_cents, included_whatsapp_instances, extra_instance_price_cents, extra_energy_price_cents, monthly_energy, is_active")
        .eq("id", planId)
        .maybeSingle();

      if (error) {
        console.error("Error fetching plan by ID:", error);
        return null;
      }
      return data as SubscriptionPlan | null;
    },
    enabled: !!planId,
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
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ planId, mode = 'new' }: { planId: string; mode?: 'new' | 'change' }) => {
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: {
          planId,
          mode,
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
      } else if (data?.success) {
        toast({
          title: "Plano alterado!",
          description: data.message || "A alteração foi processada com sucesso.",
        });
        queryClient.invalidateQueries({ queryKey: ["current-subscription"] });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao processar",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useAddSubscriptionItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ itemType, quantity }: { itemType: 'extra_users' | 'extra_whatsapp_instances' | 'extra_energy'; quantity: number }) => {
      const { data, error } = await supabase.functions.invoke("add-subscription-item", {
        body: { itemType, quantity },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "Sucesso!",
        description: data.message || "Item adicionado à sua assinatura.",
      });
      queryClient.invalidateQueries({ queryKey: ["current-subscription"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao adicionar item",
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
          returnUrl: `${window.location.origin}/team`,
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
