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
  tracking_code: string | null;
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
  payment_status: 'not_paid' | 'will_pay_before' | 'paid_now' | null;
  missing_payment_proof: boolean;
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
  // Return proof fields (photo and location when motoboy marks as not delivered)
  return_photo_url: string | null;
  return_latitude: number | null;
  return_longitude: number | null;
  // Motoboy tracking status
  motoboy_tracking_status: string | null;
  // Carrier tracking status
  carrier_tracking_status: string | null;
  // Delivery position for route ordering
  delivery_position: number;
  // Integration observation fields
  observation_1: string | null;
  observation_2: string | null;
  // External order fields
  external_order_id: string | null;
  external_order_url: string | null;
  external_source: string | null;
  // Commission fields
  seller_commission_percentage: number | null;
  seller_commission_cents: number | null;
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
  melhor_envio_labels?: Array<{
    id: string;
    label_pdf_url: string | null;
    tracking_code: string | null;
    status: string | null;
  }>;
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
  // Kit tracking fields for expedition/romaneio clarity (optional for backwards compatibility)
  kit_id?: string | null;
  kit_quantity?: number;
  multiplier?: number;
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
    // Commission fields
    commission_percentage?: number;
    commission_cents?: number;
    // Kit tracking fields for expedition/romaneio clarity
    kit_id?: string | null;
    kit_quantity?: number;
    multiplier?: number;
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
  shipping_address_id?: string | null;
  // Payment fields
  payment_method_id?: string | null;
  payment_installments?: number;
  // Payment status at creation
  payment_status?: 'not_paid' | 'will_pay_before' | 'paid_now';
  payment_proof_url?: string | null;
  // Commission fields (total)
  seller_commission_percentage?: number;
  seller_commission_cents?: number;
  // Observation fields
  observation_1?: string | null;
  observation_2?: string | null;
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
  tracking_code?: string | null;
  // Motoboy tracking
  motoboy_tracking_status?: string | null;
  // Integration observations
  observation_1?: string | null;
  observation_2?: string | null;
  // Delivery timestamps (for manual date selection)
  delivered_at?: string | null;
  returned_at?: string | null;
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

export function useSales(filters?: { status?: SaleStatus; limit?: number }) {
  const organizationId = useOrganizationId();
  const { user } = useAuth();
  const { data: permissions, isLoading: permissionsLoading } = useMyPermissions();
  const limit = filters?.limit ?? 500; // Default limit for better performance

  return useQuery({
    queryKey: ['sales', organizationId, filters, user?.id, permissions?.sales_view_all],
    queryFn: async () => {
      if (!organizationId) return [];

      let query = supabase
        .from('sales')
        .select(`
          *,
          lead:leads(id, name, whatsapp, email, street, street_number, complement, neighborhood, city, state, cep, secondary_phone, delivery_notes, google_maps_link, lead_source),
          items:sale_items(id, sale_id, product_id, product_name, quantity, unit_price_cents, discount_cents, total_cents, notes, requisition_number, created_at)
        `)
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
        .limit(limit);

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

      // Fetch seller profiles and delivery user profiles separately
      const sellerUserIds = [...new Set((data || []).map(s => s.seller_user_id).filter(Boolean))] as string[];
      const deliveryUserIds = [...new Set((data || []).map(s => s.assigned_delivery_user_id).filter(Boolean))] as string[];
      const allUserIds = [...new Set([...sellerUserIds, ...deliveryUserIds])];
      
      let userProfiles: Record<string, { first_name: string; last_name: string }> = {};
      
      if (allUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, first_name, last_name')
          .in('user_id', allUserIds);
        
        if (profiles) {
          userProfiles = profiles.reduce((acc, p) => {
            acc[p.user_id] = { first_name: p.first_name, last_name: p.last_name };
            return acc;
          }, {} as Record<string, { first_name: string; last_name: string }>);
        }
      }

      // Merge profiles into sales
      const salesWithProfiles = (data || []).map(sale => ({
        ...sale,
        seller_profile: sale.seller_user_id ? userProfiles[sale.seller_user_id] : undefined,
        delivery_user_profile: sale.assigned_delivery_user_id ? userProfiles[sale.assigned_delivery_user_id] : undefined,
      }));

      return salesWithProfiles as Sale[];
    },
    enabled: !!organizationId && !permissionsLoading,
    staleTime: 3 * 60 * 1000, // 3 minutes - reduce refetches
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
          lead:leads(id, name, whatsapp, email, street, street_number, complement, neighborhood, city, state, cep, secondary_phone, delivery_notes, google_maps_link, cpf_cnpj, birth_date, gender, favorite_team),
          return_reason:delivery_return_reasons(id, name),
          shipping_address:lead_addresses(id, label, street, street_number, complement, neighborhood, city, state, cep, delivery_notes, google_maps_link, delivery_region_id),
          delivery_region:delivery_regions!sales_delivery_region_id_fkey(id, name),
          shipping_carrier:shipping_carriers(id, name, correios_service_code),
          payment_method_data:payment_methods!sales_payment_method_id_fkey(id, name, category)
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
      let assigned_delivery_user_profile = null;

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

      if (sale.assigned_delivery_user_id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('first_name, last_name')
          .eq('user_id', sale.assigned_delivery_user_id)
          .maybeSingle();
        assigned_delivery_user_profile = profile;
      }

      return { 
        ...sale, 
        items: items || [],
        seller_profile,
        created_by_profile,
        assigned_delivery_user_profile,
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

      // Validate items - cannot create sale without products
      if (!data.items || data.items.length === 0) {
        throw new Error('Nenhum produto selecionado. Adicione pelo menos um produto para criar a venda.');
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

      // Calculate total commission from items
      const totalCommissionCents = data.items.reduce((sum, item) => {
        return sum + (item.commission_cents || 0);
      }, 0);
      
      // Use provided commission or calculate from items
      const sellerCommissionCents = data.seller_commission_cents ?? totalCommissionCents;
      const sellerCommissionPercentage = data.seller_commission_percentage ?? 
        (total_cents > 0 ? (sellerCommissionCents / total_cents) * 100 : 0);

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
          shipping_address_id: data.shipping_address_id || null,
          assigned_delivery_user_id: assignedDeliveryUserId,
          payment_method_id: data.payment_method_id || null,
          payment_installments: data.payment_installments || 1,
          payment_status: data.payment_status || 'not_paid',
          payment_proof_url: data.payment_proof_url || null,
          seller_commission_percentage: sellerCommissionPercentage,
          seller_commission_cents: sellerCommissionCents,
          observation_1: data.observation_1 || null,
          observation_2: data.observation_2 || null,
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
        commission_percentage: item.commission_percentage || 0,
        commission_cents: item.commission_cents || 0,
        // Kit tracking for expedition/romaneio clarity
        kit_id: item.kit_id || null,
        kit_quantity: item.kit_quantity || 1,
        multiplier: item.multiplier || item.quantity,
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

      // CANCEL any pending scheduled messages for this lead (sale was created)
      try {
        const { data: pendingMessages } = await supabase
          .from('lead_scheduled_messages')
          .select('id')
          .eq('lead_id', data.lead_id)
          .eq('organization_id', organizationId)
          .eq('status', 'pending');

        if (pendingMessages && pendingMessages.length > 0) {
          const ids = pendingMessages.map(m => m.id);
          await supabase
            .from('lead_scheduled_messages')
            .update({
              status: 'cancelled',
              cancelled_at: new Date().toISOString(),
              cancel_reason: 'Venda efetuada para o cliente',
              updated_at: new Date().toISOString(),
            })
            .in('id', ids);
          console.log(`Cancelled ${ids.length} pending follow-up messages due to sale creation`);
        }
      } catch (cancelError) {
        console.error('Error cancelling scheduled messages:', cancelError);
        // Don't fail the sale, just log the error
      }

      // Create installments for receivables tracking
      // This is important for financial conciliation and accounts receivable
      if (data.payment_method_id) {
        try {
          // Get payment method details to determine installment flow and settlement days
          const { data: paymentMethod } = await supabase
            .from('payment_methods')
            .select(`
              *,
              transaction_fees:payment_method_transaction_fees(*)
            `)
            .eq('id', data.payment_method_id)
            .single();

          if (paymentMethod) {
            const installmentCount = data.payment_installments || 1;
            const baseAmount = Math.floor(total_cents / installmentCount);
            const remainder = total_cents - (baseAmount * installmentCount);
            
            // Determine if this is anticipation flow or regular flow
            const isAnticipation = paymentMethod.installment_flow === 'anticipation';
            const anticipationFee = paymentMethod.anticipation_fee_percentage || 0;
            
            // Get the settlement days - for credit installments, use method's settlement days
            // Default to 30 days if not specified
            const settlementDays = paymentMethod.settlement_days || 30;
            
            const installmentsToCreate = [];
            
            for (let i = 0; i < installmentCount; i++) {
              const dueDate = new Date();
              
              if (isAnticipation) {
                // All installments received on same date (anticipation)
                dueDate.setDate(dueDate.getDate() + settlementDays);
              } else {
                // Regular flow - each installment received after N days apart
                dueDate.setDate(dueDate.getDate() + (settlementDays * (i + 1)));
              }
              
              let amount = baseAmount + (i === 0 ? remainder : 0);
              let feeAmount = 0;
              
              // If anticipation, calculate and apply fee to each installment
              if (isAnticipation && anticipationFee > 0) {
                feeAmount = Math.round(amount * (anticipationFee / 100));
              }
              
              installmentsToCreate.push({
                sale_id: sale.id,
                organization_id: organizationId,
                installment_number: i + 1,
                total_installments: installmentCount,
                amount_cents: amount,
                fee_cents: feeAmount,
                fee_percentage: isAnticipation ? anticipationFee : (paymentMethod.fee_percentage || 0),
                net_amount_cents: amount - feeAmount,
                due_date: dueDate.toISOString().split('T')[0],
                status: 'pending',
                acquirer_id: paymentMethod.acquirer_id || null,
              });
            }
            
            if (installmentsToCreate.length > 0) {
              await supabase
                .from('sale_installments')
                .insert(installmentsToCreate);
            }
          }
        } catch (installmentError) {
          console.error('Erro ao criar parcelas:', installmentError);
          // Don't fail the sale, installments can be created manually later
        }
      }

      // Update lead's negotiated_value with the sale total
      if (data.lead_id) {
        // Get current lead's negotiated_value
        const { data: lead } = await supabase
          .from('leads')
          .select('negotiated_value')
          .eq('id', data.lead_id)
          .single();
        
        // Add this sale's value to the negotiated_value
        const currentNegotiated = lead?.negotiated_value || 0;
        const newNegotiated = currentNegotiated + (total_cents / 100);
        
        await supabase
          .from('leads')
          .update({ negotiated_value: newNegotiated })
          .eq('id', data.lead_id);
      }

      // =================================================================
      // AUTOMAÇÃO PÓS-VENDA: Mover lead para etapa configurada
      // Se a etapa tiver um follow-up padrão, será disparado automaticamente
      // =================================================================
      try {
        // Fetch automation config
        const { data: automationConfig } = await supabase
          .from('ecommerce_automation_config')
          .select('receptivo_sale_funnel_stage_id')
          .eq('organization_id', organizationId)
          .maybeSingle();

        if (automationConfig?.receptivo_sale_funnel_stage_id && data.lead_id) {
          const targetStageId = automationConfig.receptivo_sale_funnel_stage_id;

          // Get the target stage to check for default follow-up
          const { data: targetStage } = await supabase
            .from('organization_funnel_stages')
            .select('id, name, default_followup_reason_id')
            .eq('id', targetStageId)
            .single();

          if (targetStage) {
            // Move lead to the target stage
            await supabase
              .from('leads')
              .update({ 
                funnel_stage_id: targetStageId,
                updated_at: new Date().toISOString(),
              })
              .eq('id', data.lead_id);

            console.log(`[Post-sale Automation] Lead ${data.lead_id} moved to stage "${targetStage.name}"`);

            // If the stage has a default follow-up reason, schedule the messages
            if (targetStage.default_followup_reason_id) {
              // Get lead info for message scheduling
              const { data: leadData } = await supabase
                .from('leads')
                .select('name, whatsapp')
                .eq('id', data.lead_id)
                .single();

              if (leadData) {
                // Get templates for the follow-up reason
                const { data: templates } = await supabase
                  .from('non_purchase_message_templates')
                  .select('*')
                  .eq('non_purchase_reason_id', targetStage.default_followup_reason_id)
                  .eq('is_active', true)
                  .order('position', { ascending: true });

                if (templates && templates.length > 0) {
                  // Schedule messages
                  const scheduledMessages = templates.map((template) => {
                    const scheduledAt = new Date(new Date().getTime() + template.delay_minutes * 60 * 1000);
                    
                    // Apply business hours if configured
                    if (template.send_start_hour !== null && template.send_end_hour !== null) {
                      const hour = scheduledAt.getHours();
                      if (hour < template.send_start_hour) {
                        scheduledAt.setHours(template.send_start_hour, 0, 0, 0);
                      } else if (hour >= template.send_end_hour) {
                        scheduledAt.setDate(scheduledAt.getDate() + 1);
                        scheduledAt.setHours(template.send_start_hour, 0, 0, 0);
                      }
                    }

                    // Replace variables
                    const firstName = leadData.name?.split(' ')[0] || leadData.name || '';
                    const finalMessage = template.message_template
                      .replace(/\{\{nome\}\}/gi, leadData.name || '')
                      .replace(/\{\{primeiro_nome\}\}/gi, firstName);

                    return {
                      organization_id: organizationId,
                      lead_id: data.lead_id,
                      lead_name: leadData.name,
                      lead_whatsapp: leadData.whatsapp,
                      non_purchase_reason_id: targetStage.default_followup_reason_id,
                      template_id: template.id,
                      message: finalMessage,
                      final_message: finalMessage,
                      original_scheduled_at: scheduledAt.toISOString(),
                      media_url: template.media_url || null,
                      media_filename: template.media_filename || null,
                      scheduled_at: scheduledAt.toISOString(),
                      status: 'pending',
                    };
                  });

                  const { error: insertError } = await supabase
                    .from('lead_scheduled_messages')
                    .insert(scheduledMessages);

                  if (!insertError) {
                    console.log(`[Post-sale Automation] Scheduled ${scheduledMessages.length} follow-up messages for lead ${data.lead_id}`);
                  } else {
                    console.error('[Post-sale Automation] Error scheduling messages:', insertError);
                  }
                }
              }
            }
          }
        }
      } catch (automationError) {
        console.error('[Post-sale Automation] Error:', automationError);
        // Don't fail the sale due to automation errors
      }

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
        // Use provided delivered_at or default to now
        updateData.delivered_at = data.delivered_at || new Date().toISOString();
      } else if (data.status === 'payment_confirmed') {
        updateData.payment_confirmed_at = new Date().toISOString();
        updateData.payment_confirmed_by = user?.id;
        
        // Get sale details to update lead's paid_value
        const { data: saleData } = await supabase
          .from('sales')
          .select('lead_id, total_cents')
          .eq('id', id)
          .single();
        
        if (saleData?.lead_id) {
          const { data: lead } = await supabase
            .from('leads')
            .select('paid_value')
            .eq('id', saleData.lead_id)
            .single();
          
          const currentPaid = lead?.paid_value || 0;
          const newPaid = currentPaid + (saleData.total_cents / 100);
          
          await supabase
            .from('leads')
            .update({ paid_value: newPaid })
            .eq('id', saleData.lead_id);
        }
      } else if (data.status === 'returned') {
        // Use provided returned_at or default to now
        updateData.returned_at = data.returned_at || new Date().toISOString();
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
        // When sale is marked as delivered, deduct real stock and create post-sale survey
        if (data.status === 'delivered') {
          const { error: stockError } = await supabase.rpc('deduct_stock_for_delivered_sale', {
            _sale_id: id,
          });
          if (stockError) console.error('Erro ao baixar estoque:', stockError);
          
          // Create post-sale survey automatically
          if (sale.lead_id && organizationId) {
            const { error: surveyError } = await supabase
              .from('post_sale_surveys')
              .insert({
                sale_id: id,
                lead_id: sale.lead_id,
                organization_id: organizationId,
                delivery_type: sale.delivery_type || null,
                status: 'pending',
              });
            if (surveyError && surveyError.code !== '23505') { // Ignore duplicate
              console.error('Erro ao criar pesquisa pós-venda:', surveyError);
            }
          }
        }

        // When sale is marked as returned, move lead to "TELE ENTREGA VOLTOU" funnel stage
        if (data.status === 'returned' && sale.lead_id && organizationId) {
          // Find the funnel stage named "TELE ENTREGA VOLTOU"
          const { data: returnedStage } = await supabase
            .from('organization_funnel_stages')
            .select('id')
            .eq('organization_id', organizationId)
            .ilike('name', '%TELE ENTREGA VOLTOU%')
            .maybeSingle();
          
          if (returnedStage?.id) {
            // Update lead to move to the returned stage
            await supabase
              .from('leads')
              .update({ 
                funnel_stage_id: returnedStage.id,
                stage: 'no_show' as any // Fallback legacy field 
              })
              .eq('id', sale.lead_id);
              
            console.log(`Lead ${sale.lead_id} moved to TELE ENTREGA VOLTOU stage`);
          }
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

      const isBlank = (v: unknown) => typeof v !== 'string' || v.trim().length === 0;

      // Get lead IDs to fetch addresses (fallback chain: shipping_address_id -> primary -> first)
      const leadIds = (data || [])
        .map((s) => (s.lead?.id ?? (s as any).lead_id) as string | null | undefined)
        .filter(Boolean) as string[];

      type LeadAddressRow = {
        id: string;
        lead_id: string;
        is_primary: boolean | null;
        street: string | null;
        street_number: string | null;
        complement: string | null;
        neighborhood: string | null;
        city: string | null;
        state: string | null;
        cep: string | null;
        delivery_notes: string | null;
        google_maps_link: string | null;
        created_at: string;
      };

      let bestAddressByLeadId: Record<string, LeadAddressRow> = {};
      let addressById: Record<string, LeadAddressRow> = {};

      if (leadIds.length > 0) {
        const { data: addresses } = await supabase
          .from('lead_addresses')
          .select(
            'id, lead_id, is_primary, street, street_number, complement, neighborhood, city, state, cep, delivery_notes, google_maps_link, created_at'
          )
          .in('lead_id', leadIds)
          .order('is_primary', { ascending: false })
          .order('created_at', { ascending: true });

        const rows = (addresses || []) as unknown as LeadAddressRow[];

        // First row per lead_id after ordering = best candidate (primary first, then oldest)
        for (const addr of rows) {
          addressById[addr.id] = addr;
          if (!bestAddressByLeadId[addr.lead_id]) bestAddressByLeadId[addr.lead_id] = addr;
        }
      }

      // Fetch items for each sale and merge address data
      const salesWithItems = await Promise.all((data || []).map(async (sale) => {
        const { data: items } = await supabase
          .from('sale_items')
          .select('*')
          .eq('sale_id', sale.id);
        
        // Resolve address:
        // 1) sale.shipping_address_id (authoritative when present)
        // 2) lead primary address
        // 3) first address for the lead
        let lead = sale.lead;
        const leadId = (lead?.id ?? (sale as any).lead_id) as string | undefined;
        const shippingAddressId = ((sale as any).shipping_address_id as string | null | undefined) || undefined;

        const resolvedAddr =
          (shippingAddressId ? addressById[shippingAddressId] : undefined) ||
          (leadId ? bestAddressByLeadId[leadId] : undefined);

        const shouldOverrideFromResolved =
          !!shippingAddressId || (lead ? isBlank(lead.street) : true);

        if (lead && resolvedAddr && shouldOverrideFromResolved) {
          lead = {
            ...lead,
            street: resolvedAddr.street ?? lead.street,
            street_number: resolvedAddr.street_number ?? lead.street_number,
            complement: resolvedAddr.complement ?? lead.complement,
            neighborhood: resolvedAddr.neighborhood ?? lead.neighborhood,
            city: resolvedAddr.city ?? lead.city,
            state: resolvedAddr.state ?? lead.state,
            cep: resolvedAddr.cep ?? lead.cep,
            delivery_notes: resolvedAddr.delivery_notes || lead.delivery_notes,
            google_maps_link: resolvedAddr.google_maps_link || lead.google_maps_link,
          };
        }
        
        return { ...sale, lead, items: items || [] };
      }));

      return salesWithItems as Sale[];
    },
    enabled: !!user?.id,
  });
}

// Hook for managers to see ALL deliveries (with deliveries_view_all permission)
export function useAllDeliveries() {
  const organizationId = useOrganizationId();

  return useQuery({
    queryKey: ['all-deliveries', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];

      const { data, error } = await supabase
        .from('sales')
        .select(`
          *,
          lead:leads(id, name, whatsapp, email, street, street_number, complement, neighborhood, city, state, cep, secondary_phone, delivery_notes, google_maps_link),
          items:sale_items(id, sale_id, product_id, product_name, quantity, unit_price_cents, discount_cents, total_cents, notes, requisition_number, created_at)
        `)
        .eq('organization_id', organizationId)
        .in('status', ['dispatched', 'delivered', 'returned'])
        .order('scheduled_delivery_date', { ascending: true });

      if (error) throw error;

      return (data || []) as unknown as Sale[];
    },
    enabled: !!organizationId,
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
