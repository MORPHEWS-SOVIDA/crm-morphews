import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

// ============================================================
// ATTRIBUTION REPORT HOOKS
// Dashboard de ROI por campanha/origem de tráfego
// ============================================================

export interface AttributionSummary {
  source: string;
  medium: string | null;
  campaign: string | null;
  leads_count: number;
  sales_count: number;
  total_revenue_cents: number;
  conversion_rate: number;
}

export interface CampaignROI {
  campaign: string;
  utm_source: string | null;
  utm_medium: string | null;
  leads: number;
  sales: number;
  revenue_cents: number;
  avg_ticket_cents: number;
  conversion_rate: number;
}

export interface SourceBreakdown {
  source: string;
  leads: number;
  sales: number;
  revenue_cents: number;
  percentage: number;
}

/**
 * Resumo de atribuição por origem
 */
export function useAttributionSummary(dateRange?: { start: string; end: string }) {
  const { profile } = useAuth();
  
  return useQuery({
    queryKey: ['attribution-summary', profile?.organization_id, dateRange],
    queryFn: async () => {
      if (!profile?.organization_id) return [];
      
      // Buscar leads com UTM
      let leadsQuery = supabase
        .from('leads')
        .select('utm_source, utm_medium, utm_campaign, created_at')
        .eq('organization_id', profile.organization_id)
        .not('utm_source', 'is', null);
      
      if (dateRange) {
        leadsQuery = leadsQuery
          .gte('created_at', dateRange.start)
          .lte('created_at', dateRange.end);
      }
      
      const { data: leads, error: leadsError } = await leadsQuery;
      if (leadsError) throw leadsError;
      
      // Buscar vendas com UTM
      let salesQuery = supabase
        .from('sales')
        .select('utm_source, utm_medium, utm_campaign, total_cents, created_at')
        .eq('organization_id', profile.organization_id)
        .not('utm_source', 'is', null);
      
      if (dateRange) {
        salesQuery = salesQuery
          .gte('created_at', dateRange.start)
          .lte('created_at', dateRange.end);
      }
      
      const { data: sales, error: salesError } = await salesQuery;
      if (salesError) throw salesError;
      
      // Agregar por source/medium/campaign
      const summary = new Map<string, AttributionSummary>();
      
      leads?.forEach((lead) => {
        const key = `${lead.utm_source}|${lead.utm_medium || ''}|${lead.utm_campaign || ''}`;
        const existing = summary.get(key) || {
          source: lead.utm_source || 'direct',
          medium: lead.utm_medium,
          campaign: lead.utm_campaign,
          leads_count: 0,
          sales_count: 0,
          total_revenue_cents: 0,
          conversion_rate: 0,
        };
        existing.leads_count++;
        summary.set(key, existing);
      });
      
      sales?.forEach((sale) => {
        const key = `${sale.utm_source}|${sale.utm_medium || ''}|${sale.utm_campaign || ''}`;
        const existing = summary.get(key) || {
          source: sale.utm_source || 'direct',
          medium: sale.utm_medium,
          campaign: sale.utm_campaign,
          leads_count: 0,
          sales_count: 0,
          total_revenue_cents: 0,
          conversion_rate: 0,
        };
        existing.sales_count++;
        existing.total_revenue_cents += sale.total_cents || 0;
        summary.set(key, existing);
      });
      
      // Calcular taxa de conversão
      const result = Array.from(summary.values()).map((item) => ({
        ...item,
        conversion_rate: item.leads_count > 0 
          ? (item.sales_count / item.leads_count) * 100 
          : 0,
      }));
      
      return result.sort((a, b) => b.total_revenue_cents - a.total_revenue_cents);
    },
    enabled: !!profile?.organization_id,
  });
}

/**
 * Top campanhas por ROI
 */
export function useTopCampaigns(limit = 10) {
  const { profile } = useAuth();
  
  return useQuery({
    queryKey: ['top-campaigns', profile?.organization_id, limit],
    queryFn: async () => {
      if (!profile?.organization_id) return [];
      
      // Buscar vendas com campanha definida
      const { data: sales, error } = await supabase
        .from('sales')
        .select('utm_campaign, utm_source, utm_medium, total_cents')
        .eq('organization_id', profile.organization_id)
        .not('utm_campaign', 'is', null);
      
      if (error) throw error;
      
      // Agregar por campanha
      const campaigns = new Map<string, CampaignROI>();
      
      sales?.forEach((sale) => {
        const key = sale.utm_campaign || 'unknown';
        const existing = campaigns.get(key) || {
          campaign: key,
          utm_source: sale.utm_source,
          utm_medium: sale.utm_medium,
          leads: 0,
          sales: 0,
          revenue_cents: 0,
          avg_ticket_cents: 0,
          conversion_rate: 0,
        };
        existing.sales++;
        existing.revenue_cents += sale.total_cents || 0;
        campaigns.set(key, existing);
      });
      
      // Calcular ticket médio
      const result = Array.from(campaigns.values()).map((item) => ({
        ...item,
        avg_ticket_cents: item.sales > 0 ? item.revenue_cents / item.sales : 0,
      }));
      
      return result
        .sort((a, b) => b.revenue_cents - a.revenue_cents)
        .slice(0, limit);
    },
    enabled: !!profile?.organization_id,
  });
}

/**
 * Breakdown por origem (pie chart data)
 */
export function useSourceBreakdown() {
  const { profile } = useAuth();
  
  return useQuery({
    queryKey: ['source-breakdown', profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return [];
      
      // Buscar todas as vendas
      const { data: sales, error } = await supabase
        .from('sales')
        .select('utm_source, total_cents')
        .eq('organization_id', profile.organization_id);
      
      if (error) throw error;
      
      // Agregar por source
      const sources = new Map<string, { leads: number; sales: number; revenue_cents: number }>();
      let totalRevenue = 0;
      
      sales?.forEach((sale) => {
        const source = sale.utm_source || 'Direto / Orgânico';
        const existing = sources.get(source) || { leads: 0, sales: 0, revenue_cents: 0 };
        existing.sales++;
        existing.revenue_cents += sale.total_cents || 0;
        totalRevenue += sale.total_cents || 0;
        sources.set(source, existing);
      });
      
      // Calcular percentuais
      const result: SourceBreakdown[] = Array.from(sources.entries()).map(([source, data]) => ({
        source,
        leads: data.leads,
        sales: data.sales,
        revenue_cents: data.revenue_cents,
        percentage: totalRevenue > 0 ? (data.revenue_cents / totalRevenue) * 100 : 0,
      }));
      
      return result.sort((a, b) => b.revenue_cents - a.revenue_cents);
    },
    enabled: !!profile?.organization_id,
  });
}

/**
 * Vendas recentes com atribuição
 */
export function useRecentAttributedSales(limit = 20) {
  const { profile } = useAuth();
  
  return useQuery({
    queryKey: ['recent-attributed-sales', profile?.organization_id, limit],
    queryFn: async () => {
      if (!profile?.organization_id) return [];
      
      const { data, error } = await supabase
        .from('sales')
        .select(`
          id,
          romaneio_number,
          total_cents,
          utm_source,
          utm_medium,
          utm_campaign,
          fbclid,
          gclid,
          created_at,
          leads(name, whatsapp)
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
