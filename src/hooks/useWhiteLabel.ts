import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface WhiteLabelConfig {
  id: string;
  implementer_id: string;
  brand_name: string;
  logo_url: string | null;
  favicon_url: string | null;
  primary_color: string;
  secondary_color: string;
  sales_page_slug: string | null;
  custom_domain: string | null;
  email_from_name: string | null;
  email_logo_url: string | null;
  support_email: string | null;
  support_whatsapp: string | null;
  login_background_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Get implementer's white label config
export function useWhiteLabelConfig(implementerId: string | undefined) {
  return useQuery({
    queryKey: ["white-label-config", implementerId],
    queryFn: async () => {
      if (!implementerId) return null;
      
      const { data, error } = await supabase
        .from("white_label_configs")
        .select("*")
        .eq("implementer_id", implementerId)
        .maybeSingle();
      
      if (error) {
        console.error("Error fetching white label config:", error);
        return null;
      }
      
      return data as WhiteLabelConfig | null;
    },
    enabled: !!implementerId,
  });
}

// Get white label config by slug (public)
export function useWhiteLabelBySlug(slug: string | undefined) {
  return useQuery({
    queryKey: ["white-label-by-slug", slug],
    queryFn: async () => {
      if (!slug) return null;
      
      const { data, error } = await supabase
        .from("white_label_configs")
        .select("*")
        .eq("sales_page_slug", slug)
        .eq("is_active", true)
        .maybeSingle();
      
      if (error) {
        console.error("Error fetching white label by slug:", error);
        return null;
      }
      
      return data as WhiteLabelConfig | null;
    },
    enabled: !!slug,
  });
}

// Check if slug is available
export function useCheckSlugAvailability() {
  return useMutation({
    mutationFn: async (slug: string) => {
      const { data, error } = await supabase
        .from("white_label_configs")
        .select("id")
        .eq("sales_page_slug", slug)
        .maybeSingle();
      
      if (error) throw error;
      return !data; // true if available
    },
  });
}

// Create white label config
export function useCreateWhiteLabelConfig() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (config: {
      implementer_id: string;
      brand_name: string;
      logo_url?: string;
      favicon_url?: string;
      primary_color?: string;
      secondary_color?: string;
      sales_page_slug: string;
      email_from_name?: string;
      email_logo_url?: string;
      support_email?: string;
      support_whatsapp?: string;
    }) => {
      const { data, error } = await supabase
        .from("white_label_configs")
        .insert(config)
        .select()
        .single();
      
      if (error) throw error;
      
      // Update implementer to mark as white label
      await supabase
        .from("implementers")
        .update({ 
          is_white_label: true,
          white_label_config_id: data.id 
        })
        .eq("id", config.implementer_id);
      
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["white-label-config", variables.implementer_id] });
      queryClient.invalidateQueries({ queryKey: ["my-implementer"] });
      toast({
        title: "White Label configurado!",
        description: "Sua marca foi configurada com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao configurar White Label",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

// Update white label config
export function useUpdateWhiteLabelConfig() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      configId, 
      updates 
    }: { 
      configId: string; 
      updates: Partial<Omit<WhiteLabelConfig, 'id' | 'implementer_id' | 'created_at' | 'updated_at'>> 
    }) => {
      const { data, error } = await supabase
        .from("white_label_configs")
        .update(updates)
        .eq("id", configId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["white-label-config"] });
      queryClient.invalidateQueries({ queryKey: ["white-label-by-slug", data.sales_page_slug] });
      toast({
        title: "Configuração atualizada!",
        description: "As alterações foram salvas.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao atualizar",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

// Check if implementer has white label plan
export function useHasWhiteLabelPlan(organizationId: string | undefined) {
  return useQuery({
    queryKey: ["has-white-label-plan", organizationId],
    queryFn: async () => {
      if (!organizationId) return false;
      
      // Get the organization's subscription and check if plan allows white label
      const { data, error } = await supabase
        .from("subscriptions")
        .select(`
          id,
          plan_id,
          subscription_plans!inner(allows_white_label)
        `)
        .eq("organization_id", organizationId)
        .eq("status", "active")
        .maybeSingle();
      
      if (error) {
        console.error("Error checking white label plan:", error);
        return false;
      }
      
      return (data?.subscription_plans as any)?.allows_white_label ?? false;
    },
    enabled: !!organizationId,
  });
}
