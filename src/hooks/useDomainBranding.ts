import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrgWhiteLabelBranding, OrgWhiteLabelBranding } from "./useOrgWhiteLabelBranding";

/**
 * Detects white label branding from the current domain (app_domain or custom_domain).
 * This is used as a fallback when the user's org isn't directly linked as a WL customer.
 */
function useDomainWhiteLabelBranding() {
  const hostname = typeof window !== 'undefined' ? window.location.hostname : '';

  // List of main domains that should NOT trigger WL branding
  const MAIN_DOMAINS = [
    'localhost', '127.0.0.1', 'lovable.app', 'lovable.dev',
    'lovableproject.com', 'morphews.com', 'sales.morphews.com',
    'crm-morphews.lovable.app',
  ];

  const isMainDomain = MAIN_DOMAINS.some(d => hostname === d || hostname.endsWith(`.${d}`));

  return useQuery({
    queryKey: ["domain-white-label-branding", hostname],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("white_label_configs")
        .select(`
          brand_name,
          logo_url,
          logo_dark_url,
          primary_color,
          secondary_color,
          favicon_url,
          sales_page_slug,
          support_whatsapp
        `)
        .or(`app_domain.eq.${hostname},custom_domain.eq.${hostname}`)
        .eq("is_active", true)
        .maybeSingle();

      if (error || !data) return null;

      return {
        brand_name: data.brand_name,
        logo_url: data.logo_url,
        logo_dark_url: data.logo_dark_url,
        primary_color: data.primary_color || '#9b87f5',
        secondary_color: data.secondary_color,
        favicon_url: data.favicon_url,
        sales_page_slug: data.sales_page_slug,
        support_whatsapp: data.support_whatsapp,
      } as OrgWhiteLabelBranding;
    },
    enabled: !isMainDomain && !!hostname,
    staleTime: 10 * 60 * 1000,
  });
}

/**
 * Combined hook: returns org-based WL branding first, falls back to domain-based.
 * This ensures users on atomic.ia.br always see AtomicSales branding,
 * even if their org isn't directly a WL customer.
 */
export function useCombinedBranding() {
  const orgBranding = useOrgWhiteLabelBranding();
  const domainBranding = useDomainWhiteLabelBranding();

  // Prefer org-based branding, fallback to domain-based
  const branding = orgBranding.data || domainBranding.data || null;
  const isLoading = orgBranding.isLoading || domainBranding.isLoading;

  return { data: branding, isLoading };
}
