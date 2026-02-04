import { useMemo } from 'react';
import { parseISO, differenceInDays, isToday, isBefore, startOfDay } from 'date-fns';
import type { Sale } from '@/hooks/useSales';

export interface ExpeditionAlert {
  id: string;
  type: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  count: number;
  saleIds: string[];
  action?: string;
  actionRoute?: string;
}

export interface ExpeditionHealthMetrics {
  // Overall health score 0-100
  healthScore: number;
  
  // Alert counts by severity
  criticalCount: number;
  warningCount: number;
  infoCount: number;
  
  // Specific alerts
  alerts: ExpeditionAlert[];
  
  // Detailed metrics
  overdueDeliveries: number;           // Entregas atrasadas (passou da data agendada)
  stalledSales: number;                // Vendas paradas há mais de 3 dias
  unconfirmedDeliveries: number;       // Correios entregues mas venda não fechada
  missingTrackingCodes: number;        // Correios sem rastreio há mais de 2 dias
  pickupsNotCollected: number;         // Retiradas não baixadas há mais de 5 dias
  dispatchedWithoutPrint: number;      // Despachadas sem checkpoint de impressão
  returnedNotProcessed: number;        // Devoluções não tratadas
  motoboyNotUpdating: number;          // Motoboy não atualizou status
}

export function useExpeditionAlerts(sales: Sale[]): ExpeditionHealthMetrics {
  return useMemo(() => {
    const alerts: ExpeditionAlert[] = [];
    const today = startOfDay(new Date());
    
    // --- CRITICAL ALERTS ---
    
    // 1. Entregas atrasadas (passou da data agendada e não entregou)
    const overdueSales = sales.filter(s => {
      if (!s.scheduled_delivery_date) return false;
      if (['delivered', 'cancelled', 'finalized', 'closed'].includes(s.status)) return false;
      const deliveryDate = startOfDay(parseISO(s.scheduled_delivery_date));
      return isBefore(deliveryDate, today);
    });
    
    if (overdueSales.length > 0) {
      alerts.push({
        id: 'overdue-deliveries',
        type: 'critical',
        title: '⏰ Entregas Atrasadas',
        description: `${overdueSales.length} vendas passaram da data de entrega agendada`,
        count: overdueSales.length,
        saleIds: overdueSales.map(s => s.id),
        action: 'Ver vendas atrasadas',
      });
    }
    
    // 2. Correios marcados como "entregue" mas venda não fechada
    const unconfirmedDeliveries = sales.filter(s => 
      s.delivery_type === 'carrier' &&
      s.carrier_tracking_status === 'delivered' &&
      !['delivered', 'cancelled', 'finalized', 'closed'].includes(s.status)
    );
    
    if (unconfirmedDeliveries.length > 0) {
      alerts.push({
        id: 'unconfirmed-deliveries',
        type: 'critical',
        title: '📦 Correios Entregues sem Baixa',
        description: `${unconfirmedDeliveries.length} vendas foram entregues pelo Correios mas não fechadas no sistema`,
        count: unconfirmedDeliveries.length,
        saleIds: unconfirmedDeliveries.map(s => s.id),
        action: 'Fechar vendas entregues',
      });
    }
    
    // 3. Devoluções não tratadas
    const returnedNotProcessed = sales.filter(s => 
      s.status === 'returned' &&
      s.created_at &&
      differenceInDays(today, parseISO(s.created_at)) > 2
    );
    
    if (returnedNotProcessed.length > 0) {
      alerts.push({
        id: 'returned-not-processed',
        type: 'critical',
        title: '↩️ Devoluções Pendentes',
        description: `${returnedNotProcessed.length} vendas devolvidas há mais de 2 dias sem tratamento`,
        count: returnedNotProcessed.length,
        saleIds: returnedNotProcessed.map(s => s.id),
        action: 'Processar devoluções',
      });
    }
    
    // --- WARNING ALERTS ---
    
    // 4. Vendas paradas há mais de 3 dias (sem movimento)
    const stalledSales = sales.filter(s => {
      if (['delivered', 'cancelled', 'finalized', 'closed'].includes(s.status)) return false;
      if (!s.created_at) return false;
      const daysOld = differenceInDays(today, parseISO(s.created_at));
      // Consider stalled if draft/pending for more than 3 days
      return daysOld > 3 && ['draft', 'payment_confirmed', 'pending_expedition'].includes(s.status);
    });
    
    if (stalledSales.length > 0) {
      alerts.push({
        id: 'stalled-sales',
        type: 'warning',
        title: '🐌 Vendas Paradas',
        description: `${stalledSales.length} vendas sem movimento há mais de 3 dias`,
        count: stalledSales.length,
        saleIds: stalledSales.map(s => s.id),
        action: 'Revisar vendas paradas',
      });
    }
    
    // 5. Correios sem código de rastreio há mais de 2 dias
    const missingTracking = sales.filter(s => {
      if (s.delivery_type !== 'carrier') return false;
      if (s.tracking_code) return false;
      if (['delivered', 'cancelled', 'finalized', 'closed'].includes(s.status)) return false;
      if (!s.created_at) return false;
      return differenceInDays(today, parseISO(s.created_at)) > 2;
    });
    
    if (missingTracking.length > 0) {
      alerts.push({
        id: 'missing-tracking',
        type: 'warning',
        title: '🏷️ Correios sem Rastreio',
        description: `${missingTracking.length} vendas Correios há mais de 2 dias sem código de rastreio`,
        count: missingTracking.length,
        saleIds: missingTracking.map(s => s.id),
        action: 'Adicionar rastreios',
      });
    }
    
    // 6. Retiradas (pickup) não baixadas há mais de 5 dias
    const pickupsNotCollected = sales.filter(s => {
      if (s.delivery_type !== 'pickup') return false;
      if (['delivered', 'cancelled', 'finalized', 'closed'].includes(s.status)) return false;
      if (!s.created_at) return false;
      return differenceInDays(today, parseISO(s.created_at)) > 5;
    });
    
    if (pickupsNotCollected.length > 0) {
      alerts.push({
        id: 'pickups-not-collected',
        type: 'warning',
        title: '🏪 Retiradas Antigas',
        description: `${pickupsNotCollected.length} retiradas há mais de 5 dias sem baixa - cliente já retirou?`,
        count: pickupsNotCollected.length,
        saleIds: pickupsNotCollected.map(s => s.id),
        action: 'Verificar retiradas',
      });
    }
    
    // 7. Motoboy não atualizando status (dispatched há mais de 1 dia sem update)
    const motoboyNotUpdating = sales.filter(s => {
      if (s.delivery_type !== 'motoboy') return false;
      if (s.status !== 'dispatched') return false;
      if (!s.created_at) return false;
      // Dispatched for more than 1 day without proper motoboy status
      const isOld = differenceInDays(today, parseISO(s.created_at)) > 1;
      const hasNoStatus = !s.motoboy_tracking_status || s.motoboy_tracking_status === 'expedition_ready';
      return isOld && hasNoStatus;
    });
    
    if (motoboyNotUpdating.length > 0) {
      alerts.push({
        id: 'motoboy-not-updating',
        type: 'warning',
        title: '🛵 Motoboys não Atualizando',
        description: `${motoboyNotUpdating.length} entregas despachadas há mais de 1 dia sem atualização do motoboy`,
        count: motoboyNotUpdating.length,
        saleIds: motoboyNotUpdating.map(s => s.id),
        action: 'Cobrar atualização',
      });
    }
    
    // --- INFO ALERTS ---
    
    // 8. Vendas para hoje (informativo)
    const todaySales = sales.filter(s => {
      if (!s.scheduled_delivery_date) return false;
      if (['delivered', 'cancelled', 'finalized', 'closed'].includes(s.status)) return false;
      return isToday(parseISO(s.scheduled_delivery_date));
    });
    
    if (todaySales.length > 0) {
      alerts.push({
        id: 'today-deliveries',
        type: 'info',
        title: '📅 Entregas Hoje',
        description: `${todaySales.length} entregas agendadas para hoje`,
        count: todaySales.length,
        saleIds: todaySales.map(s => s.id),
      });
    }
    
    // Calculate counts
    const criticalCount = alerts.filter(a => a.type === 'critical').reduce((sum, a) => sum + a.count, 0);
    const warningCount = alerts.filter(a => a.type === 'warning').reduce((sum, a) => sum + a.count, 0);
    const infoCount = alerts.filter(a => a.type === 'info').reduce((sum, a) => sum + a.count, 0);
    
    // Calculate health score (0-100)
    // Start at 100, subtract based on issues
    let healthScore = 100;
    healthScore -= criticalCount * 5;  // Each critical issue costs 5 points
    healthScore -= warningCount * 2;   // Each warning costs 2 points
    healthScore = Math.max(0, Math.min(100, healthScore));
    
    return {
      healthScore,
      criticalCount,
      warningCount,
      infoCount,
      alerts: alerts.sort((a, b) => {
        const typeOrder = { critical: 0, warning: 1, info: 2 };
        return typeOrder[a.type] - typeOrder[b.type];
      }),
      overdueDeliveries: overdueSales.length,
      stalledSales: stalledSales.length,
      unconfirmedDeliveries: unconfirmedDeliveries.length,
      missingTrackingCodes: missingTracking.length,
      pickupsNotCollected: pickupsNotCollected.length,
      dispatchedWithoutPrint: 0, // Would need checkpoint data
      returnedNotProcessed: returnedNotProcessed.length,
      motoboyNotUpdating: motoboyNotUpdating.length,
    };
  }, [sales]);
}
