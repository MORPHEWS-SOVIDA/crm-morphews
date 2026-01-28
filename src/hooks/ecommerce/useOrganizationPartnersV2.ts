import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEcommerceOrganizationId } from './useEcommerceOrganizationId';
import { toast } from 'sonner';

// =============================================================================
// TYPES
// =============================================================================

export type PartnerType = 'industry' | 'factory' | 'coproducer';

export interface OrganizationPartner {
  id: string; // virtual_account_id
  organization_id: string;
  email: string;
  name: string;
  phone: string | null;
  partner_type: PartnerType;
  default_commission_type: 'percentage' | 'fixed';
  default_commission_value: number;
  is_active: boolean;
  virtual_account_id: string;
  association_id: string; // partner_associations.id
}

export interface CheckoutPartnerLink {
  id: string;
  checkout_id: string;
  partner_type: PartnerType;
  virtual_account_id: string;
  organization_id: string;
  commission_type: 'percentage' | 'fixed';
  commission_value: number;
  partner?: OrganizationPartner;
}

// =============================================================================
// HOOKS - BUSCAR PARCEIROS DA ORGANIZAÇÃO
// =============================================================================

/**
 * Buscar todos os parceiros de um tipo específico na organização
 */
export function useOrganizationPartnersV2(partnerType: PartnerType) {
  const { data: organizationId } = useEcommerceOrganizationId();

  return useQuery({
    queryKey: ['organization-partners-v2', organizationId, partnerType],
    queryFn: async () => {
      if (!organizationId) return [];

      // Buscar partner_associations com virtual_accounts
      const { data, error } = await supabase
        .from('partner_associations')
        .select(`
          id,
          virtual_account_id,
          partner_type,
          commission_type,
          commission_value,
          is_active,
          virtual_accounts (
            id,
            holder_name,
            holder_email,
            organization_id
          )
        `)
        .eq('organization_id', organizationId)
        .eq('partner_type', partnerType)
        .eq('is_active', true)
        .is('linked_checkout_id', null); // Apenas parceiros "base" (não vinculados a checkout específico)

      if (error) throw error;

      // Deduplicar por virtual_account_id
      const uniqueMap = new Map<string, OrganizationPartner>();
      for (const item of data || []) {
        if (!uniqueMap.has(item.virtual_account_id)) {
          uniqueMap.set(item.virtual_account_id, {
            id: item.virtual_account_id,
            organization_id: organizationId,
            email: item.virtual_accounts?.holder_email || '',
            name: item.virtual_accounts?.holder_name || 'Sem nome',
            phone: null,
            partner_type: item.partner_type as PartnerType,
            default_commission_type: item.commission_type as 'percentage' | 'fixed',
            default_commission_value: Number(item.commission_value) || 0,
            is_active: item.is_active ?? true,
            virtual_account_id: item.virtual_account_id,
            association_id: item.id,
          });
        }
      }

      return Array.from(uniqueMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    },
    enabled: !!organizationId,
  });
}

/**
 * Buscar parceiro de um tipo específico vinculado a um checkout
 */
export function useCheckoutPartnerV2(checkoutId: string | null, partnerType: PartnerType) {
  const { data: organizationId } = useEcommerceOrganizationId();

  return useQuery({
    queryKey: ['checkout-partner-v2', organizationId, checkoutId, partnerType],
    queryFn: async () => {
      if (!checkoutId || !organizationId) return null;

      // Buscar vínculo específico do checkout
      const { data, error } = await supabase
        .from('partner_associations')
        .select(`
          id,
          virtual_account_id,
          partner_type,
          commission_type,
          commission_value,
          is_active,
          virtual_accounts (
            id,
            holder_name,
            holder_email
          )
        `)
        .eq('organization_id', organizationId)
        .eq('linked_checkout_id', checkoutId)
        .eq('partner_type', partnerType)
        .eq('is_active', true)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      return {
        id: data.id,
        checkout_id: checkoutId,
        partner_type: data.partner_type as PartnerType,
        virtual_account_id: data.virtual_account_id,
        organization_id: organizationId,
        commission_type: data.commission_type as 'percentage' | 'fixed',
        commission_value: Number(data.commission_value) || 0,
        partner: {
          id: data.virtual_account_id,
          organization_id: organizationId,
          email: data.virtual_accounts?.holder_email || '',
          name: data.virtual_accounts?.holder_name || 'Sem nome',
          phone: null,
          partner_type: data.partner_type as PartnerType,
          default_commission_type: data.commission_type as 'percentage' | 'fixed',
          default_commission_value: Number(data.commission_value) || 0,
          is_active: data.is_active ?? true,
          virtual_account_id: data.virtual_account_id,
          association_id: data.id,
        },
      } as CheckoutPartnerLink;
    },
    enabled: !!checkoutId && !!organizationId,
  });
}

// =============================================================================
// HOOKS - CRIAR PARCEIRO
// =============================================================================

/**
 * Criar um novo parceiro na organização
 */
export function useCreatePartner() {
  const queryClient = useQueryClient();
  const { data: organizationId } = useEcommerceOrganizationId();

  return useMutation({
    mutationFn: async ({
      email,
      name,
      phone,
      partnerType,
      commissionType = 'percentage',
      commissionValue = 10,
    }: {
      email: string;
      name: string;
      phone?: string;
      partnerType: PartnerType;
      commissionType?: 'percentage' | 'fixed';
      commissionValue?: number;
    }) => {
      if (!organizationId) throw new Error('Organização não encontrada');

      // 1. Verificar se já existe virtual_account com esse email
      const { data: existingAccount } = await supabase
        .from('virtual_accounts')
        .select('id')
        .eq('holder_email', email.toLowerCase().trim())
        .eq('organization_id', organizationId)
        .maybeSingle();

      let virtualAccountId: string;

      if (existingAccount) {
        virtualAccountId = existingAccount.id;
      } else {
        // 2. Criar virtual_account
        const accountType = partnerType === 'industry' ? 'industry' 
          : partnerType === 'factory' ? 'factory' 
          : 'coproducer';
          
        const { data: newAccount, error: accountError } = await supabase
          .from('virtual_accounts')
          .insert({
            organization_id: organizationId,
            account_type: accountType,
            holder_name: name.trim(),
            holder_email: email.toLowerCase().trim(),
            holder_document: null,
            balance_cents: 0,
            pending_balance_cents: 0,
          })
          .select('id')
          .single();

        if (accountError) throw accountError;
        virtualAccountId = newAccount.id;
      }

      // 3. Verificar se já existe partner_association deste tipo
      const { data: existingAssoc } = await supabase
        .from('partner_associations')
        .select('id')
        .eq('virtual_account_id', virtualAccountId)
        .eq('organization_id', organizationId)
        .eq('partner_type', partnerType)
        .is('linked_checkout_id', null)
        .maybeSingle();

      if (existingAssoc) {
        throw new Error(`Este parceiro já está cadastrado como ${partnerType}`);
      }

      // 4. Criar partner_association
      const { data: association, error: assocError } = await supabase
        .from('partner_associations')
        .insert({
          virtual_account_id: virtualAccountId,
          organization_id: organizationId,
          partner_type: partnerType,
          commission_type: commissionType,
          commission_value: commissionValue,
          is_active: true,
          linked_checkout_id: null, // Parceiro "base"
        })
        .select('id')
        .single();

      if (assocError) throw assocError;

      return {
        id: virtualAccountId,
        association_id: association.id,
        email: email.toLowerCase().trim(),
        name: name.trim(),
        partner_type: partnerType,
      };
    },
    onSuccess: (_, variables) => {
      toast.success('Parceiro cadastrado com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['organization-partners-v2'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao cadastrar parceiro');
    },
  });
}

// =============================================================================
// HOOKS - VINCULAR/DESVINCULAR PARCEIRO AO CHECKOUT
// =============================================================================

/**
 * Vincular um parceiro a um checkout específico
 */
export function useLinkPartnerToCheckout() {
  const queryClient = useQueryClient();
  const { data: organizationId } = useEcommerceOrganizationId();

  return useMutation({
    mutationFn: async ({
      virtualAccountId,
      checkoutId,
      partnerType,
      commissionType = 'percentage',
      commissionValue = 10,
    }: {
      virtualAccountId: string;
      checkoutId: string;
      partnerType: PartnerType;
      commissionType?: 'percentage' | 'fixed';
      commissionValue?: number;
    }) => {
      if (!organizationId) throw new Error('Organização não encontrada');

      // Remover vínculo anterior deste tipo neste checkout
      await supabase
        .from('partner_associations')
        .delete()
        .eq('organization_id', organizationId)
        .eq('linked_checkout_id', checkoutId)
        .eq('partner_type', partnerType);

      // Criar novo vínculo
      const { data, error } = await supabase
        .from('partner_associations')
        .insert({
          virtual_account_id: virtualAccountId,
          organization_id: organizationId,
          partner_type: partnerType,
          commission_type: commissionType,
          commission_value: commissionValue,
          is_active: true,
          linked_checkout_id: checkoutId,
        })
        .select('id')
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      toast.success('Parceiro vinculado com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['checkout-partner-v2'] });
      queryClient.invalidateQueries({ queryKey: ['organization-partners-v2'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao vincular parceiro');
    },
  });
}

/**
 * Remover vínculo de parceiro de um checkout
 */
export function useUnlinkPartnerFromCheckout() {
  const queryClient = useQueryClient();
  const { data: organizationId } = useEcommerceOrganizationId();

  return useMutation({
    mutationFn: async ({
      checkoutId,
      partnerType,
    }: {
      checkoutId: string;
      partnerType: PartnerType;
    }) => {
      if (!organizationId) throw new Error('Organização não encontrada');

      const { error } = await supabase
        .from('partner_associations')
        .delete()
        .eq('organization_id', organizationId)
        .eq('linked_checkout_id', checkoutId)
        .eq('partner_type', partnerType);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Parceiro desvinculado');
      queryClient.invalidateQueries({ queryKey: ['checkout-partner-v2'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao desvincular parceiro');
    },
  });
}

// =============================================================================
// HOOKS - BUSCAR PARCEIRO POR EMAIL
// =============================================================================

/**
 * Buscar parceiro por email na organização
 */
export function useFindPartnerByEmail() {
  const { data: organizationId } = useEcommerceOrganizationId();

  return useMutation({
    mutationFn: async ({ email, partnerType }: { email: string; partnerType: PartnerType }) => {
      if (!organizationId) throw new Error('Organização não encontrada');

      // Buscar virtual_account com esse email
      const { data: account, error } = await supabase
        .from('virtual_accounts')
        .select('id, holder_name, holder_email')
        .eq('holder_email', email.toLowerCase().trim())
        .eq('organization_id', organizationId)
        .maybeSingle();

      if (error) throw error;
      if (!account) return null;

      // Verificar se tem partner_association deste tipo
      const { data: assoc } = await supabase
        .from('partner_associations')
        .select('id, commission_type, commission_value')
        .eq('virtual_account_id', account.id)
        .eq('organization_id', organizationId)
        .eq('partner_type', partnerType)
        .is('linked_checkout_id', null)
        .maybeSingle();

      return {
        id: account.id,
        email: account.holder_email,
        name: account.holder_name,
        virtual_account_id: account.id,
        partner_type: partnerType,
        has_association: !!assoc,
        association_id: assoc?.id,
        default_commission_type: assoc?.commission_type as 'percentage' | 'fixed' || 'percentage',
        default_commission_value: Number(assoc?.commission_value) || 10,
      };
    },
  });
}

/**
 * Atualizar comissão de um parceiro vinculado ao checkout
 */
export function useUpdateCheckoutPartnerCommission() {
  const queryClient = useQueryClient();
  const { data: organizationId } = useEcommerceOrganizationId();

  return useMutation({
    mutationFn: async ({
      checkoutId,
      partnerType,
      commissionType,
      commissionValue,
    }: {
      checkoutId: string;
      partnerType: PartnerType;
      commissionType: 'percentage' | 'fixed';
      commissionValue: number;
    }) => {
      if (!organizationId) throw new Error('Organização não encontrada');

      const { error } = await supabase
        .from('partner_associations')
        .update({
          commission_type: commissionType,
          commission_value: commissionValue,
        })
        .eq('organization_id', organizationId)
        .eq('linked_checkout_id', checkoutId)
        .eq('partner_type', partnerType);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checkout-partner-v2'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao atualizar comissão');
    },
  });
}
