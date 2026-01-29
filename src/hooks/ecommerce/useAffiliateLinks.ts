import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { useEcommerceOrganizationId } from '@/hooks/ecommerce/useEcommerceOrganizationId';

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
  virtual_account_id: string;
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
  const { data: organizationId } = useEcommerceOrganizationId();

  return useQuery({
    queryKey: ['checkout-affiliates', organizationId, checkoutId],
    queryFn: async () => {
      if (!checkoutId || !organizationId) return [];

      // Buscar todos os afiliados da org que estão vinculados a este checkout
      const { data: associations, error } = await supabase
        .from('partner_associations')
        .select(`
          id,
          affiliate_code,
          partner_type,
          commission_type,
          commission_value,
          linked_checkout_id,
          is_active,
          virtual_account_id
        `)
        .eq('organization_id', organizationId)
        .eq('partner_type', 'affiliate')
        .eq('linked_checkout_id', checkoutId);

      if (error) throw error;
      if (!associations || associations.length === 0) return [];

      // Buscar virtual_accounts separadamente (contorna problemas de RLS no join)
      const virtualAccountIds = associations.map(a => a.virtual_account_id).filter(Boolean);
      
      const { data: virtualAccounts } = await supabase
        .from('virtual_accounts')
        .select('id, holder_name, holder_email')
        .in('id', virtualAccountIds);

      // Mapear virtual_accounts para as associações
      const vaMap = new Map(virtualAccounts?.map(va => [va.id, va]) || []);
      
      const result = associations.map(a => ({
        ...a,
        virtual_account: vaMap.get(a.virtual_account_id) || null,
      }));

      return result as unknown as AffiliateLink[];
    },
    enabled: !!checkoutId && !!organizationId,
  });
}

// Hook para buscar todos os afiliados ÚNICOS da org (para adicionar ao checkout)
// Agrupa por virtual_account_id para evitar duplicatas e mostra TODOS os afiliados
export function useOrganizationAffiliates() {
  const { data: organizationId } = useEcommerceOrganizationId();

  return useQuery({
    queryKey: ['organization-affiliates', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];

      // Buscar TODAS as associações de afiliados (sem filtrar por linked_checkout_id)
      const { data: associations, error } = await supabase
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
          virtual_account_id
        `)
        .eq('organization_id', organizationId)
        .eq('partner_type', 'affiliate')
        .eq('is_active', true);

      if (error) throw error;
      if (!associations || associations.length === 0) return [];

      // Buscar virtual_accounts separadamente (contorna problemas de RLS no join)
      const virtualAccountIds = [...new Set(associations.map(a => a.virtual_account_id).filter(Boolean))];
      
      const { data: virtualAccounts } = await supabase
        .from('virtual_accounts')
        .select('id, holder_name, holder_email')
        .in('id', virtualAccountIds);

      // Mapear virtual_accounts para as associações
      const vaMap = new Map(virtualAccounts?.map(va => [va.id, va]) || []);
      
      // Agrupar por virtual_account_id para pegar apenas um registro por afiliado único
      // Preferir o registro SEM linked_checkout_id (é a associação "base" do afiliado)
      const uniqueByVA = new Map<string, typeof associations[0]>();
      for (const a of associations) {
        const existing = uniqueByVA.get(a.virtual_account_id);
        // Se não existe, ou se o existente tem linked_checkout_id e este não, substituir
        if (!existing || (existing.linked_checkout_id && !a.linked_checkout_id)) {
          uniqueByVA.set(a.virtual_account_id, a);
        }
      }
      
      const result = Array.from(uniqueByVA.values()).map(a => ({
        ...a,
        virtual_account: vaMap.get(a.virtual_account_id) || null,
      }));

      return result as unknown as AffiliateLink[];
    },
    enabled: !!organizationId,
  });
}

// Hook para vincular afiliado a um checkout
export function useLinkAffiliateToCheckout() {
  const queryClient = useQueryClient();
  const { data: organizationId } = useEcommerceOrganizationId();

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
      if (!organizationId) throw new Error('Organização não encontrada');

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
          organization_id: organizationId,
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
      queryClient.invalidateQueries({ queryKey: ['checkout-affiliates', organizationId, variables.checkoutId] });
      queryClient.invalidateQueries({ queryKey: ['organization-affiliates', organizationId] });
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
  const { data: organizationId } = useEcommerceOrganizationId();

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
      queryClient.invalidateQueries({ queryKey: ['checkout-affiliates', organizationId, data.checkoutId] });
      queryClient.invalidateQueries({ queryKey: ['organization-affiliates', organizationId] });
      toast.success('Afiliado removido do checkout');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao remover afiliado');
    },
  });
}

// Hook para buscar ofertas disponíveis para o afiliado (usado no portal)
// Agora prioriza checkouts permitidos via redes de afiliados (affiliate_networks)
export function useAffiliateAvailableOffers() {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['affiliate-available-offers', profile?.user_id],
    queryFn: async () => {
      if (!profile?.user_id) return [];

      // 1. Buscar membros de redes do usuário
      const { data: networkMemberships } = await supabase
        .from('affiliate_network_members')
        .select(`
          id,
          network_id,
          organization_id,
          commission_type,
          commission_value,
          affiliate:organization_affiliates(id, affiliate_code, email, name)
        `)
        .eq('user_id', profile.user_id)
        .eq('is_active', true);

      // Se o usuário está em redes, buscar checkouts vinculados a essas redes
      if (networkMemberships && networkMemberships.length > 0) {
        const offers: AvailableOffer[] = [];

        for (const membership of networkMemberships) {
          const affiliate = membership.affiliate as { id: string; affiliate_code: string; email: string; name: string } | null;
          if (!affiliate?.affiliate_code) continue;

          // Buscar checkouts vinculados a esta rede
          const { data: networkCheckouts } = await supabase
            .from('affiliate_network_checkouts')
            .select(`
              checkout:standalone_checkouts(
                id,
                name,
                slug,
                attribution_model,
                is_active,
                product_id
              )
            `)
            .eq('network_id', membership.network_id);

          // Buscar produtos separadamente para evitar problemas de múltiplas FKs
          const productIds = (networkCheckouts || [])
            .map(nc => (nc.checkout as { product_id: string } | null)?.product_id)
            .filter(Boolean) as string[];

          const { data: products } = productIds.length > 0
            ? await supabase
                .from('lead_products')
                .select('id, name, images')
                .in('id', productIds)
            : { data: [] as { id: string; name: string; images: string[] | null }[] };

          type ProductInfo = { id: string; name: string; images: string[] | null };
          const productMap = new Map<string, ProductInfo>();
          for (const p of (products || []) as ProductInfo[]) {
            productMap.set(p.id, p);
          }

          for (const nc of networkCheckouts || []) {
            const checkout = nc.checkout as {
              id: string;
              name: string;
              slug: string;
              attribution_model: string;
              is_active: boolean;
              product_id: string | null;
            } | null;

            if (!checkout || !checkout.is_active) continue;

            // Verificar se já adicionamos este checkout
            if (offers.some(o => o.id === checkout.id)) continue;

            const product = checkout.product_id ? productMap.get(checkout.product_id) : null;
            offers.push({
              id: checkout.id,
              type: 'checkout',
              name: checkout.name,
              slug: checkout.slug,
              attribution_model: checkout.attribution_model || 'last_click',
              product_name: product?.name,
              product_image: product?.images?.[0],
              is_enrolled: true,
              affiliate_link: `${window.location.origin}/pay/${checkout.slug}?ref=${affiliate.affiliate_code}`,
            });
          }
        }

        // Se encontrou ofertas via redes, retornar apenas essas
        if (offers.length > 0) {
          return offers;
        }
      }

      // 2. NOVO: Buscar vínculos via checkout_affiliate_links (sistema V2 - organization_affiliates)
      // Primeiro verificar se o usuário tem um registro em organization_affiliates
      const { data: orgAffiliate } = await supabase
        .from('organization_affiliates')
        .select('id, affiliate_code, organization_id')
        .eq('user_id', profile.user_id)
        .eq('is_active', true)
        .maybeSingle();

      if (orgAffiliate) {
        // Buscar checkouts vinculados via checkout_affiliate_links
        const { data: affiliateLinks } = await supabase
          .from('checkout_affiliate_links')
          .select(`
            checkout_id,
            commission_type,
            commission_value,
            checkout:standalone_checkouts(
              id,
              name,
              slug,
              attribution_model,
              is_active,
              product_id
            )
          `)
          .eq('affiliate_id', orgAffiliate.id);

        if (affiliateLinks && affiliateLinks.length > 0) {
          // Buscar produtos para os checkouts
          const productIds = affiliateLinks
            .map(al => (al.checkout as { product_id: string } | null)?.product_id)
            .filter(Boolean) as string[];

          const { data: products } = productIds.length > 0
            ? await supabase
                .from('lead_products')
                .select('id, name, images')
                .in('id', productIds)
            : { data: [] as { id: string; name: string; images: string[] | null }[] };

          type ProductInfo = { id: string; name: string; images: string[] | null };
          const productMap = new Map<string, ProductInfo>();
          for (const p of (products || []) as ProductInfo[]) {
            productMap.set(p.id, p);
          }

          const offers: AvailableOffer[] = [];
          for (const link of affiliateLinks) {
            const checkout = link.checkout as {
              id: string;
              name: string;
              slug: string;
              attribution_model: string;
              is_active: boolean;
              product_id: string | null;
            } | null;

            if (!checkout || !checkout.is_active) continue;

            const product = checkout.product_id ? productMap.get(checkout.product_id) : null;
            offers.push({
              id: checkout.id,
              type: 'checkout',
              name: checkout.name,
              slug: checkout.slug,
              attribution_model: checkout.attribution_model || 'last_click',
              product_name: product?.name,
              product_image: product?.images?.[0],
              is_enrolled: true,
              affiliate_link: `${window.location.origin}/pay/${checkout.slug}?ref=${orgAffiliate.affiliate_code}`,
            });
          }

          if (offers.length > 0) {
            return offers;
          }
        }
      }

      // 2. Fallback: Sistema antigo via partner_associations
      // Buscar a conta virtual do usuário
      const { data: virtualAccount } = await supabase
        .from('virtual_accounts')
        .select('id, organization_id')
        .eq('user_id', profile.user_id)
        .maybeSingle();

      if (!virtualAccount) return [];

      // Buscar TODAS as associações do afiliado para determinar organization_id
      const { data: allAssociations } = await supabase
        .from('partner_associations')
        .select('id, affiliate_code, commission_type, commission_value, organization_id, linked_checkout_id, linked_landing_id')
        .eq('virtual_account_id', virtualAccount.id)
        .eq('partner_type', 'affiliate')
        .eq('is_active', true);

      if (!allAssociations || allAssociations.length === 0) return [];

      // Get organization_id from association (more reliable than virtual_account.organization_id for partners)
      const organizationId = allAssociations[0].organization_id;
      if (!organizationId) return [];

      // Buscar associação geral (sem vínculo específico)
      const myAssociation = allAssociations.find(a => !a.linked_checkout_id && !a.linked_landing_id);
      
      // Buscar vínculos específicos do afiliado
      const linkedCheckoutIds = new Set(allAssociations.map(l => l.linked_checkout_id).filter(Boolean));
      const linkedLandingIds = new Set(allAssociations.map(l => l.linked_landing_id).filter(Boolean));

      // Buscar checkouts disponíveis
      const { data: checkouts } = await supabase
        .from('standalone_checkouts')
        .select('id, name, slug, attribution_model, product_id')
        .eq('organization_id', organizationId)
        .eq('is_active', true);

      // Buscar produtos separadamente para evitar problemas de FK
      const checkoutProductIds = (checkouts || [])
        .map(c => c.product_id)
        .filter(Boolean) as string[];
      
      const { data: checkoutProducts } = checkoutProductIds.length > 0
        ? await supabase
            .from('lead_products')
            .select('id, name, images')
            .in('id', checkoutProductIds)
        : { data: [] as { id: string; name: string; images: string[] | null }[] };

      type ProductInfo2 = { id: string; name: string; images: string[] | null };
      const checkoutProductMap = new Map<string, ProductInfo2>();
      for (const p of (checkoutProducts || []) as ProductInfo2[]) {
        checkoutProductMap.set(p.id, p);
      }

      // Buscar landing pages disponíveis
      const { data: landings } = await supabase
        .from('landing_pages')
        .select('id, name, slug, attribution_model')
        .eq('organization_id', organizationId)
        .eq('is_active', true);

      const offers: AvailableOffer[] = [];
      // Use first available affiliate code for building links
      const affiliateCode = allAssociations[0]?.affiliate_code;

      // CORRIGIDO: Afiliados individuais só veem ofertas EXPLICITAMENTE vinculadas
      // Não mostrar tudo automaticamente só porque tem associação geral
      
      // Adicionar checkouts - APENAS os que têm vínculo específico
      for (const checkout of checkouts || []) {
        const specificAssoc = allAssociations.find(l => l.linked_checkout_id === checkout.id);
        if (!specificAssoc) continue; // Pular se não tem vínculo específico
        
        const code = specificAssoc.affiliate_code || affiliateCode;
        const product = checkout.product_id ? checkoutProductMap.get(checkout.product_id) : null;
        
        offers.push({
          id: checkout.id,
          type: 'checkout',
          name: checkout.name,
          slug: checkout.slug,
          attribution_model: checkout.attribution_model || 'last_click',
          product_name: product?.name,
          product_image: product?.images?.[0],
          is_enrolled: true,
          affiliate_link: code 
            ? `${window.location.origin}/pay/${checkout.slug}?ref=${code}`
            : undefined,
        });
      }

      // Adicionar landings - APENAS as que têm vínculo específico
      for (const landing of landings || []) {
        const specificAssoc = allAssociations.find(l => l.linked_landing_id === landing.id);
        if (!specificAssoc) continue; // Pular se não tem vínculo específico
        
        const code = specificAssoc.affiliate_code || affiliateCode;
        
        offers.push({
          id: landing.id,
          type: 'landing',
          name: landing.name,
          slug: landing.slug,
          attribution_model: landing.attribution_model || 'last_click',
          is_enrolled: true,
          affiliate_link: code 
            ? `${window.location.origin}/l/${landing.slug}?ref=${code}`
            : undefined,
        });
      }

      return offers;
    },
    enabled: !!profile?.user_id,
  });
}

/**
 * Hook para buscar o código de afiliado V2 (organization_affiliates) do usuário logado.
 * Retorna o código AFF... mais recente, priorizando o sistema V2 sobre o legado.
 */
export function useMyAffiliateCode() {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['my-affiliate-code-v2', profile?.user_id],
    queryFn: async () => {
      if (!profile?.user_id) return null;

      // 1. Tentar buscar do sistema V2 (organization_affiliates)
      const { data: orgAffiliate } = await supabase
        .from('organization_affiliates')
        .select('affiliate_code, email, name')
        .eq('user_id', profile.user_id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (orgAffiliate?.affiliate_code) {
        return {
          code: orgAffiliate.affiliate_code,
          source: 'v2' as const,
          email: orgAffiliate.email,
          name: orgAffiliate.name,
        };
      }

      // 2. Fallback: buscar do sistema legado (partner_associations via virtual_accounts)
      const { data: virtualAccount } = await supabase
        .from('virtual_accounts')
        .select('id')
        .eq('user_id', profile.user_id)
        .maybeSingle();

      if (!virtualAccount) return null;

      const { data: legacyAssoc } = await supabase
        .from('partner_associations')
        .select('affiliate_code')
        .eq('virtual_account_id', virtualAccount.id)
        .eq('partner_type', 'affiliate')
        .eq('is_active', true)
        .not('affiliate_code', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (legacyAssoc?.affiliate_code) {
        return {
          code: legacyAssoc.affiliate_code,
          source: 'legacy' as const,
          email: null,
          name: null,
        };
      }

      return null;
    },
    enabled: !!profile?.user_id,
    staleTime: 5 * 60 * 1000,
  });
}
