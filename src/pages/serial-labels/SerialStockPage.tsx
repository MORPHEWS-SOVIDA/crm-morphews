import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentTenantId } from '@/hooks/useTenant';
import { ArrowLeft, Package } from 'lucide-react';
import { StockFilters } from '@/components/serial-labels/StockFilters';
import { StockCard } from '@/components/serial-labels/StockCard';

export interface StockGroup {
  product_id: string;
  product_name: string;
  prefix: string;
  min_code: string;
  max_code: string;
  total: number;
  in_stock: number;
  assigned: number;
  shipped: number;
  stocked_by: string | null;
  stocked_by_name: string | null;
  stocked_at: string | null;
}

export default function SerialStockPage() {
  const { data: orgId } = useCurrentTenantId();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [userFilter, setUserFilter] = useState('all');

  const { data: stockData, isLoading } = useQuery({
    queryKey: ['serial-stock-overview', orgId],
    queryFn: async () => {
      if (!orgId) return [];

      const { data: labels, error } = await supabase
        .from('product_serial_labels')
        .select('serial_code, status, product_id, stocked_by, stocked_at')
        .eq('organization_id', orgId)
        .not('product_id', 'is', null)
        .order('serial_code')
        .limit(5000);

      if (error) throw error;
      if (!labels || labels.length === 0) return [];

      const productIds = [...new Set(labels.map((l: any) => l.product_id))];
      const { data: products } = await supabase
        .from('lead_products')
        .select('id, name')
        .in('id', productIds);

      const productMap = new Map((products || []).map((p: any) => [p.id, p.name]));

      const userIds = [...new Set(labels.map((l: any) => l.stocked_by).filter(Boolean))];
      let userMap = new Map<string, string>();
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, first_name, last_name')
          .in('user_id', userIds);
        if (profiles) {
          userMap = new Map(profiles.map((p: any) => [p.user_id, `${p.first_name} ${p.last_name}`.trim()]));
        }
      }

      const groups = new Map<string, StockGroup>();

      for (const label of labels as any[]) {
        const labelPrefix = label.serial_code.replace(/\d+$/, '');
        const key = `${label.product_id}__${label.stocked_by || 'unknown'}__${labelPrefix}`;
        if (!groups.has(key)) {
          groups.set(key, {
            product_id: label.product_id,
            product_name: productMap.get(label.product_id) || 'Produto desconhecido',
            prefix: labelPrefix,
            min_code: label.serial_code,
            max_code: label.serial_code,
            total: 0,
            in_stock: 0,
            assigned: 0,
            shipped: 0,
            stocked_by: label.stocked_by,
            stocked_by_name: label.stocked_by ? userMap.get(label.stocked_by) || 'Usuário' : null,
            stocked_at: label.stocked_at,
          });
        }
        const g = groups.get(key)!;
        g.total++;
        if (label.serial_code < g.min_code) g.min_code = label.serial_code;
        if (label.serial_code > g.max_code) g.max_code = label.serial_code;
        if (label.stocked_at && (!g.stocked_at || label.stocked_at > g.stocked_at)) {
          g.stocked_at = label.stocked_at;
        }
        if (label.status === 'in_stock') g.in_stock++;
        else if (label.status === 'assigned') g.assigned++;
        else if (label.status === 'shipped') g.shipped++;
      }

      return Array.from(groups.values()).sort((a, b) => {
        const nameCompare = a.product_name.localeCompare(b.product_name);
        if (nameCompare !== 0) return nameCompare;
        return (b.stocked_at || '').localeCompare(a.stocked_at || '');
      });
    },
    enabled: !!orgId,
  });

  const { data: unlinkedCount } = useQuery({
    queryKey: ['serial-unlinked-count', orgId],
    queryFn: async () => {
      if (!orgId) return 0;
      const { count, error } = await supabase
        .from('product_serial_labels')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', orgId)
        .is('product_id', null);
      if (error) return 0;
      return count || 0;
    },
    enabled: !!orgId,
  });

  // Derive unique users for filter
  const uniqueUsers = useMemo(() => {
    if (!stockData) return [];
    const map = new Map<string, string>();
    stockData.forEach((g) => {
      if (g.stocked_by && g.stocked_by_name) {
        map.set(g.stocked_by, g.stocked_by_name);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [stockData]);

  // Filter data
  const filtered = useMemo(() => {
    if (!stockData) return [];
    const q = search.toLowerCase();
    return stockData.filter((g) => {
      if (q && !g.product_name.toLowerCase().includes(q) && !g.prefix.toLowerCase().includes(q) && !g.min_code.toLowerCase().includes(q)) {
        return false;
      }
      if (userFilter !== 'all' && g.stocked_by !== userFilter) return false;
      if (statusFilter === 'has_in_stock' && g.in_stock === 0) return false;
      if (statusFilter === 'has_assigned' && g.assigned === 0) return false;
      if (statusFilter === 'has_shipped' && g.shipped === 0) return false;
      return true;
    });
  }, [stockData, search, statusFilter, userFilter]);

  return (
    <div className="container max-w-4xl mx-auto p-4 space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/expedicao/etiquetas-seriais"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <Package className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-bold">Estoque de Etiquetas</h1>
      </div>

      {!isLoading && stockData && stockData.length > 0 && (
        <StockFilters
          search={search}
          onSearchChange={setSearch}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          userFilter={userFilter}
          onUserFilterChange={setUserFilter}
          users={uniqueUsers}
        />
      )}

      {isLoading && (
        <p className="text-sm text-muted-foreground text-center py-8">Carregando...</p>
      )}

      {!isLoading && (!stockData || stockData.length === 0) && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <p>Nenhuma etiqueta associada a produto ainda.</p>
            <Button variant="link" asChild className="mt-2">
              <Link to="/expedicao/etiquetas-seriais/associar">Ir para Associar Etiquetas</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {filtered && filtered.length > 0 && (
        <div className="space-y-3">
          {filtered.map((g, idx) => (
            <StockCard key={`${g.product_id}-${g.stocked_by}-${g.prefix}-${idx}`} group={g} />
          ))}
        </div>
      )}

      {!isLoading && stockData && stockData.length > 0 && filtered.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">Nenhum resultado para os filtros selecionados.</p>
      )}

      {(unlinkedCount ?? 0) > 0 && (
        <Card className="border-dashed">
          <CardContent className="py-4 text-center text-sm text-muted-foreground">
            <strong>{unlinkedCount?.toLocaleString()}</strong> etiquetas registradas sem produto vinculado
          </CardContent>
        </Card>
      )}
    </div>
  );
}
