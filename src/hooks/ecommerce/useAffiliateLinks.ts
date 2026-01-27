import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export type LinkableAssetType = 'checkout' | 'landing' | 'product';

export interface AffiliateLink {
  id: string;
  affiliate_code: string;
  partner_type: string;
  commission_type: string;
  commission_value: number;
  linked_checkout_id: string | null;
  linked_landing_id: string | null;
  linked_product_id: string | null;
  is_active: boolean;
  virtual_account: {
    id: string;
    holder_name: string;
    holder_email: string;
  } | null;
}

export interface AvailableOffer {
  id: string;
  type: 'checkout' | 'landing';
  name: string;
  slug: string;
  attribution_model: string;
  product_name?: string;
  product_image?: string;
  is_enrolled: boolean;
  affiliate_link?: string;
}

// Hook para buscar afiliados vinculados a um checkout
export function useCheckoutAffiliates(checkoutId: string | null) {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['checkout-affiliates', checkoutId],
    queryFn: async () => {
      if (!checkoutId || !profile?.organization_id) return [];

      // Buscar todos os afiliados da org que estão vinculados a este checkout
      const { data, error } = await supabase
        .from('partner_associations')
        .select(`
          id,
          affiliate_code,
          partner_type,
          commission_type,
          commission_value,
          linked_checkout_id,
          is_active,
          virtual_account:virtual_accounts(id, holder_name, holder_email)
        `)
        .eq('organization_id', profile.organization_id)
        .eq('partner_type', 'affiliate')
        .eq('linked_checkout_id', checkoutId);

      if (error) throw error;
      return data as unknown as AffiliateLink[];
    },
    enabled: !!checkoutId && !!profile?.organization_id,
  });
}

// Hook para buscar todos os afiliados da org (para adicionar ao checkout)
export function useOrganizationAffiliates() {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['organization-affiliates', profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return [];

      const { data, error } = await supabase
        .from('partner_associations')
        .select(`
          id,
          affiliate_code,
          partner_type,
          commission_type,
          commission_value,
          linked_checkout_id,
          linked_landing_id,
          linked_product_id,
          is_active,
          virtual_account:virtual_accounts(id, holder_name, holder_email)
        `)
        .eq('organization_id', profile.organization_id)
        .eq('partner_type', 'affiliate')
        .eq('is_active', true);

      if (error) throw error;
      return data as unknown as AffiliateLink[];
    },
    enabled: !!profile?.organization_id,
  });
}

// Hook para vincular afiliado a um checkout
export function useLinkAffiliateToCheckout() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async ({ 
      affiliateId, 
      checkoutId,
      commissionType,
      commissionValue 
    }: { 
      affiliateId: string; 
      checkoutId: string;
      commissionType?: string;
      commissionValue?: number;
    }) => {
      if (!profile?.organization_id) throw new Error('No organization');

      // Buscar o afiliado original
      const { data: affiliate, error: fetchError } = await supabase
        .from('partner_associations')
        .select('*')
        .eq('id', affiliateId)
        .single();

      if (fetchError) throw fetchError;

      // Criar uma nova associação vinculada ao checkout específico
      const { error } = await supabase
        .from('partner_associations')
        .insert({
          virtual_account_id: affiliate.virtual_account_id,
          organization_id: profile.organization_id,
          partner_type: 'affiliate',
          commission_type: commissionType || affiliate.commission_type,
          commission_value: commissionValue || affiliate.commission_value,
          affiliate_code: affiliate.affiliate_code,
          linked_checkout_id: checkoutId,
          is_active: true,
        });

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['checkout-affiliates', variables.checkoutId] });
      toast.success('Afiliado vinculado ao checkout!');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao vincular afiliado');
    },
  });
}

// Hook para desvincular afiliado de um checkout
export function useUnlinkAffiliateFromCheckout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ linkId, checkoutId }: { linkId: string; checkoutId: string }) => {
      const { error } = await supabase
        .from('partner_associations')
        .delete()
        .eq('id', linkId);

      if (error) throw error;
      return { checkoutId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['checkout-affiliates', data.checkoutId] });
      toast.success('Afiliado removido do checkout');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao remover afiliado');
    },
  });
}

// Hook para buscar ofertas disponíveis para o afiliado (usado no portal)
export function useAffiliateAvailableOffers() {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['affiliate-available-offers', profile?.user_id],
    queryFn: async () => {
      if (!profile?.user_id) return [];

      // Buscar a conta virtual do usuário
      const { data: virtualAccount } = await supabase
        .from('virtual_accounts')
        .select('id, organization_id')
        .eq('user_id', profile.user_id)
        .maybeSingle();

      if (!virtualAccount) return [];

      // Buscar associação do afiliado (a "geral", sem vínculo específico)
      const { data: myAssociation } = await supabase
        .from('partner_associations')
        .select('id, affiliate_code, commission_type, commission_value')
        .eq('virtual_account_id', virtualAccount.id)
        .eq('partner_type', 'affiliate')
        .is('linked_checkout_id', null)
        .is('linked_landing_id', null)
        .maybeSingle();

      // Buscar vínculos específicos do afiliado
      const { data: myLinks } = await supabase
        .from('partner_associations')
        .select('linked_checkout_id, linked_landing_id, affiliate_code')
        .eq('virtual_account_id', virtualAccount.id)
        .eq('partner_type', 'affiliate')
        .eq('is_active', true);

      const linkedCheckoutIds = new Set(myLinks?.map(l => l.linked_checkout_id).filter(Boolean) || []);
      const linkedLandingIds = new Set(myLinks?.map(l => l.linked_landing_id).filter(Boolean) || []);

      // Buscar checkouts disponíveis
      const { data: checkouts } = await supabase
        .from('standalone_checkouts')
        .select(`
          id, 
          name, 
          slug, 
          attribution_model,
          product:lead_products(name, images)
        `)
        .eq('organization_id', virtualAccount.organization_id)
        .eq('is_active', true);

      // Buscar landing pages disponíveis
      const { data: landings } = await supabase
        .from('landing_pages')
        .select('id, name, slug, attribution_model')
        .eq('organization_id', virtualAccount.organization_id)
        .eq('is_active', true);

      const offers: AvailableOffer[] = [];

      // Adicionar checkouts
      for (const checkout of checkouts || []) {
        const isEnrolled = linkedCheckoutIds.has(checkout.id);
        const affiliateCode = myAssociation?.affiliate_code || 
          myLinks?.find(l => l.linked_checkout_id === checkout.id)?.affiliate_code;
        
        offers.push({
          id: checkout.id,
          type: 'checkout',
          name: checkout.name,
          slug: checkout.slug,
          attribution_model: checkout.attribution_model || 'last_click',
          product_name: (checkout.product as any)?.name,
          product_image: (checkout.product as any)?.images?.[0],
          is_enrolled: isEnrolled || !!myAssociation, // Se tem associação geral, pode promover qualquer um
          affiliate_link: affiliateCode 
            ? `${window.location.origin}/pay/${checkout.slug}?ref=${affiliateCode}`
            : undefined,
        });
      }

      // Adicionar landings
      for (const landing of landings || []) {
        const isEnrolled = linkedLandingIds.has(landing.id);
        const affiliateCode = myAssociation?.affiliate_code || 
          myLinks?.find(l => l.linked_landing_id === landing.id)?.affiliate_code;
        
        offers.push({
          id: landing.id,
          type: 'landing',
          name: landing.name,
          slug: landing.slug,
          attribution_model: landing.attribution_model || 'last_click',
          is_enrolled: isEnrolled || !!myAssociation,
          affiliate_link: affiliateCode 
            ? `${window.location.origin}/l/${landing.slug}?ref=${affiliateCode}`
            : undefined,
        });
      }

      return offers;
    },
    enabled: !!profile?.user_id,
  });
}
