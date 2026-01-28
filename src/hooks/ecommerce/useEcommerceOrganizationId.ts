import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentTenantId } from '@/hooks/useTenant';

/**
 * Fonte única de organization_id para os módulos de e-commerce.
 *
 * Problema que isso resolve:
 * - Em alguns fluxos o `profile.organization_id` no estado do frontend pode vir null/desatualizado.
 * - Isso fazia telas como "Checkouts > Afiliados > Adicionar" ficarem vazias mesmo com dados aprovados.
 */
export function useEcommerceOrganizationId() {
  const { user, profile } = useAuth();
  const { data: tenantId } = useCurrentTenantId();

  return useQuery({
    queryKey: ['ecommerce-organization-id', user?.id, tenantId, profile?.organization_id],
    queryFn: async () => {
      if (tenantId) return tenantId;
      if (profile?.organization_id) return profile.organization_id;
      if (!user) return null;

      // Fallback robusto (igual outros módulos): buscar no banco.
      const { data, error } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) return null;
      return (data?.organization_id as string | null) ?? null;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });
}
