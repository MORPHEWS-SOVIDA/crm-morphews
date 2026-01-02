import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentTenantId } from '@/hooks/useTenant';
import { useMyPermissions } from '@/hooks/useUserPermissions';
import { toast } from 'sonner';

export type SaleStatus = 
  | 'draft'
  | 'pending_expedition'
  | 'dispatched'
  | 'delivered'
  | 'payment_pending'
  | 'payment_confirmed'
  | 'cancelled'
  | 'returned';

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
  romaneio_number: number;
  organization_id: string;
  lead_id: string;
  created_by: string;
  seller_user_id: string | null;
  expedition_validated_at: string | null;
  expedition_validated_by: string | null;
  assigned_delivery_user_id: string | null;
  dispatched_at: string | null;
  delivery_status: DeliveryStatus;
  delivery_notes: string | null;
  delivered_at: string | null;
  delivery_type: DeliveryType;
  delivery_region_id: string | null;
  scheduled_delivery_date: string | null;
  scheduled_delivery_shift: 'morning' | 'afternoon' | 'full_day' | null;
  shipping_carrier_id: string | null;
  shipping_cost_cents: number;
  subtotal_cents: number;
  discount_type: 'percentage' | 'fixed' | null;
  discount_value: number;
  discount_cents: number;
  total_cents: number;
  payment_confirmed_at: string | null;
  payment_confirmed_by: string | null;
  payment_method: string | null;
  payment_method_id: string | null;
  payment_installments: number | null;
  payment_notes: string | null;
  payment_proof_url: string | null;
  invoice_pdf_url: string | null;
  invoice_xml_url: string | null;
  status: SaleStatus;
  created_at: string;
  updated_at: string;
  // Return/reschedule fields
  return_reason_id: string | null;
  return_notes: string | null;
  returned_at: string | null;
  returned_by: string | null;
  // Delivery position for route ordering
  delivery_position: number;
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
    secondary_phone: string | null;
    delivery_notes: string | null;
    google_maps_link: string | null;
  };
  items?: SaleItem[];
  created_by_profile?: {
    first_name: string;
    last_name: string;
  };
  seller_profile?: {
    first_name: string;
    last_name: string;
  };
  delivery_user_profile?: {
    first_name: string;
    last_name: string;
  };
  return_reason?: {
    id: string;
    name: string;
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
  requisition_number: string | null;
  created_at: string;
}

export type DeliveryType = 'pickup' | 'motoboy' | 'carrier';

export interface CreateSaleData {
  lead_id: string;
  seller_user_id?: string | null;
  items: {
    product_id: string;
    product_name: string;
    quantity: number;
    unit_price_cents: number;
    discount_cents?: number;
    requisition_number?: string | null;
  }[];
  discount_type?: 'percentage' | 'fixed' | null;
  discount_value?: number;
  // Delivery fields
  delivery_type?: DeliveryType;
  delivery_region_id?: string | null;
  scheduled_delivery_date?: string | null;
  scheduled_delivery_shift?: 'morning' | 'afternoon' | 'full_day' | null;
  shipping_carrier_id?: string | null;
  shipping_cost_cents?: number;
  // Payment fields
  payment_method_id?: string | null;
  payment_installments?: number;
}

export interface UpdateSaleData {
  status?: SaleStatus;
  delivery_status?: DeliveryStatus;
  delivery_notes?: string;
  assigned_delivery_user_id?: string | null;
  payment_method?: string;
  payment_method_id?: string | null;
  payment_installments?: number;
  payment_notes?: string;
  payment_proof_url?: string;
  invoice_pdf_url?: string;
  invoice_xml_url?: string;
  // Delivery fields
  delivery_type?: DeliveryType;
  delivery_region_id?: string | null;
  scheduled_delivery_date?: string | null;
  scheduled_delivery_shift?: 'morning' | 'afternoon' | 'full_day' | null;
  shipping_carrier_id?: string | null;
  shipping_cost_cents?: number;
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
    returned: 'Voltou / Reagendar',
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
    returned: 'bg-amber-100 text-amber-700',
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

function useOrganizationId() {
  const { profile } = useAuth();
  const { data: tenantId } = useCurrentTenantId();
  return profile?.organization_id ?? tenantId ?? null;
}

export function useSales(filters?: { status?: SaleStatus }) {
  const organizationId = useOrganizationId();
  const { user } = useAuth();
  const { data: permissions, isLoading: permissionsLoading } = useMyPermissions();

  return useQuery({
    queryKey: ['sales', organizationId, filters, user?.id, permissions?.sales_view_all],
    queryFn: async () => {
      if (!organizationId) return [];

      let query = supabase
        .from('sales')
        .select(`
          *,
          lead:leads(id, name, whatsapp, email, street, street_number, complement, neighborhood, city, state, cep, secondary_phone, delivery_notes, google_maps_link)
        `)
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }

      // Filter by user if they don't have sales_view_all permission
      if (!permissions?.sales_view_all && user?.id) {
        // User can only see sales they created or are the seller of
        query = query.or(`created_by.eq.${user.id},seller_user_id.eq.${user.id}`);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Fetch seller profiles separately
      const sellerUserIds = [...new Set((data || []).map(s => s.seller_user_id).filter(Boolean))] as string[];
      
      let sellerProfiles: Record<string, { first_name: string; last_name: string }> = {};
      
      if (sellerUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, first_name, last_name')
          .in('user_id', sellerUserIds);
        
        if (profiles) {
          sellerProfiles = profiles.reduce((acc, p) => {
            acc[p.user_id] = { first_name: p.first_name, last_name: p.last_name };
            return acc;
          }, {} as Record<string, { first_name: string; last_name: string }>);
        }
      }

      // Merge seller profiles into sales
      const salesWithProfiles = (data || []).map(sale => ({
        ...sale,
        seller_profile: sale.seller_user_id ? sellerProfiles[sale.seller_user_id] : undefined,
      }));

      return salesWithProfiles as Sale[];
    },
    enabled: !!organizationId && !permissionsLoading,
  });
}

export function useSale(id: string | undefined) {
  const organizationId = useOrganizationId();

  return useQuery({
    queryKey: ['sale', id, organizationId],
    queryFn: async () => {
      if (!id || !organizationId) return null;

      const { data: sale, error: saleError } = await supabase
        .from('sales')
        .select(`
          *,
          lead:leads(id, name, whatsapp, email, street, street_number, complement, neighborhood, city, state, cep, secondary_phone, delivery_notes, google_maps_link),
          return_reason:delivery_return_reasons(id, name)
        `)
        .eq('id', id)
        .eq('organization_id', organizationId)
        .maybeSingle();

      if (saleError) throw saleError;
      if (!sale) return null;

      const { data: items, error: itemsError } = await supabase
        .from('sale_items')
        .select('*')
        .eq('sale_id', id)
        .order('created_at', { ascending: true });

      if (itemsError) throw itemsError;

      // Fetch seller and created_by profiles
      let seller_profile = null;
      let created_by_profile = null;

      if (sale.seller_user_id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('first_name, last_name')
          .eq('user_id', sale.seller_user_id)
          .maybeSingle();
        seller_profile = profile;
      }

      if (sale.created_by) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('first_name, last_name')
          .eq('user_id', sale.created_by)
          .maybeSingle();
        created_by_profile = profile;
      }

      return { 
        ...sale, 
        items: items || [],
        seller_profile,
        created_by_profile,
        return_reason: sale.return_reason
      } as Sale;
    },
    enabled: !!id && !!organizationId,
  });
}

export function useCreateSale() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const organizationId = useOrganizationId();

  return useMutation({
    mutationFn: async (data: CreateSaleData) => {
      if (!organizationId || !user?.id) {
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

      // Add shipping cost if applicable
      const shippingCost = data.shipping_cost_cents || 0;
      const total_cents = subtotal_cents - discount_cents + shippingCost;

      // Resolve assigned delivery user for motoboy (based on region)
      let assignedDeliveryUserId: string | null = null;
      if (data.delivery_type === 'motoboy' && data.delivery_region_id) {
        const { data: region, error: regionError } = await supabase
          .from('delivery_regions')
          .select('assigned_user_id')
          .eq('id', data.delivery_region_id)
          .maybeSingle();

        if (regionError) throw regionError;
        assignedDeliveryUserId = region?.assigned_user_id ?? null;
      }

      // Create sale
      const { data: sale, error: saleError } = await supabase
        .from('sales')
        .insert({
          organization_id: organizationId,
          lead_id: data.lead_id,
          created_by: user.id,
          seller_user_id: data.seller_user_id || user.id,
          subtotal_cents,
          discount_type: data.discount_type || null,
          discount_value: data.discount_value || 0,
          discount_cents,
          total_cents,
          status: 'draft',
          delivery_type: data.delivery_type || 'pickup',
          delivery_region_id: data.delivery_region_id || null,
          scheduled_delivery_date: data.scheduled_delivery_date || null,
          scheduled_delivery_shift: data.scheduled_delivery_shift || null,
          shipping_carrier_id: data.shipping_carrier_id || null,
          shipping_cost_cents: shippingCost,
          assigned_delivery_user_id: assignedDeliveryUserId,
          payment_method_id: data.payment_method_id || null,
          payment_installments: data.payment_installments || 1,
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
        requisition_number: item.requisition_number || null,
      }));

      const { error: itemsError } = await supabase
        .from('sale_items')
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      // Reserve stock for sale items
      const { error: stockError } = await supabase.rpc('reserve_stock_for_sale', {
        _sale_id: sale.id,
      });
      
      if (stockError) {
        console.error('Erro ao reservar estoque:', stockError);
        // Don't fail the sale, just log the error
      }

      // Record status history
      await supabase.from('sale_status_history').insert({
        sale_id: sale.id,
        organization_id: organizationId,
        new_status: 'draft',
        changed_by: user.id,
      });

      return sale;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
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
  const { user } = useAuth();
  const organizationId = useOrganizationId();

  return useMutation({
    mutationFn: async ({ id, data, previousStatus }: { id: string; data: UpdateSaleData; previousStatus?: SaleStatus }) => {
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
      } else if (data.status === 'returned') {
        updateData.returned_at = new Date().toISOString();
        updateData.returned_by = user?.id;
      } else if (data.status === 'draft' && previousStatus === 'returned') {
        // When rescheduling from returned, clear delivery/return data for fresh start
        updateData.dispatched_at = null;
        updateData.delivered_at = null;
        updateData.return_reason_id = null;
        updateData.return_notes = null;
        updateData.returned_at = null;
        updateData.returned_by = null;
        updateData.delivery_status = 'pending';
      }

      const { data: sale, error } = await supabase
        .from('sales')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // Handle stock movements based on status changes
      if (data.status) {
        // When sale is marked as delivered, deduct real stock
        if (data.status === 'delivered') {
          const { error: stockError } = await supabase.rpc('deduct_stock_for_delivered_sale', {
            _sale_id: id,
          });
          if (stockError) console.error('Erro ao baixar estoque:', stockError);
        }
        
        // When sale is cancelled
        if (data.status === 'cancelled') {
          // If it was already delivered, restore the stock
          if (previousStatus === 'delivered' || previousStatus === 'payment_confirmed') {
            const { error: restoreError } = await supabase.rpc('restore_stock_for_cancelled_delivered_sale', {
              _sale_id: id,
            });
            if (restoreError) console.error('Erro ao restaurar estoque:', restoreError);
          } else {
            // If not delivered yet, just unreserve
            const { error: unreserveError } = await supabase.rpc('unreserve_stock_for_sale', {
              _sale_id: id,
            });
            if (unreserveError) console.error('Erro ao liberar reserva:', unreserveError);
          }
        }
      }

      // Record status change if status was updated
       if (data.status && organizationId) {
         await supabase.from('sale_status_history').insert({
           sale_id: id,
           organization_id: organizationId,
           new_status: data.status,
           changed_by: user?.id,
         });
       }

      return sale;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['sale', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['stock-movements'] });
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
          lead:leads(id, name, whatsapp, email, street, street_number, complement, neighborhood, city, state, cep, secondary_phone, delivery_notes, google_maps_link)
        `)
        .eq('assigned_delivery_user_id', user.id)
        .in('status', ['dispatched', 'delivered', 'returned'])
        .order('dispatched_at', { ascending: false });

      if (error) throw error;
      return data as Sale[];
    },
    enabled: !!user?.id,
  });
}

// Hook to get sales for a specific lead
export function useLeadSales(leadId: string | undefined) {
  const organizationId = useOrganizationId();

  return useQuery({
    queryKey: ['lead-sales', leadId, organizationId],
    queryFn: async () => {
      if (!leadId || !organizationId) return [];

      const { data, error } = await supabase
        .from('sales')
        .select('*')
        .eq('lead_id', leadId)
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Sale[];
    },
    enabled: !!leadId && !!organizationId,
  });
}
