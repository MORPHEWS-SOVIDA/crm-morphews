import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface ProductUserVisibility {
  id: string;
  product_id: string;
  user_id: string;
  organization_id: string;
  created_at: string;
}

export function useProductVisibility(productId: string | undefined) {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['product-visibility', productId],
    queryFn: async () => {
      if (!productId || !profile?.organization_id) return [];

      const { data, error } = await supabase
        .from('product_user_visibility')
        .select('*')
        .eq('product_id', productId)
        .eq('organization_id', profile.organization_id);

      if (error) throw error;
      return data as ProductUserVisibility[];
    },
    enabled: !!productId && !!profile?.organization_id,
  });
}

export function useSaveProductVisibility() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async ({ 
      productId, 
      userIds 
    }: { 
      productId: string; 
      userIds: string[];
    }) => {
      if (!profile?.organization_id) throw new Error('Organização não encontrada');

      // Delete all existing visibility records for this product
      const { error: deleteError } = await supabase
        .from('product_user_visibility')
        .delete()
        .eq('product_id', productId)
        .eq('organization_id', profile.organization_id);

      if (deleteError) throw deleteError;

      // Insert new records if there are any users selected
      if (userIds.length > 0) {
        const records = userIds.map(userId => ({
          product_id: productId,
          user_id: userId,
          organization_id: profile.organization_id,
        }));

        const { error: insertError } = await supabase
          .from('product_user_visibility')
          .insert(records);

        if (insertError) throw insertError;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['product-visibility', variables.productId] });
      queryClient.invalidateQueries({ queryKey: ['products-for-user'] });
    },
  });
}

// Hook to get products visible to current user for sales
export function useProductsForCurrentUser() {
  const { profile, user } = useAuth();

  return useQuery({
    queryKey: ['products-for-user', profile?.organization_id, user?.id],
    queryFn: async () => {
      if (!profile?.organization_id || !user?.id) return [];

      // Get all products for the organization
      const { data: products, error: productsError } = await supabase
        .from('lead_products')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .eq('is_active', true)
        .order('name');

      if (productsError) throw productsError;

      // Get visibility restrictions for products that have them
      const { data: visibility, error: visibilityError } = await supabase
        .from('product_user_visibility')
        .select('product_id, user_id')
        .eq('organization_id', profile.organization_id);

      if (visibilityError) throw visibilityError;

      // Filter products based on visibility
      const filteredProducts = products.filter(product => {
        // If product is not restricted, everyone can see it
        if (!product.restrict_to_users) return true;

        // If restricted, check if current user is in the visibility list
        const productVisibility = visibility?.filter(v => v.product_id === product.id) || [];
        return productVisibility.some(v => v.user_id === user.id);
      });

      return filteredProducts;
    },
    enabled: !!profile?.organization_id && !!user?.id,
  });
}
