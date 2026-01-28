import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEcommerceOrganizationId } from './useEcommerceOrganizationId';
import { toast } from 'sonner';

// =============================================================================
// TYPES
// =============================================================================

export interface OrganizationAffiliate {
  id: string;
  organization_id: string;
  email: string;
  name: string;
  phone: string | null;
  affiliate_code: string;
  default_commission_type: 'percentage' | 'fixed';
  default_commission_value: number;
  is_active: boolean;
  user_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CheckoutAffiliateLink {
  id: string;
  checkout_id: string;
  affiliate_id: string;
  organization_id: string;
  commission_type: 'percentage' | 'fixed';
  commission_value: number;
  created_at: string;
  affiliate?: OrganizationAffiliate;
}

// =============================================================================
// HOOKS
// =============================================================================

/**
 * Buscar todos os afiliados da organização
 */
export function useOrganizationAffiliatesV2() {
  const { data: organizationId } = useEcommerceOrganizationId();

  return useQuery({
    queryKey: ['organization-affiliates-v2', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];

      const { data, error } = await supabase
        .from('organization_affiliates')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return (data || []) as OrganizationAffiliate[];
    },
    enabled: !!organizationId,
  });
}

/**
 * Buscar afiliados vinculados a um checkout específico
 */
export function useCheckoutAffiliatesV2(checkoutId: string | null) {
  const { data: organizationId } = useEcommerceOrganizationId();

  return useQuery({
    queryKey: ['checkout-affiliates-v2', organizationId, checkoutId],
    queryFn: async () => {
      if (!checkoutId || !organizationId) return [];

      // Buscar vínculos
      const { data: links, error: linksError } = await supabase
        .from('checkout_affiliate_links')
        .select('*')
        .eq('checkout_id', checkoutId);

      if (linksError) throw linksError;
      if (!links || links.length === 0) return [];

      // Buscar dados dos afiliados
      const affiliateIds = links.map(l => l.affiliate_id);
      const { data: affiliates, error: affError } = await supabase
        .from('organization_affiliates')
        .select('*')
        .in('id', affiliateIds);

      if (affError) throw affError;

      // Mapear afiliados aos links
      const affMap = new Map((affiliates || []).map(a => [a.id, a]));
      
      return links.map(link => ({
        ...link,
        affiliate: affMap.get(link.affiliate_id) || undefined,
      })) as CheckoutAffiliateLink[];
    },
    enabled: !!checkoutId && !!organizationId,
  });
}

/**
 * Criar um novo afiliado na organização
 */
export function useCreateAffiliate() {
  const queryClient = useQueryClient();
  const { data: organizationId } = useEcommerceOrganizationId();

  return useMutation({
    mutationFn: async ({
      email,
      name,
      phone,
      commissionType = 'percentage',
      commissionValue = 10,
    }: {
      email: string;
      name: string;
      phone?: string;
      commissionType?: 'percentage' | 'fixed';
      commissionValue?: number;
    }) => {
      if (!organizationId) throw new Error('Organização não encontrada');

      // Verificar se já existe afiliado com este email
      const { data: existing } = await supabase
        .from('organization_affiliates')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('email', email.toLowerCase().trim())
        .maybeSingle();

      if (existing) {
        throw new Error('Já existe um afiliado cadastrado com este e-mail');
      }

      const { data, error } = await supabase
        .from('organization_affiliates')
        .insert({
          organization_id: organizationId,
          email: email.toLowerCase().trim(),
          name: name.trim(),
          phone: phone?.trim() || null,
          default_commission_type: commissionType,
          default_commission_value: commissionValue,
          affiliate_code: '', // Será gerado pelo trigger
        })
        .select()
        .single();

      if (error) throw error;
      return data as OrganizationAffiliate;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization-affiliates-v2'] });
      toast.success('Afiliado cadastrado com sucesso!');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao cadastrar afiliado');
    },
  });
}

/**
 * Vincular um afiliado a um checkout
 */
export function useLinkAffiliateToCheckoutV2() {
  const queryClient = useQueryClient();
  const { data: organizationId } = useEcommerceOrganizationId();

  return useMutation({
    mutationFn: async ({
      affiliateId,
      checkoutId,
      commissionType,
      commissionValue,
    }: {
      affiliateId: string;
      checkoutId: string;
      commissionType?: 'percentage' | 'fixed';
      commissionValue?: number;
    }) => {
      if (!organizationId) throw new Error('Organização não encontrada');

      // Buscar dados do afiliado para comissão padrão
      const { data: affiliate } = await supabase
        .from('organization_affiliates')
        .select('default_commission_type, default_commission_value')
        .eq('id', affiliateId)
        .single();

      const { data, error } = await supabase
        .from('checkout_affiliate_links')
        .insert({
          checkout_id: checkoutId,
          affiliate_id: affiliateId,
          organization_id: organizationId,
          commission_type: commissionType || affiliate?.default_commission_type || 'percentage',
          commission_value: commissionValue ?? affiliate?.default_commission_value ?? 10,
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          throw new Error('Este afiliado já está vinculado a este checkout');
        }
        throw error;
      }
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['checkout-affiliates-v2', organizationId, variables.checkoutId] });
      toast.success('Afiliado vinculado ao checkout!');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao vincular afiliado');
    },
  });
}

/**
 * Desvincular afiliado de um checkout
 */
export function useUnlinkAffiliateFromCheckoutV2() {
  const queryClient = useQueryClient();
  const { data: organizationId } = useEcommerceOrganizationId();

  return useMutation({
    mutationFn: async ({ linkId, checkoutId }: { linkId: string; checkoutId: string }) => {
      const { error } = await supabase
        .from('checkout_affiliate_links')
        .delete()
        .eq('id', linkId);

      if (error) throw error;
      return { checkoutId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['checkout-affiliates-v2', organizationId, data.checkoutId] });
      toast.success('Afiliado removido do checkout');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao remover afiliado');
    },
  });
}

/**
 * Buscar afiliado por email (para adicionar existente)
 */
export function useFindAffiliateByEmail() {
  const { data: organizationId } = useEcommerceOrganizationId();

  return useMutation({
    mutationFn: async (email: string): Promise<OrganizationAffiliate | null> => {
      if (!organizationId) throw new Error('Organização não encontrada');

      const { data, error } = await supabase
        .from('organization_affiliates')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('email', email.toLowerCase().trim())
        .maybeSingle();

      if (error) throw error;
      return data as OrganizationAffiliate | null;
    },
  });
}

/**
 * Atualizar comissão de um afiliado vinculado ao checkout
 */
export function useUpdateCheckoutAffiliateCommission() {
  const queryClient = useQueryClient();
  const { data: organizationId } = useEcommerceOrganizationId();

  return useMutation({
    mutationFn: async ({
      linkId,
      checkoutId,
      commissionType,
      commissionValue,
    }: {
      linkId: string;
      checkoutId: string;
      commissionType: 'percentage' | 'fixed';
      commissionValue: number;
    }) => {
      const { error } = await supabase
        .from('checkout_affiliate_links')
        .update({
          commission_type: commissionType,
          commission_value: commissionValue,
        })
        .eq('id', linkId);

      if (error) throw error;
      return { checkoutId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['checkout-affiliates-v2', organizationId, data.checkoutId] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao atualizar comissão');
    },
  });
}
