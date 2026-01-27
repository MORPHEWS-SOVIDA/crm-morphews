import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { PartnerType, CommissionType } from './usePartners';

export interface PartnerPublicLink {
  id: string;
  organization_id: string;
  created_by: string | null;
  slug: string;
  name: string;
  partner_type: PartnerType;
  commission_type: CommissionType;
  commission_value: number;
  responsible_for_refunds: boolean;
  responsible_for_chargebacks: boolean;
  linked_product_id: string | null;
  linked_landing_id: string | null;
  linked_checkout_id: string | null;
  is_active: boolean;
  expires_at: string | null;
  max_registrations: number | null;
  registrations_count: number;
  created_at: string;
  updated_at: string;
}

export interface PartnerApplication {
  id: string;
  organization_id: string;
  public_link_id: string;
  name: string;
  email: string;
  whatsapp: string | null;
  document: string | null;
  partner_type: PartnerType;
  commission_type: CommissionType;
  commission_value: number;
  responsible_for_refunds: boolean;
  responsible_for_chargebacks: boolean;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  accepted_by_user_id: string | null;
  virtual_account_id: string | null;
  partner_association_id: string | null;
  created_at: string;
  updated_at: string;
  public_link?: PartnerPublicLink;
}

// Buscar links públicos da organização
export function usePartnerPublicLinks() {
  return useQuery({
    queryKey: ['partner-public-links'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('partner_public_links')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as PartnerPublicLink[];
    },
  });
}

// Criar link público
export function useCreatePartnerPublicLink() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async (input: {
      slug: string;
      name: string;
      partner_type: PartnerType;
      commission_type: CommissionType;
      commission_value: number;
      responsible_for_refunds: boolean;
      responsible_for_chargebacks: boolean;
      linked_product_id?: string;
      expires_at?: string;
      max_registrations?: number;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      if (!profile?.organization_id) throw new Error('Organização não encontrada');

      // Verificar se slug já existe
      const { data: existing } = await supabase
        .from('partner_public_links')
        .select('id')
        .eq('organization_id', profile.organization_id)
        .eq('slug', input.slug)
        .maybeSingle();

      if (existing) {
        throw new Error('Este slug já está em uso. Escolha outro.');
      }

      const { data, error } = await supabase
        .from('partner_public_links')
        .insert({
          organization_id: profile.organization_id,
          created_by: user.id,
          slug: input.slug.toLowerCase().replace(/[^a-z0-9-]/g, ''),
          name: input.name,
          partner_type: input.partner_type,
          commission_type: input.commission_type,
          commission_value: input.commission_value,
          responsible_for_refunds: input.responsible_for_refunds,
          responsible_for_chargebacks: input.responsible_for_chargebacks,
          linked_product_id: input.linked_product_id || null,
          expires_at: input.expires_at || null,
          max_registrations: input.max_registrations || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data as PartnerPublicLink;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partner-public-links'] });
    },
  });
}

// Atualizar link público
export function useUpdatePartnerPublicLink() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<PartnerPublicLink> & { id: string }) => {
      const { data, error } = await supabase
        .from('partner_public_links')
        .update({ ...input, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as PartnerPublicLink;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partner-public-links'] });
    },
  });
}

// Deletar link público
export function useDeletePartnerPublicLink() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('partner_public_links')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partner-public-links'] });
    },
  });
}

// Buscar solicitações de parceria
export function usePartnerApplications() {
  return useQuery({
    queryKey: ['partner-applications'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('partner_applications')
        .select(`
          *,
          public_link:partner_public_links(id, name, slug)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as PartnerApplication[];
    },
  });
}

// Aprovar solicitação
export function useApprovePartnerApplication() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (applicationId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { data, error } = await supabase
        .rpc('approve_partner_application', {
          p_application_id: applicationId,
          p_reviewer_id: user.id,
        });

      if (error) throw error;
      
      const result = data as { 
        success: boolean; 
        error?: string; 
        needs_user_creation?: boolean;
        email?: string;
        name?: string;
        whatsapp?: string;
        temp_password?: string;
        org_name?: string;
        affiliate_code?: string;
      };
      
      if (!result.success) {
        throw new Error(result.error || 'Erro ao aprovar solicitação');
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partner-applications'] });
      queryClient.invalidateQueries({ queryKey: ['partner-associations'] });
    },
  });
}

// Rejeitar solicitação
export function useRejectPartnerApplication() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ applicationId, reason }: { applicationId: string; reason?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { error } = await supabase
        .from('partner_applications')
        .update({
          status: 'rejected',
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          rejection_reason: reason || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', applicationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partner-applications'] });
    },
  });
}

// Buscar link público por slug (para página pública)
export function usePublicLinkBySlug(slug: string | undefined) {
  return useQuery({
    queryKey: ['partner-public-link', slug],
    queryFn: async () => {
      if (!slug) return null;

      const { data, error } = await supabase
        .rpc('get_partner_public_link', { p_slug: slug });

      if (error) throw error;
      
      const result = data as { 
        success: boolean; 
        error?: string; 
        link?: {
          id: string;
          organization_id: string;
          organization_name: string;
          name: string;
          partner_type: PartnerType;
          commission_type: CommissionType;
          commission_value: number;
        };
      };
      
      if (!result.success) {
        return null;
      }

      return result.link;
    },
    enabled: !!slug,
  });
}

// Criar solicitação de parceria (página pública)
export function useCreatePartnerApplication() {
  return useMutation({
    mutationFn: async (input: {
      public_link_id: string;
      organization_id: string;
      name: string;
      email: string;
      whatsapp?: string;
      document?: string;
      partner_type: PartnerType;
      commission_type: CommissionType;
      commission_value: number;
      responsible_for_refunds: boolean;
      responsible_for_chargebacks: boolean;
    }) => {
      // For public/anonymous submissions, we don't use .select().single()
      // because anonymous users don't have SELECT permission on this table
      // IMPORTANT: Public submit goes through a backend function to avoid RLS/RETURNING issues
      // and keep partner_applications unreadable for anonymous users.
      const { data, error } = await supabase.functions.invoke('partner-apply-public', {
        body: {
          public_link_id: input.public_link_id,
          name: input.name,
          email: input.email,
          whatsapp: input.whatsapp || null,
          document: input.document || null,
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Erro ao enviar solicitação');
      return { success: true };
    },
  });
}
