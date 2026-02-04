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
  
  // Clientes para ligar (sem compra recente e sem contato)
  clientsToCall: Array<{
    lead_id: string;
    lead_name: string;
    lead_whatsapp: string;
    last_sale_date: string;
    days_since_sale: number;
    last_product: string;
    total_purchases: number;
  }>;
  
  // Vendas pendentes por status
  pendingSales: {
    draft: SaleSummary[];
    separated: SaleSummary[];
    motoboyDispatched: SaleSummary[];
    carrierDispatched: SaleSummary[];
    pickupPending: SaleSummary[];
    returned: SaleSummary[];
    cancelled: SaleSummary[];
  };
  
  // Comissões
  commissions: {
    pending: number; // Comissão das vendas do mês que ainda não são entregues+pagas
    pendingCount: number;
    pendingSalesTotal: number; // Total em vendas antes da comissão
    toReceiveThisMonth: number; // Comissão das vendas pagas E entregues no mês (pela data de entrega)
    toReceiveCount: number;
    toReceiveSalesTotal: number; // Total em vendas antes da comissão
    defaultCommissionPercentage: number;
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
  delivery_type: string | null;
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
      // Filter by seller_user_id - shows treatments for sales made by this seller
      // Include both 'delivered' and 'finalized' status since finalized sales were also delivered
      const { data: treatmentsData } = await supabase
        .from('sales')
        .select(`
          id,
          lead_id,
          delivered_at,
          lead:leads!sales_lead_id_fkey(name, whatsapp),
          sale_items(
            product_id,
            product_name,
            quantity
          )
        `)
        .eq('organization_id', tenantId)
        .eq('seller_user_id', user.id)
        .in('status', ['delivered', 'finalized'])
        .not('delivered_at', 'is', null)
        .order('delivered_at', { ascending: false })
        .limit(200);

      // Get all kits with usage_period_days to match with sale_items
      const { data: kitsWithUsageDays } = await supabase
        .from('product_price_kits')
        .select('product_id, quantity, usage_period_days')
        .eq('organization_id', tenantId)
        .gt('usage_period_days', 0);

      // Create a map for quick lookup: productId-quantity -> usage_period_days
      const kitUsageMap = new Map<string, number>();
      (kitsWithUsageDays || []).forEach((kit: any) => {
        const key = `${kit.product_id}-${kit.quantity}`;
        kitUsageMap.set(key, kit.usage_period_days);
      });

      const treatmentsEnding: SellerDashboardData['treatmentsEnding'] = [];
      const processedLeadProducts = new Set<string>();

      (treatmentsData || []).forEach((sale: any) => {
        if (!sale.delivered_at || !sale.sale_items) return;
        
        const deliveredDate = new Date(sale.delivered_at);
        
        sale.sale_items.forEach((item: any) => {
          // Match kit by product_id and quantity
          const kitKey = `${item.product_id}-${item.quantity}`;
          const usagePeriodDays = kitUsageMap.get(kitKey);
          const productName = item.product_name;
          
          if (!usagePeriodDays || !productName) return;
          
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
        delivery_type: sale.delivery_type,
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
        // Pickup pending (retirada no balcão - not yet delivered)
        pickupPending: (salesData || [])
          .filter((s: any) => s.delivery_type === 'pickup' && s.status !== 'delivered' && s.status !== 'cancelled')
          .map(mapSale),
        returned: allSales.filter(s => s.status === 'returned'),
        cancelled: allSales.filter(s => s.status === 'cancelled'),
      };

      // 6. Clients to call - customers with past purchases but no purchase this month
      // Find leads with delivered/finalized sales from this seller, ordered by last sale date
      const { data: pastCustomersData } = await supabase
        .from('sales')
        .select(`
          lead_id,
          created_at,
          status,
          lead:leads!sales_lead_id_fkey(id, name, whatsapp),
          sale_items(product_name)
        `)
        .eq('organization_id', tenantId)
        .eq('seller_user_id', user.id)
        .in('status', ['delivered', 'finalized'])
        .order('created_at', { ascending: false });

      // Group by lead and find those without purchase this month
      const leadPurchases = new Map<string, {
        lead_id: string;
        lead_name: string;
        lead_whatsapp: string;
        last_sale_date: string;
        last_product: string;
        total_purchases: number;
        has_purchase_this_month: boolean;
      }>();

      (pastCustomersData || []).forEach((sale: any) => {
        if (!sale.lead_id || !sale.lead) return;
        
        const saleDate = parseISO(sale.created_at);
        const isThisMonth = saleDate >= monthStart && saleDate <= monthEnd;
        
        if (!leadPurchases.has(sale.lead_id)) {
          leadPurchases.set(sale.lead_id, {
            lead_id: sale.lead_id,
            lead_name: sale.lead.name || 'Lead',
            lead_whatsapp: sale.lead.whatsapp || '',
            last_sale_date: sale.created_at,
            last_product: sale.sale_items?.[0]?.product_name || 'Produto',
            total_purchases: 1,
            has_purchase_this_month: isThisMonth,
          });
        } else {
          const existing = leadPurchases.get(sale.lead_id)!;
          existing.total_purchases++;
          if (isThisMonth) {
            existing.has_purchase_this_month = true;
          }
        }
      });

      // Filter to only leads without purchase this month, calculate days since last sale
      const clientsToCall: SellerDashboardData['clientsToCall'] = [];
      const currentDate = new Date();
      leadPurchases.forEach((lead) => {
        if (lead.has_purchase_this_month) return; // Skip if they already bought this month
        
        const lastSaleDate = parseISO(lead.last_sale_date);
        const daysSinceSale = Math.floor((currentDate.getTime() - lastSaleDate.getTime()) / (1000 * 60 * 60 * 24));
        
        // Only show if more than 7 days since last purchase
        if (daysSinceSale >= 7) {
          clientsToCall.push({
            lead_id: lead.lead_id,
            lead_name: lead.lead_name,
            lead_whatsapp: lead.lead_whatsapp,
            last_sale_date: lead.last_sale_date,
            days_since_sale: daysSinceSale,
            last_product: lead.last_product,
            total_purchases: lead.total_purchases,
          });
        }
      });

      // Sort by days since sale (oldest first - most urgent to contact)
      clientsToCall.sort((a, b) => b.days_since_sale - a.days_since_sale);

      // 7. Commission calculation
      // Get seller's default commission percentage from organization_members
      const { data: memberData } = await supabase
        .from('organization_members')
        .select('commission_percentage')
        .eq('organization_id', tenantId)
        .eq('user_id', user.id)
        .maybeSingle();

      const defaultCommissionPercentage = Number(memberData?.commission_percentage) || 0;

      // Comissões Pendentes: todas as vendas do mês que AINDA NÃO SÃO (entregues + pagas)
      // Busca sale_items para calcular comissão por item (cada item pode ter comissão específica)
      const { data: pendingCommissionSales } = await supabase
        .from('sales')
        .select(`
          id, 
          total_cents, 
          status, 
          payment_status,
          sale_items(commission_cents)
        `)
        .eq('organization_id', tenantId)
        .eq('seller_user_id', user.id)
        .neq('status', 'cancelled')
        .gte('created_at', monthStart.toISOString())
        .lte('created_at', monthEnd.toISOString());

      // Filter out finalized sales (those go to "a receber")
      const pendingSalesFiltered = (pendingCommissionSales || []).filter((s: any) => {
        return s.status !== 'finalized';
      });

      // Calculate pending totals using commission_cents from items when available
      let pendingSalesTotal = 0;
      let pendingCommission = 0;
      pendingSalesFiltered.forEach((s: any) => {
        pendingSalesTotal += Number(s.total_cents) || 0;
        // Sum commission_cents from items (comissão já calculada por item, sobre valor total do kit)
        const itemsCommission = (s.sale_items || []).reduce((sum: number, item: any) => 
          sum + (Number(item.commission_cents) || 0), 0);
        if (itemsCommission > 0) {
          pendingCommission += itemsCommission;
        } else {
          // Fallback: use default commission percentage
          pendingCommission += Math.round((Number(s.total_cents) || 0) * (defaultCommissionPercentage / 100));
        }
      });

      // Comissões a Receber: vendas FINALIZADAS, filtradas pela data de FINALIZAÇÃO do mês
      const { data: toReceiveSales } = await supabase
        .from('sales')
        .select(`
          id, 
          total_cents, 
          finalized_at,
          sale_items(commission_cents)
        `)
        .eq('organization_id', tenantId)
        .eq('seller_user_id', user.id)
        .eq('status', 'finalized')
        .gte('finalized_at', monthStart.toISOString())
        .lte('finalized_at', monthEnd.toISOString());

      // All finalized sales count for commission
      const toReceiveSalesFiltered = toReceiveSales || [];

      // Calculate to-receive totals using commission_cents from items
      let toReceiveSalesTotal = 0;
      let toReceiveCommission = 0;
      toReceiveSalesFiltered.forEach((s: any) => {
        toReceiveSalesTotal += Number(s.total_cents) || 0;
        const itemsCommission = (s.sale_items || []).reduce((sum: number, item: any) => 
          sum + (Number(item.commission_cents) || 0), 0);
        if (itemsCommission > 0) {
          toReceiveCommission += itemsCommission;
        } else {
          toReceiveCommission += Math.round((Number(s.total_cents) || 0) * (defaultCommissionPercentage / 100));
        }
      });

      return {
        pendingFollowups,
        scheduledMessages,
        treatmentsEnding,
        clientsToCall,
        pendingSales,
        commissions: {
          pending: pendingCommission,
          pendingCount: pendingSalesFiltered.length,
          pendingSalesTotal,
          toReceiveThisMonth: toReceiveCommission,
          toReceiveCount: toReceiveSalesFiltered.length,
          toReceiveSalesTotal,
          defaultCommissionPercentage,
        },
      };
    },
    enabled: !!tenantId && !!user?.id,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}
