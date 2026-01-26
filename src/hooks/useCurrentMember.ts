import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from './useTenant';
import { useAuth } from './useAuth';

export interface CurrentMember {
  id: string;
  user_id: string;
  role: string;
  team_id: string | null;
  is_sales_manager: boolean;
  can_see_all_leads: boolean;
  commission_percentage: number | null;
}

/**
 * Hook to get the current authenticated user's organization member info
 * Includes team_id and is_sales_manager for team-based filtering
 */
export function useCurrentMember() {
  const { tenantId } = useTenant();
  const { user } = useAuth();

  return useQuery({
    queryKey: ['current-member', tenantId, user?.id],
    queryFn: async () => {
      if (!tenantId || !user?.id) return null;

      const { data, error } = await supabase
        .from('organization_members')
        .select('id, user_id, role, team_id, is_sales_manager, can_see_all_leads, commission_percentage')
        .eq('organization_id', tenantId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      return data as CurrentMember | null;
    },
    enabled: !!tenantId && !!user?.id,
    staleTime: 60_000,
  });
}
