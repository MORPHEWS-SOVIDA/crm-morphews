import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface LeadSalesData {
  lead_id: string;
  has_any_sale: boolean;
  has_sale_this_month: boolean;
  days_since_last_sale: number | null;
  last_sale_date: string | null;
}

export function useLeadsSalesData() {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['leads-sales-data', profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return {};

      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      
      // Get all sales with lead_id
      const { data: sales, error } = await supabase
        .from('sales')
        .select('lead_id, created_at')
        .eq('organization_id', profile.organization_id)
        .not('lead_id', 'is', null)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Process sales data per lead
      const salesByLead = new Map<string, LeadSalesData>();
      
      for (const sale of sales || []) {
        if (!sale.lead_id) continue;
        
        const saleDate = new Date(sale.created_at);
        const daysSinceSale = Math.floor((now.getTime() - saleDate.getTime()) / (1000 * 60 * 60 * 24));
        const isThisMonth = saleDate >= startOfMonth;
        
        const existing = salesByLead.get(sale.lead_id);
        
        if (!existing) {
          salesByLead.set(sale.lead_id, {
            lead_id: sale.lead_id,
            has_any_sale: true,
            has_sale_this_month: isThisMonth,
            days_since_last_sale: daysSinceSale,
            last_sale_date: sale.created_at,
          });
        } else {
          // Update if this sale is more recent
          if (!existing.last_sale_date || saleDate > new Date(existing.last_sale_date)) {
            existing.days_since_last_sale = daysSinceSale;
            existing.last_sale_date = sale.created_at;
          }
          if (isThisMonth) {
            existing.has_sale_this_month = true;
          }
        }
      }

      return Object.fromEntries(salesByLead);
    },
    enabled: !!profile?.organization_id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
