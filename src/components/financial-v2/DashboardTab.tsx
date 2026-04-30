import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, Download, TrendingUp, TrendingDown, Wallet, AlertTriangle } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { useFinancialDashboard, useFinancialEntities } from '@/hooks/useFinancialV2';
import { format, startOfMonth, endOfMonth } from 'date-fns';

const ALL = '__all__';

const fmt = (cents: number | null | undefined) =>
  ((cents ?? 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function downloadCSV(filename: string, rows: (string | number)[][]) {
  const csv = rows
    .map(r => r.map(c => {
      const s = String(c ?? '');
      return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(';'))
    .join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

export function DashboardTab() {
  const today = new Date();
  const [start, setStart] = useState(format(startOfMonth(today), 'yyyy-MM-dd'));
  const [end, setEnd] = useState(format(endOfMonth(today), 'yyyy-MM-dd'));
  const [entityId, setEntityId] = useState<string>(ALL);

  const { data: entities } = useFinancialEntities();
  const { data, isLoading } = useFinancialDashboard({
    start_date: start,
    end_date: end,
    entity_id: entityId === ALL ? null : entityId,
  });

  const summary = data?.summary;

  const cards = useMemo(() => [
    {
      title: 'Saldo realizado',
      value: fmt(summary?.saldo_realizado_cents),
      hint: `${fmt(summary?.realizado_inflow_cents)} entradas · ${fmt(summary?.realizado_outflow_cents)} saídas`,
      icon: Wallet,
      tone: (summary?.saldo_realizado_cents ?? 0) >= 0 ? 'text-green-500' : 'text-red-500',
    },
    {
      title: 'Entradas previstas',
      value: fmt(summary?.previsto_inflow_cents),
      hint: 'a receber no período',
      icon: TrendingUp,
      tone: 'text-blue-500',
    },
    {
      title: 'Saídas previstas',
      value: fmt(summary?.previsto_outflow_cents),
      hint: 'a pagar no período',
      icon: TrendingDown,
      tone: 'text-amber-500',
    },
    {
      title: 'Vencidos',
      value: fmt(summary?.vencidos_cents),
      hint: `${fmt(summary?.vence_7d_cents)} em 7d · ${fmt(summary?.vence_30d_cents)} em 30d`,
      icon: AlertTriangle,
      tone: 'text-red-500',
    },
  ], [summary]);

  const handleExportRows = () => {
    if (!data?.rows?.length) return;
    const header = ['Data venc', 'Pago em', 'Descrição', 'Direção', 'Status', 'Previsto', 'Realizado', 'Diferença'];
    const rows: (string | number)[][] = [header];
    data.rows.forEach(r => {
      rows.push([
        r.due_date ?? '',
        r.paid_at ? new Date(r.paid_at).toISOString().slice(0, 10) : '',
        r.description ?? '',
        r.direction,
        r.status,
        ((r.expected_amount_cents ?? 0) / 100).toFixed(2),
        ((r.actual_amount_cents ?? 0) / 100).toFixed(2),
        ((r.difference_amount_cents ?? 0) / 100).toFixed(2),
      ]);
    });
    downloadCSV(`razao-financeiro_${start}_${end}.csv`, rows);
  };

  const handleExportBreakdown = (rows: { name: string; outflow_cents: number; inflow_cents: number }[], label: string) => {
    if (!rows?.length) return;
    const header = [label, 'Saídas', 'Entradas', 'Líquido'];
    const csv: (string | number)[][] = [header];
    rows.forEach(r => csv.push([
      r.name,
      (r.outflow_cents / 100).toFixed(2),
      (r.inflow_cents / 100).toFixed(2),
      ((r.inflow_cents - r.outflow_cents) / 100).toFixed(2),
    ]));
    downloadCSV(`${label.toLowerCase().replace(/\s+/g, '-')}_${start}_${end}.csv`, csv);
  };

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-end flex-wrap gap-3">
            <div>
              <Label className="text-xs">Início</Label>
              <Input type="date" value={start} onChange={e => setStart(e.target.value)} className="w-[150px]" />
            </div>
            <div>
              <Label className="text-xs">Fim</Label>
              <Input type="date" value={end} onChange={e => setEnd(e.target.value)} className="w-[150px]" />
            </div>
            <div>
              <Label className="text-xs">Entidade</Label>
              <Select value={entityId} onValueChange={setEntityId}>
                <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todas</SelectItem>
                  {entities?.filter(e => e.is_active).map(e => (
                    <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="ml-auto flex gap-2">
              <Button variant="outline" size="sm" onClick={handleExportRows} disabled={!data?.rows?.length}>
                <Download className="w-4 h-4 mr-1" /> Exportar lançamentos (CSV)
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(c => {
          const Icon = c.icon;
          return (
            <Card key={c.title}>
              <CardContent className="pt-4">
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <p className="text-sm text-muted-foreground">{c.title}</p>
                    <p className={`text-2xl font-bold ${c.tone}`}>{c.value}</p>
                    <p className="text-xs text-muted-foreground mt-1">{c.hint}</p>
                  </div>
                  <Icon className={`h-8 w-8 ${c.tone}`} />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Breakdowns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <BreakdownCard
          title="Saídas por categoria"
          rows={data?.by_category ?? []}
          onExport={() => handleExportBreakdown(data?.by_category ?? [], 'Categorias')}
        />
        <BreakdownCard
          title="Saídas por centro de custo"
          rows={data?.by_cost_center ?? []}
          onExport={() => handleExportBreakdown(data?.by_cost_center ?? [], 'Centros de custo')}
        />
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">Por entidade</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => handleExportBreakdown(data?.by_entity ?? [], 'Entidades')}>
            <Download className="w-4 h-4 mr-1" /> CSV
          </Button>
        </CardHeader>
        <CardContent>
          {(data?.by_entity?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">Sem dados no período.</p>
          ) : (
            <div className="space-y-2">
              {data!.by_entity.map(r => (
                <div key={r.id ?? r.name} className="flex items-center justify-between text-sm">
                  <span className="truncate">{r.name}</span>
                  <div className="flex gap-2">
                    <Badge variant="outline" className="font-mono">↓ {fmt(r.inflow_cents)}</Badge>
                    <Badge variant="outline" className="font-mono">↑ {fmt(r.outflow_cents)}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function BreakdownCard({
  title, rows, onExport,
}: {
  title: string;
  rows: { id: string | null; name: string; outflow_cents: number; inflow_cents: number }[];
  onExport: () => void;
}) {
  const chartData = rows.slice(0, 8).map(r => ({
    name: r.name.length > 18 ? r.name.slice(0, 18) + '…' : r.name,
    Saídas: r.outflow_cents / 100,
  }));
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-base">{title}</CardTitle>
        <Button variant="ghost" size="sm" onClick={onExport} disabled={!rows.length}>
          <Download className="w-4 h-4 mr-1" /> CSV
        </Button>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem dados no período.</p>
        ) : (
          <>
            <div className="h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  />
                  <Bar dataKey="Saídas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 space-y-1 max-h-[200px] overflow-auto">
              {rows.map(r => (
                <div key={r.id ?? r.name} className="flex items-center justify-between text-sm py-1 border-b last:border-0">
                  <span className="truncate">{r.name}</span>
                  <span className="font-mono">{fmt(r.outflow_cents)}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
