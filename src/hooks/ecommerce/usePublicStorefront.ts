import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Storefront, StorefrontProduct, StorefrontBanner } from '@/hooks/ecommerce';
import type { StorefrontPage } from '@/hooks/ecommerce/useStorefrontPages';
import type { StorefrontCategory } from '@/hooks/ecommerce/useStorefrontCategories';

export interface PublicProduct {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  ecommerce_title: string | null;
  ecommerce_description: string | null;
  ecommerce_short_description: string | null;
  ecommerce_images: string[];
  ecommerce_video_url: string | null;
  ecommerce_benefits: string[];
  base_price_cents: number | null;
  price_1_unit: number;
  price_3_units: number;
  price_6_units: number;
  price_12_units: number;
  crosssell_product_1_id: string | null;
  crosssell_product_2_id: string | null;
}

export interface StorefrontData extends Omit<Storefront, 'template'> {
  template: {
    id: string;
    name: string;
    slug: string;
    config: Record<string, any>;
  } | null;
  banners: StorefrontBanner[];
  pages: StorefrontPage[];
  categories: StorefrontCategory[];
  featured_products: (StorefrontProduct & { product: PublicProduct })[];
}

// Fetch storefront by slug (public)
export function usePublicStorefront(slug: string | undefined) {
  return useQuery({
    queryKey: ['public-storefront', slug],
    enabled: !!slug,
    staleTime: 5 * 60 * 1000, // 5 minutes
    queryFn: async () => {
      // Fetch storefront
      const { data: storefront, error } = await supabase
        .from('tenant_storefronts')
        .select(`
          *,
          template:storefront_templates(id, name, slug, config)
        `)
        .eq('slug', slug)
        .eq('is_active', true)
        .single();
      
      if (error) throw error;
      if (!storefront) throw new Error('Loja não encontrada');

      // Fetch banners, pages, categories, products and payment fees in parallel
      const [bannersRes, pagesRes, categoriesRes, productsRes, paymentFeesRes] = await Promise.all([
        supabase
          .from('storefront_banners')
          .select('*')
          .eq('storefront_id', storefront.id)
          .eq('is_active', true)
          .or(`starts_at.is.null,starts_at.lte.${new Date().toISOString()}`)
          .or(`ends_at.is.null,ends_at.gte.${new Date().toISOString()}`)
          .order('display_order'),
        supabase
          .from('storefront_pages')
          .select('*')
          .eq('storefront_id', storefront.id)
          .eq('is_active', true)
          .order('display_order'),
        supabase
          .from('storefront_categories')
          .select('*')
          .eq('storefront_id', storefront.id)
          .eq('is_active', true)
          .order('display_order'),
        supabase
          .from('storefront_products')
          .select(`
            *,
            product:lead_products(
              id, name, description, image_url,
              ecommerce_title, ecommerce_description, ecommerce_short_description,
              ecommerce_images, ecommerce_video_url, ecommerce_benefits,
              base_price_cents, price_1_unit, price_3_units, price_6_units, price_12_units,
              crosssell_product_1_id, crosssell_product_2_id
            )
          `)
          .eq('storefront_id', storefront.id)
          .eq('is_visible', true)
          .order('display_order'),
        // Fetch payment fees for this organization
        supabase
          .from('tenant_payment_fees')
          .select('installment_fees, installment_fee_passed_to_buyer, max_installments')
          .eq('organization_id', storefront.organization_id)
          .maybeSingle(),
      ]);

      // Filter out products where the join returned null (RLS denied access to lead_products)
      const validProducts = (productsRes.data || []).filter(p => p.product !== null);

      // Default installment config
      const installmentConfig = {
        installment_fees: (paymentFeesRes.data?.installment_fees as Record<string, number>) || {
          "2": 3.49, "3": 4.29, "4": 4.99, "5": 5.49, "6": 5.99,
          "7": 6.49, "8": 6.99, "9": 7.49, "10": 7.99, "11": 8.49, "12": 8.99,
        },
        installment_fee_passed_to_buyer: paymentFeesRes.data?.installment_fee_passed_to_buyer ?? true,
        max_installments: paymentFeesRes.data?.max_installments || 12,
      };

      return {
        ...storefront,
        banners: bannersRes.data || [],
        pages: pagesRes.data || [],
        categories: categoriesRes.data || [],
        featured_products: validProducts.filter(p => p.is_featured),
        all_products: validProducts,
        installment_config: installmentConfig,
      } as unknown as StorefrontData & { 
        all_products: (StorefrontProduct & { product: PublicProduct })[],
        installment_config: typeof installmentConfig,
      };
    },
  });
}

// Fetch single product for product page
export function usePublicProduct(storefrontSlug: string | undefined, productId: string | undefined) {
  return useQuery({
    queryKey: ['public-product', storefrontSlug, productId],
    enabled: !!storefrontSlug && !!productId,
    queryFn: async () => {
      // First get the storefront
      const { data: storefront } = await supabase
        .from('tenant_storefronts')
        .select('id')
        .eq('slug', storefrontSlug)
        .eq('is_active', true)
        .single();

      if (!storefront) throw new Error('Loja não encontrada');

      // Get the product with storefront config
      const { data: storefrontProduct, error } = await supabase
        .from('storefront_products')
        .select(`
          *,
          product:lead_products(
            id, name, description, image_url,
            ecommerce_title, ecommerce_description, ecommerce_short_description,
            ecommerce_images, ecommerce_video_url, ecommerce_benefits,
            base_price_cents, price_1_unit, price_3_units, price_6_units, price_12_units,
            crosssell_product_1_id, crosssell_product_2_id
          )
        `)
        .eq('storefront_id', storefront.id)
        .eq('product_id', productId)
        .eq('is_visible', true)
        .single();

      if (error) throw error;
      if (!storefrontProduct || !storefrontProduct.product) {
        throw new Error('Produto não encontrado ou sem permissão de acesso');
      }
      return storefrontProduct as unknown as StorefrontProduct & { product: PublicProduct };
    },
  });
}

// Fetch product price kits for dynamic pricing
export function usePublicProductKits(productId: string | undefined, organizationId: string | undefined) {
  return useQuery({
    queryKey: ['public-product-kits', productId, organizationId],
    enabled: !!productId && !!organizationId,
    staleTime: 10 * 60 * 1000, // 10 minutes
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_price_kits')
        .select('quantity, regular_price_cents, promotional_price_cents, position')
        .eq('product_id', productId)
        .eq('organization_id', organizationId)
        .order('position');
      
      if (error) {
        console.error('Error fetching product kits:', error);
        return [];
      }
      
      return data || [];
    },
  });
}

// Fetch products by category
export function usePublicCategoryProducts(storefrontSlug: string | undefined, categorySlug: string | undefined) {
  return useQuery({
    queryKey: ['public-category-products', storefrontSlug, categorySlug],
    enabled: !!storefrontSlug && !!categorySlug,
    queryFn: async () => {
      // Get storefront
      const { data: storefront } = await supabase
        .from('tenant_storefronts')
        .select('id')
        .eq('slug', storefrontSlug)
        .eq('is_active', true)
        .single();

      if (!storefront) throw new Error('Loja não encontrada');

      // Get category
      const { data: category } = await supabase
        .from('storefront_categories')
        .select('id, name, description, image_url')
        .eq('storefront_id', storefront.id)
        .eq('slug', categorySlug)
        .eq('is_active', true)
        .single();

      if (!category) throw new Error('Categoria não encontrada');

      // Get products in category
      const { data: productCategories } = await supabase
        .from('storefront_product_categories')
        .select(`
          storefront_product:storefront_products(
            *,
            product:lead_products(
              id, name, description, image_url,
              ecommerce_title, ecommerce_short_description,
              base_price_cents, price_1_unit, price_3_units, price_6_units, price_12_units
            )
          )
        `)
        .eq('category_id', category.id);

      // Filter out products where the join returned null
      const validProducts = (productCategories || [])
        .map(pc => pc.storefront_product)
        .filter((sp): sp is NonNullable<typeof sp> => sp !== null && sp.product !== null);

      return {
        category,
        products: validProducts as unknown as (StorefrontProduct & { product: PublicProduct })[],
      };
    },
  });
}

// Fetch page content
export function usePublicPage(storefrontSlug: string | undefined, pageSlug: string | undefined) {
  return useQuery({
    queryKey: ['public-page', storefrontSlug, pageSlug],
    enabled: !!storefrontSlug && !!pageSlug,
    queryFn: async () => {
      // Get storefront
      const { data: storefront } = await supabase
        .from('tenant_storefronts')
        .select('id, name, primary_color')
        .eq('slug', storefrontSlug)
        .eq('is_active', true)
        .single();

      if (!storefront) throw new Error('Loja não encontrada');

      // Get page
      const { data: page, error } = await supabase
        .from('storefront_pages')
        .select('*')
        .eq('storefront_id', storefront.id)
        .eq('slug', pageSlug)
        .eq('is_active', true)
        .single();

      if (error) throw error;
      return { page, storefront };
    },
  });
}
