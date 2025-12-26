import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useOrgAdmin() {
  return useQuery({
    queryKey: ["is_current_user_org_admin"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("is_current_user_org_admin");
      if (error) throw error;
      return Boolean(data);
    },
    staleTime: 60_000,
    retry: 1,
  });
}
