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
    pending: number; // Vendas pagas, mas não entregues
    pendingCount: number;
    pendingTotal: number; // Total em vendas antes da comissão
    toReceiveThisMonth: number; // Vendas pagas E entregues no mês
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

      // 4. Treatments ending soon (based on last sale + usage_period_days)
      // Get delivered sales for leads I'm responsible for
      const { data: treatmentsData } = myLeadIds.length > 0 ? await supabase
        .from('sales')
        .select(`
          id,
          lead_id,
          delivered_at,
          lead:leads!sales_lead_id_fkey(name, whatsapp),
          sale_items(
            product:lead_products!sale_items_product_id_fkey(
              name,
              usage_period_days
            )
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
          const product = item.product;
          if (!product?.usage_period_days) return;
          
          const key = `${sale.lead_id}-${product.name}`;
          if (processedLeadProducts.has(key)) return;
          
          const treatmentEnd = addDays(deliveredDate, product.usage_period_days);
          const daysRemaining = Math.ceil((treatmentEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          
          if (daysRemaining > 0 && daysRemaining <= treatmentDays) {
            processedLeadProducts.add(key);
            treatmentsEnding.push({
              lead_id: sale.lead_id,
              lead_name: sale.lead?.name || 'Lead',
              lead_whatsapp: sale.lead?.whatsapp || '',
              product_name: product.name,
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
        .in('status', ['draft', 'pending_expedition', 'dispatched', 'returned', 'cancelled'])
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
        separated: allSales.filter(s => s.status === 'pending_expedition'),
        motoboyDispatched: (salesData || [])
          .filter((s: any) => s.status === 'dispatched' && s.delivery_type === 'motoboy')
          .map(mapSale),
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

      // Pending commissions: paid but not yet delivered (any time)
      // Uses payment_status = 'paid_now' and status is NOT delivered and NOT cancelled
      const { data: pendingCommissionSales } = await supabase
        .from('sales')
        .select('id, total_cents')
        .eq('organization_id', tenantId)
        .eq('seller_user_id', user.id)
        .eq('payment_status', 'paid_now')
        .neq('status', 'delivered')
        .neq('status', 'cancelled');

      const pendingTotal = (pendingCommissionSales || [])
        .reduce((sum: number, s: any) => sum + (Number(s.total_cents) || 0), 0);
      const pendingCommission = Math.round(pendingTotal * (commissionPercentage / 100));

      // Commissions to receive: paid AND delivered in selected month
      // Commission is based on delivered_at date (when treatment starts)
      const { data: toReceiveSales } = await supabase
        .from('sales')
        .select('id, total_cents, delivered_at')
        .eq('organization_id', tenantId)
        .eq('seller_user_id', user.id)
        .eq('payment_status', 'paid_now')
        .eq('status', 'delivered')
        .gte('delivered_at', monthStart.toISOString())
        .lte('delivered_at', monthEnd.toISOString());

      const toReceiveTotal = (toReceiveSales || [])
        .reduce((sum: number, s: any) => sum + (Number(s.total_cents) || 0), 0);
      const toReceiveCommission = Math.round(toReceiveTotal * (commissionPercentage / 100));

      return {
        pendingFollowups,
        scheduledMessages,
        treatmentsEnding,
        pendingSales,
        commissions: {
          pending: pendingCommission,
          pendingCount: pendingCommissionSales?.length || 0,
          pendingTotal,
          toReceiveThisMonth: toReceiveCommission,
          toReceiveCount: toReceiveSales?.length || 0,
          toReceiveTotal,
          commissionPercentage,
        },
      };
    },
    enabled: !!tenantId && !!user?.id,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}
