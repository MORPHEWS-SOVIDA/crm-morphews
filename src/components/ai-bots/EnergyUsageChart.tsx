import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity, TrendingUp, TrendingDown, Minus } from "lucide-react";

export function EnergyUsageChart() {
  const { tenantId } = useTenant();

  const { data: usageData, isLoading } = useQuery({
    queryKey: ['energy-usage-chart', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];

      const endDate = endOfDay(new Date());
      const startDate = startOfDay(subDays(new Date(), 6)); // Last 7 days

      const { data, error } = await supabase
        .from('energy_usage_log')
        .select('created_at, energy_consumed, action_type, bot_id')
        .eq('organization_id', tenantId)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Group by day
      const groupedByDay: Record<string, { total: number; count: number }> = {};
      
      for (let i = 6; i >= 0; i--) {
        const date = format(subDays(new Date(), i), 'yyyy-MM-dd');
        groupedByDay[date] = { total: 0, count: 0 };
      }

      (data || []).forEach((item: any) => {
        const date = format(new Date(item.created_at), 'yyyy-MM-dd');
        if (groupedByDay[date]) {
          groupedByDay[date].total += item.energy_consumed || 0;
          groupedByDay[date].count += 1;
        }
      });

      return Object.entries(groupedByDay).map(([date, values]) => ({
        date,
        label: format(new Date(date), 'EEE', { locale: ptBR }),
        energy: values.total,
        messages: values.count
      }));
    },
    enabled: !!tenantId,
    refetchInterval: 60000 // Refresh every minute
  });

  const totalEnergy = usageData?.reduce((sum, d) => sum + d.energy, 0) || 0;
  const totalMessages = usageData?.reduce((sum, d) => sum + d.messages, 0) || 0;
  const avgPerMessage = totalMessages > 0 ? (totalEnergy / totalMessages).toFixed(1) : '0';

  // Calculate trend (compare last 3 days with previous 3 days)
  const recentDays = usageData?.slice(-3) || [];
  const previousDays = usageData?.slice(0, 3) || [];
  const recentTotal = recentDays.reduce((sum, d) => sum + d.energy, 0);
  const previousTotal = previousDays.reduce((sum, d) => sum + d.energy, 0);
  const trend = previousTotal > 0 ? ((recentTotal - previousTotal) / previousTotal * 100).toFixed(0) : 0;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-48 w-full" />
        </CardContent>
      </Card>
    );
  }

  const maxEnergy = Math.max(...(usageData?.map(d => d.energy) || [1]));

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Consumo de Energia (7 dias)
          </CardTitle>
          <div className="flex items-center gap-1 text-sm">
            {Number(trend) > 0 ? (
              <>
                <TrendingUp className="h-4 w-4 text-red-500" />
                <span className="text-red-500">+{trend}%</span>
              </>
            ) : Number(trend) < 0 ? (
              <>
                <TrendingDown className="h-4 w-4 text-green-500" />
                <span className="text-green-500">{trend}%</span>
              </>
            ) : (
              <>
                <Minus className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">0%</span>
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="text-center p-2 bg-muted/50 rounded-lg">
            <p className="text-2xl font-bold text-primary">{totalEnergy.toLocaleString('pt-BR')}</p>
            <p className="text-xs text-muted-foreground">Energia Total</p>
          </div>
          <div className="text-center p-2 bg-muted/50 rounded-lg">
            <p className="text-2xl font-bold">{totalMessages.toLocaleString('pt-BR')}</p>
            <p className="text-xs text-muted-foreground">Mensagens</p>
          </div>
          <div className="text-center p-2 bg-muted/50 rounded-lg">
            <p className="text-2xl font-bold">{avgPerMessage}</p>
            <p className="text-xs text-muted-foreground">Média/Msg</p>
          </div>
        </div>

        {/* Chart */}
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={usageData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <XAxis 
                dataKey="label" 
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis 
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => value.toLocaleString('pt-BR')}
              />
              <Tooltip
                formatter={(value: number) => [value.toLocaleString('pt-BR'), 'Energia']}
                labelFormatter={(label) => `Dia: ${label}`}
                contentStyle={{
                  backgroundColor: 'hsl(var(--background))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '12px'
                }}
              />
              <Bar dataKey="energy" radius={[4, 4, 0, 0]}>
                {usageData?.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`}
                    fill={entry.energy > maxEnergy * 0.8 
                      ? 'hsl(var(--destructive))' 
                      : entry.energy > maxEnergy * 0.5 
                        ? 'hsl(var(--chart-2))' 
                        : 'hsl(var(--primary))'
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
