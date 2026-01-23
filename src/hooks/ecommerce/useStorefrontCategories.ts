import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface StorefrontCategory {
  id: string;
  storefront_id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  parent_id: string | null;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
  children?: StorefrontCategory[];
  products_count?: number;
}

export interface CreateCategoryInput {
  storefront_id: string;
  name: string;
  slug: string;
  description?: string;
  image_url?: string;
  parent_id?: string;
  is_active?: boolean;
  display_order?: number;
}

export function useStorefrontCategories(storefrontId: string | undefined) {
  return useQuery({
    queryKey: ['storefront-categories', storefrontId],
    enabled: !!storefrontId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('storefront_categories')
        .select(`
          *,
          products:storefront_product_categories(count)
        `)
        .eq('storefront_id', storefrontId)
        .order('display_order');
      
      if (error) throw error;
      
      // Build tree structure
      const categories = (data || []).map(cat => ({
        ...cat,
        products_count: cat.products?.[0]?.count || 0,
      })) as StorefrontCategory[];
      
      // Organize into tree
      const rootCategories = categories.filter(c => !c.parent_id);
      const childCategories = categories.filter(c => c.parent_id);
      
      return rootCategories.map(root => ({
        ...root,
        children: childCategories.filter(child => child.parent_id === root.id),
      }));
    },
  });
}

export function useFlatStorefrontCategories(storefrontId: string | undefined) {
  return useQuery({
    queryKey: ['storefront-categories-flat', storefrontId],
    enabled: !!storefrontId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('storefront_categories')
        .select('*')
        .eq('storefront_id', storefrontId)
        .order('display_order');
      
      if (error) throw error;
      return data as StorefrontCategory[];
    },
  });
}

export function useCreateStorefrontCategory() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (input: CreateCategoryInput) => {
      const { data, error } = await supabase
        .from('storefront_categories')
        .insert(input)
        .select()
        .single();
      
      if (error) {
        if (error.code === '23505') throw new Error('Já existe uma categoria com este slug');
        throw error;
      }
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['storefront-categories', variables.storefront_id] });
      queryClient.invalidateQueries({ queryKey: ['storefront-categories-flat', variables.storefront_id] });
      toast.success('Categoria criada!');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useUpdateStorefrontCategory() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, storefrontId, ...input }: Partial<StorefrontCategory> & { id: string; storefrontId: string }) => {
      const { data, error } = await supabase
        .from('storefront_categories')
        .update(input)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['storefront-categories', variables.storefrontId] });
      queryClient.invalidateQueries({ queryKey: ['storefront-categories-flat', variables.storefrontId] });
      toast.success('Categoria atualizada!');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useDeleteStorefrontCategory() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, storefrontId }: { id: string; storefrontId: string }) => {
      const { error } = await supabase
        .from('storefront_categories')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['storefront-categories', variables.storefrontId] });
      queryClient.invalidateQueries({ queryKey: ['storefront-categories-flat', variables.storefrontId] });
      toast.success('Categoria removida!');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

// Assign products to categories
export function useAssignProductToCategory() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ storefrontProductId, categoryId }: { storefrontProductId: string; categoryId: string }) => {
      const { data, error } = await supabase
        .from('storefront_product_categories')
        .insert({
          storefront_product_id: storefrontProductId,
          category_id: categoryId,
        })
        .select()
        .single();
      
      if (error) {
        if (error.code === '23505') throw new Error('Produto já está nesta categoria');
        throw error;
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['storefront-categories'] });
      queryClient.invalidateQueries({ queryKey: ['storefront-products'] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useRemoveProductFromCategory() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ storefrontProductId, categoryId }: { storefrontProductId: string; categoryId: string }) => {
      const { error } = await supabase
        .from('storefront_product_categories')
        .delete()
        .eq('storefront_product_id', storefrontProductId)
        .eq('category_id', categoryId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['storefront-categories'] });
      queryClient.invalidateQueries({ queryKey: ['storefront-products'] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useUpdateProductCategories() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ storefrontProductId, categoryIds, storefrontId }: { 
      storefrontProductId: string; 
      categoryIds: string[];
      storefrontId: string;
    }) => {
      // Remove all existing
      await supabase
        .from('storefront_product_categories')
        .delete()
        .eq('storefront_product_id', storefrontProductId);
      
      // Insert new ones
      if (categoryIds.length > 0) {
        const { error } = await supabase
          .from('storefront_product_categories')
          .insert(categoryIds.map(categoryId => ({
            storefront_product_id: storefrontProductId,
            category_id: categoryId,
          })));
        
        if (error) throw error;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['storefront-categories', variables.storefrontId] });
      queryClient.invalidateQueries({ queryKey: ['storefront-products'] });
      toast.success('Categorias atualizadas!');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}
