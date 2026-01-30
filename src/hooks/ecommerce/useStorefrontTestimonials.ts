import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface StorefrontTestimonial {
  id: string;
  storefront_id: string;
  organization_id: string;
  customer_name: string;
  testimonial_text: string;
  photo_url: string | null;
  is_verified: boolean;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface CreateTestimonialInput {
  storefront_id: string;
  organization_id: string;
  customer_name: string;
  testimonial_text: string;
  photo_url?: string;
  is_verified?: boolean;
  is_active?: boolean;
  display_order?: number;
}

export function useStorefrontTestimonials(storefrontId: string | undefined) {
  return useQuery({
    queryKey: ['storefront-testimonials', storefrontId],
    enabled: !!storefrontId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('storefront_testimonials')
        .select('*')
        .eq('storefront_id', storefrontId)
        .order('display_order');
      
      if (error) throw error;
      return data as StorefrontTestimonial[];
    },
  });
}

export function useCreateStorefrontTestimonial() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (input: CreateTestimonialInput) => {
      const { data, error } = await supabase
        .from('storefront_testimonials')
        .insert(input)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['storefront-testimonials', variables.storefront_id] });
      toast.success('Depoimento adicionado!');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useUpdateStorefrontTestimonial() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, storefrontId, ...input }: Partial<StorefrontTestimonial> & { id: string; storefrontId: string }) => {
      const { data, error } = await supabase
        .from('storefront_testimonials')
        .update(input)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['storefront-testimonials', variables.storefrontId] });
      toast.success('Depoimento atualizado!');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useDeleteStorefrontTestimonial() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, storefrontId }: { id: string; storefrontId: string }) => {
      const { error } = await supabase
        .from('storefront_testimonials')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['storefront-testimonials', variables.storefrontId] });
      toast.success('Depoimento removido!');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useReorderStorefrontTestimonials() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ storefrontId, testimonialIds }: { storefrontId: string; testimonialIds: string[] }) => {
      const updates = testimonialIds.map((id, index) => 
        supabase
          .from('storefront_testimonials')
          .update({ display_order: index })
          .eq('id', id)
      );
      
      await Promise.all(updates);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['storefront-testimonials', variables.storefrontId] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useToggleTestimonialsEnabled() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ storefrontId, enabled }: { storefrontId: string; enabled: boolean }) => {
      const { error } = await supabase
        .from('tenant_storefronts')
        .update({ testimonials_enabled: enabled })
        .eq('id', storefrontId);
      
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['storefront', variables.storefrontId] });
      queryClient.invalidateQueries({ queryKey: ['storefronts'] });
      toast.success(variables.enabled ? 'Depoimentos ativados!' : 'Depoimentos desativados!');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}
