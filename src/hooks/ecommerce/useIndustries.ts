import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Industry {
  id: string;
  organization_id: string;
  name: string;
  legal_name: string | null;
  document: string | null;
  email: string | null;
  phone: string | null;
  bank_name: string | null;
  bank_agency: string | null;
  bank_account: string | null;
  bank_account_type: string | null;
  pix_key: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductIndustryCost {
  id: string;
  product_id: string;
  industry_id: string;
  organization_id: string;
  unit_cost_cents: number;
  shipping_cost_cents: number;
  additional_cost_cents: number;
  unit_cost_description: string | null;
  shipping_cost_description: string | null;
  additional_cost_description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  industry?: Industry;
}

export function useIndustries() {
  return useQuery({
    queryKey: ['industries'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('industries')
        .select('*')
        .order('name');

      if (error) throw error;
      return data as Industry[];
    },
  });
}

export function useActiveIndustries() {
  return useQuery({
    queryKey: ['industries', 'active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('industries')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return data as Industry[];
    },
  });
}

export function useCreateIndustry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Omit<Industry, 'id' | 'organization_id' | 'created_at' | 'updated_at'>) => {
      // Get user's organization
      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .single();

      if (!profile?.organization_id) {
        throw new Error('Organização não encontrada');
      }

      const { data: result, error } = await supabase
        .from('industries')
        .insert({
          ...data,
          organization_id: profile.organization_id,
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['industries'] });
    },
  });
}

export function useUpdateIndustry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<Industry> & { id: string }) => {
      const { data: result, error } = await supabase
        .from('industries')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['industries'] });
    },
  });
}

export function useDeleteIndustry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('industries')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['industries'] });
    },
  });
}

// Product Industry Costs hooks
export function useProductIndustryCosts(productId?: string) {
  return useQuery({
    queryKey: ['product-industry-costs', productId],
    queryFn: async () => {
      if (!productId) return [];

      const { data, error } = await supabase
        .from('product_industry_costs')
        .select(`
          *,
          industry:industries(*)
        `)
        .eq('product_id', productId);

      if (error) throw error;
      return data as (ProductIndustryCost & { industry: Industry })[];
    },
    enabled: !!productId,
  });
}

export function useCreateProductIndustryCost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Omit<ProductIndustryCost, 'id' | 'organization_id' | 'created_at' | 'updated_at' | 'industry'>) => {
      // Get user's organization
      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .single();

      if (!profile?.organization_id) {
        throw new Error('Organização não encontrada');
      }

      const { data: result, error } = await supabase
        .from('product_industry_costs')
        .insert({
          ...data,
          organization_id: profile.organization_id,
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['product-industry-costs', variables.product_id] });
    },
  });
}

export function useUpdateProductIndustryCost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, productId, ...data }: Partial<ProductIndustryCost> & { id: string; productId: string }) => {
      const { data: result, error } = await supabase
        .from('product_industry_costs')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['product-industry-costs', variables.productId] });
    },
  });
}

export function useDeleteProductIndustryCost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, productId }: { id: string; productId: string }) => {
      const { error } = await supabase
        .from('product_industry_costs')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['product-industry-costs', variables.productId] });
    },
  });
}

// Calculate total industry cost for a product
export function calculateIndustryCost(costs: ProductIndustryCost[], quantity: number = 1): number {
  return costs
    .filter(c => c.is_active)
    .reduce((total, cost) => {
      return total + (cost.unit_cost_cents + cost.shipping_cost_cents + cost.additional_cost_cents) * quantity;
    }, 0);
}
