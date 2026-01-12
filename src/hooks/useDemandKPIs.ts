import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { isPast, differenceInHours, startOfDay, endOfDay, subDays } from 'date-fns';

interface DemandKPIs {
  totalDemands: number;
  openDemands: number;
  completedDemands: number;
  overdueDemands: number;
  slaComplianceRate: number;
  avgCompletionTimeHours: number;
  demandsByUrgency: { low: number; medium: number; high: number };
  demandsByColumn: { name: string; count: number; color: string | null }[];
  demandsByUser: { userId: string; userName: string; count: number; completed: number }[];
  recentActivity: { date: string; created: number; completed: number }[];
  timeByUser: { userId: string; userName: string; totalSeconds: number }[];
}

export function useDemandKPIs(boardId: string | null, dateRange?: { from: Date; to: Date }) {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['demand-kpis', boardId, dateRange?.from?.toISOString(), dateRange?.to?.toISOString()],
    queryFn: async (): Promise<DemandKPIs> => {
      if (!profile?.organization_id) {
        throw new Error('Organization not found');
      }

      // Fetch all demands for this board
      let query = supabase
        .from('demands')
        .select(`
          id,
          title,
          urgency,
          column_id,
          sla_deadline,
          completed_at,
          created_at,
          total_time_seconds,
          is_archived,
          column:demand_columns(id, name, color, is_final),
          assignees:demand_assignees(user_id)
        `)
        .eq('organization_id', profile.organization_id)
        .eq('is_archived', false);

      if (boardId) {
        query = query.eq('board_id', boardId);
      }

      if (dateRange?.from) {
        query = query.gte('created_at', dateRange.from.toISOString());
      }
      if (dateRange?.to) {
        query = query.lte('created_at', dateRange.to.toISOString());
      }

      const { data: demands, error } = await query;
      if (error) throw error;

      // Fetch user profiles for assignees
      const allUserIds = [...new Set((demands || []).flatMap(d => 
        (d.assignees as { user_id: string }[] || []).map(a => a.user_id)
      ))];

      const { data: users } = allUserIds.length > 0 
        ? await supabase.from('profiles').select('id, first_name, last_name').in('id', allUserIds)
        : { data: [] };

      const userMap = new Map((users || []).map(u => [u.id, `${u.first_name || ''} ${u.last_name || ''}`.trim() || 'Sem nome']));

      // Fetch time entries for time tracking
      let timeQuery = supabase
        .from('demand_time_entries')
        .select('user_id, duration_seconds')
        .eq('organization_id', profile.organization_id)
        .not('duration_seconds', 'is', null);

      if (boardId) {
        const demandIds = (demands || []).map(d => d.id);
        if (demandIds.length > 0) {
          timeQuery = timeQuery.in('demand_id', demandIds);
        }
      }

      const { data: timeEntries } = await timeQuery;

      // Calculate KPIs
      const totalDemands = demands?.length || 0;
      const completedDemands = (demands || []).filter(d => 
        (d.column as any)?.is_final || d.completed_at
      ).length;
      const openDemands = totalDemands - completedDemands;
      
      const overdueDemands = (demands || []).filter(d => {
        if ((d.column as any)?.is_final || d.completed_at) return false;
        return d.sla_deadline && isPast(new Date(d.sla_deadline));
      }).length;

      // SLA compliance - completed demands that met SLA
      const completedWithSla = (demands || []).filter(d => 
        ((d.column as any)?.is_final || d.completed_at) && d.sla_deadline
      );
      const metSla = completedWithSla.filter(d => {
        const completedAt = d.completed_at ? new Date(d.completed_at) : new Date();
        return completedAt <= new Date(d.sla_deadline!);
      }).length;
      const slaComplianceRate = completedWithSla.length > 0 
        ? Math.round((metSla / completedWithSla.length) * 100) 
        : 100;

      // Average completion time
      const completedTimes = (demands || [])
        .filter(d => d.completed_at)
        .map(d => differenceInHours(new Date(d.completed_at!), new Date(d.created_at)));
      const avgCompletionTimeHours = completedTimes.length > 0
        ? Math.round(completedTimes.reduce((a, b) => a + b, 0) / completedTimes.length)
        : 0;

      // Demands by urgency
      const demandsByUrgency = {
        low: (demands || []).filter(d => d.urgency === 'low').length,
        medium: (demands || []).filter(d => d.urgency === 'medium').length,
        high: (demands || []).filter(d => d.urgency === 'high').length,
      };

      // Demands by column
      const columnCounts = new Map<string, { name: string; count: number; color: string | null }>();
      (demands || []).forEach(d => {
        const col = d.column as { id: string; name: string; color: string | null } | null;
        if (col) {
          const existing = columnCounts.get(col.id);
          if (existing) {
            existing.count++;
          } else {
            columnCounts.set(col.id, { name: col.name, count: 1, color: col.color });
          }
        }
      });
      const demandsByColumn = Array.from(columnCounts.values());

      // Demands by user
      const userCounts = new Map<string, { count: number; completed: number }>();
      (demands || []).forEach(d => {
        const assignees = d.assignees as { user_id: string }[] | null;
        const isCompleted = (d.column as any)?.is_final || !!d.completed_at;
        (assignees || []).forEach(a => {
          const existing = userCounts.get(a.user_id);
          if (existing) {
            existing.count++;
            if (isCompleted) existing.completed++;
          } else {
            userCounts.set(a.user_id, { count: 1, completed: isCompleted ? 1 : 0 });
          }
        });
      });
      const demandsByUser = Array.from(userCounts.entries()).map(([userId, data]) => ({
        userId,
        userName: userMap.get(userId) || 'Desconhecido',
        count: data.count,
        completed: data.completed,
      })).sort((a, b) => b.count - a.count);

      // Recent activity (last 7 days)
      const recentActivity: { date: string; created: number; completed: number }[] = [];
      for (let i = 6; i >= 0; i--) {
        const day = subDays(new Date(), i);
        const dayStart = startOfDay(day);
        const dayEnd = endOfDay(day);
        
        const created = (demands || []).filter(d => {
          const createdAt = new Date(d.created_at);
          return createdAt >= dayStart && createdAt <= dayEnd;
        }).length;
        
        const completed = (demands || []).filter(d => {
          if (!d.completed_at) return false;
          const completedAt = new Date(d.completed_at);
          return completedAt >= dayStart && completedAt <= dayEnd;
        }).length;

        recentActivity.push({
          date: day.toISOString().split('T')[0],
          created,
          completed,
        });
      }

      // Time by user
      const timeByCounts = new Map<string, number>();
      (timeEntries || []).forEach(entry => {
        const existing = timeByCounts.get(entry.user_id) || 0;
        timeByCounts.set(entry.user_id, existing + (entry.duration_seconds || 0));
      });
      const timeByUser = Array.from(timeByCounts.entries()).map(([userId, totalSeconds]) => ({
        userId,
        userName: userMap.get(userId) || 'Desconhecido',
        totalSeconds,
      })).sort((a, b) => b.totalSeconds - a.totalSeconds);

      return {
        totalDemands,
        openDemands,
        completedDemands,
        overdueDemands,
        slaComplianceRate,
        avgCompletionTimeHours,
        demandsByUrgency,
        demandsByColumn,
        demandsByUser,
        recentActivity,
        timeByUser,
      };
    },
    enabled: !!profile?.organization_id,
  });
}
