import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface OrgWhiteLabelBranding {
  brand_name: string;
  logo_url: string | null;
  logo_dark_url: string | null;
  primary_color: string;
  secondary_color: string | null;
  favicon_url: string | null;
  sales_page_slug: string | null;
  support_whatsapp: string | null;
}

/**
 * Hook to get white label branding for the current user's organization.
 * Returns the branding config if the organization is a white label customer,
 * or null if it's a direct Morphews customer.
 */
export function useOrgWhiteLabelBranding() {
  const { profile } = useAuth();
  const organizationId = profile?.organization_id;

  return useQuery({
    queryKey: ["org-white-label-branding", organizationId],
    queryFn: async () => {
      if (!organizationId) return null;

      // Check if this org is a white label customer
      // Use the explicit FK relationship white_label_config_id
      const { data, error } = await supabase
        .from("white_label_customers")
        .select(`
          status,
          white_label_config_id,
          white_label_configs:white_label_config_id(
            brand_name,
            logo_url,
            logo_dark_url,
            primary_color,
            secondary_color,
            favicon_url,
            sales_page_slug,
            support_whatsapp
          )
        `)
        .eq("organization_id", organizationId)
        .eq("status", "active")
        .maybeSingle();

      if (error) {
        console.error("Error fetching org white label branding:", error);
        return null;
      }

      if (!data?.white_label_configs) {
        return null;
      }

      const config = data.white_label_configs as any;
      return {
        brand_name: config.brand_name,
        logo_url: config.logo_url,
        logo_dark_url: config.logo_dark_url,
        primary_color: config.primary_color || '#9b87f5',
        secondary_color: config.secondary_color,
        favicon_url: config.favicon_url,
        sales_page_slug: config.sales_page_slug,
        support_whatsapp: config.support_whatsapp,
      } as OrgWhiteLabelBranding;
    },
    enabled: !!organizationId,
    staleTime: 10 * 60 * 1000, // Cache for 10 minutes
  });
}
