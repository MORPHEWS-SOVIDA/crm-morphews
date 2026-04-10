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

      const { data, error } = await supabase
        .rpc('get_serial_stock_overview', { p_organization_id: orgId });

      if (error) throw error;

      return (data || []).map((row: any) => ({
        product_id: row.product_id,
        product_name: row.product_name,
        prefix: row.prefix,
        min_code: row.min_code,
        max_code: row.max_code,
        total: Number(row.total),
        in_stock: Number(row.in_stock),
        assigned: Number(row.assigned),
        shipped: Number(row.shipped),
        stocked_by: row.stocked_by,
        stocked_by_name: row.stocked_by_name?.trim() || null,
        stocked_at: row.stocked_at,
      })) as StockGroup[];
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
