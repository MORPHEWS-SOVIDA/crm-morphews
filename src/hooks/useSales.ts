import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export type SaleStatus = 
  | 'draft'
  | 'pending_expedition'
  | 'dispatched'
  | 'delivered'
  | 'payment_pending'
  | 'payment_confirmed'
  | 'cancelled';

export type DeliveryStatus =
  | 'pending'
  | 'delivered_normal'
  | 'delivered_missing_prescription'
  | 'delivered_no_money'
  | 'delivered_no_card_limit'
  | 'delivered_customer_absent'
  | 'delivered_customer_denied'
  | 'delivered_customer_gave_up'
  | 'delivered_wrong_product'
  | 'delivered_missing_product'
  | 'delivered_insufficient_address'
  | 'delivered_wrong_time'
  | 'delivered_other';

export interface Sale {
  id: string;
  organization_id: string;
  lead_id: string;
  created_by: string;
  expedition_validated_at: string | null;
  expedition_validated_by: string | null;
  assigned_delivery_user_id: string | null;
  dispatched_at: string | null;
  delivery_status: DeliveryStatus;
  delivery_notes: string | null;
  delivered_at: string | null;
  subtotal_cents: number;
  discount_type: 'percentage' | 'fixed' | null;
  discount_value: number;
  discount_cents: number;
  total_cents: number;
  payment_confirmed_at: string | null;
  payment_confirmed_by: string | null;
  payment_method: string | null;
  payment_notes: string | null;
  payment_proof_url: string | null;
  invoice_pdf_url: string | null;
  invoice_xml_url: string | null;
  status: SaleStatus;
  created_at: string;
  updated_at: string;
  // Joined data
  lead?: {
    id: string;
    name: string;
    whatsapp: string;
    email: string | null;
    street: string | null;
    street_number: string | null;
    complement: string | null;
    neighborhood: string | null;
    city: string | null;
    state: string | null;
    cep: string | null;
  };
  items?: SaleItem[];
  created_by_profile?: {
    first_name: string;
    last_name: string;
  };
  delivery_user_profile?: {
    first_name: string;
    last_name: string;
  };
}

export interface SaleItem {
  id: string;
  sale_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price_cents: number;
  discount_cents: number;
  total_cents: number;
  notes: string | null;
  created_at: string;
}

export interface CreateSaleData {
  lead_id: string;
  items: {
    product_id: string;
    product_name: string;
    quantity: number;
    unit_price_cents: number;
    discount_cents?: number;
  }[];
  discount_type?: 'percentage' | 'fixed' | null;
  discount_value?: number;
}

export interface UpdateSaleData {
  status?: SaleStatus;
  delivery_status?: DeliveryStatus;
  delivery_notes?: string;
  assigned_delivery_user_id?: string | null;
  payment_method?: string;
  payment_notes?: string;
  payment_proof_url?: string;
  invoice_pdf_url?: string;
  invoice_xml_url?: string;
}

// Helper functions
export function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

export function getStatusLabel(status: SaleStatus): string {
  const labels: Record<SaleStatus, string> = {
    draft: 'Rascunho',
    pending_expedition: 'Aguardando Expedição',
    dispatched: 'Despachado',
    delivered: 'Entregue',
    payment_pending: 'Aguardando Pagamento',
    payment_confirmed: 'Pagamento Confirmado',
    cancelled: 'Cancelado',
  };
  return labels[status] || status;
}

export function getStatusColor(status: SaleStatus): string {
  const colors: Record<SaleStatus, string> = {
    draft: 'bg-slate-100 text-slate-700',
    pending_expedition: 'bg-orange-100 text-orange-700',
    dispatched: 'bg-blue-100 text-blue-700',
    delivered: 'bg-green-100 text-green-700',
    payment_pending: 'bg-yellow-100 text-yellow-700',
    payment_confirmed: 'bg-emerald-100 text-emerald-700',
    cancelled: 'bg-red-100 text-red-700',
  };
  return colors[status] || 'bg-gray-100 text-gray-700';
}

export function getDeliveryStatusLabel(status: DeliveryStatus): string {
  const labels: Record<DeliveryStatus, string> = {
    pending: 'Pendente',
    delivered_normal: 'Normal',
    delivered_missing_prescription: 'Falta receita',
    delivered_no_money: 'Cliente sem dinheiro',
    delivered_no_card_limit: 'Cliente sem limite cartão',
    delivered_customer_absent: 'Cliente ausente',
    delivered_customer_denied: 'Cliente disse que não pediu',
    delivered_customer_gave_up: 'Cliente desistiu',
    delivered_wrong_product: 'Produto enviado errado',
    delivered_missing_product: 'Produto faltante',
    delivered_insufficient_address: 'Endereço insuficiente',
    delivered_wrong_time: 'Motoboy foi em horário errado',
    delivered_other: 'Outros',
  };
  return labels[status] || status;
}

export function useSales(filters?: { status?: SaleStatus }) {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['sales', profile?.organization_id, filters],
    queryFn: async () => {
      if (!profile?.organization_id) return [];

      let query = supabase
        .from('sales')
        .select(`
          *,
          lead:leads(id, name, whatsapp, email, street, street_number, complement, neighborhood, city, state, cep)
        `)
        .eq('organization_id', profile.organization_id)
        .order('created_at', { ascending: false });

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as Sale[];
    },
    enabled: !!profile?.organization_id,
  });
}

export function useSale(id: string | undefined) {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['sale', id],
    queryFn: async () => {
      if (!id || !profile?.organization_id) return null;

      const { data: sale, error: saleError } = await supabase
        .from('sales')
        .select(`
          *,
          lead:leads(id, name, whatsapp, email, street, street_number, complement, neighborhood, city, state, cep)
        `)
        .eq('id', id)
        .eq('organization_id', profile.organization_id)
        .maybeSingle();

      if (saleError) throw saleError;
      if (!sale) return null;

      const { data: items, error: itemsError } = await supabase
        .from('sale_items')
        .select('*')
        .eq('sale_id', id)
        .order('created_at', { ascending: true });

      if (itemsError) throw itemsError;

      return { ...sale, items: items || [] } as Sale;
    },
    enabled: !!id && !!profile?.organization_id,
  });
}

export function useCreateSale() {
  const queryClient = useQueryClient();
  const { user, profile } = useAuth();

  return useMutation({
    mutationFn: async (data: CreateSaleData) => {
      if (!profile?.organization_id || !user?.id) {
        throw new Error('Usuário não autenticado');
      }

      // Calculate totals
      const subtotal_cents = data.items.reduce((sum, item) => {
        const itemTotal = (item.unit_price_cents * item.quantity) - (item.discount_cents || 0);
        return sum + itemTotal;
      }, 0);

      let discount_cents = 0;
      if (data.discount_type === 'percentage' && data.discount_value) {
        discount_cents = Math.round(subtotal_cents * (data.discount_value / 100));
      } else if (data.discount_type === 'fixed' && data.discount_value) {
        discount_cents = data.discount_value;
      }

      const total_cents = subtotal_cents - discount_cents;

      // Create sale
      const { data: sale, error: saleError } = await supabase
        .from('sales')
        .insert({
          organization_id: profile.organization_id,
          lead_id: data.lead_id,
          created_by: user.id,
          subtotal_cents,
          discount_type: data.discount_type || null,
          discount_value: data.discount_value || 0,
          discount_cents,
          total_cents,
          status: 'draft',
        })
        .select()
        .single();

      if (saleError) throw saleError;

      // Create sale items
      const itemsToInsert = data.items.map(item => ({
        sale_id: sale.id,
        product_id: item.product_id,
        product_name: item.product_name,
        quantity: item.quantity,
        unit_price_cents: item.unit_price_cents,
        discount_cents: item.discount_cents || 0,
        total_cents: (item.unit_price_cents * item.quantity) - (item.discount_cents || 0),
      }));

      const { error: itemsError } = await supabase
        .from('sale_items')
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      // Record status history
      await supabase.from('sale_status_history').insert({
        sale_id: sale.id,
        organization_id: profile.organization_id,
        new_status: 'draft',
        changed_by: user.id,
      });

      return sale;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      toast.success('Venda criada com sucesso!');
    },
    onError: (error: Error) => {
      console.error('Erro ao criar venda:', error);
      toast.error('Erro ao criar venda. Verifique os dados e tente novamente.');
    },
  });
}

export function useUpdateSale() {
  const queryClient = useQueryClient();
  const { user, profile } = useAuth();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateSaleData }) => {
      const updateData: Record<string, unknown> = { ...data };
      
      // Handle status-specific timestamps
      if (data.status === 'pending_expedition') {
        updateData.expedition_validated_at = new Date().toISOString();
        updateData.expedition_validated_by = user?.id;
      } else if (data.status === 'dispatched') {
        updateData.dispatched_at = new Date().toISOString();
      } else if (data.status === 'delivered') {
        updateData.delivered_at = new Date().toISOString();
      } else if (data.status === 'payment_confirmed') {
        updateData.payment_confirmed_at = new Date().toISOString();
        updateData.payment_confirmed_by = user?.id;
      }

      const { data: sale, error } = await supabase
        .from('sales')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // Record status change if status was updated
      if (data.status && profile?.organization_id) {
        await supabase.from('sale_status_history').insert({
          sale_id: id,
          organization_id: profile.organization_id,
          new_status: data.status,
          changed_by: user?.id,
        });
      }

      return sale;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['sale', variables.id] });
      toast.success('Venda atualizada com sucesso!');
    },
    onError: (error: Error) => {
      console.error('Erro ao atualizar venda:', error);
      toast.error('Erro ao atualizar venda.');
    },
  });
}

export function useDeleteSale() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('sales')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      toast.success('Venda excluída com sucesso!');
    },
    onError: (error: Error) => {
      console.error('Erro ao excluir venda:', error);
      toast.error('Erro ao excluir venda.');
    },
  });
}

// Hook for entregadores to get their assigned sales
export function useMyDeliveries() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['my-deliveries', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from('sales')
        .select(`
          *,
          lead:leads(id, name, whatsapp, email, street, street_number, complement, neighborhood, city, state, cep)
        `)
        .eq('assigned_delivery_user_id', user.id)
        .in('status', ['dispatched', 'delivered'])
        .order('dispatched_at', { ascending: false });

      if (error) throw error;
      return data as Sale[];
    },
    enabled: !!user?.id,
  });
}
