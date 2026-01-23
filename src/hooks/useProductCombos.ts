import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

// =============================================================================
// TYPES
// =============================================================================

export interface ProductCombo {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  sku: string | null;
  image_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductComboItem {
  id: string;
  combo_id: string;
  product_id: string;
  quantity: number;
  position: number;
  created_at: string;
  // Joined data
  product?: {
    id: string;
    name: string;
    base_price_cents: number;
    image_url: string | null;
  };
}

export interface ProductComboPrice {
  id: string;
  combo_id: string;
  organization_id: string;
  multiplier: number;
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
  points: number;
  sales_hack: string | null;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface ComboWithDetails extends ProductCombo {
  items: ProductComboItem[];
  prices: ProductComboPrice[];
  calculated_base_price: number; // Soma dos preços base dos produtos
}

export interface CreateComboInput {
  name: string;
  description?: string;
  sku?: string;
  image_url?: string;
  is_active?: boolean;
}

export interface CreateComboItemInput {
  combo_id: string;
  product_id: string;
  quantity: number;
  position: number;
}

export interface CreateComboPriceInput {
  combo_id: string;
  multiplier: number;
  regular_price_cents: number;
  regular_use_default_commission?: boolean;
  regular_custom_commission?: number | null;
  promotional_price_cents?: number | null;
  promotional_use_default_commission?: boolean;
  promotional_custom_commission?: number | null;
  promotional_price_2_cents?: number | null;
  promotional_2_use_default_commission?: boolean;
  promotional_2_custom_commission?: number | null;
  minimum_price_cents?: number | null;
  minimum_use_default_commission?: boolean;
  minimum_custom_commission?: number | null;
  points?: number;
  sales_hack?: string | null;
  position?: number;
}

// =============================================================================
// QUERY HOOKS
// =============================================================================

export function useProductCombos() {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['product-combos', profile?.organization_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_combos')
        .select('*')
        .eq('organization_id', profile!.organization_id)
        .order('name');

      if (error) throw error;
      return data as ProductCombo[];
    },
    enabled: !!profile?.organization_id,
  });
}

export function useProductCombo(comboId: string | undefined) {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['product-combo', comboId],
    queryFn: async () => {
      if (!comboId) return null;

      // Fetch combo
      const { data: combo, error: comboError } = await supabase
        .from('product_combos')
        .select('*')
        .eq('id', comboId)
        .single();

      if (comboError) throw comboError;

      // Fetch items with product details
      const { data: items, error: itemsError } = await supabase
        .from('product_combo_items')
        .select(`
          *,
          product:lead_products(id, name, base_price_cents, image_url)
        `)
        .eq('combo_id', comboId)
        .order('position');

      if (itemsError) throw itemsError;

      // Fetch prices
      const { data: prices, error: pricesError } = await supabase
        .from('product_combo_prices')
        .select('*')
        .eq('combo_id', comboId)
        .order('position');

      if (pricesError) throw pricesError;

      // Calculate base price from products
      const calculatedBasePrice = (items || []).reduce((sum, item) => {
        const productPrice = (item.product as any)?.base_price_cents || 0;
        return sum + (productPrice * item.quantity);
      }, 0);

      return {
        ...combo,
        items: items || [],
        prices: prices || [],
        calculated_base_price: calculatedBasePrice,
      } as ComboWithDetails;
    },
    enabled: !!comboId && !!profile?.organization_id,
  });
}

// Get all combos that include a specific product
export function useProductCombosContaining(productId: string | undefined) {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['product-combos-containing', productId],
    queryFn: async () => {
      if (!productId) return [];

      const { data, error } = await supabase
        .from('product_combo_items')
        .select(`
          combo_id,
          combo:product_combos(*)
        `)
        .eq('product_id', productId);

      if (error) throw error;

      // Extract unique combos
      const combos = data
        .map(item => item.combo)
        .filter((combo, index, self) => 
          combo && self.findIndex(c => c?.id === combo.id) === index
        );

      return combos as ProductCombo[];
    },
    enabled: !!productId && !!profile?.organization_id,
  });
}

// =============================================================================
// MUTATION HOOKS
// =============================================================================

export function useCreateProductCombo() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async (input: CreateComboInput) => {
      const { data, error } = await supabase
        .from('product_combos')
        .insert({
          organization_id: profile!.organization_id,
          name: input.name,
          description: input.description || null,
          sku: input.sku || null,
          image_url: input.image_url || null,
          is_active: input.is_active ?? true,
        })
        .select()
        .single();

      if (error) throw error;
      return data as ProductCombo;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-combos'] });
      toast.success('Combo criado com sucesso!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao criar combo: ' + error.message);
    },
  });
}

export function useUpdateProductCombo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<ProductCombo> & { id: string }) => {
      const { data, error } = await supabase
        .from('product_combos')
        .update({
          ...input,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as ProductCombo;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['product-combos'] });
      queryClient.invalidateQueries({ queryKey: ['product-combo', data.id] });
      toast.success('Combo atualizado com sucesso!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao atualizar combo: ' + error.message);
    },
  });
}

export function useDeleteProductCombo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('product_combos')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-combos'] });
      toast.success('Combo excluído com sucesso!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao excluir combo: ' + error.message);
    },
  });
}

// =============================================================================
// COMBO ITEMS MUTATIONS
// =============================================================================

export function useSaveComboItems() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ comboId, items }: { comboId: string; items: Omit<CreateComboItemInput, 'combo_id'>[] }) => {
      // Delete existing items
      await supabase
        .from('product_combo_items')
        .delete()
        .eq('combo_id', comboId);

      // Insert new items
      if (items.length > 0) {
        const { error } = await supabase
          .from('product_combo_items')
          .insert(
            items.map((item, index) => ({
              combo_id: comboId,
              product_id: item.product_id,
              quantity: item.quantity,
              position: index,
            }))
          );

        if (error) throw error;
      }
    },
    onSuccess: (_, { comboId }) => {
      queryClient.invalidateQueries({ queryKey: ['product-combo', comboId] });
      queryClient.invalidateQueries({ queryKey: ['product-combos-containing'] });
    },
    onError: (error: Error) => {
      toast.error('Erro ao salvar itens do combo: ' + error.message);
    },
  });
}

// =============================================================================
// COMBO PRICES MUTATIONS
// =============================================================================

export function useSaveComboPrices() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async ({ comboId, prices }: { comboId: string; prices: Omit<CreateComboPriceInput, 'combo_id'>[] }) => {
      // Delete existing prices
      await supabase
        .from('product_combo_prices')
        .delete()
        .eq('combo_id', comboId);

      // Insert new prices
      if (prices.length > 0) {
        const { error } = await supabase
          .from('product_combo_prices')
          .insert(
            prices.map((price, index) => ({
              combo_id: comboId,
              organization_id: profile!.organization_id,
              multiplier: price.multiplier,
              regular_price_cents: price.regular_price_cents,
              regular_use_default_commission: price.regular_use_default_commission ?? true,
              regular_custom_commission: price.regular_custom_commission || null,
              promotional_price_cents: price.promotional_price_cents || null,
              promotional_use_default_commission: price.promotional_use_default_commission ?? true,
              promotional_custom_commission: price.promotional_custom_commission || null,
              promotional_price_2_cents: price.promotional_price_2_cents || null,
              promotional_2_use_default_commission: price.promotional_2_use_default_commission ?? true,
              promotional_2_custom_commission: price.promotional_2_custom_commission || null,
              minimum_price_cents: price.minimum_price_cents || null,
              minimum_use_default_commission: price.minimum_use_default_commission ?? true,
              minimum_custom_commission: price.minimum_custom_commission || null,
              points: price.points || 0,
              sales_hack: price.sales_hack || null,
              position: index,
            }))
          );

        if (error) throw error;
      }
    },
    onSuccess: (_, { comboId }) => {
      queryClient.invalidateQueries({ queryKey: ['product-combo', comboId] });
      toast.success('Preços do combo salvos!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao salvar preços do combo: ' + error.message);
    },
  });
}
