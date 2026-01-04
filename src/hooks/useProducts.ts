import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export const PRODUCT_CATEGORIES = [
  { value: 'produto_pronto', label: 'Produto Pronto' },
  { value: 'print_on_demand', label: 'Produto Print on Demand' },
  { value: 'manipulado', label: 'Manipulado' },
  { value: 'ebook', label: 'Ebook' },
  { value: 'info_video_aula', label: 'Info/Vídeo Aula' },
  { value: 'dropshipping', label: 'Dropshipping' },
  { value: 'servico', label: 'Serviço' },
  { value: 'outro', label: 'Outro' },
] as const;

export type ProductCategory = typeof PRODUCT_CATEGORIES[number]['value'];

export interface Product {
  id: string;
  name: string;
  description: string | null;
  sales_script: string | null;
  key_question_1: string | null;
  key_question_2: string | null;
  key_question_3: string | null;
  price_1_unit: number;
  price_3_units: number;
  price_6_units: number;
  price_12_units: number;
  minimum_price: number;
  usage_period_days: number;
  is_active: boolean;
  is_featured: boolean;
  category: ProductCategory;
  organization_id: string;
  created_at: string;
  updated_at: string | null;
  // Cost and stock fields
  cost_cents: number;
  stock_quantity: number;
  stock_reserved: number;
  minimum_stock: number;
  track_stock: boolean;
  // Cross-sell fields
  crosssell_product_1_id: string | null;
  crosssell_product_2_id: string | null;
  // Image fields
  image_url: string | null;
  label_image_url: string | null;
  // Visibility restriction
  restrict_to_users: boolean;
}

// Computed property for available stock
export function getAvailableStock(product: Product): number {
  return Math.max(0, (product.stock_quantity || 0) - (product.stock_reserved || 0));
}

export interface ProductFormData {
  name: string;
  description?: string;
  sales_script?: string;
  key_question_1?: string;
  key_question_2?: string;
  key_question_3?: string;
  price_1_unit?: number;
  price_3_units?: number;
  price_6_units?: number;
  price_12_units?: number;
  minimum_price?: number;
  usage_period_days?: number;
  is_active?: boolean;
  is_featured?: boolean;
  category?: ProductCategory;
  // New fields
  cost_cents?: number;
  stock_quantity?: number;
  minimum_stock?: number;
  track_stock?: boolean;
  // Cross-sell fields
  crosssell_product_1_id?: string | null;
  crosssell_product_2_id?: string | null;
  // Image fields
  image_url?: string | null;
  label_image_url?: string | null;
  // Visibility restriction
  restrict_to_users?: boolean;
}

export function useProducts() {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['products', profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return [];

      const { data, error } = await supabase
        .from('lead_products')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .order('name');

      if (error) throw error;
      return data as Product[];
    },
    enabled: !!profile?.organization_id,
  });
}

export function useProduct(id: string | undefined) {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['product', id],
    queryFn: async () => {
      if (!id || !profile?.organization_id) return null;

      const { data, error } = await supabase
        .from('lead_products')
        .select('*')
        .eq('id', id)
        .eq('organization_id', profile.organization_id)
        .single();

      if (error) throw error;
      return data as Product;
    },
    enabled: !!id && !!profile?.organization_id,
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async (data: ProductFormData) => {
      if (!profile?.organization_id) throw new Error('Organização não encontrada');

      const { data: product, error } = await supabase
        .from('lead_products')
        .insert({
          ...data,
          organization_id: profile.organization_id,
          price_1_unit: data.price_1_unit || 0,
          price_3_units: data.price_3_units || 0,
          price_6_units: data.price_6_units || 0,
          price_12_units: data.price_12_units || 0,
          minimum_price: data.minimum_price || 0,
          usage_period_days: data.usage_period_days || 0,
          cost_cents: data.cost_cents || 0,
          stock_quantity: data.stock_quantity || 0,
          minimum_stock: data.minimum_stock || 0,
          track_stock: data.track_stock || false,
          is_featured: data.is_featured || false,
          category: data.category || 'produto_pronto',
        })
        .select()
        .single();

      if (error) throw error;
      return product;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('Produto criado com sucesso!');
    },
    onError: (error: Error) => {
      console.error('Erro ao criar produto:', error);
      toast.error('Erro ao criar produto. Verifique se você tem permissão.');
    },
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ProductFormData> }) => {
      const { data: product, error } = await supabase
        .from('lead_products')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return product;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['product', variables.id] });
      toast.success('Produto atualizado com sucesso!');
    },
    onError: (error: Error) => {
      console.error('Erro ao atualizar produto:', error);
      toast.error('Erro ao atualizar produto. Verifique se você tem permissão.');
    },
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('lead_products')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('Produto excluído com sucesso!');
    },
    onError: (error: Error) => {
      console.error('Erro ao excluir produto:', error);
      toast.error('Erro ao excluir produto. Verifique se você tem permissão.');
    },
  });
}

export function useIsOwner() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['is-owner', user?.id],
    queryFn: async () => {
      if (!user?.id) return false;

      const { data, error } = await supabase
        .from('organization_members')
        .select('role')
        .eq('user_id', user.id)
        .single();

      if (error) return false;
      return data?.role === 'owner';
    },
    enabled: !!user?.id,
  });
}
