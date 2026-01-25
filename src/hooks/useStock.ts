import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface StockMovement {
  id: string;
  organization_id: string;
  product_id: string;
  movement_type: 'entry' | 'exit' | 'adjustment' | 'sale' | 'return';
  quantity: number;
  previous_quantity: number;
  new_quantity: number;
  reference_id: string | null;
  reference_type: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export interface StockMovementInput {
  product_id: string;
  movement_type: 'entry' | 'exit' | 'adjustment' | 'sale' | 'return';
  quantity: number;
  notes?: string;
  reference_id?: string;
  reference_type?: string;
}

// Hook to get stock movements for a product
export function useProductStockMovements(productId: string | undefined) {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['stock-movements', productId],
    queryFn: async () => {
      if (!productId || !profile?.organization_id) return [];

      const { data, error } = await supabase
        .from('stock_movements')
        .select('*')
        .eq('product_id', productId)
        .eq('organization_id', profile.organization_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as StockMovement[];
    },
    enabled: !!productId && !!profile?.organization_id,
  });
}

// Hook to get all recent stock movements
export function useRecentStockMovements(limit: number = 50) {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['stock-movements-recent', profile?.organization_id, limit],
    queryFn: async () => {
      if (!profile?.organization_id) return [];

      const { data, error } = await supabase
        .from('stock_movements')
        .select(`
          *,
          lead_products:product_id (
            id,
            name
          )
        `)
        .eq('organization_id', profile.organization_id)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data;
    },
    enabled: !!profile?.organization_id,
  });
}

// Hook to create stock movement
export function useCreateStockMovement() {
  const queryClient = useQueryClient();
  const { profile, user } = useAuth();

  return useMutation({
    mutationFn: async (input: StockMovementInput) => {
      if (!profile?.organization_id) throw new Error('Organização não encontrada');

      // Get current stock
      const { data: product, error: productError } = await supabase
        .from('lead_products')
        .select('stock_quantity')
        .eq('id', input.product_id)
        .single();

      if (productError) throw productError;

      const previousQuantity = product.stock_quantity || 0;
      let newQuantity = previousQuantity;

      // Calculate new quantity based on movement type
      switch (input.movement_type) {
        case 'entry':
        case 'return':
          newQuantity = previousQuantity + input.quantity;
          break;
        case 'exit':
        case 'sale':
          newQuantity = previousQuantity - input.quantity;
          break;
        case 'adjustment':
          newQuantity = input.quantity; // Adjustment sets absolute value
          break;
      }

      // Estoque negativo é permitido conforme configuração da organização
      // A validação agora é feita apenas para exibir alertas, não para bloquear

      // Create movement record
      const { data: movement, error: movementError } = await supabase
        .from('stock_movements')
        .insert({
          organization_id: profile.organization_id,
          product_id: input.product_id,
          movement_type: input.movement_type,
          quantity: input.quantity,
          previous_quantity: previousQuantity,
          new_quantity: newQuantity,
          notes: input.notes,
          reference_id: input.reference_id,
          reference_type: input.reference_type,
          created_by: user?.id,
        })
        .select()
        .single();

      if (movementError) throw movementError;

      // Update product stock
      const { error: updateError } = await supabase
        .from('lead_products')
        .update({ stock_quantity: newQuantity })
        .eq('id', input.product_id);

      if (updateError) throw updateError;

      return movement;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['product', variables.product_id] });
      queryClient.invalidateQueries({ queryKey: ['stock-movements'] });
      toast.success('Movimentação de estoque registrada!');
    },
    onError: (error: Error) => {
      console.error('Erro ao registrar movimentação:', error);
      toast.error(error.message || 'Erro ao registrar movimentação de estoque');
    },
  });
}

// Helper to get movement type label
export function getMovementTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    entry: 'Entrada',
    exit: 'Saída',
    adjustment: 'Ajuste',
    sale: 'Venda',
    return: 'Devolução',
  };
  return labels[type] || type;
}

// Helper to get movement type color
export function getMovementTypeColor(type: string): string {
  const colors: Record<string, string> = {
    entry: 'text-green-600',
    exit: 'text-red-600',
    adjustment: 'text-blue-600',
    sale: 'text-orange-600',
    return: 'text-purple-600',
  };
  return colors[type] || 'text-muted-foreground';
}
