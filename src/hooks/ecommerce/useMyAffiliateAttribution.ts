import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

/**
 * Retorna os IDs de partner_associations (affiliate) do usuário logado.
 * Isso é o que o checkout grava em ecommerce_orders.affiliate_id.
 */
export function useMyAffiliatePartnerAssociationIds() {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['my-affiliate-partner-association-ids', profile?.user_id],
    enabled: !!profile?.user_id,
    queryFn: async () => {
      if (!profile?.user_id) return [] as string[];

      // 1) achar a virtual_account do usuário
      const { data: virtualAccount, error: vaError } = await supabase
        .from('virtual_accounts')
        .select('id')
        .eq('user_id', profile.user_id)
        .maybeSingle();

      if (vaError) throw vaError;
      if (!virtualAccount?.id) return [] as string[];

      // 2) buscar todas as associações de affiliate (geral + específicas)
      const { data: associations, error: assocError } = await supabase
        .from('partner_associations')
        .select('id')
        .eq('virtual_account_id', virtualAccount.id)
        .eq('partner_type', 'affiliate')
        .eq('is_active', true);

      if (assocError) throw assocError;
      return (associations || []).map((a) => a.id);
    },
  });
}
