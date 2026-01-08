import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface ProductBrand {
  id: string;
  name: string;
  organization_id: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function useProductBrands() {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['product-brands', profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return [];

      const { data, error } = await supabase
        .from('product_brands')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return data as ProductBrand[];
    },
    enabled: !!profile?.organization_id,
  });
}

export function useCreateProductBrand() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async (name: string) => {
      if (!profile?.organization_id) throw new Error('Organização não encontrada');

      const { data, error } = await supabase
        .from('product_brands')
        .insert({
          name: name.trim(),
          organization_id: profile.organization_id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-brands'] });
      toast.success('Marca criada com sucesso!');
    },
    onError: (error: Error) => {
      console.error('Erro ao criar marca:', error);
      if (error.message.includes('duplicate') || error.message.includes('unique')) {
        toast.error('Já existe uma marca com este nome');
      } else {
        toast.error('Erro ao criar marca');
      }
    },
  });
}

export function useUpdateProductBrand() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { data, error } = await supabase
        .from('product_brands')
        .update({ name: name.trim(), updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-brands'] });
      toast.success('Marca atualizada!');
    },
    onError: (error: Error) => {
      console.error('Erro ao atualizar marca:', error);
      toast.error('Erro ao atualizar marca');
    },
  });
}

export function useDeleteProductBrand() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // Soft delete - just mark as inactive
      const { error } = await supabase
        .from('product_brands')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-brands'] });
      toast.success('Marca removida!');
    },
    onError: (error: Error) => {
      console.error('Erro ao remover marca:', error);
      toast.error('Erro ao remover marca');
    },
  });
}
