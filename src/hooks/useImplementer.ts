import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";

export interface Implementer {
  id: string;
  user_id: string;
  organization_id: string;
  referral_code: string;
  is_active: boolean;
  is_white_label: boolean;
  white_label_config_id: string | null;
  total_clients: number;
  total_earnings_cents: number;
  created_at: string;
  updated_at: string;
}

export interface ImplementerSale {
  id: string;
  implementer_id: string;
  client_organization_id: string;
  client_subscription_id: string | null;
  plan_id: string;
  implementation_fee_cents: number;
  first_payment_cents: number;
  status: 'active' | 'cancelled' | 'churned';
  created_at: string;
  cancelled_at: string | null;
  // Joined data
  client_organization?: {
    name: string;
    owner_email: string | null;
  };
  subscription_plans?: {
    name: string;
    price_cents: number;
  };
}

export interface ImplementerCommission {
  id: string;
  implementer_id: string;
  implementer_sale_id: string;
  commission_type: 'implementation_fee' | 'first_month' | 'recurring';
  gross_amount_cents: number;
  platform_fee_cents: number;
  net_amount_cents: number;
  period_month: number | null;
  status: 'pending' | 'paid' | 'cancelled';
  created_at: string;
  paid_at: string | null;
}

export interface ImplementerCheckoutLink {
  id: string;
  implementer_id: string;
  plan_id: string;
  implementation_fee_cents: number;
  slug: string;
  description: string | null;
  is_active: boolean;
  uses_count: number;
  created_at: string;
  // Joined
  subscription_plans?: {
    name: string;
    price_cents: number;
  };
}

// Check if current user is an implementer
export function useIsImplementer() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ["is-implementer", user?.id],
    queryFn: async () => {
      if (!user?.id) return false;
      
      const { data, error } = await supabase
        .from("implementers")
        .select("id, is_active")
        .eq("user_id", user.id)
        .maybeSingle();
      
      if (error) {
        console.error("Error checking implementer status:", error);
        return false;
      }
      
      return data?.is_active ?? false;
    },
    enabled: !!user?.id,
  });
}

// Get current user's implementer record
export function useMyImplementer() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ["my-implementer", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from("implementers")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      
      if (error) {
        console.error("Error fetching implementer:", error);
        return null;
      }
      
      return data as Implementer | null;
    },
    enabled: !!user?.id,
  });
}

// Get implementer's sales/clients
export function useImplementerSales(implementerId: string | undefined) {
  return useQuery({
    queryKey: ["implementer-sales", implementerId],
    queryFn: async () => {
      if (!implementerId) return [];
      
      const { data, error } = await supabase
        .from("implementer_sales")
        .select(`
          *,
          client_organization:organizations!client_organization_id(name, owner_email),
          subscription_plans(name, price_cents)
        `)
        .eq("implementer_id", implementerId)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data as ImplementerSale[];
    },
    enabled: !!implementerId,
  });
}

// Get implementer's commissions
export function useImplementerCommissions(implementerId: string | undefined) {
  return useQuery({
    queryKey: ["implementer-commissions", implementerId],
    queryFn: async () => {
      if (!implementerId) return [];
      
      const { data, error } = await supabase
        .from("implementer_commissions")
        .select("*")
        .eq("implementer_id", implementerId)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data as ImplementerCommission[];
    },
    enabled: !!implementerId,
  });
}

// Get implementer's checkout links
export function useImplementerLinks(implementerId: string | undefined) {
  return useQuery({
    queryKey: ["implementer-links", implementerId],
    queryFn: async () => {
      if (!implementerId) return [];
      
      const { data, error } = await supabase
        .from("implementer_checkout_links")
        .select(`
          *,
          subscription_plans(name, price_cents)
        `)
        .eq("implementer_id", implementerId)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data as ImplementerCheckoutLink[];
    },
    enabled: !!implementerId,
  });
}

// Create a new checkout link
export function useCreateImplementerLink() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({
      implementerId,
      planId,
      implementationFeeCents,
      description,
    }: {
      implementerId: string;
      planId: string;
      implementationFeeCents: number;
      description?: string;
    }) => {
      // Generate unique slug
      const slug = `imp-${Date.now().toString(36)}`;
      
      const { data, error } = await supabase
        .from("implementer_checkout_links")
        .insert({
          implementer_id: implementerId,
          plan_id: planId,
          implementation_fee_cents: implementationFeeCents,
          slug,
          description,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["implementer-links", variables.implementerId] });
      toast({
        title: "Link criado!",
        description: "Seu link de checkout foi criado com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao criar link",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

// Toggle link active status
export function useToggleImplementerLink() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ linkId, isActive }: { linkId: string; isActive: boolean }) => {
      const { error } = await supabase
        .from("implementer_checkout_links")
        .update({ is_active: isActive })
        .eq("id", linkId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["implementer-links"] });
    },
  });
}

// Delete a link
export function useDeleteImplementerLink() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (linkId: string) => {
      const { error } = await supabase
        .from("implementer_checkout_links")
        .delete()
        .eq("id", linkId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["implementer-links"] });
      toast({
        title: "Link removido",
        description: "O link foi removido com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao remover link",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

// Get all available plans for implementers
export function useImplementerPlans() {
  return useQuery({
    queryKey: ["implementer-available-plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscription_plans")
        .select("id, name, price_cents, max_users, max_leads, monthly_energy, included_whatsapp_instances")
        .eq("is_active", true)
        .neq("price_cents", 0) // Exclude free plans
        .order("price_cents", { ascending: true });
      
      if (error) throw error;
      return data;
    },
  });
}
