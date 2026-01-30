import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface StorefrontBanner {
  id: string;
  storefront_id: string;
  title: string | null;
  subtitle: string | null;
  image_url: string;
  image_tablet_url: string | null;
  image_mobile_url: string | null;
  link_url: string | null;
  link_target: string;
  button_text: string | null;
  button_style: string;
  overlay_color: string | null;
  text_color: string;
  position: string;
  is_active: boolean;
  display_order: number;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateBannerInput {
  storefront_id: string;
  title?: string;
  subtitle?: string;
  image_url: string;
  image_tablet_url?: string;
  image_mobile_url?: string;
  link_url?: string;
  link_target?: string;
  button_text?: string;
  button_style?: string;
  overlay_color?: string;
  text_color?: string;
  position?: string;
  is_active?: boolean;
  display_order?: number;
  starts_at?: string;
  ends_at?: string;
}

export function useStorefrontBanners(storefrontId: string | undefined) {
  return useQuery({
    queryKey: ['storefront-banners', storefrontId],
    enabled: !!storefrontId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('storefront_banners')
        .select('*')
        .eq('storefront_id', storefrontId)
        .order('display_order');
      
      if (error) throw error;
      return data as StorefrontBanner[];
    },
  });
}

export function useCreateStorefrontBanner() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (input: CreateBannerInput) => {
      const { data, error } = await supabase
        .from('storefront_banners')
        .insert(input)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['storefront-banners', variables.storefront_id] });
      toast.success('Banner criado!');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useUpdateStorefrontBanner() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, storefrontId, ...input }: Partial<StorefrontBanner> & { id: string; storefrontId: string }) => {
      const { data, error } = await supabase
        .from('storefront_banners')
        .update(input)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['storefront-banners', variables.storefrontId] });
      toast.success('Banner atualizado!');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useDeleteStorefrontBanner() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, storefrontId }: { id: string; storefrontId: string }) => {
      const { error } = await supabase
        .from('storefront_banners')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['storefront-banners', variables.storefrontId] });
      toast.success('Banner removido!');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useReorderStorefrontBanners() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ storefrontId, bannerIds }: { storefrontId: string; bannerIds: string[] }) => {
      // Update each banner's display_order
      const updates = bannerIds.map((id, index) => 
        supabase
          .from('storefront_banners')
          .update({ display_order: index })
          .eq('id', id)
      );
      
      await Promise.all(updates);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['storefront-banners', variables.storefrontId] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}
