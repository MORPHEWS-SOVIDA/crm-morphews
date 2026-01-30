import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentTenantId } from '@/hooks/useTenant';
import { startOfDay, endOfDay, parseISO, format } from 'date-fns';

export interface ConfirmedSaleItem {
  id: string;
  romaneio_number: number | null;
  created_at: string;
  delivered_at: string | null;
  delivery_type: string | null;
  total_cents: number | null;
  payment_method: string | null;
  shipping_cost_cents: number | null;
  lead_name: string | null;
  lead_whatsapp: string | null;
  seller_user_id: string | null;
  seller_name: string | null;
  // Calculated fields
  product_cost_cents: number;
  commission_percentage: number;
  commission_cents: number;
}

export interface ConfirmedSalesReportData {
  sales: ConfirmedSaleItem[];
  // Seller summaries
  sellerSummaries: Array<{
    seller_user_id: string | null;
    seller_name: string;
    total_sales: number;
    total_cents: number;
    total_commission_cents: number;
    total_product_cost_cents: number;
    total_shipping_cents: number;
    sales: ConfirmedSaleItem[];
  }>;
  // Payment method summaries
  paymentSummaries: Array<{
    payment_method: string;
    total_sales: number;
    total_cents: number;
  }>;
  // Totals
  totals: {
    total_sales: number;
    total_cents: number;
    total_commission_cents: number;
    total_product_cost_cents: number;
    total_shipping_cents: number;
  };
}

export type DateFilterType = 'delivered_at' | 'created_at';

interface ReportFilters {
  dateType: DateFilterType;
  startDate: Date;
  endDate: Date;
}

export function useConfirmedSalesReport(filters: ReportFilters | null) {
  const { data: tenantId } = useCurrentTenantId();

  return useQuery({
    queryKey: ['confirmed-sales-report', tenantId, filters?.dateType, filters?.startDate?.toISOString(), filters?.endDate?.toISOString()],
    queryFn: async (): Promise<ConfirmedSalesReportData> => {
      if (!tenantId || !filters) {
        return {
          sales: [],
          sellerSummaries: [],
          paymentSummaries: [],
          totals: { total_sales: 0, total_cents: 0, total_commission_cents: 0, total_product_cost_cents: 0, total_shipping_cents: 0 },
        };
      }

      const startDateStr = format(startOfDay(filters.startDate), 'yyyy-MM-dd');
      const endDateStr = format(endOfDay(filters.endDate), 'yyyy-MM-dd');

      // Get all sale IDs that have been confirmed by admin (in pickup_closing_sales with confirmed_final status)
      const { data: confirmedClosings, error: closingsError } = await supabase
        .from('pickup_closings')
        .select('id')
        .eq('organization_id', tenantId)
        .eq('status', 'confirmed_final');

      if (closingsError) throw closingsError;

      const closingIds = (confirmedClosings || []).map(c => c.id);

      if (closingIds.length === 0) {
        return {
          sales: [],
          sellerSummaries: [],
          paymentSummaries: [],
          totals: { total_sales: 0, total_cents: 0, total_commission_cents: 0, total_product_cost_cents: 0, total_shipping_cents: 0 },
        };
      }

      // Get sale IDs from confirmed closings
      const { data: closingSales, error: closingSalesError } = await supabase
        .from('pickup_closing_sales')
        .select('sale_id')
        .in('closing_id', closingIds);

      if (closingSalesError) throw closingSalesError;

      const confirmedSaleIds = (closingSales || []).map(cs => cs.sale_id);

      if (confirmedSaleIds.length === 0) {
        return {
          sales: [],
          sellerSummaries: [],
          paymentSummaries: [],
          totals: { total_sales: 0, total_cents: 0, total_commission_cents: 0, total_product_cost_cents: 0, total_shipping_cents: 0 },
        };
      }

      // Fetch sales with date filter
      let query = supabase
        .from('sales')
        .select(`
          id,
          romaneio_number,
          created_at,
          delivered_at,
          delivery_type,
          total_cents,
          payment_method,
          shipping_cost_cents,
          seller_user_id,
          lead:leads(name, whatsapp)
        `)
        .eq('organization_id', tenantId)
        .in('id', confirmedSaleIds);

      // Apply date filter
      const dateColumn = filters.dateType;
      query = query.gte(dateColumn, startDateStr).lte(dateColumn, `${endDateStr}T23:59:59`);

      const { data: salesData, error: salesError } = await query;

      if (salesError) throw salesError;

      if (!salesData || salesData.length === 0) {
        return {
          sales: [],
          sellerSummaries: [],
          paymentSummaries: [],
          totals: { total_sales: 0, total_cents: 0, total_commission_cents: 0, total_product_cost_cents: 0, total_shipping_cents: 0 },
        };
      }

      const saleIds = salesData.map(s => s.id);

      // Fetch sale items with costs and commissions
      const { data: itemsData, error: itemsError } = await supabase
        .from('sale_items')
        .select('sale_id, cost_cents, commission_percentage, commission_cents, quantity')
        .in('sale_id', saleIds);

      if (itemsError) throw itemsError;

      // Aggregate costs and commissions per sale
      const saleCostsMap: Record<string, { cost_cents: number; commission_cents: number; avg_commission_pct: number }> = {};
      (itemsData || []).forEach(item => {
        if (!saleCostsMap[item.sale_id]) {
          saleCostsMap[item.sale_id] = { cost_cents: 0, commission_cents: 0, avg_commission_pct: 0 };
        }
        saleCostsMap[item.sale_id].cost_cents += (item.cost_cents || 0) * (item.quantity || 1);
        saleCostsMap[item.sale_id].commission_cents += item.commission_cents || 0;
        // Track avg commission percentage (weighted by item count)
        if (item.commission_percentage) {
          saleCostsMap[item.sale_id].avg_commission_pct = item.commission_percentage;
        }
      });

      // Fetch seller profiles
      const sellerIds = Array.from(new Set(salesData.map(s => s.seller_user_id).filter(Boolean) as string[]));
      let sellerMap: Record<string, string> = {};
      
      if (sellerIds.length > 0) {
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('user_id, first_name, last_name')
          .in('user_id', sellerIds);

        if (profilesError) throw profilesError;

        sellerMap = (profiles || []).reduce((acc, p) => {
          acc[p.user_id] = `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Vendedor';
          return acc;
        }, {} as Record<string, string>);
      }

      // Build sales list
      const sales: ConfirmedSaleItem[] = salesData.map(s => {
        const costs = saleCostsMap[s.id] || { cost_cents: 0, commission_cents: 0, avg_commission_pct: 0 };
        const lead = s.lead as { name: string | null; whatsapp: string | null } | null;
        
        return {
          id: s.id,
          romaneio_number: s.romaneio_number,
          created_at: s.created_at,
          delivered_at: s.delivered_at,
          delivery_type: s.delivery_type,
          total_cents: s.total_cents,
          payment_method: s.payment_method,
          shipping_cost_cents: s.shipping_cost_cents,
          lead_name: lead?.name || null,
          lead_whatsapp: lead?.whatsapp || null,
          seller_user_id: s.seller_user_id,
          seller_name: s.seller_user_id ? sellerMap[s.seller_user_id] || 'Vendedor' : null,
          product_cost_cents: costs.cost_cents,
          commission_percentage: costs.avg_commission_pct,
          commission_cents: costs.commission_cents,
        };
      });

      // Group by seller
      const sellerGrouped: Record<string, ConfirmedSaleItem[]> = {};
      sales.forEach(sale => {
        const key = sale.seller_user_id || '_none';
        if (!sellerGrouped[key]) sellerGrouped[key] = [];
        sellerGrouped[key].push(sale);
      });

      const sellerSummaries = Object.entries(sellerGrouped).map(([sellerId, sellerSales]) => ({
        seller_user_id: sellerId === '_none' ? null : sellerId,
        seller_name: sellerSales[0]?.seller_name || 'Sem vendedor',
        total_sales: sellerSales.length,
        total_cents: sellerSales.reduce((sum, s) => sum + (s.total_cents || 0), 0),
        total_commission_cents: sellerSales.reduce((sum, s) => sum + s.commission_cents, 0),
        total_product_cost_cents: sellerSales.reduce((sum, s) => sum + s.product_cost_cents, 0),
        total_shipping_cents: sellerSales.reduce((sum, s) => sum + (s.shipping_cost_cents || 0), 0),
        sales: sellerSales,
      })).sort((a, b) => b.total_cents - a.total_cents);

      // Group by payment method
      const paymentGrouped: Record<string, { count: number; total: number }> = {};
      sales.forEach(sale => {
        const method = sale.payment_method || 'Não informado';
        if (!paymentGrouped[method]) paymentGrouped[method] = { count: 0, total: 0 };
        paymentGrouped[method].count++;
        paymentGrouped[method].total += sale.total_cents || 0;
      });

      const paymentSummaries = Object.entries(paymentGrouped)
        .map(([method, data]) => ({
          payment_method: method,
          total_sales: data.count,
          total_cents: data.total,
        }))
        .sort((a, b) => b.total_cents - a.total_cents);

      // Calculate totals
      const totals = {
        total_sales: sales.length,
        total_cents: sales.reduce((sum, s) => sum + (s.total_cents || 0), 0),
        total_commission_cents: sales.reduce((sum, s) => sum + s.commission_cents, 0),
        total_product_cost_cents: sales.reduce((sum, s) => sum + s.product_cost_cents, 0),
        total_shipping_cents: sales.reduce((sum, s) => sum + (s.shipping_cost_cents || 0), 0),
      };

      return { sales, sellerSummaries, paymentSummaries, totals };
    },
    enabled: !!tenantId && !!filters,
  });
}
