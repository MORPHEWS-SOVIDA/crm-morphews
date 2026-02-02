import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface WhiteLabelPlan {
  id: string;
  white_label_config_id: string;
  name: string;
  slug: string;
  description: string | null;
  price_cents: number;
  setup_fee_cents: number;
  max_users: number;
  max_leads: number | null;
  max_whatsapp_instances: number;
  max_energy_per_month: number;
  has_whatsapp: boolean;
  has_ai_bots: boolean;
  has_ecommerce: boolean;
  has_erp: boolean;
  has_nfe: boolean;
  has_email_marketing: boolean;
  has_tracking: boolean;
  is_active: boolean;
  is_public: boolean;
  created_at: string | null;
  updated_at: string | null;
}

// Get white label plans by config ID (public)
export function useWhiteLabelPlansByConfigId(configId: string | undefined) {
  return useQuery({
    queryKey: ["white-label-plans", configId],
    queryFn: async () => {
      if (!configId) return [];
      
      const { data, error } = await supabase
        .from("white_label_plans")
        .select("*")
        .eq("white_label_config_id", configId)
        .eq("is_active", true)
        .eq("is_public", true)
        .order("price_cents", { ascending: true });
      
      if (error) {
        console.error("Error fetching white label plans:", error);
        return [];
      }
      
      return data as WhiteLabelPlan[];
    },
    enabled: !!configId,
  });
}
