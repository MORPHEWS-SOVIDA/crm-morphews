import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";

// Types
export interface WhiteLabelPlan {
  id: string;
  white_label_config_id: string;
  name: string;
  description: string | null;
  slug: string;
  price_cents: number;
  setup_fee_cents: number;
  max_users: number;
  max_leads: number | null;
  max_whatsapp_instances: number;
  max_energy_per_month: number;
  max_ecommerce_products: number;
  max_storefronts: number;
  has_ai_bots: boolean;
  has_whatsapp: boolean;
  has_email_marketing: boolean;
  has_ecommerce: boolean;
  has_erp: boolean;
  has_tracking: boolean;
  has_nfe: boolean;
  platform_cost_cents: number;
  platform_percentage: number;
  is_active: boolean;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export interface WhiteLabelCustomer {
  id: string;
  white_label_config_id: string;
  organization_id: string;
  white_label_plan_id: string | null;
  contracted_price_cents: number | null;
  setup_fee_paid_cents: number;
  status: 'active' | 'suspended' | 'cancelled' | 'trial';
  trial_ends_at: string | null;
  created_at: string;
  activated_at: string | null;
  cancelled_at: string | null;
  // Joined data
  organization?: {
    id: string;
    name: string;
    slug: string;
    owner_email: string | null;
    phone: string | null;
    created_at: string;
  };
  plan?: WhiteLabelPlan;
}

export interface WhiteAdminStats {
  totalCustomers: number;
  activeCustomers: number;
  totalRevenueCents: number;
  pendingCommissionsCents: number;
  totalPlans: number;
}

// Check if user is a White Label owner
export function useIsWhiteLabelOwner() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ["is-white-label-owner", user?.id],
    queryFn: async () => {
      if (!user?.id) return false;
      
      const { data, error } = await supabase
        .rpc("is_white_label_owner", { _user_id: user.id });
      
      if (error) {
        console.error("Error checking WL owner status:", error);
        return false;
      }
      
      return data === true;
    },
    enabled: !!user?.id,
  });
}

// Get the White Label config for the current user
export function useMyWhiteLabelConfig() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ["my-white-label-config", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      // First get the implementer
      const { data: implementer, error: impError } = await supabase
        .from("implementers")
        .select("id, user_id, organization_id, referral_code, is_white_label, total_clients, total_earnings_cents")
        .eq("user_id", user.id)
        .eq("is_white_label", true)
        .maybeSingle();
      
      if (impError) {
        console.error("Error fetching implementer:", impError);
        return null;
      }
      
      if (!implementer) return null;
      
      // Then get the white_label_config separately
      const { data: config, error: configError } = await supabase
        .from("white_label_configs")
        .select(`
          id,
          brand_name,
          logo_url,
          favicon_url,
          primary_color,
          secondary_color,
          sales_page_slug,
          custom_domain,
          app_domain,
          checkout_domain,
          email_from_name,
          email_logo_url,
          support_email,
          support_whatsapp,
          support_phone,
          terms_url,
          privacy_url,
          login_background_url,
          dashboard_welcome_message,
          is_active
        `)
        .eq("implementer_id", implementer.id)
        .maybeSingle();
      
      if (configError) {
        console.error("Error fetching WL config:", configError);
        return null;
      }
      
      if (!config) return null;
      
      return {
        ...implementer,
        white_label_configs: config
      };
    },
    enabled: !!user?.id,
  });
}

// Get White Label plans
export function useWhiteLabelPlans(configId: string | undefined) {
  return useQuery({
    queryKey: ["white-label-plans", configId],
    queryFn: async () => {
      if (!configId) return [];
      
      const { data, error } = await supabase
        .from("white_label_plans")
        .select("*")
        .eq("white_label_config_id", configId)
        .order("price_cents", { ascending: true });
      
      if (error) throw error;
      return data as WhiteLabelPlan[];
    },
    enabled: !!configId,
  });
}

// Get White Label customers
export function useWhiteLabelCustomers(configId: string | undefined) {
  return useQuery({
    queryKey: ["white-label-customers", configId],
    queryFn: async () => {
      if (!configId) return [];
      
      const { data, error } = await supabase
        .from("white_label_customers")
        .select(`
          *,
          organization:organizations(id, name, slug, owner_email, phone, created_at),
          plan:white_label_plans(id, name, price_cents)
        `)
        .eq("white_label_config_id", configId)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data as WhiteLabelCustomer[];
    },
    enabled: !!configId,
  });
}

// Get White Admin stats
export function useWhiteAdminStats(configId: string | undefined) {
  return useQuery({
    queryKey: ["white-admin-stats", configId],
    queryFn: async () => {
      if (!configId) {
        return {
          totalCustomers: 0,
          activeCustomers: 0,
          totalRevenueCents: 0,
          pendingCommissionsCents: 0,
          totalPlans: 0,
        };
      }
      
      // Get customer counts
      const { data: customers, error: custError } = await supabase
        .from("white_label_customers")
        .select("status, contracted_price_cents")
        .eq("white_label_config_id", configId);
      
      if (custError) throw custError;
      
      // Get plans count
      const { count: plansCount } = await supabase
        .from("white_label_plans")
        .select("id", { count: "exact", head: true })
        .eq("white_label_config_id", configId)
        .eq("is_active", true);
      
      // Also check implementer_sales for legacy customers
      const { data: legacyData } = await supabase
        .from("implementer_sales")
        .select("id")
        .eq("white_label_config_id", configId);
      
      const totalCustomers = (customers?.length || 0) + (legacyData?.length || 0);
      const activeCustomers = customers?.filter(c => c.status === 'active').length || 0;
      const totalRevenueCents = customers?.reduce((sum, c) => sum + (c.contracted_price_cents || 0), 0) || 0;
      
      return {
        totalCustomers,
        activeCustomers,
        totalRevenueCents,
        pendingCommissionsCents: 0, // TODO: calculate from commissions
        totalPlans: plansCount || 0,
      };
    },
    enabled: !!configId,
  });
}

// Create a new plan
export function useCreateWhiteLabelPlan() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (plan: Omit<WhiteLabelPlan, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from("white_label_plans")
        .insert(plan)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["white-label-plans", variables.white_label_config_id] });
      queryClient.invalidateQueries({ queryKey: ["white-admin-stats"] });
      toast({ title: "Plano criado com sucesso!" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao criar plano", description: error.message, variant: "destructive" });
    },
  });
}

// Update a plan
export function useUpdateWhiteLabelPlan() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<WhiteLabelPlan> }) => {
      const { data, error } = await supabase
        .from("white_label_plans")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["white-label-plans"] });
      toast({ title: "Plano atualizado!" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
    },
  });
}

// Create a customer
export function useCreateWhiteLabelCustomer() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (customer: {
      white_label_config_id: string;
      organization_id: string;
      white_label_plan_id?: string;
      contracted_price_cents?: number;
      status?: 'active' | 'trial';
    }) => {
      const { data, error } = await supabase
        .from("white_label_customers")
        .insert({
          ...customer,
          activated_at: customer.status === 'active' ? new Date().toISOString() : null,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["white-label-customers", variables.white_label_config_id] });
      queryClient.invalidateQueries({ queryKey: ["white-admin-stats"] });
      toast({ title: "Cliente adicionado!" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao adicionar cliente", description: error.message, variant: "destructive" });
    },
  });
}

// Update customer status
export function useUpdateWhiteLabelCustomer() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, updates }: { 
      id: string; 
      updates: Partial<Pick<WhiteLabelCustomer, 'status' | 'white_label_plan_id' | 'contracted_price_cents'>> 
    }) => {
      const updateData: Record<string, unknown> = { ...updates };
      
      if (updates.status === 'cancelled') {
        updateData.cancelled_at = new Date().toISOString();
      } else if (updates.status === 'active') {
        updateData.activated_at = new Date().toISOString();
      }
      
      const { data, error } = await supabase
        .from("white_label_customers")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["white-label-customers"] });
      queryClient.invalidateQueries({ queryKey: ["white-admin-stats"] });
      toast({ title: "Cliente atualizado!" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
    },
  });
}
