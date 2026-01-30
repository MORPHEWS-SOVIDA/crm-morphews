import { useMemo } from 'react';
import { format, parseISO, getDay, getHours, eachDayOfInterval, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Sale } from '@/hooks/useSales';

export interface HourlySlot {
  start: number;
  end: number;
  label: string;
  salesCount: number;
  totalCents: number;
}

export interface DaySummary {
  date: string;
  dateFormatted: string;
  dayOfWeek: string;
  dayOfWeekIndex: number;
  salesCount: number;
  totalCents: number;
}

export interface MotoboyDeliverySummary {
  date: string;
  dateFormatted: string;
  dayOfWeek: string;
  deliveries: number;
  byHour: Record<number, number>;
}

export interface SalesHourlyReportData {
  hourlySlots: HourlySlot[];
  dailySummary: DaySummary[];
  motoboyDeliveries: MotoboyDeliverySummary[];
  totals: {
    totalSales: number;
    totalCents: number;
    totalMotoboyDeliveries: number;
  };
  peakHour: { label: string; count: number } | null;
  bestDay: { date: string; dayOfWeek: string; count: number } | null;
}

const DAY_NAMES = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

export function useSalesHourlyReport(
  sales: Sale[],
  startDate: Date,
  endDate: Date
): SalesHourlyReportData {
  return useMemo(() => {
    // Initialize hourly slots (from 6:00 to 23:00)
    const hourlySlots: HourlySlot[] = [];
    for (let hour = 6; hour < 24; hour++) {
      hourlySlots.push({
        start: hour,
        end: hour + 1,
        label: `${String(hour).padStart(2, '0')}:00 às ${String(hour + 1).padStart(2, '0')}:00`,
        salesCount: 0,
        totalCents: 0,
      });
    }

    // Generate all days in range
    const allDays = eachDayOfInterval({ start: startDate, end: endDate });
    const dailyMap: Record<string, DaySummary> = {};
    
    allDays.forEach(day => {
      const dateKey = format(day, 'yyyy-MM-dd');
      const dayOfWeekIndex = getDay(day);
      dailyMap[dateKey] = {
        date: dateKey,
        dateFormatted: format(day, 'dd/MM/yyyy', { locale: ptBR }),
        dayOfWeek: DAY_NAMES[dayOfWeekIndex],
        dayOfWeekIndex,
        salesCount: 0,
        totalCents: 0,
      };
    });

    // Motoboy deliveries map
    const motoboyMap: Record<string, MotoboyDeliverySummary> = {};

    // Process sales
    sales.forEach(sale => {
      if (!sale.created_at) return;

      const createdDate = parseISO(sale.created_at);
      const hour = getHours(createdDate);
      const dateKey = format(createdDate, 'yyyy-MM-dd');

      // Update hourly slots
      const slotIndex = hour - 6;
      if (slotIndex >= 0 && slotIndex < hourlySlots.length) {
        hourlySlots[slotIndex].salesCount++;
        hourlySlots[slotIndex].totalCents += sale.total_cents || 0;
      }

      // Update daily summary
      if (dailyMap[dateKey]) {
        dailyMap[dateKey].salesCount++;
        dailyMap[dateKey].totalCents += sale.total_cents || 0;
      }

      // Process motoboy deliveries
      if (sale.delivery_type === 'motoboy' && sale.delivered_at) {
        const deliveredDate = parseISO(sale.delivered_at);
        const deliveryDateKey = format(deliveredDate, 'yyyy-MM-dd');
        const deliveryHour = getHours(deliveredDate);

        if (!motoboyMap[deliveryDateKey]) {
          const dayOfWeekIndex = getDay(deliveredDate);
          motoboyMap[deliveryDateKey] = {
            date: deliveryDateKey,
            dateFormatted: format(deliveredDate, 'dd/MM/yyyy', { locale: ptBR }),
            dayOfWeek: DAY_NAMES[dayOfWeekIndex],
            deliveries: 0,
            byHour: {},
          };
        }

        motoboyMap[deliveryDateKey].deliveries++;
        motoboyMap[deliveryDateKey].byHour[deliveryHour] = 
          (motoboyMap[deliveryDateKey].byHour[deliveryHour] || 0) + 1;
      }
    });

    // Sort daily summary by date
    const dailySummary = Object.values(dailyMap).sort((a, b) => 
      a.date.localeCompare(b.date)
    );

    // Sort motoboy deliveries by date
    const motoboyDeliveries = Object.values(motoboyMap).sort((a, b) => 
      a.date.localeCompare(b.date)
    );

    // Calculate totals
    const totalSales = sales.length;
    const totalCents = sales.reduce((sum, s) => sum + (s.total_cents || 0), 0);
    const totalMotoboyDeliveries = motoboyDeliveries.reduce((sum, d) => sum + d.deliveries, 0);

    // Find peak hour
    const peakSlot = hourlySlots.reduce((max, slot) => 
      slot.salesCount > (max?.salesCount || 0) ? slot : max, hourlySlots[0]
    );
    const peakHour = peakSlot && peakSlot.salesCount > 0 
      ? { label: peakSlot.label, count: peakSlot.salesCount } 
      : null;

    // Find best day
    const bestDaySummary = dailySummary.reduce((max, day) => 
      day.salesCount > (max?.salesCount || 0) ? day : max, dailySummary[0]
    );
    const bestDay = bestDaySummary && bestDaySummary.salesCount > 0
      ? { date: bestDaySummary.dateFormatted, dayOfWeek: bestDaySummary.dayOfWeek, count: bestDaySummary.salesCount }
      : null;

    return {
      hourlySlots: hourlySlots.filter(slot => slot.salesCount > 0 || slot.start >= 7 && slot.start <= 20),
      dailySummary,
      motoboyDeliveries,
      totals: { totalSales, totalCents, totalMotoboyDeliveries },
      peakHour,
      bestDay,
    };
  }, [sales, startDate, endDate]);
}
