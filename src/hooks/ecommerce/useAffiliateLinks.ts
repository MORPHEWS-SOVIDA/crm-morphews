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
        .select(`
          id, 
          name, 
          slug, 
          attribution_model,
          product:lead_products(name, images)
        `)
        .eq('organization_id', organizationId)
        .eq('is_active', true);

      // Buscar landing pages disponíveis
      const { data: landings } = await supabase
        .from('landing_pages')
        .select('id, name, slug, attribution_model')
        .eq('organization_id', organizationId)
        .eq('is_active', true);

      const offers: AvailableOffer[] = [];
      const affiliateCode = myAssociation?.affiliate_code || allAssociations[0]?.affiliate_code;

      // Adicionar checkouts
      for (const checkout of checkouts || []) {
        const isEnrolled = linkedCheckoutIds.has(checkout.id);
        const specificAssoc = allAssociations.find(l => l.linked_checkout_id === checkout.id);
        const code = specificAssoc?.affiliate_code || affiliateCode;
        
        offers.push({
          id: checkout.id,
          type: 'checkout',
          name: checkout.name,
          slug: checkout.slug,
          attribution_model: checkout.attribution_model || 'last_click',
          product_name: (checkout.product as any)?.name,
          product_image: (checkout.product as any)?.images?.[0],
          is_enrolled: isEnrolled || !!myAssociation, // Se tem associação geral, pode promover qualquer um
          affiliate_link: code 
            ? `${window.location.origin}/pay/${checkout.slug}?ref=${code}`
            : undefined,
        });
      }

      // Adicionar landings
      for (const landing of landings || []) {
        const isEnrolled = linkedLandingIds.has(landing.id);
        const specificAssoc = allAssociations.find(l => l.linked_landing_id === landing.id);
        const code = specificAssoc?.affiliate_code || affiliateCode;
        
        offers.push({
          id: landing.id,
          type: 'landing',
          name: landing.name,
          slug: landing.slug,
          attribution_model: landing.attribution_model || 'last_click',
          is_enrolled: isEnrolled || !!myAssociation,
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
