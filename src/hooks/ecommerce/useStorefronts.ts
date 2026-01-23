import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Types
export interface StorefrontTemplate {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  preview_image_url: string | null;
  template_type: 'store' | 'landing_page';
  config: Record<string, any>;
  is_active: boolean;
  created_at: string;
}

export interface Storefront {
  id: string;
  organization_id: string;
  name: string;
  slug: string;
  template_id: string | null;
  logo_url: string | null;
  favicon_url: string | null;
  primary_color: string;
  secondary_color: string;
  custom_css: string | null;
  meta_title: string | null;
  meta_description: string | null;
  google_analytics_id: string | null;
  facebook_pixel_id: string | null;
  whatsapp_number: string | null;
  is_active: boolean;
  settings: Record<string, any>;
  created_at: string;
  updated_at: string;
  template?: StorefrontTemplate;
  domains?: StorefrontDomain[];
  products_count?: number;
  // New config fields
  header_config?: Record<string, any>;
  footer_config?: Record<string, any>;
  checkout_config?: Record<string, any>;
  cart_config?: Record<string, any>;
  social_links?: Record<string, any>;
  payment_methods_display?: string[];
}

export interface StorefrontDomain {
  id: string;
  storefront_id: string;
  domain: string;
  is_primary: boolean;
  ssl_status: 'pending' | 'active' | 'failed';
  verified_at: string | null;
  created_at: string;
}

export interface StorefrontProduct {
  id: string;
  storefront_id: string;
  product_id: string;
  display_order: number;
  is_featured: boolean;
  custom_price_cents: number | null;
  custom_description: string | null;
  is_visible: boolean;
  created_at: string;
  // New fields from migration
  show_crosssell?: boolean;
  show_kit_upsell?: boolean;
  category_label?: string | null;
  highlight_badge?: string | null;
  custom_images?: any;
  product?: {
    id: string;
    name: string;
    sale_price_cents?: number | null;
    image_url: string | null;
  };
}

// Fetch templates
export function useStorefrontTemplates() {
  return useQuery({
    queryKey: ['storefront-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('storefront_templates')
        .select('*')
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      return data as StorefrontTemplate[];
    },
  });
}

// Fetch storefronts for current org
export function useStorefronts() {
  return useQuery({
    queryKey: ['storefronts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenant_storefronts')
        .select(`
          *,
          template:storefront_templates(*),
          domains:storefront_domains(*),
          products:storefront_products(count)
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      return (data || []).map(s => ({
        ...s,
        products_count: s.products?.[0]?.count || 0,
      })) as Storefront[];
    },
  });
}

// Fetch single storefront
export function useStorefront(id: string | undefined) {
  return useQuery({
    queryKey: ['storefront', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenant_storefronts')
        .select(`
          *,
          template:storefront_templates(*),
          domains:storefront_domains(*)
        `)
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data as Storefront;
    },
  });
}

// Fetch products for a storefront
export function useStorefrontProducts(storefrontId: string | undefined) {
  return useQuery({
    queryKey: ['storefront-products', storefrontId],
    enabled: !!storefrontId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('storefront_products')
        .select(`
          *,
          product:lead_products(id, name, sale_price_cents, image_url)
        `)
        .eq('storefront_id', storefrontId)
        .order('display_order');
      
      if (error) throw error;
      return data as unknown as StorefrontProduct[];
    },
  });
}

// Create storefront
export interface CreateStorefrontInput {
  name: string;
  slug: string;
  template_id?: string;
  logo_url?: string;
  primary_color?: string;
  secondary_color?: string;
  meta_title?: string;
  meta_description?: string;
  whatsapp_number?: string;
}

export function useCreateStorefront() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (input: CreateStorefrontInput) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('user_id', user.id)
        .single();
      
      if (!profile?.organization_id) throw new Error('Organização não encontrada');
      
      const { data, error } = await supabase
        .from('tenant_storefronts')
        .insert({
          ...input,
          organization_id: profile.organization_id,
        })
        .select()
        .single();
      
      if (error) {
        if (error.code === '23505') throw new Error('Este slug já está em uso');
        throw error;
      }
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['storefronts'] });
      toast.success('Loja criada com sucesso!');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

// Update storefront
export function useUpdateStorefront() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<Storefront> & { id: string }) => {
      const { data, error } = await supabase
        .from('tenant_storefronts')
        .update(input)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['storefronts'] });
      queryClient.invalidateQueries({ queryKey: ['storefront', variables.id] });
      toast.success('Loja atualizada!');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

// Delete storefront
export function useDeleteStorefront() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('tenant_storefronts')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['storefronts'] });
      toast.success('Loja removida');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

// Add domain
export function useAddStorefrontDomain() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ storefrontId, domain, isPrimary }: { 
      storefrontId: string; 
      domain: string; 
      isPrimary?: boolean;
    }) => {
      const { data, error } = await supabase
        .from('storefront_domains')
        .insert({
          storefront_id: storefrontId,
          domain: domain.toLowerCase().trim(),
          is_primary: isPrimary || false,
        })
        .select()
        .single();
      
      if (error) {
        if (error.code === '23505') throw new Error('Este domínio já está em uso');
        throw error;
      }
      
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['storefront', variables.storefrontId] });
      toast.success('Domínio adicionado!');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

// Add/update products in storefront
export function useUpdateStorefrontProducts() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      storefrontId, 
      products 
    }: { 
      storefrontId: string; 
      products: { product_id: string; display_order?: number; is_featured?: boolean; custom_price_cents?: number | null }[];
    }) => {
      // Remove all existing
      await supabase
        .from('storefront_products')
        .delete()
        .eq('storefront_id', storefrontId);
      
      // Insert new ones
      if (products.length > 0) {
        const { error } = await supabase
          .from('storefront_products')
          .insert(products.map((p, idx) => ({
            storefront_id: storefrontId,
            product_id: p.product_id,
            display_order: p.display_order ?? idx,
            is_featured: p.is_featured ?? false,
            custom_price_cents: p.custom_price_cents,
          })));
        
        if (error) throw error;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['storefront-products', variables.storefrontId] });
      queryClient.invalidateQueries({ queryKey: ['storefronts'] });
      toast.success('Produtos atualizados!');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}
