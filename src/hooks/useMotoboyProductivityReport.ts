import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentTenantId } from '@/hooks/useTenant';
import { format, parseISO, getHours, eachDayOfInterval, startOfDay, getDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export interface MotoboyDailyDelivery {
  date: string;
  dateFormatted: string;
  dayOfWeek: string;
  deliveries: number;
  morningDeliveries: number; // 06:00-12:00
  afternoonDeliveries: number; // 12:00-18:00
  eveningDeliveries: number; // 18:00-24:00
}

export interface MotoboyRegionSummary {
  regionId: string | null;
  regionName: string;
  deliveries: MotoboyDailyDelivery[];
  totalDeliveries: number;
}

export interface MotoboyProductivity {
  motoboyId: string;
  motoboyName: string;
  regions: MotoboyRegionSummary[];
  totalDeliveries: number;
  dailyTotals: MotoboyDailyDelivery[];
}

export interface RegionDailySummary {
  regionId: string | null;
  regionName: string;
  dailyData: {
    date: string;
    dateFormatted: string;
    dayOfWeek: string;
    morning: number;
    afternoon: number;
    evening: number;
    total: number;
  }[];
  totalDeliveries: number;
}

export interface ProductivityReportData {
  motoboys: MotoboyProductivity[];
  regionSummaries: RegionDailySummary[];
  dailyTotals: {
    date: string;
    dateFormatted: string;
    dayOfWeek: string;
    morning: number;
    afternoon: number;
    evening: number;
    total: number;
    costPerDelivery: number;
  }[];
  overallTotal: number;
  totalCost: number;
  averageCostPerDelivery: number;
}

function useOrganizationId() {
  const { profile } = useAuth();
  const { data: tenantId } = useCurrentTenantId();
  return profile?.organization_id ?? tenantId ?? null;
}

const DAY_NAMES = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

export function useMotoboyProductivityReport(startDate: Date, endDate: Date, totalCostCents: number = 1400000) {
  const organizationId = useOrganizationId();

  return useQuery({
    queryKey: ['motoboy-productivity-report', organizationId, startDate.toISOString(), endDate.toISOString(), totalCostCents],
    queryFn: async (): Promise<ProductivityReportData> => {
      if (!organizationId) {
        return {
          motoboys: [],
          regionSummaries: [],
          dailyTotals: [],
          overallTotal: 0,
          totalCost: totalCostCents,
          averageCostPerDelivery: 0,
        };
      }

      // Fetch delivered sales with motoboy in date range
      const { data: sales, error } = await supabase
        .from('sales')
        .select(`
          id,
          delivered_at,
          assigned_delivery_user_id,
          delivery_region_id,
          delivery_region:delivery_regions!sales_delivery_region_id_fkey(id, name)
        `)
        .eq('organization_id', organizationId)
        .eq('delivery_type', 'motoboy')
        .eq('status', 'delivered')
        .not('delivered_at', 'is', null)
        .gte('delivered_at', startDate.toISOString())
        .lte('delivered_at', endDate.toISOString());

      if (error) throw error;

      // Fetch profiles for motoboys
      const motoboyIds = [...new Set((sales || []).map(s => s.assigned_delivery_user_id).filter(Boolean))] as string[];
      
      let profilesMap: Record<string, string> = {};
      if (motoboyIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, first_name, last_name')
          .in('user_id', motoboyIds);
        
        profilesMap = (profiles || []).reduce((acc, p) => {
          acc[p.user_id] = `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Motoboy';
          return acc;
        }, {} as Record<string, string>);
      }

      // Generate all days in range
      const allDays = eachDayOfInterval({ start: startDate, end: endDate });
      
      // Initialize data structures
      const motoboyData: Record<string, {
        name: string;
        regions: Record<string, { name: string; days: Record<string, { morning: number; afternoon: number; evening: number }> }>;
      }> = {};

      const regionData: Record<string, { 
        name: string; 
        days: Record<string, { morning: number; afternoon: number; evening: number }> 
      }> = {};

      const dailyTotals: Record<string, { morning: number; afternoon: number; evening: number }> = {};

      // Initialize days for all data
      allDays.forEach(day => {
        const dateKey = format(day, 'yyyy-MM-dd');
        dailyTotals[dateKey] = { morning: 0, afternoon: 0, evening: 0 };
      });

      // Process sales
      (sales || []).forEach(sale => {
        if (!sale.delivered_at || !sale.assigned_delivery_user_id) return;

        const deliveredDate = parseISO(sale.delivered_at);
        const dateKey = format(deliveredDate, 'yyyy-MM-dd');
        const hour = getHours(deliveredDate);
        
        const motoboyId = sale.assigned_delivery_user_id;
        const motoboyName = profilesMap[motoboyId] || 'Motoboy Desconhecido';
        
        const regionId = sale.delivery_region_id || 'sem-regiao';
        const regionName = (sale.delivery_region as any)?.name || 'Sem Região';

        // Determine shift
        let shift: 'morning' | 'afternoon' | 'evening';
        if (hour >= 6 && hour < 12) {
          shift = 'morning';
        } else if (hour >= 12 && hour < 18) {
          shift = 'afternoon';
        } else {
          shift = 'evening';
        }

        // Initialize motoboy if needed
        if (!motoboyData[motoboyId]) {
          motoboyData[motoboyId] = { name: motoboyName, regions: {} };
        }
        if (!motoboyData[motoboyId].regions[regionId]) {
          motoboyData[motoboyId].regions[regionId] = { 
            name: regionName, 
            days: {} 
          };
          allDays.forEach(day => {
            const dk = format(day, 'yyyy-MM-dd');
            motoboyData[motoboyId].regions[regionId].days[dk] = { morning: 0, afternoon: 0, evening: 0 };
          });
        }

        // Initialize region if needed
        if (!regionData[regionId]) {
          regionData[regionId] = { name: regionName, days: {} };
          allDays.forEach(day => {
            const dk = format(day, 'yyyy-MM-dd');
            regionData[regionId].days[dk] = { morning: 0, afternoon: 0, evening: 0 };
          });
        }

        // Update counts
        if (motoboyData[motoboyId].regions[regionId].days[dateKey]) {
          motoboyData[motoboyId].regions[regionId].days[dateKey][shift]++;
        }
        if (regionData[regionId].days[dateKey]) {
          regionData[regionId].days[dateKey][shift]++;
        }
        if (dailyTotals[dateKey]) {
          dailyTotals[dateKey][shift]++;
        }
      });

      // Transform motoboy data
      const motoboys: MotoboyProductivity[] = Object.entries(motoboyData).map(([motoboyId, data]) => {
        const regions: MotoboyRegionSummary[] = Object.entries(data.regions).map(([regionId, regionData]) => {
          const deliveries: MotoboyDailyDelivery[] = allDays.map(day => {
            const dateKey = format(day, 'yyyy-MM-dd');
            const dayData = regionData.days[dateKey] || { morning: 0, afternoon: 0, evening: 0 };
            const dayOfWeekIndex = getDay(day);
            return {
              date: dateKey,
              dateFormatted: format(day, 'dd/MM/yyyy', { locale: ptBR }),
              dayOfWeek: DAY_NAMES[dayOfWeekIndex],
              deliveries: dayData.morning + dayData.afternoon + dayData.evening,
              morningDeliveries: dayData.morning,
              afternoonDeliveries: dayData.afternoon,
              eveningDeliveries: dayData.evening,
            };
          });
          
          return {
            regionId: regionId === 'sem-regiao' ? null : regionId,
            regionName: regionData.name,
            deliveries,
            totalDeliveries: deliveries.reduce((sum, d) => sum + d.deliveries, 0),
          };
        });

        // Calculate daily totals for this motoboy
        const dailyTotals: MotoboyDailyDelivery[] = allDays.map(day => {
          const dateKey = format(day, 'yyyy-MM-dd');
          const dayOfWeekIndex = getDay(day);
          let morning = 0, afternoon = 0, evening = 0;
          
          regions.forEach(r => {
            const dayData = r.deliveries.find(d => d.date === dateKey);
            if (dayData) {
              morning += dayData.morningDeliveries;
              afternoon += dayData.afternoonDeliveries;
              evening += dayData.eveningDeliveries;
            }
          });
          
          return {
            date: dateKey,
            dateFormatted: format(day, 'dd/MM/yyyy', { locale: ptBR }),
            dayOfWeek: DAY_NAMES[dayOfWeekIndex],
            deliveries: morning + afternoon + evening,
            morningDeliveries: morning,
            afternoonDeliveries: afternoon,
            eveningDeliveries: evening,
          };
        });

        return {
          motoboyId,
          motoboyName: data.name,
          regions,
          totalDeliveries: regions.reduce((sum, r) => sum + r.totalDeliveries, 0),
          dailyTotals,
        };
      }).sort((a, b) => b.totalDeliveries - a.totalDeliveries);

      // Transform region summaries
      const regionSummaries: RegionDailySummary[] = Object.entries(regionData).map(([regionId, data]) => {
        const dailyData = allDays.map(day => {
          const dateKey = format(day, 'yyyy-MM-dd');
          const dayData = data.days[dateKey] || { morning: 0, afternoon: 0, evening: 0 };
          const dayOfWeekIndex = getDay(day);
          return {
            date: dateKey,
            dateFormatted: format(day, 'dd/MM/yyyy', { locale: ptBR }),
            dayOfWeek: DAY_NAMES[dayOfWeekIndex],
            morning: dayData.morning,
            afternoon: dayData.afternoon,
            evening: dayData.evening,
            total: dayData.morning + dayData.afternoon + dayData.evening,
          };
        });

        return {
          regionId: regionId === 'sem-regiao' ? null : regionId,
          regionName: data.name,
          dailyData,
          totalDeliveries: dailyData.reduce((sum, d) => sum + d.total, 0),
        };
      }).sort((a, b) => b.totalDeliveries - a.totalDeliveries);

      // Transform daily totals
      const overallTotal = Object.values(dailyTotals).reduce(
        (sum, d) => sum + d.morning + d.afternoon + d.evening, 0
      );

      const dailyTotalsArray = allDays.map(day => {
        const dateKey = format(day, 'yyyy-MM-dd');
        const dayData = dailyTotals[dateKey] || { morning: 0, afternoon: 0, evening: 0 };
        const dayOfWeekIndex = getDay(day);
        const dayTotal = dayData.morning + dayData.afternoon + dayData.evening;
        
        return {
          date: dateKey,
          dateFormatted: format(day, 'dd/MM/yyyy', { locale: ptBR }),
          dayOfWeek: DAY_NAMES[dayOfWeekIndex],
          morning: dayData.morning,
          afternoon: dayData.afternoon,
          evening: dayData.evening,
          total: dayTotal,
          costPerDelivery: dayTotal > 0 ? Math.round((totalCostCents / overallTotal) * dayTotal / dayTotal) : 0,
        };
      });

      return {
        motoboys,
        regionSummaries,
        dailyTotals: dailyTotalsArray,
        overallTotal,
        totalCost: totalCostCents,
        averageCostPerDelivery: overallTotal > 0 ? Math.round(totalCostCents / overallTotal) : 0,
      };
    },
    enabled: !!organizationId,
    staleTime: 30_000,
  });
}
