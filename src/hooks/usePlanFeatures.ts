import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";

// Define all available features that can be enabled/disabled per plan
// This should mirror the modules available in user_permissions
export const AVAILABLE_FEATURES = {
  // Dashboards
  dashboard_funnel: { label: "Dashboard Funil", group: "Dashboards" },
  dashboard_kanban: { label: "Dashboard Kanban", group: "Dashboards" },
  seller_panel: { label: "Meu Painel (Vendedor)", group: "Dashboards" },
  sales_dashboard: { label: "Dashboard Vendas (Gamificação)", group: "Dashboards" },
  
  // Módulos Principais
  leads: { label: "Leads / CRM", group: "Módulos Principais" },
  products: { label: "Produtos", group: "Módulos Principais" },
  standard_questions: { label: "Perguntas Sovida", group: "Módulos Principais" },
  custom_questions: { label: "Perguntas Personalizadas", group: "Módulos Principais" },
  
  // Vendas
  sales: { label: "Vendas", group: "Vendas" },
  deliveries: { label: "Entregas", group: "Vendas" },
  expedition: { label: "Expedição", group: "Vendas" },
  receptive: { label: "Add Receptivo", group: "Vendas" },
  receptive_manage: { label: "Gerência Receptivo", group: "Vendas" },
  
  // Pós-Venda & SAC
  post_sale: { label: "Pós-Venda", group: "Pós-Venda & SAC" },
  post_sale_kanban: { label: "Kanban Pós-Venda", group: "Pós-Venda & SAC" },
  sac: { label: "SAC (Chamados)", group: "Pós-Venda & SAC" },
  
  // Mensagens & Automação
  scheduled_messages: { label: "Mensagens Agendadas", group: "Mensagens & Automação" },
  ai_bots: { label: "Robôs de IA", group: "Mensagens & Automação" },
  
  // WhatsApp
  whatsapp_v1: { label: "WhatsApp 1.0 (DMs)", group: "WhatsApp" },
  whatsapp_v2: { label: "WhatsApp 2.0", group: "WhatsApp" },
  whatsapp_multiattendant: { label: "Multi-Atendimento", group: "WhatsApp" },
  whatsapp_manage: { label: "Gerenciar WhatsApp", group: "WhatsApp" },
  wavoip_calls: { label: "Chamadas Wavoip (Telefone)", group: "WhatsApp" },
  
  // Canais Adicionais
  instagram: { label: "Instagram DMs", group: "Canais Adicionais" },
  
  // Demandas
  demands: { label: "Demandas", group: "Demandas" },
  demands_settings: { label: "Config. Demandas", group: "Demandas" },
  
  // Relatórios
  sales_report: { label: "Relatório de Vendas", group: "Relatórios" },
  expedition_report: { label: "Relatório de Expedição", group: "Relatórios" },
  financial: { label: "Financeiro", group: "Relatórios" },
  
  // Gerenciamento
  team: { label: "Minha Equipe", group: "Gerenciamento" },
  settings: { label: "Configurações", group: "Gerenciamento" },
  integrations: { label: "Integrações", group: "Gerenciamento" },
  
  // Super Admin (interno)
  new_organization: { label: "Nova Organização", group: "Super Admin" },
  interested_leads: { label: "Leads Interessados", group: "Super Admin" },
} as const;

export type FeatureKey = keyof typeof AVAILABLE_FEATURES;

export interface PlanFeature {
  id: string;
  plan_id: string;
  feature_key: string;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface OrgFeatureOverride {
  id: string;
  organization_id: string;
  feature_key: string;
  is_enabled: boolean;
  override_reason: string | null;
  overridden_by: string | null;
  created_at: string;
  updated_at: string;
}

// Get features for a specific plan
export function usePlanFeatures(planId: string | undefined) {
  return useQuery({
    queryKey: ["plan-features", planId],
    queryFn: async () => {
      if (!planId) return [];
      
      const { data, error } = await supabase
        .from("plan_features")
        .select("*")
        .eq("plan_id", planId);
      
      if (error) throw error;
      return data as PlanFeature[];
    },
    enabled: !!planId,
  });
}

// Get all plan features (for super admin)
export function useAllPlanFeatures() {
  return useQuery({
    queryKey: ["all-plan-features"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plan_features")
        .select("*");
      
      if (error) throw error;
      return data as PlanFeature[];
    },
  });
}

// Update plan feature
export function useUpdatePlanFeature() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({
      planId,
      featureKey,
      isEnabled,
    }: {
      planId: string;
      featureKey: string;
      isEnabled: boolean;
    }) => {
      const { data, error } = await supabase
        .from("plan_features")
        .upsert(
          {
            plan_id: planId,
            feature_key: featureKey,
            is_enabled: isEnabled,
          },
          { onConflict: "plan_id,feature_key" }
        )
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["plan-features", variables.planId] });
      queryClient.invalidateQueries({ queryKey: ["all-plan-features"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao atualizar feature",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

// Bulk update plan features
export function useBulkUpdatePlanFeatures() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({
      planId,
      features,
    }: {
      planId: string;
      features: { feature_key: string; is_enabled: boolean }[];
    }) => {
      const records = features.map((f) => ({
        plan_id: planId,
        feature_key: f.feature_key,
        is_enabled: f.is_enabled,
      }));
      
      const { error } = await supabase
        .from("plan_features")
        .upsert(records, { onConflict: "plan_id,feature_key" });
      
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["plan-features", variables.planId] });
      queryClient.invalidateQueries({ queryKey: ["all-plan-features"] });
      toast({
        title: "Features atualizadas",
        description: "As features do plano foram salvas com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao salvar features",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

// Get organization feature overrides (for super admin)
export function useOrgFeatureOverrides(organizationId: string | undefined) {
  return useQuery({
    queryKey: ["org-feature-overrides", organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      
      const { data, error } = await supabase
        .from("organization_feature_overrides")
        .select("*")
        .eq("organization_id", organizationId);
      
      if (error) throw error;
      return data as OrgFeatureOverride[];
    },
    enabled: !!organizationId,
  });
}

// Update org feature override
export function useUpdateOrgFeatureOverride() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async ({
      organizationId,
      featureKey,
      isEnabled,
      reason,
    }: {
      organizationId: string;
      featureKey: string;
      isEnabled: boolean;
      reason?: string;
    }) => {
      const { data, error } = await supabase
        .from("organization_feature_overrides")
        .upsert(
          {
            organization_id: organizationId,
            feature_key: featureKey,
            is_enabled: isEnabled,
            override_reason: reason || null,
            overridden_by: user?.id,
          },
          { onConflict: "organization_id,feature_key" }
        )
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["org-feature-overrides", variables.organizationId] });
      toast({
        title: "Override atualizado",
        description: `Feature ${variables.isEnabled ? "liberada" : "bloqueada"} com sucesso.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao atualizar override",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

// Delete org feature override (remove override, use plan default)
export function useDeleteOrgFeatureOverride() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({
      organizationId,
      featureKey,
    }: {
      organizationId: string;
      featureKey: string;
    }) => {
      const { error } = await supabase
        .from("organization_feature_overrides")
        .delete()
        .eq("organization_id", organizationId)
        .eq("feature_key", featureKey);
      
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["org-feature-overrides", variables.organizationId] });
      toast({
        title: "Override removido",
        description: "A organização usará o padrão do plano agora.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao remover override",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

// Check if current org has a feature (for sidebar/menu visibility)
export function useOrgHasFeature(featureKey: FeatureKey) {
  const { profile } = useAuth();
  
  return useQuery({
    queryKey: ["org-has-feature", profile?.organization_id, featureKey],
    queryFn: async () => {
      if (!profile?.organization_id) return true; // Default to true if no org
      
      const { data, error } = await supabase
        .rpc("org_has_feature", {
          _org_id: profile.organization_id,
          _feature_key: featureKey,
        });
      
      if (error) {
        console.error("Error checking feature:", error);
        return true; // Default to true on error for backwards compatibility
      }
      
      return data as boolean;
    },
    enabled: !!profile?.organization_id,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
}

// Bulk check features for current org (more efficient than multiple calls)
export function useOrgFeatures() {
  const { profile } = useAuth();
  
  return useQuery({
    queryKey: ["org-features", profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) {
        // Return all features as enabled by default
        return Object.keys(AVAILABLE_FEATURES).reduce((acc, key) => {
          acc[key as FeatureKey] = true;
          return acc;
        }, {} as Record<FeatureKey, boolean>);
      }
      
      // Get org's subscription plan
      const { data: subscription } = await supabase
        .from("subscriptions")
        .select("plan_id")
        .eq("organization_id", profile.organization_id)
        .eq("status", "active")
        .single();
      
      // Get plan features
      const planFeatures: Record<string, boolean> = {};
      if (subscription?.plan_id) {
        const { data: features } = await supabase
          .from("plan_features")
          .select("feature_key, is_enabled")
          .eq("plan_id", subscription.plan_id);
        
        features?.forEach((f) => {
          planFeatures[f.feature_key] = f.is_enabled;
        });
      }
      
      // Get org overrides
      const { data: overrides } = await supabase
        .from("organization_feature_overrides")
        .select("feature_key, is_enabled")
        .eq("organization_id", profile.organization_id);
      
      const overrideMap: Record<string, boolean> = {};
      overrides?.forEach((o) => {
        overrideMap[o.feature_key] = o.is_enabled;
      });
      
      // Compute final feature availability
      const result: Record<FeatureKey, boolean> = {} as Record<FeatureKey, boolean>;
      Object.keys(AVAILABLE_FEATURES).forEach((key) => {
        const featureKey = key as FeatureKey;
        // Override > Plan > Default (true)
        if (overrideMap[featureKey] !== undefined) {
          result[featureKey] = overrideMap[featureKey];
        } else if (planFeatures[featureKey] !== undefined) {
          result[featureKey] = planFeatures[featureKey];
        } else {
          result[featureKey] = true; // Default to enabled for backwards compatibility
        }
      });
      
      return result;
    },
    enabled: !!profile?.organization_id,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
}
