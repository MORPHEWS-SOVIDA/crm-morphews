import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface ProductPriceKit {
  id: string;
  product_id: string;
  organization_id: string;
  quantity: number;
  
  regular_price_cents: number;
  regular_use_default_commission: boolean;
  regular_custom_commission: number | null;
  
  promotional_price_cents: number | null;
  promotional_use_default_commission: boolean;
  promotional_custom_commission: number | null;
  
  promotional_price_2_cents: number | null;
  promotional_2_use_default_commission: boolean;
  promotional_2_custom_commission: number | null;
  
  minimum_price_cents: number | null;
  minimum_use_default_commission: boolean;
  minimum_custom_commission: number | null;
  
  points: number | null;
  
  position: number;
  created_at: string;
  updated_at: string;
}

export interface ProductPriceKitFormData {
  quantity: number;
  
  regular_price_cents: number;
  regular_use_default_commission: boolean;
  regular_custom_commission?: number | null;
  
  promotional_price_cents?: number | null;
  promotional_use_default_commission: boolean;
  promotional_custom_commission?: number | null;
  
  promotional_price_2_cents?: number | null;
  promotional_2_use_default_commission: boolean;
  promotional_2_custom_commission?: number | null;
  
  minimum_price_cents?: number | null;
  minimum_use_default_commission: boolean;
  minimum_custom_commission?: number | null;
  
  points?: number | null;
  
  position?: number;
}

export function useProductPriceKits(productId: string | undefined) {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['product-price-kits', productId],
    queryFn: async () => {
      if (!productId || !profile?.organization_id) return [];

      const { data, error } = await supabase
        .from('product_price_kits')
        .select('*')
        .eq('product_id', productId)
        .order('position', { ascending: true });

      if (error) throw error;
      return data as ProductPriceKit[];
    },
    enabled: !!productId && !!profile?.organization_id,
  });
}

export function useCreateProductPriceKit() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async ({ productId, data }: { productId: string; data: ProductPriceKitFormData }) => {
      if (!profile?.organization_id) throw new Error('Organização não encontrada');

      const { data: kit, error } = await supabase
        .from('product_price_kits')
        .insert({
          product_id: productId,
          organization_id: profile.organization_id,
          quantity: data.quantity,
          regular_price_cents: data.regular_price_cents,
          regular_use_default_commission: data.regular_use_default_commission,
          regular_custom_commission: data.regular_use_default_commission ? null : data.regular_custom_commission,
          promotional_price_cents: data.promotional_price_cents || null,
          promotional_use_default_commission: data.promotional_use_default_commission,
          promotional_custom_commission: data.promotional_use_default_commission ? null : data.promotional_custom_commission,
          promotional_price_2_cents: data.promotional_price_2_cents || null,
          promotional_2_use_default_commission: data.promotional_2_use_default_commission,
          promotional_2_custom_commission: data.promotional_2_use_default_commission ? null : data.promotional_2_custom_commission,
          minimum_price_cents: data.minimum_price_cents || null,
          minimum_use_default_commission: data.minimum_use_default_commission,
          minimum_custom_commission: data.minimum_use_default_commission ? null : data.minimum_custom_commission,
          points: data.points || 0,
          position: data.position || 0,
        })
        .select()
        .single();

      if (error) throw error;
      return kit;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['product-price-kits', variables.productId] });
      toast.success('Kit de preço criado!');
    },
    onError: (error: Error) => {
      console.error('Erro ao criar kit:', error);
      if (error.message.includes('duplicate')) {
        toast.error('Já existe um kit com essa quantidade de unidades');
      } else {
        toast.error('Erro ao criar kit de preço');
      }
    },
  });
}

export function useUpdateProductPriceKit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ kitId, productId, data }: { kitId: string; productId: string; data: Partial<ProductPriceKitFormData> }) => {
      const updateData: Record<string, any> = {};
      
      if (data.quantity !== undefined) updateData.quantity = data.quantity;
      if (data.regular_price_cents !== undefined) updateData.regular_price_cents = data.regular_price_cents;
      if (data.regular_use_default_commission !== undefined) {
        updateData.regular_use_default_commission = data.regular_use_default_commission;
        updateData.regular_custom_commission = data.regular_use_default_commission ? null : data.regular_custom_commission;
      }
      if (data.promotional_price_cents !== undefined) updateData.promotional_price_cents = data.promotional_price_cents || null;
      if (data.promotional_use_default_commission !== undefined) {
        updateData.promotional_use_default_commission = data.promotional_use_default_commission;
        updateData.promotional_custom_commission = data.promotional_use_default_commission ? null : data.promotional_custom_commission;
      }
      if (data.promotional_price_2_cents !== undefined) updateData.promotional_price_2_cents = data.promotional_price_2_cents || null;
      if (data.promotional_2_use_default_commission !== undefined) {
        updateData.promotional_2_use_default_commission = data.promotional_2_use_default_commission;
        updateData.promotional_2_custom_commission = data.promotional_2_use_default_commission ? null : data.promotional_2_custom_commission;
      }
      if (data.minimum_price_cents !== undefined) updateData.minimum_price_cents = data.minimum_price_cents || null;
      if (data.minimum_use_default_commission !== undefined) {
        updateData.minimum_use_default_commission = data.minimum_use_default_commission;
        updateData.minimum_custom_commission = data.minimum_use_default_commission ? null : data.minimum_custom_commission;
      }
      if (data.position !== undefined) updateData.position = data.position;

      const { data: kit, error } = await supabase
        .from('product_price_kits')
        .update(updateData)
        .eq('id', kitId)
        .select()
        .single();

      if (error) throw error;
      return { kit, productId };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['product-price-kits', result.productId] });
      toast.success('Kit atualizado!');
    },
    onError: (error: Error) => {
      console.error('Erro ao atualizar kit:', error);
      toast.error('Erro ao atualizar kit de preço');
    },
  });
}

export function useDeleteProductPriceKit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ kitId, productId }: { kitId: string; productId: string }) => {
      const { error } = await supabase
        .from('product_price_kits')
        .delete()
        .eq('id', kitId);

      if (error) throw error;
      return { productId };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['product-price-kits', result.productId] });
      toast.success('Kit removido!');
    },
    onError: (error: Error) => {
      console.error('Erro ao remover kit:', error);
      toast.error('Erro ao remover kit de preço');
    },
  });
}

export function useBulkSaveProductPriceKits() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async ({ productId, kits }: { productId: string; kits: ProductPriceKitFormData[] }) => {
      if (!profile?.organization_id) throw new Error('Organização não encontrada');

      // Delete existing kits for this product
      await supabase
        .from('product_price_kits')
        .delete()
        .eq('product_id', productId);

      // Insert new kits
      if (kits.length > 0) {
        const kitsToInsert = kits.map((kit, index) => ({
          product_id: productId,
          organization_id: profile.organization_id,
          quantity: kit.quantity,
          regular_price_cents: kit.regular_price_cents,
          regular_use_default_commission: kit.regular_use_default_commission,
          regular_custom_commission: kit.regular_use_default_commission ? null : kit.regular_custom_commission,
          promotional_price_cents: kit.promotional_price_cents || null,
          promotional_use_default_commission: kit.promotional_use_default_commission,
          promotional_custom_commission: kit.promotional_use_default_commission ? null : kit.promotional_custom_commission,
          promotional_price_2_cents: kit.promotional_price_2_cents || null,
          promotional_2_use_default_commission: kit.promotional_2_use_default_commission,
          promotional_2_custom_commission: kit.promotional_2_use_default_commission ? null : kit.promotional_2_custom_commission,
          minimum_price_cents: kit.minimum_price_cents || null,
          minimum_use_default_commission: kit.minimum_use_default_commission,
          minimum_custom_commission: kit.minimum_use_default_commission ? null : kit.minimum_custom_commission,
          points: kit.points || 0,
          position: index,
        }));

        const { error } = await supabase
          .from('product_price_kits')
          .insert(kitsToInsert);

        if (error) throw error;
      }

      return { productId };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['product-price-kits', result.productId] });
    },
    onError: (error: Error) => {
      console.error('Erro ao salvar kits:', error);
      toast.error('Erro ao salvar kits de preço');
    },
  });
}
