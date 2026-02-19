import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentTenantId } from '@/hooks/useTenant';
import { Sale } from '@/hooks/useSales';

export interface PickupClosing {
  id: string;
  organization_id: string;
  closing_number: number;
  closing_date: string;
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
  // Joined data
  creator_profile?: { first_name: string | null; last_name: string | null };
  auxiliar_profile?: { first_name: string | null; last_name: string | null };
  admin_profile?: { first_name: string | null; last_name: string | null };
  sales?: PickupClosingSale[];
}

export interface PickupClosingSale {
  id: string;
  closing_id: string;
  sale_id: string;
  sale_number: string | null;
  lead_name: string | null;
  total_cents: number | null;
  payment_method: string | null;
  delivered_at: string | null;
}

// Fetch pickup sales that have NOT been included in any closing yet
// Shows ALL pickup sales regardless of status (except cancelled), as long as they weren't in a previous closing
export function useAvailablePickupSales() {
  const { data: tenantId } = useCurrentTenantId();
  const { user } = useAuth();

  return useQuery({
    queryKey: ['available-pickup-sales', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];

      // Get all sale_ids that are already in a closing
      const { data: usedSales, error: usedError } = await supabase
        .from('pickup_closing_sales')
        .select('sale_id')
        .eq('organization_id', tenantId);

      if (usedError) throw usedError;

      const usedSaleIds = (usedSales || []).map(s => s.sale_id);

      // Fetch ALL pickup sales that are NOT in any closing (regardless of status)
      // Only exclude cancelled sales
      let query = supabase
        .from('sales')
        .select(`
          id,
          romaneio_number,
          status,
          delivery_type,
          total_cents,
          payment_method,
          delivered_at,
          scheduled_delivery_date,
          created_at,
          lead:leads(id, name)
        `)
        .eq('organization_id', tenantId)
        .eq('delivery_type', 'pickup')
        .neq('status', 'cancelled')
        .order('created_at', { ascending: false });

      // Exclude sales already in closings
      if (usedSaleIds.length > 0) {
        query = query.not('id', 'in', `(${usedSaleIds.join(',')})`);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId && !!user,
  });
}

// Fetch all closings
export function usePickupClosings() {
  const { data: tenantId } = useCurrentTenantId();
  const { user } = useAuth();

  return useQuery({
    queryKey: ['pickup-closings', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];

      const { data, error } = await supabase
        .from('pickup_closings')
        .select('*')
        .eq('organization_id', tenantId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch profiles for created_by, confirmed_by_auxiliar, confirmed_by_admin
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
        status: c.status as PickupClosing['status'],
        creator_profile: c.created_by ? profilesMap[c.created_by] : undefined,
        auxiliar_profile: c.confirmed_by_auxiliar ? profilesMap[c.confirmed_by_auxiliar] : undefined,
        admin_profile: c.confirmed_by_admin ? profilesMap[c.confirmed_by_admin] : undefined,
      })) as PickupClosing[];
    },
    enabled: !!tenantId && !!user,
  });
}

// Fetch sales for a specific closing
export function usePickupClosingSales(closingId: string | undefined) {
  return useQuery({
    queryKey: ['pickup-closing-sales', closingId],
    queryFn: async () => {
      if (!closingId) return [];

      const { data, error } = await supabase
        .from('pickup_closing_sales')
        .select('*')
        .eq('closing_id', closingId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as PickupClosingSale[];
    },
    enabled: !!closingId,
  });
}

interface CreateClosingData {
  sales: Array<{
    id: string;
    romaneio_number?: number | null;
    lead?: { name: string } | null;
    total_cents?: number | null;
    payment_method?: string | null;
    delivered_at?: string | null;
  }>;
  notes?: string;
}

export function useCreatePickupClosing() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data: tenantId } = useCurrentTenantId();

  return useMutation({
    mutationFn: async ({ sales, notes }: CreateClosingData) => {
      if (!tenantId || !user) throw new Error('Not authenticated');

      // Calculate totals
      let total_amount_cents = 0;
      let total_card_cents = 0;
      let total_pix_cents = 0;
      let total_cash_cents = 0;
      let total_other_cents = 0;

      sales.forEach(sale => {
        const amount = sale.total_cents || 0;
        total_amount_cents += amount;

        const method = (sale.payment_method || '').toLowerCase();
        if (method.includes('cartao') || method.includes('cartão') || method.includes('card') || method.includes('credito') || method.includes('débito') || method.includes('debito')) {
          total_card_cents += amount;
        } else if (method.includes('pix')) {
          total_pix_cents += amount;
        } else if (method.includes('dinheiro') || method.includes('cash') || method.includes('especie')) {
          total_cash_cents += amount;
        } else {
          total_other_cents += amount;
        }
      });

      // Create the closing
      const { data: closing, error: closingError } = await supabase
        .from('pickup_closings')
        .insert({
          organization_id: tenantId,
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
      const closingSales = sales.map(sale => {
        // Resolve payment method name: prefer payment_method_rel (new system) over legacy text field
        const resolvedPaymentMethod = (sale as any).payment_method_rel?.name || sale.payment_method || null;
        return {
          closing_id: closing.id,
          sale_id: sale.id,
          organization_id: tenantId,
          sale_number: sale.romaneio_number ? String(sale.romaneio_number) : null,
          lead_name: sale.lead?.name || null,
          total_cents: sale.total_cents || null,
          payment_method: resolvedPaymentMethod,
          delivered_at: sale.delivered_at || null,
        };
      });

      const { error: salesError } = await supabase
        .from('pickup_closing_sales')
        .insert(closingSales);

      if (salesError) {
        // Rollback: delete the orphan closing header to avoid empty closings
        await supabase.from('pickup_closings').delete().eq('id', closing.id);
        throw salesError;
      }

      // No need to update sales - they're tracked in pickup_closing_sales

      return closing;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pickup-closings'] });
      queryClient.invalidateQueries({ queryKey: ['available-pickup-sales'] });
      queryClient.invalidateQueries({ queryKey: ['expedition-sales'] });
    },
  });
}

interface ConfirmClosingData {
  closingId: string;
  type: 'auxiliar' | 'admin';
}

export function useConfirmPickupClosing() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ closingId, type }: ConfirmClosingData) => {
      if (!user) throw new Error('Not authenticated');

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
          // Update to 'finalized' status + mark ALL checkpoints as complete
          // This ensures any missed steps are automatically completed on finalization
          // But preserves existing timestamps if they already exist
          
          for (const saleId of saleIds) {
            // Get current sale to check existing values
            const { data: sale } = await supabase
              .from('sales')
              .select('organization_id, status, printed_at, expedition_validated_at, dispatched_at, delivered_at, payment_confirmed_at')
              .eq('id', saleId)
              .single();

            if (!sale || sale.status === 'cancelled' || sale.status === 'returned') continue;

            // Build update with only missing fields filled
            const updateFields: Record<string, any> = {
              status: 'finalized',
              finalized_at: now,
              finalized_by: user.id,
            };

            // Only fill missing checkpoints (preserve original dates if they exist)
            if (!sale.printed_at) {
              updateFields.printed_at = now;
              updateFields.printed_by = user.id;
            }
            if (!sale.expedition_validated_at) {
              updateFields.expedition_validated_at = now;
              updateFields.expedition_validated_by = user.id;
            }
            if (!sale.dispatched_at) {
              updateFields.dispatched_at = now;
            }
            if (!sale.delivered_at) {
              updateFields.delivered_at = now;
              updateFields.delivery_status = 'delivered_normal';
            }
            if (!sale.payment_confirmed_at) {
              updateFields.payment_confirmed_at = now;
              updateFields.payment_confirmed_by = user.id;
            }

            await supabase
              .from('sales')
              .update(updateFields)
              .eq('id', saleId);

            // Also mark checkpoints in the sale_checkpoints table
            const checkpointTypes = ['printed', 'pending_expedition', 'dispatched', 'delivered', 'payment_confirmed'];
            for (const checkpointType of checkpointTypes) {
              // Upsert checkpoint as completed
              const { data: existing } = await supabase
                .from('sale_checkpoints')
                .select('id, completed_at')
                .eq('sale_id', saleId)
                .eq('checkpoint_type', checkpointType)
                .maybeSingle();

              if (existing && !existing.completed_at) {
                // Update existing checkpoint to completed
                await supabase
                  .from('sale_checkpoints')
                  .update({ completed_at: now, completed_by: user.id })
                  .eq('id', existing.id);
              } else if (!existing) {
                // Create completed checkpoint
                await supabase
                  .from('sale_checkpoints')
                  .insert({
                    sale_id: saleId,
                    organization_id: sale.organization_id,
                    checkpoint_type: checkpointType,
                    completed_at: now,
                    completed_by: user.id,
                  });
              }
            }
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pickup-closings'] });
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['expedition-sales'] });
    },
  });
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
