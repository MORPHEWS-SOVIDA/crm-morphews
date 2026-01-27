import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Types
export interface CheckoutElements {
  countdown: {
    enabled: boolean;
    duration_minutes: number;
    text: string;
    end_action: 'hide' | 'redirect' | 'show_expired';
  };
  top_banner: {
    enabled: boolean;
    text: string;
    background_color: string;
    text_color: string;
  };
  testimonials: {
    enabled: boolean;
    items: string[]; // IDs from checkout_testimonials
  };
  guarantee: {
    enabled: boolean;
    days: number;
    text: string;
  };
  trust_badges: {
    enabled: boolean;
    show_secure_payment: boolean;
    show_money_back: boolean;
    show_support: boolean;
  };
}

export interface CheckoutTheme {
  primary_color: string;
  background_color: string;
  text_color: string;
  font_family: string;
  border_radius: string;
  button_style: 'solid' | 'outline' | 'gradient';
}

export interface StandaloneCheckout {
  id: string;
  organization_id: string;
  name: string;
  slug: string;
  product_id: string;
  checkout_type: 'one_step' | 'two_step' | 'three_step';
  elements: CheckoutElements;
  order_bump_enabled: boolean;
  order_bump_product_id: string | null;
  order_bump_discount_percent: number;
  order_bump_headline: string;
  order_bump_description: string | null;
  payment_methods: string[];
  pix_discount_percent: number;
  theme: CheckoutTheme;
  meta_title: string | null;
  meta_description: string | null;
  facebook_pixel_id: string | null;
  google_analytics_id: string | null;
  tiktok_pixel_id: string | null;
  attribution_model: 'first_click' | 'last_click';
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Joined data
  product?: {
    id: string;
    name: string;
    base_price_cents: number;
    price_1_unit: number | null;
    images: string[] | null;
  };
  order_bump_product?: {
    id: string;
    name: string;
    base_price_cents: number;
    price_1_unit: number | null;
  } | null;
}

export interface CreateCheckoutInput {
  name: string;
  slug: string;
  product_id: string;
  checkout_type?: 'one_step' | 'two_step' | 'three_step';
  elements?: Partial<CheckoutElements>;
  order_bump_enabled?: boolean;
  order_bump_product_id?: string;
  order_bump_discount_percent?: number;
  order_bump_headline?: string;
  order_bump_description?: string;
  payment_methods?: string[];
  pix_discount_percent?: number;
  theme?: Partial<CheckoutTheme>;
  meta_title?: string;
  meta_description?: string;
  facebook_pixel_id?: string;
  google_analytics_id?: string;
  tiktok_pixel_id?: string;
  attribution_model?: 'first_click' | 'last_click';
}

export interface CheckoutTestimonial {
  id: string;
  checkout_id: string;
  organization_id: string;
  author_name: string;
  author_photo_url: string | null;
  author_location: string | null;
  rating: number;
  content: string;
  position: number;
  is_active: boolean;
  created_at: string;
}

// Fetch all checkouts for organization
export function useStandaloneCheckouts() {
  return useQuery({
    queryKey: ['standalone-checkouts'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('[useStandaloneCheckouts] No user found');
        return [];
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!profile?.organization_id) {
        console.log('[useStandaloneCheckouts] No organization found for user');
        return [];
      }

      console.log('[useStandaloneCheckouts] Fetching checkouts for org:', profile.organization_id);

      const { data, error } = await supabase
        .from('standalone_checkouts')
        .select(`
          *,
          product:lead_products!standalone_checkouts_product_id_fkey(id, name, base_price_cents, price_1_unit, images),
          order_bump_product:lead_products!standalone_checkouts_order_bump_product_id_fkey(id, name, base_price_cents, price_1_unit)
        `)
        .eq('organization_id', profile.organization_id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[useStandaloneCheckouts] Error fetching checkouts:', error);
        throw error;
      }
      
      console.log('[useStandaloneCheckouts] Fetched checkouts:', data?.length || 0);
      return (data || []) as unknown as StandaloneCheckout[];
    },
    staleTime: 0, // Always fetch fresh data
    refetchOnMount: true,
  });
}

// Fetch single checkout
export function useStandaloneCheckout(id: string | undefined) {
  return useQuery({
    queryKey: ['standalone-checkout', id],
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await supabase
        .from('standalone_checkouts')
        .select(`
          *,
          product:lead_products!standalone_checkouts_product_id_fkey(id, name, base_price_cents, price_1_unit, images),
          order_bump_product:lead_products!standalone_checkouts_order_bump_product_id_fkey(id, name, base_price_cents, price_1_unit)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as unknown as StandaloneCheckout;
    },
    enabled: !!id,
  });
}

// Create checkout
export function useCreateStandaloneCheckout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateCheckoutInput) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!profile?.organization_id) {
        throw new Error('Organização não encontrada');
      }

      const { data, error } = await supabase
        .from('standalone_checkouts')
        .insert({
          organization_id: profile.organization_id,
          ...input,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['standalone-checkouts'] });
      toast.success('Checkout criado com sucesso!');
    },
    onError: (error: Error) => {
      console.error('Error creating checkout:', error);
      if (error.message.includes('unique_checkout_slug_per_org')) {
        toast.error('Já existe um checkout com esse slug');
      } else {
        toast.error('Erro ao criar checkout');
      }
    },
  });
}

// Update checkout
export function useUpdateStandaloneCheckout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<CreateCheckoutInput> & { id: string }) => {
      const { data, error } = await supabase
        .from('standalone_checkouts')
        .update(input)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['standalone-checkouts'] });
      queryClient.invalidateQueries({ queryKey: ['standalone-checkout', variables.id] });
      toast.success('Checkout atualizado!');
    },
    onError: (error: Error) => {
      console.error('Error updating checkout:', error);
      toast.error('Erro ao atualizar checkout');
    },
  });
}

// Delete checkout
export function useDeleteStandaloneCheckout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('standalone_checkouts')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['standalone-checkouts'] });
      toast.success('Checkout excluído');
    },
    onError: () => {
      toast.error('Erro ao excluir checkout');
    },
  });
}

// Toggle checkout active status
export function useToggleCheckoutStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('standalone_checkouts')
        .update({ is_active })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['standalone-checkouts'] });
    },
  });
}

// Testimonials hooks
export function useCheckoutTestimonials(checkoutId: string | undefined) {
  return useQuery({
    queryKey: ['checkout-testimonials', checkoutId],
    queryFn: async () => {
      if (!checkoutId) return [];

      const { data, error } = await supabase
        .from('checkout_testimonials')
        .select('*')
        .eq('checkout_id', checkoutId)
        .order('position', { ascending: true });

      if (error) throw error;
      return (data || []) as CheckoutTestimonial[];
    },
    enabled: !!checkoutId,
  });
}

export function useCreateCheckoutTestimonial() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: Omit<CheckoutTestimonial, 'id' | 'created_at'>) => {
      const { data, error } = await supabase
        .from('checkout_testimonials')
        .insert(input)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['checkout-testimonials', variables.checkout_id] });
      toast.success('Depoimento adicionado');
    },
    onError: () => {
      toast.error('Erro ao adicionar depoimento');
    },
  });
}

export function useDeleteCheckoutTestimonial() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, checkoutId }: { id: string; checkoutId: string }) => {
      const { error } = await supabase
        .from('checkout_testimonials')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return checkoutId;
    },
    onSuccess: (checkoutId) => {
      queryClient.invalidateQueries({ queryKey: ['checkout-testimonials', checkoutId] });
      toast.success('Depoimento removido');
    },
    onError: () => {
      toast.error('Erro ao remover depoimento');
    },
  });
}

// Public checkout fetch (for customer view)
export function usePublicCheckout(slug: string | undefined) {
  return useQuery({
    queryKey: ['public-checkout', slug],
    queryFn: async () => {
      if (!slug) return null;

      const { data, error } = await supabase
        .from('standalone_checkouts')
        .select(`
          *,
          product:lead_products!standalone_checkouts_product_id_fkey(
            id, name, description, base_price_cents, price_1_unit, images, benefits
          ),
          order_bump_product:lead_products!standalone_checkouts_order_bump_product_id_fkey(
            id, name, base_price_cents, price_1_unit, images
          )
        `)
        .eq('slug', slug)
        .eq('is_active', true)
        .single();

      if (error) throw error;
      return data as unknown as StandaloneCheckout & {
        product: {
          id: string;
          name: string;
          description: string | null;
          base_price_cents: number;
          price_1_unit: number | null;
          images: string[] | null;
          benefits: string[] | null;
        };
      };
    },
    enabled: !!slug,
  });
}
