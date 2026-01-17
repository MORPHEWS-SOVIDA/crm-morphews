import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';
import { addDays, startOfDay, endOfDay, startOfMonth, endOfMonth, format, parseISO } from 'date-fns';

export interface SellerDashboardData {
  // Follow-ups pendentes
  pendingFollowups: Array<{
    id: string;
    lead_id: string;
    lead_name: string;
    lead_whatsapp: string;
    scheduled_at: string;
    reason: string | null;
  }>;
  
  // Mensagens agendadas
  scheduledMessages: Array<{
    id: string;
    lead_id: string;
    lead_name: string;
    lead_whatsapp: string;
    scheduled_at: string;
    final_message: string;
  }>;
  
  // Clientes com tratamento terminando
  treatmentsEnding: Array<{
    lead_id: string;
    lead_name: string;
    lead_whatsapp: string;
    product_name: string;
    treatment_end_date: string;
    days_remaining: number;
    sale_id: string;
  }>;
  
  // Vendas pendentes por status
  pendingSales: {
    draft: SaleSummary[];
    separated: SaleSummary[];
    motoboyDispatched: SaleSummary[];
    carrierDispatched: SaleSummary[];
    returned: SaleSummary[];
    cancelled: SaleSummary[];
  };
  
  // Comissões
  commissions: {
    pending: number; // Vendas do mês que ainda não são entregues+pagas
    pendingCount: number;
    pendingTotal: number; // Total em vendas antes da comissão
    toReceiveThisMonth: number; // Vendas pagas E entregues no mês (pela data de entrega)
    toReceiveCount: number;
    toReceiveTotal: number; // Total em vendas antes da comissão
    commissionPercentage: number;
  };
}

export interface SaleSummary {
  id: string;
  romaneio_number: number | null;
  lead_id: string;
  lead_name: string;
  lead_whatsapp: string;
  total_cents: number;
  status: string;
  motoboy_tracking_status: string | null;
  carrier_tracking_status: string | null;
  created_at: string;
  delivered_at: string | null;
  payment_status: string | null;
}

interface SellerDashboardOptions {
  treatmentDays?: number;
  commissionMonth?: Date;
}

export function useSellerDashboard(options: SellerDashboardOptions = {}) {
  const { treatmentDays = 5, commissionMonth = new Date() } = options;
  const { user } = useAuth();
  const { tenantId } = useTenant();
  
  const monthKey = format(commissionMonth, 'yyyy-MM');
  
  return useQuery({
    queryKey: ['seller-dashboard', tenantId, user?.id, treatmentDays, monthKey],
    queryFn: async (): Promise<SellerDashboardData> => {
      if (!tenantId || !user?.id) {
        throw new Error('Missing tenant or user');
      }

      const now = new Date();
      const treatmentEndDate = addDays(startOfDay(now), treatmentDays);
      const monthStart = startOfMonth(commissionMonth);
      const monthEnd = endOfMonth(commissionMonth);

      // 1. Get leads where user is responsible
      const { data: responsibleLeads } = await supabase
        .from('lead_responsibles')
        .select('lead_id')
        .eq('organization_id', tenantId)
        .eq('user_id', user.id);

      const myLeadIds = responsibleLeads?.map(r => r.lead_id) || [];

      // 2. Pending follow-ups for my leads
      const { data: followupsData } = await supabase
        .from('lead_followups')
        .select(`
          id,
          lead_id,
          scheduled_at,
          reason,
          lead:leads!lead_followups_lead_id_fkey(name, whatsapp)
        `)
        .eq('organization_id', tenantId)
        .eq('user_id', user.id)
        .is('completed_at', null)
        .gte('scheduled_at', now.toISOString())
        .order('scheduled_at', { ascending: true })
        .limit(50);

      const pendingFollowups = (followupsData || []).map((f: any) => ({
        id: f.id,
        lead_id: f.lead_id,
        lead_name: f.lead?.name || 'Lead',
        lead_whatsapp: f.lead?.whatsapp || '',
        scheduled_at: f.scheduled_at,
        reason: f.reason,
      }));

      // 3. Scheduled messages for my leads
      const { data: messagesData } = await supabase
        .from('lead_scheduled_messages')
        .select(`
          id,
          lead_id,
          scheduled_at,
          final_message,
          lead:leads!lead_scheduled_messages_lead_id_fkey(name, whatsapp)
        `)
        .eq('organization_id', tenantId)
        .eq('created_by', user.id)
        .eq('status', 'pending')
        .is('deleted_at', null)
        .gte('scheduled_at', now.toISOString())
        .order('scheduled_at', { ascending: true })
        .limit(50);

      const scheduledMessages = (messagesData || []).map((m: any) => ({
        id: m.id,
        lead_id: m.lead_id,
        lead_name: m.lead?.name || 'Lead',
        lead_whatsapp: m.lead?.whatsapp || '',
        scheduled_at: m.scheduled_at,
        final_message: m.final_message,
      }));

      // 4. Treatments ending soon (based on delivered sales + kit's usage_period_days)
      // Get delivered sales for leads I'm responsible for, including kit data
      const { data: treatmentsData } = myLeadIds.length > 0 ? await supabase
        .from('sales')
        .select(`
          id,
          lead_id,
          delivered_at,
          lead:leads!sales_lead_id_fkey(name, whatsapp),
          sale_items(
            kit_id,
            product:lead_products!sale_items_product_id_fkey(name),
            kit:product_price_kits!sale_items_kit_id_fkey(usage_period_days)
          )
        `)
        .eq('organization_id', tenantId)
        .eq('status', 'delivered')
        .in('lead_id', myLeadIds)
        .not('delivered_at', 'is', null)
        .order('delivered_at', { ascending: false }) : { data: [] };

      const treatmentsEnding: SellerDashboardData['treatmentsEnding'] = [];
      const processedLeadProducts = new Set<string>();

      (treatmentsData || []).forEach((sale: any) => {
        if (!sale.delivered_at || !sale.sale_items) return;
        
        const deliveredDate = new Date(sale.delivered_at);
        
        sale.sale_items.forEach((item: any) => {
          // Use kit's usage_period_days (from product_price_kits table)
          const usagePeriodDays = item.kit?.usage_period_days;
          const productName = item.product?.name;
          
          if (!usagePeriodDays || usagePeriodDays <= 0 || !productName) return;
          
          const key = `${sale.lead_id}-${productName}`;
          if (processedLeadProducts.has(key)) return;
          
          const treatmentEnd = addDays(deliveredDate, usagePeriodDays);
          const daysRemaining = Math.ceil((treatmentEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          
          if (daysRemaining > 0 && daysRemaining <= treatmentDays) {
            processedLeadProducts.add(key);
            treatmentsEnding.push({
              lead_id: sale.lead_id,
              lead_name: sale.lead?.name || 'Lead',
              lead_whatsapp: sale.lead?.whatsapp || '',
              product_name: productName,
              treatment_end_date: treatmentEnd.toISOString(),
              days_remaining: daysRemaining,
              sale_id: sale.id,
            });
          }
        });
      });

      // Sort by days remaining
      treatmentsEnding.sort((a, b) => a.days_remaining - b.days_remaining);

      // 5. Pending sales by status (my sales as seller)
      // Include all non-final statuses to show pending work
      const { data: salesData } = await supabase
        .from('sales')
        .select(`
          id,
          romaneio_number,
          lead_id,
          total_cents,
          status,
          motoboy_tracking_status,
          carrier_tracking_status,
          created_at,
          delivered_at,
          payment_status,
          delivery_type,
          lead:leads!sales_lead_id_fkey(name, whatsapp)
        `)
        .eq('organization_id', tenantId)
        .eq('seller_user_id', user.id)
        .in('status', ['draft', 'pending_expedition', 'payment_confirmed', 'dispatched', 'returned', 'cancelled'])
        .order('created_at', { ascending: false });

      const mapSale = (sale: any): SaleSummary => ({
        id: sale.id,
        romaneio_number: sale.romaneio_number,
        lead_id: sale.lead_id,
        lead_name: sale.lead?.name || 'Lead',
        lead_whatsapp: sale.lead?.whatsapp || '',
        total_cents: sale.total_cents || 0,
        status: sale.status,
        motoboy_tracking_status: sale.motoboy_tracking_status,
        carrier_tracking_status: sale.carrier_tracking_status,
        created_at: sale.created_at,
        delivered_at: sale.delivered_at,
        payment_status: sale.payment_status,
      });

      const allSales = (salesData || []).map(mapSale);

      const pendingSales = {
        draft: allSales.filter(s => s.status === 'draft'),
        // Separated includes both pending_expedition and payment_confirmed (awaiting dispatch)
        separated: allSales.filter(s => s.status === 'pending_expedition' || s.status === 'payment_confirmed'),
        // Motoboy dispatched (not yet delivered)
        motoboyDispatched: (salesData || [])
          .filter((s: any) => s.status === 'dispatched' && s.delivery_type === 'motoboy')
          .map(mapSale),
        // Carrier dispatched (not yet delivered)
        carrierDispatched: (salesData || [])
          .filter((s: any) => s.status === 'dispatched' && s.delivery_type === 'carrier')
          .map(mapSale),
        returned: allSales.filter(s => s.status === 'returned'),
        cancelled: allSales.filter(s => s.status === 'cancelled'),
      };

      // 6. Commission calculation
      // Get seller's commission percentage from organization_members
      const { data: memberData } = await supabase
        .from('organization_members')
        .select('commission_percentage')
        .eq('organization_id', tenantId)
        .eq('user_id', user.id)
        .maybeSingle();

      const commissionPercentage = Number(memberData?.commission_percentage) || 0;

      // Comissões Pendentes: todas as vendas do mês que AINDA NÃO SÃO (entregues + pagas)
      // Inclui: draft, separadas, despachadas, enviadas, pagas mas não entregues
      // Exclui: canceladas e as que já são entregues+pagas
      const { data: pendingCommissionSales } = await supabase
        .from('sales')
        .select('id, total_cents, status, payment_status')
        .eq('organization_id', tenantId)
        .eq('seller_user_id', user.id)
        .neq('status', 'cancelled')
        .gte('created_at', monthStart.toISOString())
        .lte('created_at', monthEnd.toISOString());

      // Filter out sales that are both delivered AND paid (those go to "a receber")
      const pendingSalesFiltered = (pendingCommissionSales || []).filter((s: any) => {
        const isDelivered = s.status === 'delivered';
        const isPaid = s.payment_status === 'paid_now' || s.payment_status === 'paid_in_delivery';
        // If both delivered AND paid, it's not pending anymore
        return !(isDelivered && isPaid);
      });

      const pendingTotal = pendingSalesFiltered
        .reduce((sum: number, s: any) => sum + (Number(s.total_cents) || 0), 0);
      const pendingCommission = Math.round(pendingTotal * (commissionPercentage / 100));

      // Comissões a Receber: vendas PAGAS e ENTREGUES, filtradas pela data de ENTREGA do mês
      // A comissão é paga pela data de entrega, não pela data de pagamento
      const { data: toReceiveSales } = await supabase
        .from('sales')
        .select('id, total_cents, delivered_at, payment_status')
        .eq('organization_id', tenantId)
        .eq('seller_user_id', user.id)
        .eq('status', 'delivered')
        .gte('delivered_at', monthStart.toISOString())
        .lte('delivered_at', monthEnd.toISOString());

      // Only count sales that are both delivered AND paid
      const toReceiveSalesFiltered = (toReceiveSales || []).filter((s: any) => {
        return s.payment_status === 'paid_now' || s.payment_status === 'paid_in_delivery';
      });

      const toReceiveTotal = toReceiveSalesFiltered
        .reduce((sum: number, s: any) => sum + (Number(s.total_cents) || 0), 0);
      const toReceiveCommission = Math.round(toReceiveTotal * (commissionPercentage / 100));

      return {
        pendingFollowups,
        scheduledMessages,
        treatmentsEnding,
        pendingSales,
        commissions: {
          pending: pendingCommission,
          pendingCount: pendingSalesFiltered.length,
          pendingTotal,
          toReceiveThisMonth: toReceiveCommission,
          toReceiveCount: toReceiveSalesFiltered.length,
          toReceiveTotal,
          commissionPercentage,
        },
      };
    },
    enabled: !!tenantId && !!user?.id,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}
