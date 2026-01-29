import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CrosssellProduct {
  id: string;
  name: string;
  ecommerce_title: string | null;
  image_url: string | null;
  ecommerce_images: string[];
  base_price_cents: number | null;
  price_1_unit: number;
}

// Fetch crosssell products for a specific product
export function useCrosssellProducts(
  storefrontId: string | undefined,
  crosssellProductId1: string | null | undefined,
  crosssellProductId2: string | null | undefined
) {
  return useQuery({
    queryKey: ['crosssell-products', storefrontId, crosssellProductId1, crosssellProductId2],
    enabled: !!storefrontId && (!!crosssellProductId1 || !!crosssellProductId2),
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const productIds = [crosssellProductId1, crosssellProductId2].filter(Boolean) as string[];
      if (productIds.length === 0) return [];

      // Check if these products are visible in the storefront
      const { data, error } = await supabase
        .from('storefront_products')
        .select(`
          id,
          product_id,
          custom_price_cents,
          product:lead_products(
            id, name, ecommerce_title, image_url, ecommerce_images,
            base_price_cents, price_1_unit
          )
        `)
        .eq('storefront_id', storefrontId)
        .eq('is_visible', true)
        .in('product_id', productIds);

      if (error) throw error;

      return (data || [])
        .filter(sp => sp.product !== null)
        .map(sp => ({
          ...sp.product as CrosssellProduct,
          storefrontProductId: sp.id,
          customPriceCents: sp.custom_price_cents,
        }));
    },
  });
}

// Fetch recommended products for cart (products not already in cart)
export function useCartRecommendations(
  storefrontId: string | undefined,
  cartProductIds: string[]
) {
  return useQuery({
    queryKey: ['cart-recommendations', storefrontId, cartProductIds],
    enabled: !!storefrontId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      // First, get crosssell IDs from products in cart
      const { data: cartProducts } = await supabase
        .from('lead_products')
        .select('crosssell_product_1_id, crosssell_product_2_id')
        .in('id', cartProductIds);

      const crosssellIds = new Set<string>();
      (cartProducts || []).forEach(p => {
        if (p.crosssell_product_1_id) crosssellIds.add(p.crosssell_product_1_id);
        if (p.crosssell_product_2_id) crosssellIds.add(p.crosssell_product_2_id);
      });

      // Remove products already in cart
      cartProductIds.forEach(id => crosssellIds.delete(id));

      if (crosssellIds.size === 0) {
        // Fallback: get featured products not in cart
        const { data: featured } = await supabase
          .from('storefront_products')
          .select(`
            id,
            product_id,
            custom_price_cents,
            product:lead_products(
              id, name, ecommerce_title, image_url, ecommerce_images,
              base_price_cents, price_1_unit
            )
          `)
          .eq('storefront_id', storefrontId)
          .eq('is_visible', true)
          .eq('is_featured', true)
          .not('product_id', 'in', `(${cartProductIds.join(',')})`)
          .limit(4);

        return (featured || [])
          .filter(sp => sp.product !== null)
          .map(sp => ({
            ...sp.product as CrosssellProduct,
            storefrontProductId: sp.id,
            customPriceCents: sp.custom_price_cents,
          }));
      }

      // Get crosssell products that are in the storefront and visible
      const { data: recommendations } = await supabase
        .from('storefront_products')
        .select(`
          id,
          product_id,
          custom_price_cents,
          product:lead_products(
            id, name, ecommerce_title, image_url, ecommerce_images,
            base_price_cents, price_1_unit
          )
        `)
        .eq('storefront_id', storefrontId)
        .eq('is_visible', true)
        .in('product_id', Array.from(crosssellIds))
        .limit(4);

      return (recommendations || [])
        .filter(sp => sp.product !== null)
        .map(sp => ({
          ...sp.product as CrosssellProduct,
          storefrontProductId: sp.id,
          customPriceCents: sp.custom_price_cents,
        }));
    },
  });
}
