import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useEcommerceOrganizationId } from '@/hooks/ecommerce/useEcommerceOrganizationId';

export type PartnerType = 'affiliate' | 'coproducer' | 'industry' | 'factory';
export type CommissionType = 'percentage' | 'fixed';

export interface PartnerInvitation {
  id: string;
  organization_id: string;
  invited_by: string | null;
  invite_code: string;
  partner_type: PartnerType;
  name: string;
  email: string;
  whatsapp: string | null;
  document: string | null;
  commission_type: CommissionType;
  commission_value: number;
  responsible_for_refunds: boolean;
  responsible_for_chargebacks: boolean;
  linked_product_id: string | null;
  linked_landing_id: string | null;
  linked_checkout_id: string | null;
  status: 'pending' | 'accepted' | 'expired' | 'cancelled';
  accepted_at: string | null;
  accepted_by_user_id: string | null;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

export interface PartnerAssociation {
  id: string;
  virtual_account_id: string;
  organization_id: string;
  partner_type: PartnerType;
  commission_type: CommissionType;
  commission_value: number;
  responsible_for_refunds: boolean;
  responsible_for_chargebacks: boolean;
  linked_product_id: string | null;
  linked_landing_id: string | null;
  linked_checkout_id: string | null;
  affiliate_code: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  virtual_account?: {
    id: string;
    user_id: string | null;
    holder_name: string;
    holder_email: string;
    holder_document: string | null;
    balance_cents: number;
    pending_balance_cents: number;
  };
  product?: {
    id: string;
    name: string;
  };
  organization?: {
    id: string;
    name: string;
  };
}

export function usePartnerInvitations() {
  return useQuery({
    queryKey: ['partner-invitations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('partner_invitations')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as PartnerInvitation[];
    },
  });
}

export function usePartnerAssociations(partnerType?: PartnerType) {
  const { data: organizationId } = useEcommerceOrganizationId();
  
  return useQuery({
    queryKey: ['partner-associations', partnerType, organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      
      // Query todos os parceiros da organização (sem filtro de vínculo)
      // A tela de gestão deve mostrar TODOS os parceiros, independente de onde estão vinculados
      let query = supabase
        .from('partner_associations')
        .select(`
          *,
          virtual_account:virtual_accounts(
            id, user_id, holder_name, holder_email, holder_document,
            balance_cents, pending_balance_cents
          ),
          product:lead_products(id, name),
          organization:organizations(id, name)
        `)
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (partnerType) {
        query = query.eq('partner_type', partnerType);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as unknown as PartnerAssociation[];
    },
    enabled: !!organizationId,
  });
}

export function useCreatePartnerInvitation() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async (input: {
      partner_type: PartnerType;
      name: string;
      email: string;
      whatsapp?: string;
      document?: string;
      commission_type: CommissionType;
      commission_value: number;
      responsible_for_refunds: boolean;
      responsible_for_chargebacks: boolean;
      linked_product_id?: string;
      linked_landing_id?: string;
      linked_checkout_id?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      if (!profile?.organization_id) throw new Error('Organização não encontrada');

      const { data, error } = await supabase
        .from('partner_invitations')
        .insert({
          organization_id: profile.organization_id,
          invited_by: user.id,
          partner_type: input.partner_type,
          name: input.name,
          email: input.email,
          whatsapp: input.whatsapp || null,
          document: input.document || null,
          commission_type: input.commission_type,
          commission_value: input.commission_value,
          responsible_for_refunds: input.responsible_for_refunds,
          responsible_for_chargebacks: input.responsible_for_chargebacks,
          linked_product_id: input.linked_product_id || null,
          linked_landing_id: input.linked_landing_id || null,
          linked_checkout_id: input.linked_checkout_id || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data as PartnerInvitation;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partner-invitations'] });
    },
  });
}

export function useCancelPartnerInvitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (invitationId: string) => {
      const { error } = await supabase
        .from('partner_invitations')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', invitationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partner-invitations'] });
    },
  });
}

export function useUpdatePartnerAssociation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: {
      id: string;
      commission_type?: CommissionType;
      commission_value?: number;
      responsible_for_refunds?: boolean;
      responsible_for_chargebacks?: boolean;
      is_active?: boolean;
    }) => {
      const { data, error } = await supabase
        .from('partner_associations')
        .update({ ...input, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partner-associations'] });
    },
  });
}

export function useDeletePartnerAssociation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (associationId: string) => {
      const { error } = await supabase
        .from('partner_associations')
        .delete()
        .eq('id', associationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partner-associations'] });
    },
  });
}

// Get invitation by code (for public accept page)
export function useInvitationByCode(code: string | null) {
  return useQuery({
    queryKey: ['partner-invitation', code],
    queryFn: async () => {
      if (!code) return null;

      const { data, error } = await supabase
        .from('partner_invitations')
        .select('*, organization:organizations(id, name)')
        .eq('invite_code', code)
        .eq('status', 'pending')
        .maybeSingle();

      if (error) throw error;
      return data as (PartnerInvitation & { organization: { id: string; name: string } }) | null;
    },
    enabled: !!code,
  });
}

// Accept invitation (after user creates account or logs in)
export function useAcceptInvitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (inviteCode: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { data, error } = await supabase
        .rpc('accept_partner_invitation', {
          p_invite_code: inviteCode,
          p_user_id: user.id,
        });

      if (error) throw error;
      
      const result = data as { success: boolean; error?: string; affiliate_code?: string };
      if (!result.success) {
        throw new Error(result.error || 'Erro ao aceitar convite');
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partner-associations'] });
      queryClient.invalidateQueries({ queryKey: ['partner-invitations'] });
    },
  });
}

// Get my partner associations (for partner portal)
export function useMyPartnerAssociations() {
  return useQuery({
    queryKey: ['my-partner-associations'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      // First get user's virtual account
      const { data: virtualAccounts, error: vaError } = await supabase
        .from('virtual_accounts')
        .select('id')
        .eq('user_id', user.id);

      if (vaError) throw vaError;
      if (!virtualAccounts?.length) return [];

      const vaIds = virtualAccounts.map(va => va.id);

      const { data, error } = await supabase
        .from('partner_associations')
        .select(`
          *,
          virtual_account:virtual_accounts(
            id, user_id, holder_name, holder_email, holder_document,
            balance_cents, pending_balance_cents
          ),
          product:lead_products(id, name),
          organization:organizations(id, name)
        `)
        .in('virtual_account_id', vaIds)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as unknown as PartnerAssociation[];
    },
  });
}

// Partner type labels
export const partnerTypeLabels: Record<PartnerType, string> = {
  affiliate: 'Afiliado',
  coproducer: 'Co-produtor',
  industry: 'Indústria',
  factory: 'Fábrica',
};

export const partnerTypeColors: Record<PartnerType, string> = {
  affiliate: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  coproducer: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300',
  industry: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  factory: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
};

export function formatCommission(type: CommissionType, value: number): string {
  if (type === 'percentage') {
    return `${value}%`;
  }
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value / 100);
}
