import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { normalizeText } from '@/lib/utils';

export interface LeadSearchResult {
  id: string;
  name: string;
  whatsapp: string;
  email: string | null;
  city: string | null;
  state: string | null;
  stars: number;
}

export function useSearchLeadByName(searchTerm: string) {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['leads-search-by-name', searchTerm, profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id || searchTerm.length < 2) {
        return [];
      }

      const { data, error } = await supabase
        .from('leads')
        .select('id, name, whatsapp, email, city, state, stars')
        .eq('organization_id', profile.organization_id)
        .ilike('name', `%${searchTerm}%`)
        .order('name')
        .limit(10);

      if (error) throw error;

      return (data || []) as LeadSearchResult[];
    },
    enabled: !!profile?.organization_id && searchTerm.length >= 2,
    staleTime: 30000, // Cache for 30 seconds
  });
}
