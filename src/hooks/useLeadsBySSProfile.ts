import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';

/**
 * Returns a Set of lead IDs that belong to a specific social selling profile.
 * When profileId is null, returns null (no filtering needed).
 */
export function useLeadsBySSProfile(profileId: string | null) {
  const { tenantId: organizationId } = useTenant();

  const { data: leadIds, isLoading } = useQuery({
    queryKey: ['leads-by-ss-profile', organizationId, profileId],
    queryFn: async () => {
      if (!organizationId || !profileId) return null;
      
      const { data } = await (supabase as any)
        .from('social_selling_activities')
        .select('lead_id')
        .eq('organization_id', organizationId)
        .eq('profile_id', profileId)
        .not('lead_id', 'is', null);
      
      if (!data) return new Set<string>();
      
      // Deduplicate lead_ids
      return new Set<string>(data.map((r: any) => r.lead_id));
    },
    enabled: !!organizationId && !!profileId,
  });

  return { leadIds: profileId ? (leadIds ?? new Set<string>()) : null, isLoading };
}
