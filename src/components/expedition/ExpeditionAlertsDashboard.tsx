import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  AlertTriangle,
  AlertCircle,
  Info,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Loader2,
  Activity,
} from 'lucide-react';
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import type { ExpeditionHealthMetrics, ExpeditionAlert } from '@/hooks/useExpeditionAlerts';

interface ExpeditionAlertsDashboardProps {
  metrics: ExpeditionHealthMetrics;
  onFilterBySaleIds?: (saleIds: string[]) => void;
  onRefresh?: () => void;
}

export function ExpeditionAlertsDashboard({ 
  metrics, 
  onFilterBySaleIds,
  onRefresh 
}: ExpeditionAlertsDashboardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const { profile } = useAuth();

  const handleSyncCorreios = async () => {
    if (!profile?.organization_id) return;
    
    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-correios-status', {
        body: { 
          organization_id: profile.organization_id,
          dry_run: false,
        },
      });

      if (error) throw error;

      toast.success(
        <div>
          <strong>Sync Correios Concluído!</strong>
          <p className="text-sm mt-1">
            Verificados: {data.checked} | 
            Atualizados: {data.updated} | 
            Fechados: {data.auto_closed}
          </p>
        </div>,
        { duration: 5000 }
      );

      onRefresh?.();
    } catch (err) {
      console.error('Sync error:', err);
      toast.error('Erro ao sincronizar com Correios');
    } finally {
      setIsSyncing(false);
    }
  };

  const getHealthColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    if (score >= 40) return 'text-orange-600';
    return 'text-red-600';
  };

  const getHealthBg = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-yellow-500';
    if (score >= 40) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const getAlertIcon = (type: ExpeditionAlert['type']) => {
    switch (type) {
      case 'critical':
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case 'warning':
        return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      case 'info':
        return <Info className="w-4 h-4 text-blue-500" />;
    }
  };

  const getAlertBg = (type: ExpeditionAlert['type']) => {
    switch (type) {
      case 'critical':
        return 'bg-red-50 dark:bg-red-950/30 border-red-200';
      case 'warning':
        return 'bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200';
      case 'info':
        return 'bg-blue-50 dark:bg-blue-950/30 border-blue-200';
    }
  };

  // Only show if there are alerts
  if (metrics.alerts.length === 0) {
    return (
      <Card className="border-green-300 bg-green-50 dark:bg-green-950/30">
        <CardContent className="p-4 flex items-center gap-4">
          <Activity className="w-8 h-8 text-green-600" />
          <div className="flex-1">
            <p className="font-semibold text-green-700 dark:text-green-400">
              ✅ Expedição Saudável
            </p>
            <p className="text-sm text-green-600 dark:text-green-500">
              Nenhum alerta no momento. Continue assim!
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSyncCorreios}
            disabled={isSyncing}
            className="border-green-300 text-green-700"
          >
            {isSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            <span className="ml-2">Sync Correios</span>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-2 border-dashed border-muted-foreground/20">
      <CardContent className="p-4">
        {/* Header with health score */}
        <div className="flex items-center gap-4 mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <span className={`text-2xl font-bold ${getHealthColor(metrics.healthScore)}`}>
                {metrics.healthScore}%
              </span>
              <div className="flex-1 max-w-32">
                <Progress 
                  value={metrics.healthScore} 
                  className="h-2"
                />
              </div>
              <span className="text-sm text-muted-foreground">Saúde da Expedição</span>
            </div>
          </div>
          
          {/* Alert counters */}
          <div className="flex items-center gap-2">
            {metrics.criticalCount > 0 && (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="w-3 h-3" />
                {metrics.criticalCount} críticos
              </Badge>
            )}
            {metrics.warningCount > 0 && (
              <Badge variant="outline" className="gap-1 border-yellow-400 text-yellow-700 bg-yellow-50">
                <AlertCircle className="w-3 h-3" />
                {metrics.warningCount} avisos
              </Badge>
            )}
          </div>
          
          {/* Actions */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSyncCorreios}
              disabled={isSyncing}
            >
              {isSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              <span className="ml-2 hidden sm:inline">Sync Correios</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              <span className="ml-1">{isExpanded ? 'Menos' : 'Ver Alertas'}</span>
            </Button>
          </div>
        </div>

        {/* Expanded alerts list */}
        {isExpanded && (
          <div className="space-y-2 pt-3 border-t">
            {metrics.alerts.map(alert => (
              <div
                key={alert.id}
                className={`p-3 rounded-lg border flex items-center gap-3 ${getAlertBg(alert.type)}`}
              >
                {getAlertIcon(alert.type)}
                <div className="flex-1">
                  <p className="font-medium text-sm">{alert.title}</p>
                  <p className="text-xs text-muted-foreground">{alert.description}</p>
                </div>
                <Badge variant="secondary" className="text-xs">
                  {alert.count}
                </Badge>
                {alert.action && onFilterBySaleIds && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs h-7"
                    onClick={() => onFilterBySaleIds(alert.saleIds)}
                  >
                    {alert.action}
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
