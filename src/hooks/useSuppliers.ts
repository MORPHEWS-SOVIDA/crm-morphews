import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface Supplier {
  id: string;
  organization_id: string;
  name: string;
  trade_name: string | null;
  cnpj: string | null;
  cpf: string | null;
  ie: string | null;
  im: string | null;
  email: string | null;
  phone: string | null;
  contact_name: string | null;
  cep: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  bank_name: string | null;
  bank_agency: string | null;
  bank_account: string | null;
  bank_account_type: string | null;
  pix_key: string | null;
  pix_key_type: string | null;
  cost_center_id: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
}

export function useSuppliers(activeOnly: boolean = true) {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['suppliers', activeOnly],
    queryFn: async () => {
      let query = supabase
        .from('suppliers')
        .select('*')
        .order('name');

      if (activeOnly) {
        query = query.eq('is_active', true);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Supplier[];
    },
    enabled: !!profile?.organization_id,
  });
}

export function useSupplier(id: string | null) {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['supplier', id],
    queryFn: async () => {
      if (!id) return null;
      
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as Supplier;
    },
    enabled: !!profile?.organization_id && !!id,
  });
}

export function useCreateSupplier() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async (data: Partial<Supplier>) => {
      const { data: result, error } = await supabase
        .from('suppliers')
        .insert({
          organization_id: profile!.organization_id,
          name: data.name!,
          trade_name: data.trade_name,
          cnpj: data.cnpj,
          cpf: data.cpf,
          ie: data.ie,
          im: data.im,
          email: data.email,
          phone: data.phone,
          contact_name: data.contact_name,
          cep: data.cep,
          street: data.street,
          number: data.number,
          complement: data.complement,
          neighborhood: data.neighborhood,
          city: data.city,
          state: data.state,
          bank_name: data.bank_name,
          bank_agency: data.bank_agency,
          bank_account: data.bank_account,
          bank_account_type: data.bank_account_type,
          pix_key: data.pix_key,
          pix_key_type: data.pix_key_type,
          notes: data.notes,
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      toast.success('Fornecedor criado');
    },
    onError: (error: Error) => {
      toast.error('Erro ao criar: ' + error.message);
    },
  });
}

export function useUpdateSupplier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<Supplier> & { id: string }) => {
      const { data: result, error } = await supabase
        .from('suppliers')
        .update({
          ...data,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      toast.success('Fornecedor atualizado');
    },
    onError: (error: Error) => {
      toast.error('Erro ao atualizar: ' + error.message);
    },
  });
}

export function useDeleteSupplier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('suppliers')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      toast.success('Fornecedor desativado');
    },
    onError: (error: Error) => {
      toast.error('Erro ao desativar: ' + error.message);
    },
  });
}
