import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentTenantId } from '@/hooks/useTenant';
import { ArrowLeft, Package } from 'lucide-react';
import { StockFilters } from '@/components/serial-labels/StockFilters';
import { ProductStockCard } from '@/components/serial-labels/ProductStockCard';

export interface ProductSummary {
  product_id: string;
  product_name: string;
  total: number;
  in_stock: number;
  assigned: number;
  shipped: number;
  prefix_count: number;
  last_stocked_at: string | null;
}

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

const PAGE_SIZE = 30;

export default function SerialStockPage() {
  const { data: orgId } = useCurrentTenantId();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [userFilter, setUserFilter] = useState('all');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Product-level summary (one row per product)
  const { data: products, isLoading } = useQuery({
    queryKey: ['serial-stock-products', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .rpc('get_serial_stock_products', { p_organization_id: orgId });
      if (error) throw error;
      return (data || []).map((row: any) => ({
        product_id: row.product_id,
        product_name: row.product_name,
        total: Number(row.total),
        in_stock: Number(row.in_stock),
        assigned: Number(row.assigned),
        shipped: Number(row.shipped),
        prefix_count: Number(row.prefix_count),
        last_stocked_at: row.last_stocked_at,
      })) as ProductSummary[];
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

  // Filter products
  const filtered = useMemo(() => {
    if (!products) return [];
    const q = search.toLowerCase();
    return products.filter((p) => {
      if (q && !p.product_name.toLowerCase().includes(q)) return false;
      if (statusFilter === 'has_in_stock' && p.in_stock === 0) return false;
      if (statusFilter === 'has_assigned' && p.assigned === 0) return false;
      if (statusFilter === 'has_shipped' && p.shipped === 0) return false;
      return true;
    });
  }, [products, search, statusFilter]);

  const visible = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  return (
    <div className="container max-w-4xl mx-auto p-4 space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/expedicao/etiquetas-seriais"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <Package className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-bold">Estoque de Etiquetas</h1>
        {filtered.length > 0 && (
          <span className="text-sm text-muted-foreground ml-auto">
            {filtered.length} produto{filtered.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {!isLoading && products && products.length > 0 && (
        <StockFilters
          search={search}
          onSearchChange={(v) => { setSearch(v); setVisibleCount(PAGE_SIZE); }}
          statusFilter={statusFilter}
          onStatusFilterChange={(v) => { setStatusFilter(v); setVisibleCount(PAGE_SIZE); }}
          userFilter={userFilter}
          onUserFilterChange={setUserFilter}
          users={[]}
        />
      )}

      {isLoading && (
        <p className="text-sm text-muted-foreground text-center py-8">Carregando...</p>
      )}

      {!isLoading && (!products || products.length === 0) && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <p>Nenhuma etiqueta associada a produto ainda.</p>
            <Button variant="link" asChild className="mt-2">
              <Link to="/expedicao/etiquetas-seriais/associar">Ir para Associar Etiquetas</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {visible.length > 0 && (
        <div className="space-y-3">
          {visible.map((p) => (
            <ProductStockCard key={p.product_id} product={p} orgId={orgId!} />
          ))}
        </div>
      )}

      {hasMore && (
        <div className="text-center">
          <Button variant="outline" onClick={() => setVisibleCount(c => c + PAGE_SIZE)}>
            Carregar mais ({filtered.length - visibleCount} restantes)
          </Button>
        </div>
      )}

      {!isLoading && products && products.length > 0 && filtered.length === 0 && (
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
