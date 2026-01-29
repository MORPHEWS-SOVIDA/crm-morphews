import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentTenantId } from '@/hooks/useTenant';
import { useFunnelStages, CapiEventName } from '@/hooks/useFunnelStages';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Zap, 
  ArrowRight, 
  Users, 
  TrendingUp, 
  Clock, 
  CheckCircle2,
  AlertTriangle,
  BarChart3,
  Target,
  Activity,
  Settings,
  Link2,
} from 'lucide-react';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { TracZAPLinkGenerator } from './TracZAPLinkGenerator';

interface StageStats {
  stage_id: string;
  stage_name: string;
  stage_color: string;
  stage_position: number;
  capi_event_name: CapiEventName;
  total_leads: number;
  events_sent: number;
  events_failed: number;
  avg_time_to_next_hours: number | null;
}

interface TracZAPMetrics {
  total_events_sent: number;
  total_leads_tracked: number;
  conversion_rate: number;
  stages: StageStats[];
}

// CAPI Event colors
const capiEventColors: Record<string, string> = {
  Lead: 'bg-blue-100 text-blue-700 border-blue-300',
  Contact: 'bg-green-100 text-green-700 border-green-300',
  Schedule: 'bg-purple-100 text-purple-700 border-purple-300',
  Purchase: 'bg-emerald-100 text-emerald-700 border-emerald-300',
  CompleteRegistration: 'bg-indigo-100 text-indigo-700 border-indigo-300',
  SubmitApplication: 'bg-orange-100 text-orange-700 border-orange-300',
  ViewContent: 'bg-gray-100 text-gray-700 border-gray-300',
};

function useTracZAPMetrics(dateRange: { start: Date; end: Date }) {
  const { data: tenantId } = useCurrentTenantId();
  
  return useQuery({
    queryKey: ['traczap-metrics', tenantId, dateRange.start.toISOString(), dateRange.end.toISOString()],
    enabled: !!tenantId,
    queryFn: async () => {
      if (!tenantId) return null;

      // Get all funnel stages with CAPI configuration
      const stagesQuery = supabase
        .from('organization_funnel_stages' as any)
        .select('id, name, color, position, capi_event_name')
        .eq('organization_id', tenantId)
        .eq('is_active', true)
        .order('position');
      const { data: stages, error: stagesError } = await stagesQuery as any;

      if (stagesError) throw stagesError;

      // Get stage history with CAPI events in date range
      const { data: history, error: historyError } = await (supabase
        .from('lead_stage_history' as any)
        .select('id, funnel_stage_id, capi_event_sent, capi_event_name, created_at')
        .eq('organization_id', tenantId)
        .gte('created_at', dateRange.start.toISOString())
        .lte('created_at', dateRange.end.toISOString()) as any);

      if (historyError) throw historyError;

      // Calculate metrics per stage
      const stageStats: StageStats[] = (stages || [])
        .filter(s => s.capi_event_name) // Only stages with CAPI events
        .map(stage => {
          const stageHistory = (history || []).filter((h: any) => h.funnel_stage_id === stage.id);
          const eventsSent = stageHistory.filter((h: any) => h.capi_event_sent).length;
          const eventsFailed = stageHistory.filter((h: any) => !h.capi_event_sent && h.capi_event_name).length;

          return {
            stage_id: stage.id,
            stage_name: stage.name,
            stage_color: stage.color || '#6B7280',
            stage_position: stage.position,
            capi_event_name: stage.capi_event_name as CapiEventName,
            total_leads: stageHistory.length,
            events_sent: eventsSent,
            events_failed: eventsFailed,
            avg_time_to_next_hours: null, // TODO: Calculate this
          };
        });

      const totalEventsSent = stageStats.reduce((acc, s) => acc + s.events_sent, 0);
      const totalLeads = stageStats.reduce((acc, s) => acc + s.total_leads, 0);

      return {
        total_events_sent: totalEventsSent,
        total_leads_tracked: totalLeads,
        conversion_rate: totalLeads > 0 ? (totalEventsSent / totalLeads) * 100 : 0,
        stages: stageStats,
      } as TracZAPMetrics;
    },
  });
}

function useRecentTracZAPEvents(limit = 20) {
  const { data: tenantId } = useCurrentTenantId();
  
  return useQuery({
    queryKey: ['traczap-recent-events', tenantId, limit],
    enabled: !!tenantId,
    queryFn: async () => {
      if (!tenantId) return [];

      const { data, error } = await (supabase
        .from('lead_stage_history' as any)
        .select(`
          id,
          lead_id,
          funnel_stage_id,
          capi_event_sent,
          capi_event_name,
          created_at,
          lead:leads(name),
          stage:organization_funnel_stages!lead_stage_history_funnel_stage_id_fkey(name, color)
        `)
        .eq('organization_id', tenantId)
        .not('capi_event_name', 'is', null)
        .order('created_at', { ascending: false })
        .limit(limit) as any);

      if (error) throw error;
      return data || [];
    },
  });
}

export function TracZAPDashboard() {
  const [period, setPeriod] = useState('7');
  const { data: stages, isLoading: stagesLoading } = useFunnelStages();
  
  const dateRange = {
    start: startOfDay(subDays(new Date(), parseInt(period))),
    end: endOfDay(new Date()),
  };

  const { data: metrics, isLoading: metricsLoading } = useTracZAPMetrics(dateRange);
  const { data: recentEvents, isLoading: eventsLoading } = useRecentTracZAPEvents();

  // Check if any stage has CAPI configured
  const hasCapiConfigured = stages?.some(s => s.capi_event_name);

  if (stagesLoading || metricsLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!hasCapiConfigured) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <div className="rounded-full bg-blue-100 dark:bg-blue-900/30 p-4 mb-4">
            <Zap className="h-8 w-8 text-blue-600" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Configure o TracZAP</h3>
          <p className="text-muted-foreground text-center max-w-md mb-4">
            Para começar a rastrear conversões por etapa do funil, configure os eventos CAPI 
            nas suas etapas do funil.
          </p>
          <Button asChild>
            <Link to="/settings?tab=funnel">
              <Settings className="h-4 w-4 mr-2" />
              Configurar Etapas do Funil
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600">
          <Zap className="h-6 w-6 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-bold">TracZAP</h2>
          <p className="text-sm text-muted-foreground">
            Rastreamento de conversões por etapa do funil
          </p>
        </div>
      </div>

      <Tabs defaultValue="funnel" className="w-full">
        <TabsList>
          <TabsTrigger value="funnel" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Funil CAPI
          </TabsTrigger>
          <TabsTrigger value="links" className="gap-2">
            <Link2 className="h-4 w-4" />
            Links Rastreáveis
          </TabsTrigger>
        </TabsList>

        <TabsContent value="funnel" className="mt-6 space-y-6">
          {/* Period selector */}
          <div className="flex justify-end">
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Últimos 7 dias</SelectItem>
                <SelectItem value="14">Últimos 14 dias</SelectItem>
                <SelectItem value="30">Últimos 30 dias</SelectItem>
                <SelectItem value="60">Últimos 60 dias</SelectItem>
                <SelectItem value="90">Últimos 90 dias</SelectItem>
              </SelectContent>
            </Select>
          </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-900/30">
                <Activity className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Eventos Enviados</p>
                <p className="text-2xl font-bold">{metrics?.total_events_sent || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-green-100 dark:bg-green-900/30">
                <Users className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Leads Rastreados</p>
                <p className="text-2xl font-bold">{metrics?.total_leads_tracked || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-purple-100 dark:bg-purple-900/30">
                <Target className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Taxa de Sucesso</p>
                <p className="text-2xl font-bold">{(metrics?.conversion_rate || 0).toFixed(1)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Funnel Visualization */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Funil de Conversões CAPI
          </CardTitle>
          <CardDescription>
            Eventos Meta Ads disparados por etapa do funil
          </CardDescription>
        </CardHeader>
        <CardContent>
          {metrics?.stages && metrics.stages.length > 0 ? (
            <div className="space-y-4">
              {metrics.stages.map((stage, index) => {
                const successRate = stage.total_leads > 0 
                  ? (stage.events_sent / stage.total_leads) * 100 
                  : 0;
                const maxLeads = Math.max(...metrics.stages.map(s => s.total_leads), 1);
                const barWidth = (stage.total_leads / maxLeads) * 100;

                return (
                  <div key={stage.stage_id} className="relative">
                    <div className="flex items-center gap-4">
                      {/* Stage indicator */}
                      <div 
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: stage.stage_color }}
                      />
                      
                      {/* Stage name and CAPI event */}
                      <div className="w-48 shrink-0">
                        <p className="font-medium text-sm truncate">{stage.stage_name}</p>
                        <Badge 
                          variant="outline" 
                          className={`text-xs ${capiEventColors[stage.capi_event_name] || ''}`}
                        >
                          {stage.capi_event_name}
                        </Badge>
                      </div>

                      {/* Progress bar */}
                      <div className="flex-1">
                        <div className="h-8 bg-muted rounded-lg overflow-hidden relative">
                          <div 
                            className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500"
                            style={{ width: `${barWidth}%` }}
                          />
                          <div className="absolute inset-0 flex items-center justify-between px-3">
                            <span className="text-xs font-medium text-foreground">
                              {stage.total_leads} leads
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {stage.events_sent} eventos
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Success rate */}
                      <div className="w-20 text-right shrink-0">
                        <div className="flex items-center justify-end gap-1">
                          {stage.events_failed > 0 ? (
                            <AlertTriangle className="h-4 w-4 text-amber-500" />
                          ) : successRate === 100 && stage.total_leads > 0 ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          ) : null}
                          <span className={`text-sm font-semibold ${
                            successRate === 100 ? 'text-green-600' : 
                            successRate >= 80 ? 'text-blue-600' : 
                            'text-amber-600'
                          }`}>
                            {successRate.toFixed(0)}%
                          </span>
                        </div>
                        {stage.events_failed > 0 && (
                          <p className="text-xs text-amber-600">{stage.events_failed} falhas</p>
                        )}
                      </div>
                    </div>

                    {/* Arrow to next stage */}
                    {index < metrics.stages.length - 1 && (
                      <div className="flex justify-center my-2">
                        <ArrowRight className="h-4 w-4 text-muted-foreground rotate-90" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p>Nenhum evento CAPI registrado no período selecionado.</p>
              <p className="text-sm mt-1">
                Os eventos serão exibidos conforme leads mudarem de etapa no funil.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Events */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Eventos Recentes
          </CardTitle>
          <CardDescription>
            Últimos eventos TracZAP disparados
          </CardDescription>
        </CardHeader>
        <CardContent>
          {eventsLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : recentEvents && recentEvents.length > 0 ? (
            <div className="space-y-2">
              {recentEvents.map((event) => (
                <div 
                  key={event.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: (event.stage as any)?.color || '#6B7280' }}
                    />
                    <div>
                      <p className="text-sm font-medium">
                        {(event.lead as any)?.name || 'Lead'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        → {(event.stage as any)?.name}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge 
                      variant="outline"
                      className={`text-xs ${capiEventColors[event.capi_event_name || ''] || ''}`}
                    >
                      {event.capi_event_name}
                    </Badge>
                    {event.capi_event_sent ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                    )}
                    <span className="text-xs text-muted-foreground w-16 text-right">
                      {format(new Date(event.created_at), "dd/MM HH:mm", { locale: ptBR })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center py-8 text-muted-foreground">
              Nenhum evento recente
            </p>
          )}
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="links" className="mt-6">
          <TracZAPLinkGenerator />
        </TabsContent>
      </Tabs>
    </div>
  );
}
