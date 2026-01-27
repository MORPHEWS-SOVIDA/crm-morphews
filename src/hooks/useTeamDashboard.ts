import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';
import { useCurrentMember } from '@/hooks/useCurrentMember';
import { addDays, startOfDay, endOfDay, startOfMonth, endOfMonth, format, parseISO } from 'date-fns';

export interface TeamMemberSummary {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  pending_followups: number;
  pending_sales: number;
  commission_pending: number;
  commission_to_receive: number;
}

export interface TeamDashboardData {
  // Team members summary
  members: TeamMemberSummary[];
  
  // Aggregated follow-ups from all team members
  pendingFollowups: Array<{
    id: string;
    lead_id: string;
    lead_name: string;
    lead_whatsapp: string;
    scheduled_at: string;
    reason: string | null;
    seller_name: string;
    seller_user_id: string;
  }>;
  
  // Aggregated scheduled messages
  scheduledMessages: Array<{
    id: string;
    lead_id: string;
    lead_name: string;
    lead_whatsapp: string;
    scheduled_at: string;
    final_message: string;
    seller_name: string;
    seller_user_id: string;
  }>;
  
  // Treatments ending (aggregated)
  treatmentsEnding: Array<{
    lead_id: string;
    lead_name: string;
    lead_whatsapp: string;
    product_name: string;
    treatment_end_date: string;
    days_remaining: number;
    sale_id: string;
    seller_name: string;
    seller_user_id: string;
  }>;
  
  // Pending sales aggregated
  pendingSales: {
    draft: TeamSaleSummary[];
    separated: TeamSaleSummary[];
    motoboyDispatched: TeamSaleSummary[];
    carrierDispatched: TeamSaleSummary[];
    pickupPending: TeamSaleSummary[];
    returned: TeamSaleSummary[];
    cancelled: TeamSaleSummary[];
  };
  
  // Team commission totals
  commissions: {
    pending: number;
    pendingCount: number;
    pendingSalesTotal: number;
    toReceiveThisMonth: number;
    toReceiveCount: number;
    toReceiveSalesTotal: number;
  };
}

export interface TeamSaleSummary {
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
  seller_name: string;
  seller_user_id: string;
}

interface TeamDashboardOptions {
  treatmentDays?: number;
  commissionMonth?: Date;
  selectedMemberIds?: string[];
}

export function useTeamDashboard(options: TeamDashboardOptions = {}) {
  const { treatmentDays = 5, commissionMonth = new Date(), selectedMemberIds } = options;
  const { user } = useAuth();
  const { tenantId } = useTenant();
  const { data: currentMember } = useCurrentMember();
  
  const monthKey = format(commissionMonth, 'yyyy-MM');
  
  return useQuery({
    queryKey: ['team-dashboard', tenantId, currentMember?.team_id, treatmentDays, monthKey, selectedMemberIds],
    queryFn: async (): Promise<TeamDashboardData> => {
      if (!tenantId || !user?.id || !currentMember?.team_id) {
        throw new Error('Missing tenant, user, or team');
      }

      const now = new Date();
      const treatmentEndDate = addDays(startOfDay(now), treatmentDays);
      const monthStart = startOfMonth(commissionMonth);
      const monthEnd = endOfMonth(commissionMonth);

      // 1. Get all team members
      const { data: teamMembersData } = await supabase
        .from('organization_members')
        .select(`
          user_id,
          commission_percentage,
          profiles!inner(first_name, last_name, avatar_url)
        `)
        .eq('organization_id', tenantId)
        .eq('team_id', currentMember.team_id);

      const teamMembers = (teamMembersData || []).map((m: any) => ({
        user_id: m.user_id,
        full_name: `${m.profiles?.first_name || ''} ${m.profiles?.last_name || ''}`.trim(),
        avatar_url: m.profiles?.avatar_url,
        commission_percentage: m.commission_percentage || 0,
      }));

      // Filter by selected members if provided
      const memberUserIds = selectedMemberIds && selectedMemberIds.length > 0
        ? teamMembers.filter(m => selectedMemberIds.includes(m.user_id)).map(m => m.user_id)
        : teamMembers.map(m => m.user_id);

      if (memberUserIds.length === 0) {
        return getEmptyDashboard(teamMembers);
      }

      // 2. Get leads where team members are responsible
      const { data: responsibleLeads } = await supabase
        .from('lead_responsibles')
        .select('lead_id, user_id')
        .eq('organization_id', tenantId)
        .in('user_id', memberUserIds);

      const teamLeadIds = [...new Set((responsibleLeads || []).map(r => r.lead_id))];
      const leadToSellerMap = new Map<string, string>();
      (responsibleLeads || []).forEach(r => leadToSellerMap.set(r.lead_id, r.user_id));

      const getSellerName = (userId: string) => {
        const member = teamMembers.find(m => m.user_id === userId);
        return member?.full_name || 'Vendedor';
      };

      // 3. Pending follow-ups for team
      const { data: followupsData } = await supabase
        .from('lead_followups')
        .select(`
          id,
          lead_id,
          scheduled_at,
          reason,
          user_id,
          lead:leads!lead_followups_lead_id_fkey(name, whatsapp)
        `)
        .eq('organization_id', tenantId)
        .in('user_id', memberUserIds)
        .is('completed_at', null)
        .gte('scheduled_at', now.toISOString())
        .order('scheduled_at', { ascending: true })
        .limit(100);

      const pendingFollowups = (followupsData || []).map((f: any) => ({
        id: f.id,
        lead_id: f.lead_id,
        lead_name: f.lead?.name || 'Lead',
        lead_whatsapp: f.lead?.whatsapp || '',
        scheduled_at: f.scheduled_at,
        reason: f.reason,
        seller_name: getSellerName(f.user_id),
        seller_user_id: f.user_id,
      }));

      // 4. Scheduled messages for team
      const { data: messagesData } = await supabase
        .from('lead_scheduled_messages')
        .select(`
          id,
          lead_id,
          scheduled_at,
          final_message,
          created_by,
          lead:leads!lead_scheduled_messages_lead_id_fkey(name, whatsapp)
        `)
        .eq('organization_id', tenantId)
        .in('created_by', memberUserIds)
        .eq('status', 'pending')
        .is('deleted_at', null)
        .gte('scheduled_at', now.toISOString())
        .order('scheduled_at', { ascending: true })
        .limit(100);

      const scheduledMessages = (messagesData || []).map((m: any) => ({
        id: m.id,
        lead_id: m.lead_id,
        lead_name: m.lead?.name || 'Lead',
        lead_whatsapp: m.lead?.whatsapp || '',
        scheduled_at: m.scheduled_at,
        final_message: m.final_message,
        seller_name: getSellerName(m.created_by),
        seller_user_id: m.created_by,
      }));

      // 5. Treatments ending (aggregated for team)
      const { data: treatmentsData } = teamLeadIds.length > 0 ? await supabase
        .from('sales')
        .select(`
          id,
          lead_id,
          delivered_at,
          seller_user_id,
          lead:leads!sales_lead_id_fkey(name, whatsapp),
          sale_items(
            product_id,
            product_name,
            quantity
          )
        `)
        .eq('organization_id', tenantId)
        .eq('status', 'delivered')
        .in('lead_id', teamLeadIds)
        .in('seller_user_id', memberUserIds)
        .not('delivered_at', 'is', null)
        .order('delivered_at', { ascending: false })
        .limit(500) : { data: [] };

      // Get kits with usage days
      const { data: kitsWithUsageDays } = await supabase
        .from('product_price_kits')
        .select('product_id, quantity, usage_period_days')
        .eq('organization_id', tenantId)
        .gt('usage_period_days', 0);

      const kitUsageMap = new Map<string, number>();
      (kitsWithUsageDays || []).forEach((kit: any) => {
        const key = `${kit.product_id}-${kit.quantity}`;
        kitUsageMap.set(key, kit.usage_period_days);
      });

      const treatmentsEnding: TeamDashboardData['treatmentsEnding'] = [];
      const processedLeadProducts = new Set<string>();

      (treatmentsData || []).forEach((sale: any) => {
        if (!sale.delivered_at || !sale.sale_items) return;
        
        const deliveredDate = new Date(sale.delivered_at);
        
        sale.sale_items.forEach((item: any) => {
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
              seller_name: getSellerName(sale.seller_user_id),
              seller_user_id: sale.seller_user_id,
            });
          }
        });
      });

      treatmentsEnding.sort((a, b) => a.days_remaining - b.days_remaining);

      // 6. Pending sales by status (team aggregated)
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
          seller_user_id,
          lead:leads!sales_lead_id_fkey(name, whatsapp)
        `)
        .eq('organization_id', tenantId)
        .in('seller_user_id', memberUserIds)
        .in('status', ['draft', 'pending_expedition', 'payment_confirmed', 'dispatched', 'returned', 'cancelled'])
        .order('created_at', { ascending: false });

      const mapSale = (sale: any): TeamSaleSummary => ({
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
        seller_name: getSellerName(sale.seller_user_id),
        seller_user_id: sale.seller_user_id,
      });

      const allSales = (salesData || []).map(mapSale);

      const pendingSales = {
        draft: allSales.filter(s => s.status === 'draft'),
        separated: allSales.filter(s => s.status === 'pending_expedition' || s.status === 'payment_confirmed'),
        motoboyDispatched: (salesData || [])
          .filter((s: any) => s.status === 'dispatched' && s.delivery_type === 'motoboy')
          .map(mapSale),
        carrierDispatched: (salesData || [])
          .filter((s: any) => s.status === 'dispatched' && s.delivery_type === 'carrier')
          .map(mapSale),
        pickupPending: (salesData || [])
          .filter((s: any) => s.delivery_type === 'pickup' && s.status !== 'delivered' && s.status !== 'cancelled')
          .map(mapSale),
        returned: allSales.filter(s => s.status === 'returned'),
        cancelled: allSales.filter(s => s.status === 'cancelled'),
      };

      // 7. Commission calculation (aggregated for team)
      const { data: pendingCommissionSales } = await supabase
        .from('sales')
        .select(`
          id, 
          total_cents, 
          status, 
          payment_status,
          seller_user_id,
          sale_items(commission_cents)
        `)
        .eq('organization_id', tenantId)
        .in('seller_user_id', memberUserIds)
        .neq('status', 'cancelled')
        .gte('created_at', monthStart.toISOString())
        .lte('created_at', monthEnd.toISOString());

      const pendingSalesFiltered = (pendingCommissionSales || []).filter((s: any) => {
        const isDelivered = s.status === 'delivered';
        const isPaid = s.payment_status === 'paid_now' || s.payment_status === 'paid_in_delivery';
        return !(isDelivered && isPaid);
      });

      let pendingSalesTotal = 0;
      let pendingCommission = 0;
      pendingSalesFiltered.forEach((s: any) => {
        pendingSalesTotal += Number(s.total_cents) || 0;
        const itemsCommission = (s.sale_items || []).reduce((sum: number, item: any) => 
          sum + (Number(item.commission_cents) || 0), 0);
        const member = teamMembers.find(m => m.user_id === s.seller_user_id);
        const defaultPct = member?.commission_percentage || 0;
        if (itemsCommission > 0) {
          pendingCommission += itemsCommission;
        } else {
          pendingCommission += Math.round((Number(s.total_cents) || 0) * (defaultPct / 100));
        }
      });

      const { data: toReceiveSales } = await supabase
        .from('sales')
        .select(`
          id, 
          total_cents, 
          delivered_at, 
          payment_status,
          seller_user_id,
          sale_items(commission_cents)
        `)
        .eq('organization_id', tenantId)
        .in('seller_user_id', memberUserIds)
        .eq('status', 'delivered')
        .gte('delivered_at', monthStart.toISOString())
        .lte('delivered_at', monthEnd.toISOString());

      const toReceiveSalesFiltered = (toReceiveSales || []).filter((s: any) => {
        return s.payment_status === 'paid_now' || s.payment_status === 'paid_in_delivery';
      });

      let toReceiveSalesTotal = 0;
      let toReceiveCommission = 0;
      toReceiveSalesFiltered.forEach((s: any) => {
        toReceiveSalesTotal += Number(s.total_cents) || 0;
        const itemsCommission = (s.sale_items || []).reduce((sum: number, item: any) => 
          sum + (Number(item.commission_cents) || 0), 0);
        const member = teamMembers.find(m => m.user_id === s.seller_user_id);
        const defaultPct = member?.commission_percentage || 0;
        if (itemsCommission > 0) {
          toReceiveCommission += itemsCommission;
        } else {
          toReceiveCommission += Math.round((Number(s.total_cents) || 0) * (defaultPct / 100));
        }
      });

      // Build member summaries
      const memberSummaries: TeamMemberSummary[] = teamMembers.map(m => {
        const memberFollowups = pendingFollowups.filter(f => f.seller_user_id === m.user_id);
        const memberPendingSales = allSales.filter(s => s.seller_user_id === m.user_id);
        const memberPendingComm = pendingSalesFiltered
          .filter((s: any) => s.seller_user_id === m.user_id)
          .reduce((sum: number, s: any) => {
            const itemsComm = (s.sale_items || []).reduce((acc: number, i: any) => acc + (Number(i.commission_cents) || 0), 0);
            return sum + (itemsComm > 0 ? itemsComm : Math.round((s.total_cents || 0) * (m.commission_percentage / 100)));
          }, 0);
        const memberToReceiveComm = toReceiveSalesFiltered
          .filter((s: any) => s.seller_user_id === m.user_id)
          .reduce((sum: number, s: any) => {
            const itemsComm = (s.sale_items || []).reduce((acc: number, i: any) => acc + (Number(i.commission_cents) || 0), 0);
            return sum + (itemsComm > 0 ? itemsComm : Math.round((s.total_cents || 0) * (m.commission_percentage / 100)));
          }, 0);

        return {
          user_id: m.user_id,
          full_name: m.full_name,
          avatar_url: m.avatar_url,
          pending_followups: memberFollowups.length,
          pending_sales: memberPendingSales.length,
          commission_pending: memberPendingComm,
          commission_to_receive: memberToReceiveComm,
        };
      });

      return {
        members: memberSummaries,
        pendingFollowups,
        scheduledMessages,
        treatmentsEnding,
        pendingSales,
        commissions: {
          pending: pendingCommission,
          pendingCount: pendingSalesFiltered.length,
          pendingSalesTotal,
          toReceiveThisMonth: toReceiveCommission,
          toReceiveCount: toReceiveSalesFiltered.length,
          toReceiveSalesTotal,
        },
      };
    },
    enabled: !!tenantId && !!user?.id && !!currentMember?.team_id,
    staleTime: 1000 * 60 * 2,
  });
}

function getEmptyDashboard(members: any[]): TeamDashboardData {
  return {
    members: members.map(m => ({
      user_id: m.user_id,
      full_name: m.full_name,
      avatar_url: m.avatar_url,
      pending_followups: 0,
      pending_sales: 0,
      commission_pending: 0,
      commission_to_receive: 0,
    })),
    pendingFollowups: [],
    scheduledMessages: [],
    treatmentsEnding: [],
    pendingSales: {
      draft: [],
      separated: [],
      motoboyDispatched: [],
      carrierDispatched: [],
      pickupPending: [],
      returned: [],
      cancelled: [],
    },
    commissions: {
      pending: 0,
      pendingCount: 0,
      pendingSalesTotal: 0,
      toReceiveThisMonth: 0,
      toReceiveCount: 0,
      toReceiveSalesTotal: 0,
    },
  };
}
