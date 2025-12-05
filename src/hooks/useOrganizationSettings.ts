import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface OrganizationSettings {
  id: string;
  name: string;
  whatsapp_dms_enabled: boolean;
}

export function useOrganizationSettings() {
  const { profile, isLoading: authLoading } = useAuth();

  return useQuery({
    queryKey: ["organization-settings", profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return null;

      const { data, error } = await supabase
        .from("organizations")
        .select("id, name, whatsapp_dms_enabled")
        .eq("id", profile.organization_id)
        .single();

      if (error) throw error;
      return data as OrganizationSettings;
    },
    enabled: !!profile?.organization_id && !authLoading,
  });
}
