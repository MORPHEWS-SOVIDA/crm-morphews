import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentTenantId } from '@/hooks/useTenant';
import { ArrowLeft, FileText, Search, CheckCircle, XCircle } from 'lucide-react';
import { format } from 'date-fns';

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  scan_lookup: { label: 'Consulta', color: 'bg-blue-100 text-blue-800' },
  scan_validate: { label: 'Validação', color: 'bg-green-100 text-green-800' },
  register_batch: { label: 'Registro Lote', color: 'bg-purple-100 text-purple-800' },
  assign_product: { label: 'Associar Produto', color: 'bg-amber-100 text-amber-800' },
  assign_sale: { label: 'Vincular Venda', color: 'bg-indigo-100 text-indigo-800' },
  ship: { label: 'Envio', color: 'bg-cyan-100 text-cyan-800' },
  return: { label: 'Devolução', color: 'bg-red-100 text-red-800' },
};

export default function SerialLogsPage() {
  const { data: orgId } = useCurrentTenantId();
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');

  const { data: logs, isLoading } = useQuery({
    queryKey: ['serial-logs', orgId, search, actionFilter],
    queryFn: async () => {
      if (!orgId) return [];

      let query = supabase
        .from('serial_label_logs')
        .select('*')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false })
        .limit(200);

      if (search.trim()) {
        query = query.ilike('serial_code', `%${search.trim()}%`);
      }
      if (actionFilter !== 'all') {
        query = query.eq('action', actionFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!orgId,
  });

  return (
    <div className="container max-w-4xl mx-auto p-4 space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/expedicao/etiquetas-seriais"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <FileText className="h-5 w-5 text-muted-foreground" />
        <h1 className="text-xl font-bold">Logs de Etiquetas</h1>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Histórico de Ações</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                placeholder="Buscar por código serial..."
                value={search}
                onChange={e => setSearch(e.target.value.toUpperCase())}
                className="w-full"
              />
            </div>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filtrar ação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as ações</SelectItem>
                {Object.entries(ACTION_LABELS).map(([key, { label }]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isLoading && <p className="text-sm text-muted-foreground text-center py-4">Carregando...</p>}

          {!isLoading && logs && logs.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhum log encontrado
            </p>
          )}

          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {logs?.map((log: any) => {
              const actionInfo = ACTION_LABELS[log.action] || { label: log.action, color: 'bg-muted text-muted-foreground' };
              return (
                <div key={log.id} className="flex items-start gap-3 p-3 rounded-lg border text-sm">
                  {log.success ? (
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                  ) : (
                    <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${actionInfo.color}`}>
                        {actionInfo.label}
                      </span>
                      {log.serial_code && (
                        <span className="font-mono font-bold">{log.serial_code}</span>
                      )}
                    </div>
                    {log.error_message && (
                      <p className="text-destructive text-xs mt-1">{log.error_message}</p>
                    )}
                    {log.details && typeof log.details === 'object' && Object.keys(log.details).length > 0 && (
                      <p className="text-muted-foreground text-xs mt-1">
                        {log.sale_id && <span>Venda: {log.sale_id.slice(0, 8)}... </span>}
                        {(log.details as any)?.batch_label && <span>Lote: {(log.details as any).batch_label} </span>}
                        {(log.details as any)?.count && <span>Qtd: {(log.details as any).count} </span>}
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {format(new Date(log.created_at), 'dd/MM HH:mm:ss')}
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
