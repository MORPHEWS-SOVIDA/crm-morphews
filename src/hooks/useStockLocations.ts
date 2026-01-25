import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

// ============================================================================
// TYPES
// ============================================================================

export interface StockLocation {
  id: string;
  organization_id: string;
  name: string;
  code: string | null;
  address: string | null;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface StockByLocation {
  id: string;
  organization_id: string;
  product_id: string;
  location_id: string;
  quantity: number;
  reserved: number;
  average_cost_cents: number | null;
  created_at: string;
  updated_at: string;
  // Joined
  location?: StockLocation;
  product?: {
    id: string;
    name: string;
  };
}

export interface CreateStockLocationInput {
  name: string;
  code?: string;
  address?: string;
  is_default?: boolean;
  is_active?: boolean;
}

// ============================================================================
// HOOKS - LOCATIONS
// ============================================================================

export function useStockLocations() {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['stock-locations', profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return [];

      const { data, error } = await supabase
        .from('stock_locations')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .eq('is_active', true)
        .order('is_default', { ascending: false })
        .order('name');

      if (error) throw error;
      return data as StockLocation[];
    },
    enabled: !!profile?.organization_id,
  });
}

export function useDefaultStockLocation() {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['stock-location-default', profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return null;

      const { data, error } = await supabase
        .from('stock_locations')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .eq('is_default', true)
        .eq('is_active', true)
        .maybeSingle();

      if (error) throw error;
      return data as StockLocation | null;
    },
    enabled: !!profile?.organization_id,
  });
}

export function useCreateStockLocation() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async (input: CreateStockLocationInput) => {
      if (!profile?.organization_id) throw new Error('Organização não encontrada');

      // If setting as default, remove default from others
      if (input.is_default) {
        await supabase
          .from('stock_locations')
          .update({ is_default: false })
          .eq('organization_id', profile.organization_id);
      }

      const { data, error } = await supabase
        .from('stock_locations')
        .insert({
          organization_id: profile.organization_id,
          ...input,
        })
        .select()
        .single();

      if (error) throw error;
      return data as StockLocation;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-locations'] });
      queryClient.invalidateQueries({ queryKey: ['stock-location-default'] });
      toast.success('Local de estoque criado!');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao criar local de estoque');
    },
  });
}

export function useUpdateStockLocation() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CreateStockLocationInput> }) => {
      if (!profile?.organization_id) throw new Error('Organização não encontrada');

      // If setting as default, remove default from others
      if (data.is_default) {
        await supabase
          .from('stock_locations')
          .update({ is_default: false })
          .eq('organization_id', profile.organization_id)
          .neq('id', id);
      }

      const { data: updated, error } = await supabase
        .from('stock_locations')
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('organization_id', profile.organization_id)
        .select()
        .single();

      if (error) throw error;
      return updated as StockLocation;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-locations'] });
      queryClient.invalidateQueries({ queryKey: ['stock-location-default'] });
      toast.success('Local de estoque atualizado!');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao atualizar local de estoque');
    },
  });
}

export function useDeleteStockLocation() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async (id: string) => {
      if (!profile?.organization_id) throw new Error('Organização não encontrada');

      // Soft delete - just mark as inactive
      const { error } = await supabase
        .from('stock_locations')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('organization_id', profile.organization_id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-locations'] });
      toast.success('Local de estoque removido!');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao remover local de estoque');
    },
  });
}

// ============================================================================
// HOOKS - STOCK BY LOCATION
// ============================================================================

export function useProductStockByLocation(productId: string | undefined) {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['stock-by-location', productId],
    queryFn: async () => {
      if (!productId || !profile?.organization_id) return [];

      const { data, error } = await supabase
        .from('stock_by_location')
        .select(`
          *,
          location:location_id (*)
        `)
        .eq('product_id', productId)
        .eq('organization_id', profile.organization_id);

      if (error) throw error;
      return data as StockByLocation[];
    },
    enabled: !!productId && !!profile?.organization_id,
  });
}

export function useLocationStock(locationId: string | undefined) {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['location-stock', locationId],
    queryFn: async () => {
      if (!locationId || !profile?.organization_id) return [];

      const { data, error } = await supabase
        .from('stock_by_location')
        .select(`
          *,
          product:product_id (
            id,
            name,
            sku,
            barcode_ean
          )
        `)
        .eq('location_id', locationId)
        .eq('organization_id', profile.organization_id)
        .order('quantity', { ascending: false });

      if (error) throw error;
      return data as StockByLocation[];
    },
    enabled: !!locationId && !!profile?.organization_id,
  });
}
