import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentTenantId } from '@/hooks/useTenant';
import { ArrowLeft, FileText, Search, Package } from 'lucide-react';

interface BatchRow {
  serial_code: string;
  product_id: string | null;
  product_name: string | null;
  lote: string | null;
  validade: string | null;
  status: string;
  sale_id: string | null;
  stocked_at: string | null;
  assigned_at: string | null;
  shipped_at: string | null;
}

export default function SerialBatchReportPage() {
  const { data: orgId } = useCurrentTenantId();
  const [loteFilter, setLoteFilter] = useState('');
  const [productFilter, setProductFilter] = useState('');

  const { data: lotes = [] } = useQuery({
    queryKey: ['serial-lotes-list', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from('product_serial_labels')
        .select('lote, validade, product_name')
        .eq('organization_id', orgId)
        .not('lote', 'is', null)
        .limit(5000);
      if (error) throw error;
      const map = new Map<string, { lote: string; validade: string | null; product_name: string | null; count: number }>();
      (data || []).forEach((r: any) => {
        const key = `${r.lote}::${r.product_name || ''}`;
        const existing = map.get(key);
        if (existing) existing.count++;
        else map.set(key, { lote: r.lote, validade: r.validade, product_name: r.product_name, count: 1 });
      });
      return Array.from(map.values()).sort((a, b) => a.lote.localeCompare(b.lote));
    },
    enabled: !!orgId,
  });

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['serial-batch-report', orgId, loteFilter, productFilter],
    queryFn: async () => {
      if (!orgId || !loteFilter) return [];
      let q = supabase
        .from('product_serial_labels')
        .select('serial_code, product_id, product_name, lote, validade, status, sale_id, stocked_at, assigned_at, shipped_at')
        .eq('organization_id', orgId)
        .eq('lote', loteFilter)
        .order('serial_code')
        .limit(2000);
      if (productFilter) q = q.ilike('product_name', `%${productFilter}%`);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as BatchRow[];
    },
    enabled: !!orgId && !!loteFilter,
  });

  const summary = useMemo(() => {
    const s = { total: rows.length, in_stock: 0, assigned: 0, shipped: 0, delivered: 0, returned: 0 };
    rows.forEach(r => { if ((s as any)[r.status] != null) (s as any)[r.status]++; });
    return s;
  }, [rows]);

  const salesIds = useMemo(
    () => Array.from(new Set(rows.map(r => r.sale_id).filter(Boolean))) as string[],
    [rows]
  );

  const { data: sales = [] } = useQuery({
    queryKey: ['serial-batch-sales', salesIds],
    queryFn: async () => {
      if (salesIds.length === 0) return [];
      const { data, error } = await supabase
        .from('sales')
        .select('id, romaneio_number, total_cents, status, delivered_at, created_at, lead:leads(name)')
        .in('id', salesIds);
      if (error) throw error;
      return data || [];
    },
    enabled: salesIds.length > 0,
  });

  const salesById = useMemo(() => {
    const m: Record<string, any> = {};
    (sales as any[]).forEach((s: any) => { m[s.id] = s; });
    return m;
  }, [sales]);

  const filteredLotes = lotes.filter(l =>
    !productFilter || (l.product_name || '').toLowerCase().includes(productFilter.toLowerCase())
  );

  return (
    <div className="container max-w-5xl mx-auto p-4 space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/expedicao/etiquetas-seriais"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <FileText className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-bold">Conferir Vendas por Lote</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Filtrar por produto (opcional)</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-8"
                  value={productFilter}
                  onChange={e => setProductFilter(e.target.value)}
                  placeholder="Nome do produto..."
                />
              </div>
            </div>
            <div>
              <Label>Lote</Label>
              <Input
                value={loteFilter}
                onChange={e => setLoteFilter(e.target.value)}
                placeholder="Digite ou selecione abaixo"
              />
            </div>
          </div>

          {filteredLotes.length > 0 && (
            <div>
              <Label className="text-xs text-muted-foreground">Lotes registrados ({filteredLotes.length})</Label>
              <div className="flex flex-wrap gap-2 mt-1 max-h-32 overflow-y-auto">
                {filteredLotes.map(l => (
                  <button
                    key={`${l.lote}-${l.product_name}`}
                    onClick={() => setLoteFilter(l.lote)}
                    className={`text-xs px-2 py-1 rounded border ${loteFilter === l.lote ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                  >
                    {l.lote} {l.product_name && `· ${l.product_name}`} {l.validade && `· val ${l.validade}`} ({l.count})
                  </button>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {loteFilter && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="h-4 w-4" />
              Lote: {loteFilter}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-sm">
              <div className="bg-muted/50 rounded p-2"><div className="text-xs text-muted-foreground">Total</div><div className="font-bold">{summary.total}</div></div>
              <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded p-2"><div className="text-xs text-muted-foreground">Em estoque</div><div className="font-bold">{summary.in_stock}</div></div>
              <div className="bg-blue-50 dark:bg-blue-950/30 rounded p-2"><div className="text-xs text-muted-foreground">Em pedido</div><div className="font-bold">{summary.assigned}</div></div>
              <div className="bg-purple-50 dark:bg-purple-950/30 rounded p-2"><div className="text-xs text-muted-foreground">Despachadas</div><div className="font-bold">{summary.shipped}</div></div>
              <div className="bg-orange-50 dark:bg-orange-950/30 rounded p-2"><div className="text-xs text-muted-foreground">Devolvidas</div><div className="font-bold">{summary.returned}</div></div>
            </div>

            {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}

            {!isLoading && rows.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="py-2">Etiqueta</th>
                      <th>Produto</th>
                      <th>Status</th>
                      <th>Venda</th>
                      <th>Cliente</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(r => {
                      const sale = r.sale_id ? salesById[r.sale_id] : null;
                      return (
                        <tr key={r.serial_code} className="border-b hover:bg-muted/30">
                          <td className="py-2 font-mono text-xs">{r.serial_code}</td>
                          <td className="text-xs">{r.product_name || '-'}</td>
                          <td className="text-xs">{r.status}</td>
                          <td className="text-xs">
                            {sale ? (
                              <Link to={`/vendas/${sale.id}`} className="text-primary hover:underline">
                                #{sale.romaneio_number || sale.id.slice(0, 8)}
                              </Link>
                            ) : '-'}
                          </td>
                          <td className="text-xs">{sale?.lead?.name || '-'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {!isLoading && rows.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhuma etiqueta encontrada para este lote.</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
