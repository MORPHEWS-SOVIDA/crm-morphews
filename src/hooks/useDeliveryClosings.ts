import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentTenantId } from '@/hooks/useTenant';
import { type PaymentCategory, calculateCategoryTotals } from '@/lib/paymentCategories';

export type ClosingType = 'pickup' | 'motoboy' | 'carrier';

export interface DeliveryClosing {
  id: string;
  organization_id: string;
  closing_number: number;
  closing_date: string;
  closing_type: ClosingType;
  total_sales: number;
  total_amount_cents: number;
  total_card_cents: number;
  total_pix_cents: number;
  total_cash_cents: number;
  total_other_cents: number;
  created_by: string | null;
  created_at: string;
  confirmed_by_auxiliar: string | null;
  confirmed_at_auxiliar: string | null;
  confirmed_by_admin: string | null;
  confirmed_at_admin: string | null;
  status: 'pending' | 'confirmed_auxiliar' | 'confirmed_final';
  notes: string | null;
  creator_profile?: { first_name: string | null; last_name: string | null };
  auxiliar_profile?: { first_name: string | null; last_name: string | null };
  admin_profile?: { first_name: string | null; last_name: string | null };
  sales?: DeliveryClosingSale[];
}

export interface DeliveryClosingSale {
  id: string;
  closing_id: string;
  sale_id: string;
  sale_number: string | null;
  lead_name: string | null;
  total_cents: number | null;
  payment_method: string | null;
  delivered_at: string | null;
}

// Map closing type to delivery type filter
const deliveryTypeMap: Record<ClosingType, string> = {
  pickup: 'pickup',
  motoboy: 'motoboy',
  carrier: 'carrier',
};

// Fetch available sales for a specific closing type
export function useAvailableClosingSales(closingType: ClosingType) {
  const { data: tenantId } = useCurrentTenantId();
  const { user } = useAuth();

  return useQuery({
    queryKey: ['available-closing-sales', tenantId, closingType],
    queryFn: async () => {
      if (!tenantId) return [];

      // Get all sale_ids that are already in a closing of this type
      const { data: usedSales, error: usedError } = await supabase
        .from('pickup_closing_sales')
        .select('sale_id')
        .eq('organization_id', tenantId)
        .eq('closing_type', closingType);

      if (usedError) throw usedError;

      const usedSaleIds = (usedSales || []).map(s => s.sale_id);

      // Fetch ALL sales of this delivery type that are NOT in any closing
      const deliveryTypeValue = deliveryTypeMap[closingType];
      let query = supabase
        .from('sales')
        .select(`
          id,
          romaneio_number,
          status,
          delivery_type,
          delivery_status,
          total_cents,
          payment_method,
          payment_method_id,
          payment_proof_url,
          delivered_at,
          scheduled_delivery_date,
          created_at,
          assigned_delivery_user_id,
          seller_user_id,
          tracking_code,
          carrier_tracking_status,
          lead:leads(id, name),
          payment_method_rel:payment_methods(id, name, category),
          melhor_envio_labels(id, tracking_code, status, company_name, service_name, label_pdf_url)
        `)
        .eq('organization_id', tenantId)
        .eq('delivery_type', deliveryTypeValue as any)
        .neq('status', 'cancelled')
        .order('created_at', { ascending: false });

      // Exclude sales already in closings
      if (usedSaleIds.length > 0) {
        query = query.not('id', 'in', `(${usedSaleIds.join(',')})`);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Fetch profiles for motoboys and sellers
      const userIds = new Set<string>();
      (data || []).forEach(sale => {
        if (sale.assigned_delivery_user_id) userIds.add(sale.assigned_delivery_user_id);
        if (sale.seller_user_id) userIds.add(sale.seller_user_id);
      });

      let profilesMap: Record<string, { first_name: string | null; last_name: string | null }> = {};
      if (userIds.size > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, first_name, last_name')
          .in('user_id', Array.from(userIds));

        profilesMap = (profiles || []).reduce((acc, p) => {
          acc[p.user_id] = { first_name: p.first_name, last_name: p.last_name };
          return acc;
        }, {} as typeof profilesMap);
      }
      
      // Map the data to include payment_category, profiles, and tracking info
      return (data || []).map(sale => {
        // Get the most relevant tracking info (from sale or melhor_envio_labels)
        const melhorEnvioLabel = (sale as any).melhor_envio_labels?.[0];
        const trackingCode = sale.tracking_code || melhorEnvioLabel?.tracking_code;
        const trackingStatus = sale.carrier_tracking_status || melhorEnvioLabel?.status;
        
        return {
          ...sale,
          // Use category from payment_method_rel
          payment_category: (sale.payment_method_rel?.category || null) as PaymentCategory | null,
          motoboy_profile: sale.assigned_delivery_user_id ? profilesMap[sale.assigned_delivery_user_id] : null,
          seller_profile: sale.seller_user_id ? profilesMap[sale.seller_user_id] : null,
          // Tracking info
          tracking_code: trackingCode || null,
          carrier_tracking_status: trackingStatus || null,
          melhor_envio_label: melhorEnvioLabel || null,
        };
      });
    },
    enabled: !!tenantId && !!user,
  });
}

// Fetch all closings of a specific type
export function useDeliveryClosings(closingType: ClosingType) {
  const { data: tenantId } = useCurrentTenantId();
  const { user } = useAuth();

  return useQuery({
    queryKey: ['delivery-closings', tenantId, closingType],
    queryFn: async () => {
      if (!tenantId) return [];

      const { data, error } = await supabase
        .from('pickup_closings')
        .select('*')
        .eq('organization_id', tenantId)
        .eq('closing_type', closingType)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch profiles
      const userIds = new Set<string>();
      (data || []).forEach(c => {
        if (c.created_by) userIds.add(c.created_by);
        if (c.confirmed_by_auxiliar) userIds.add(c.confirmed_by_auxiliar);
        if (c.confirmed_by_admin) userIds.add(c.confirmed_by_admin);
      });

      let profilesMap: Record<string, { first_name: string | null; last_name: string | null }> = {};
      if (userIds.size > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, first_name, last_name')
          .in('user_id', Array.from(userIds));

        profilesMap = (profiles || []).reduce((acc, p) => {
          acc[p.user_id] = { first_name: p.first_name, last_name: p.last_name };
          return acc;
        }, {} as typeof profilesMap);
      }

      return (data || []).map(c => ({
        ...c,
        closing_type: c.closing_type as ClosingType,
        status: c.status as DeliveryClosing['status'],
        creator_profile: c.created_by ? profilesMap[c.created_by] : undefined,
        auxiliar_profile: c.confirmed_by_auxiliar ? profilesMap[c.confirmed_by_auxiliar] : undefined,
        admin_profile: c.confirmed_by_admin ? profilesMap[c.confirmed_by_admin] : undefined,
      })) as DeliveryClosing[];
    },
    enabled: !!tenantId && !!user,
  });
}

// Fetch sales for a specific closing
export function useDeliveryClosingSales(closingId: string | undefined) {
  return useQuery({
    queryKey: ['delivery-closing-sales', closingId],
    queryFn: async () => {
      if (!closingId) return [];

      const { data, error } = await supabase
        .from('pickup_closing_sales')
        .select('*')
        .eq('closing_id', closingId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as DeliveryClosingSale[];
    },
    enabled: !!closingId,
  });
}

interface CreateClosingData {
  closingType: ClosingType;
  sales: Array<{
    id: string;
    romaneio_number?: number | null;
    lead?: { name: string } | null;
    total_cents?: number | null;
    payment_method?: string | null;
    payment_category?: string | null;
    delivered_at?: string | null;
  }>;
  notes?: string;
}

export function useCreateDeliveryClosing() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data: tenantId } = useCurrentTenantId();

  return useMutation({
    mutationFn: async ({ closingType, sales, notes }: CreateClosingData) => {
      if (!tenantId || !user) throw new Error('Not authenticated');

      // Calculate totals using real payment categories
      const { total: total_amount_cents, byCategory } = calculateCategoryTotals(sales);
      
      // Map new categories to legacy columns for backward compatibility
      // card = card_machine + payment_link + ecommerce
      // pix = pix
      // cash = cash
      // other = boleto_prepaid + boleto_postpaid + boleto_installment + gift + other
      const total_card_cents = byCategory.card_machine + byCategory.payment_link + byCategory.ecommerce;
      const total_pix_cents = byCategory.pix;
      const total_cash_cents = byCategory.cash;
      const total_other_cents = byCategory.boleto_prepaid + byCategory.boleto_postpaid + byCategory.boleto_installment + byCategory.gift + byCategory.other;

      // Create the closing
      const { data: closing, error: closingError } = await supabase
        .from('pickup_closings')
        .insert({
          organization_id: tenantId,
          closing_type: closingType,
          closing_date: new Date().toISOString().split('T')[0],
          total_sales: sales.length,
          total_amount_cents,
          total_card_cents,
          total_pix_cents,
          total_cash_cents,
          total_other_cents,
          created_by: user.id,
          notes,
        })
        .select()
        .single();

      if (closingError) throw closingError;

      // Insert all sales into the closing
      const closingSales = sales.map(sale => ({
        closing_id: closing.id,
        sale_id: sale.id,
        organization_id: tenantId,
        closing_type: closingType,
        sale_number: sale.romaneio_number ? String(sale.romaneio_number) : null,
        lead_name: sale.lead?.name || null,
        total_cents: sale.total_cents || null,
        payment_method: sale.payment_method || null,
        delivered_at: sale.delivered_at || null,
      }));

      const { error: salesError } = await supabase
        .from('pickup_closing_sales')
        .insert(closingSales);

      if (salesError) throw salesError;

      return closing;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['delivery-closings', undefined, variables.closingType] });
      queryClient.invalidateQueries({ queryKey: ['available-closing-sales', undefined, variables.closingType] });
      queryClient.invalidateQueries({ queryKey: ['expedition-sales'] });
    },
  });
}

interface ConfirmClosingData {
  closingId: string;
  closingType: ClosingType;
  type: 'auxiliar' | 'admin';
}

export function useConfirmDeliveryClosing() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ closingId, closingType, type }: ConfirmClosingData) => {
      if (!user) throw new Error('Not authenticated');

      // SECURITY: Validate admin permission before sending to backend
      // Only authorized emails can confirm as admin (final confirmation)
      if (type === 'admin') {
        const userEmail = user.email?.toLowerCase();
        const config = closingTypeConfig[closingType];
        if (!userEmail || !config.adminEmails.includes(userEmail)) {
          throw new Error('Você não tem permissão para realizar a confirmação final. Somente usuários autorizados podem confirmar.');
        }
      }

      const now = new Date().toISOString();
      
      const updateData = type === 'auxiliar'
        ? {
            confirmed_by_auxiliar: user.id,
            confirmed_at_auxiliar: now,
            status: 'confirmed_auxiliar',
          }
        : {
            confirmed_by_admin: user.id,
            confirmed_at_admin: now,
            status: 'confirmed_final',
          };

      const { error } = await supabase
        .from('pickup_closings')
        .update(updateData)
        .eq('id', closingId);

      if (error) throw error;

      // Update sales status based on confirmation type
      // Get all sales in this closing
      const { data: closingSales } = await supabase
        .from('pickup_closing_sales')
        .select('sale_id')
        .eq('closing_id', closingId);

      if (closingSales && closingSales.length > 0) {
        const saleIds = closingSales.map(cs => cs.sale_id);
        
        if (type === 'auxiliar') {
          // Update to 'closed' status
          await supabase
            .from('sales')
            .update({ 
              status: 'closed',
              closed_at: now,
              closed_by: user.id,
            })
            .in('id', saleIds)
            .not('status', 'in', '("cancelled","returned","finalized")');
        } else {
          // Update to 'finalized' status
          await supabase
            .from('sales')
            .update({ 
              status: 'finalized',
              finalized_at: now,
              finalized_by: user.id,
            })
            .in('id', saleIds)
            .not('status', 'in', '("cancelled","returned")');
        }
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['delivery-closings', undefined, variables.closingType] });
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['expedition-sales'] });
    },
  });
}

// Configuration for each closing type
export const closingTypeConfig: Record<ClosingType, {
  title: string;
  subtitle: string;
  icon: string;
  color: string;
  emptyMessage: string;
  printPath: (id: string) => string;
  // Admin email for final confirmation (second button)
  adminEmails: string[];
}> = {
  pickup: {
    title: 'Fechamento de Caixa Balcão',
    subtitle: 'Gere relatórios de fechamento para vendas retiradas no balcão',
    icon: 'Store',
    color: 'purple',
    emptyMessage: 'Nenhuma venda balcão disponível',
    printPath: (id) => `/expedicao/fechamento/${id}/imprimir`,
    adminEmails: ['thiago@sonatura.com.br'],
  },
  motoboy: {
    title: 'Fechamento de Entregas Motoboy',
    subtitle: 'Gere relatórios de fechamento para entregas realizadas por motoboy',
    icon: 'Bike',
    color: 'orange',
    emptyMessage: 'Nenhuma venda motoboy disponível',
    printPath: (id) => `/expedicao/fechamento/${id}/imprimir?type=motoboy`,
    adminEmails: ['thiago@sonatura.com.br'],
  },
  carrier: {
    title: 'Fechamento de Transportadoras',
    subtitle: 'Gere relatórios de fechamento para entregas via transportadora',
    icon: 'Truck',
    color: 'blue',
    emptyMessage: 'Nenhuma venda transportadora disponível',
    printPath: (id) => `/expedicao/fechamento/${id}/imprimir?type=carrier`,
    adminEmails: ['thiago@sonatura.com.br'],
  },
};

// Helper to check if user can confirm - now uses permission for auxiliar
export function canUserConfirmAdmin(
  userEmail: string | undefined,
  closingType: ClosingType
): boolean {
  if (!userEmail) return false;
  const config = closingTypeConfig[closingType];
  return config.adminEmails.includes(userEmail.toLowerCase());
}

// Helper to format payment method for display
export function formatPaymentMethod(method: string | null): string {
  if (!method) return 'Não informado';
  const lower = method.toLowerCase();
  if (lower.includes('pix')) return 'PIX';
  if (lower.includes('dinheiro') || lower.includes('cash') || lower.includes('especie')) return 'Dinheiro';
  if (lower.includes('cartao') || lower.includes('cartão') || lower.includes('card')) {
    if (lower.includes('credito') || lower.includes('crédito')) return 'Cartão Crédito';
    if (lower.includes('debito') || lower.includes('débito')) return 'Cartão Débito';
    return 'Cartão';
  }
  if (lower.includes('boleto')) return 'Boleto';
  return method;
}
