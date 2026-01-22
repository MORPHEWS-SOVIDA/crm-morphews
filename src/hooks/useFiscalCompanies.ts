import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

// Note: Using 'any' type assertions until Supabase types are regenerated after migration

// =============================================================================
// TYPES
// =============================================================================

export interface FiscalCompany {
  id: string;
  organization_id: string;
  company_name: string;
  trade_name: string | null;
  cnpj: string;
  state_registration: string | null;
  municipal_registration: string | null;
  address_street: string | null;
  address_number: string | null;
  address_complement: string | null;
  address_neighborhood: string | null;
  address_city: string | null;
  address_city_code: string | null;
  address_state: string | null;
  address_zip: string | null;
  phone: string | null;
  email: string | null;
  tax_regime: 'simples_nacional' | 'lucro_presumido' | 'lucro_real';
  certificate_file_path: string | null;
  certificate_password_encrypted: string | null;
  is_primary: boolean;
  is_active: boolean;
  focus_nfe_company_id: string | null;
  default_cfop_internal: string;
  default_cfop_interstate: string;
  default_cst: string;
  nfse_municipal_code: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateFiscalCompanyData {
  company_name: string;
  trade_name?: string;
  cnpj: string;
  state_registration?: string;
  municipal_registration?: string;
  address_street?: string;
  address_number?: string;
  address_complement?: string;
  address_neighborhood?: string;
  address_city?: string;
  address_city_code?: string;
  address_state?: string;
  address_zip?: string;
  phone?: string;
  email?: string;
  tax_regime?: 'simples_nacional' | 'lucro_presumido' | 'lucro_real';
  is_primary?: boolean;
  default_cfop_internal?: string;
  default_cfop_interstate?: string;
  default_cst?: string;
  nfse_municipal_code?: string;
}

export type UpdateFiscalCompanyData = Partial<CreateFiscalCompanyData> & {
  certificate_file_path?: string;
  certificate_password_encrypted?: string;
  is_active?: boolean;
  focus_nfe_company_id?: string;
};

// =============================================================================
// HELPERS
// =============================================================================

function formatCNPJ(cnpj: string): string {
  const digits = cnpj.replace(/\D/g, '');
  if (digits.length !== 14) return cnpj;
  return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
}

function cleanCNPJ(cnpj: string): string {
  return cnpj.replace(/\D/g, '');
}

export { formatCNPJ, cleanCNPJ };

// =============================================================================
// HOOKS
// =============================================================================

export function useFiscalCompanies() {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['fiscal-companies', profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return [];

      const { data, error } = await (supabase as any)
        .from('fiscal_companies')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .order('is_primary', { ascending: false })
        .order('company_name');

      if (error) throw error;
      return data as FiscalCompany[];
    },
    enabled: !!profile?.organization_id,
  });
}

export function useFiscalCompany(id: string | undefined) {
  return useQuery({
    queryKey: ['fiscal-company', id],
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await (supabase as any)
        .from('fiscal_companies')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as FiscalCompany;
    },
    enabled: !!id,
  });
}

export function usePrimaryFiscalCompany() {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['fiscal-company-primary', profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return null;

      const { data, error } = await (supabase as any)
        .from('fiscal_companies')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .eq('is_primary', true)
        .eq('is_active', true)
        .maybeSingle();

      if (error) throw error;
      return data as FiscalCompany | null;
    },
    enabled: !!profile?.organization_id,
  });
}

export function useCreateFiscalCompany() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async (data: CreateFiscalCompanyData) => {
      if (!profile?.organization_id) throw new Error('Organização não encontrada');

      const cleanedData = {
        ...data,
        cnpj: cleanCNPJ(data.cnpj),
        organization_id: profile.organization_id,
      };

      // If this is the first company or marked as primary, ensure only one primary
      if (data.is_primary) {
        await (supabase as any)
          .from('fiscal_companies')
          .update({ is_primary: false })
          .eq('organization_id', profile.organization_id);
      }

      const { data: result, error } = await (supabase as any)
        .from('fiscal_companies')
        .insert(cleanedData)
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          throw new Error('Já existe uma empresa com este CNPJ cadastrada');
        }
        throw error;
      }

      return result as FiscalCompany;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fiscal-companies'] });
      queryClient.invalidateQueries({ queryKey: ['fiscal-company-primary'] });
      toast({ title: 'Empresa fiscal cadastrada com sucesso!' });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao cadastrar empresa',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useUpdateFiscalCompany() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateFiscalCompanyData }) => {
      const updateData = { ...data };
      if (data.cnpj) {
        updateData.cnpj = cleanCNPJ(data.cnpj);
      }

      // If setting as primary, unset others
      if (data.is_primary && profile?.organization_id) {
        await (supabase as any)
          .from('fiscal_companies')
          .update({ is_primary: false })
          .eq('organization_id', profile.organization_id)
          .neq('id', id);
      }

      const { data: result, error } = await (supabase as any)
        .from('fiscal_companies')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return result as FiscalCompany;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['fiscal-companies'] });
      queryClient.invalidateQueries({ queryKey: ['fiscal-company', id] });
      queryClient.invalidateQueries({ queryKey: ['fiscal-company-primary'] });
      toast({ title: 'Empresa fiscal atualizada!' });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao atualizar empresa',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useDeleteFiscalCompany() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from('fiscal_companies')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fiscal-companies'] });
      queryClient.invalidateQueries({ queryKey: ['fiscal-company-primary'] });
      toast({ title: 'Empresa fiscal removida!' });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao remover empresa',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// =============================================================================
// CERTIFICATE UPLOAD
// =============================================================================

export function useUploadCertificate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      companyId,
      file,
      password,
    }: {
      companyId: string;
      file: File;
      password: string;
    }) => {
      // Upload file to storage
      const filePath = `${companyId}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('fiscal-certificates')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Update company with file path and encrypted password
      // Note: In production, password should be encrypted server-side
      const { error: updateError } = await (supabase as any)
        .from('fiscal_companies')
        .update({
          certificate_file_path: filePath,
          certificate_password_encrypted: password, // TODO: Encrypt in edge function
        })
        .eq('id', companyId);

      if (updateError) throw updateError;

      return { filePath };
    },
    onSuccess: (_, { companyId }) => {
      queryClient.invalidateQueries({ queryKey: ['fiscal-companies'] });
      queryClient.invalidateQueries({ queryKey: ['fiscal-company', companyId] });
      toast({ title: 'Certificado enviado com sucesso!' });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao enviar certificado',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// =============================================================================
// WEBHOOK REGISTRATION
// =============================================================================

export function useRegisterWebhooks() {
  return useMutation({
    mutationFn: async ({
      fiscalCompanyId,
      events = ['nfe', 'nfse'],
    }: {
      fiscalCompanyId: string;
      events?: string[];
    }) => {
      const { data, error } = await supabase.functions.invoke('focus-nfe-register-hooks', {
        body: { fiscal_company_id: fiscalCompanyId, events },
      });

      if (error) throw error;
      if (!data?.success) {
        throw new Error(data?.results?.[0]?.error || 'Falha ao registrar webhooks');
      }

      return data;
    },
    onSuccess: () => {
      toast({ title: 'Webhooks registrados com sucesso!' });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao registrar webhooks',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
