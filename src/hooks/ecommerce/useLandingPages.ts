import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Types
export interface LandingOffer {
  id: string;
  landing_page_id: string;
  quantity: number;
  label: string;
  price_cents: number;
  original_price_cents: number | null;
  discount_percentage: number | null;
  badge_text: string | null;
  is_highlighted: boolean;
  display_order: number;
  is_active: boolean;
  created_at: string;
}

export interface LandingPage {
  id: string;
  organization_id: string;
  product_id: string;
  template_id: string | null;
  name: string;
  slug: string;
  headline: string | null;
  subheadline: string | null;
  video_url: string | null;
  benefits: unknown[];
  testimonials: unknown[];
  faq: unknown[];
  urgency_text: string | null;
  guarantee_text: string | null;
  logo_url: string | null;
  primary_color: string;
  whatsapp_number: string | null;
  facebook_pixel_id: string | null;
  google_analytics_id: string | null;
  custom_css: string | null;
  is_active: boolean;
  settings: Record<string, any>;
  created_at: string;
  updated_at: string;
  offers?: LandingOffer[];
  product?: {
    id: string;
    name: string;
    base_price_cents?: number;
    price_1_unit?: number;
    image_url: string | null;
  };
}

// Fetch landing pages
export function useLandingPages() {
  return useQuery({
    queryKey: ['landing-pages'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('landing_pages')
        .select(`
          *,
          product:lead_products(id, name, base_price_cents, price_1_unit, image_url),
          offers:landing_offers(*)
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as unknown as LandingPage[];
    },
  });
}

// Fetch single landing page
export function useLandingPage(id: string | undefined) {
  return useQuery({
    queryKey: ['landing-page', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('landing_pages')
        .select(`
          *,
          product:lead_products(id, name, base_price_cents, price_1_unit, image_url, description),
          offers:landing_offers(*)
        `)
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data as unknown as LandingPage;
    },
  });
}

// Create landing page
export interface CreateLandingPageInput {
  product_id: string;
  name: string;
  slug: string;
  template_id?: string;
  headline?: string;
  subheadline?: string;
  video_url?: string;
  benefits?: string[];
  urgency_text?: string;
  guarantee_text?: string;
  logo_url?: string;
  primary_color?: string;
  whatsapp_number?: string;
  offers?: {
    quantity: number;
    label: string;
    price_cents: number;
    original_price_cents?: number;
    discount_percentage?: number;
    badge_text?: string;
    is_highlighted?: boolean;
  }[];
}

export function useCreateLandingPage() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (input: CreateLandingPageInput) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('user_id', user.id)
        .single();
      
      if (!profile?.organization_id) throw new Error('Organização não encontrada');
      
      const { offers, ...pageData } = input;
      
      // Create landing page
      const { data: page, error } = await supabase
        .from('landing_pages')
        .insert({
          ...pageData,
          organization_id: profile.organization_id,
          benefits: pageData.benefits || [],
        })
        .select()
        .single();
      
      if (error) {
        if (error.code === '23505') throw new Error('Este slug já está em uso');
        throw error;
      }
      
      // Create offers
      if (offers && offers.length > 0) {
        const { error: offersError } = await supabase
          .from('landing_offers')
          .insert(offers.map((o, idx) => ({
            landing_page_id: page.id,
            quantity: o.quantity,
            label: o.label,
            price_cents: o.price_cents,
            original_price_cents: o.original_price_cents,
            discount_percentage: o.discount_percentage,
            badge_text: o.badge_text,
            is_highlighted: o.is_highlighted ?? false,
            display_order: idx,
          })));
        
        if (offersError) console.error('Erro ao criar ofertas:', offersError);
      }
      
      return page;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['landing-pages'] });
      toast.success('Landing Page criada!');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

// Update landing page
export function useUpdateLandingPage() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, offers, ...input }: Partial<LandingPage> & { 
      id: string; 
      offers?: CreateLandingPageInput['offers'];
    }) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { product, ...updateData } = input;
      
      const { data, error } = await supabase
        .from('landing_pages')
        .update(updateData as Record<string, unknown>)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      
      // Update offers if provided
      if (offers !== undefined) {
        await supabase
          .from('landing_offers')
          .delete()
          .eq('landing_page_id', id);
        
        if (offers.length > 0) {
          await supabase
            .from('landing_offers')
            .insert(offers.map((o, idx) => ({
              landing_page_id: id,
              quantity: o.quantity,
              label: o.label,
              price_cents: o.price_cents,
              original_price_cents: o.original_price_cents,
              discount_percentage: o.discount_percentage,
              badge_text: o.badge_text,
              is_highlighted: o.is_highlighted ?? false,
              display_order: idx,
            })));
        }
      }
      
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['landing-pages'] });
      queryClient.invalidateQueries({ queryKey: ['landing-page', variables.id] });
      toast.success('Landing Page atualizada!');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

// Delete landing page
export function useDeleteLandingPage() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('landing_pages')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['landing-pages'] });
      toast.success('Landing Page removida');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

// Duplicate landing page
export function useDuplicateLandingPage() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      // Fetch original
      const { data: original, error: fetchError } = await supabase
        .from('landing_pages')
        .select('*, offers:landing_offers(*)')
        .eq('id', id)
        .single();
      
      if (fetchError) throw fetchError;
      
      // Create copy
      const { id: _, created_at, updated_at, offers, ...pageData } = original;
      const newSlug = `${pageData.slug}-copy-${Date.now()}`;
      
      const { data: newPage, error: insertError } = await supabase
        .from('landing_pages')
        .insert({
          ...pageData,
          name: `${pageData.name} (Cópia)`,
          slug: newSlug,
          is_active: false,
        })
        .select()
        .single();
      
      if (insertError) throw insertError;
      
      // Copy offers
      if (offers && offers.length > 0) {
        await supabase
          .from('landing_offers')
          .insert(offers.map((o: LandingOffer) => ({
            landing_page_id: newPage.id,
            quantity: o.quantity,
            label: o.label,
            price_cents: o.price_cents,
            original_price_cents: o.original_price_cents,
            discount_percentage: o.discount_percentage,
            badge_text: o.badge_text,
            is_highlighted: o.is_highlighted,
            display_order: o.display_order,
          })));
      }
      
      return newPage;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['landing-pages'] });
      toast.success('Landing Page duplicada!');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}
