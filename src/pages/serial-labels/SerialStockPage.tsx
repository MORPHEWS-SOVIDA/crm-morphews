import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentTenantId } from '@/hooks/useTenant';
import { ArrowLeft, Package, Warehouse, Check } from 'lucide-react';
import { StockFilters } from '@/components/serial-labels/StockFilters';
import { ProductStockCard } from '@/components/serial-labels/ProductStockCard';
import { cn } from '@/lib/utils';

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

interface LocationSummary {
  location_id: string;
  location_name: string;
  location_code: string | null;
  is_default: boolean;
  total: number;
  in_stock: number;
  assigned: number;
  shipped: number;
  product_count: number;
}

const PAGE_SIZE = 30;

export default function SerialStockPage() {
  const { data: orgId } = useCurrentTenantId();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [userFilter, setUserFilter] = useState('all');
  const [locationId, setLocationId] = useState<string | null>(null); // null = todos
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Per-location summary cards
  const { data: locations } = useQuery({
    queryKey: ['serial-stock-by-location', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .rpc('get_serial_stock_by_location', { p_organization_id: orgId });
      if (error) throw error;
      return (data || []).map((row: any) => ({
        location_id: row.location_id,
        location_name: row.location_name,
        location_code: row.location_code,
        is_default: row.is_default,
        total: Number(row.total),
        in_stock: Number(row.in_stock),
        assigned: Number(row.assigned),
        shipped: Number(row.shipped),
        product_count: Number(row.product_count),
      })) as LocationSummary[];
    },
    enabled: !!orgId,
  });

  // Product-level summary (filtered by selected location)
  const { data: products, isLoading } = useQuery({
    queryKey: ['serial-stock-products', orgId, locationId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .rpc('get_serial_stock_products', {
          p_organization_id: orgId,
          p_location_id: locationId,
        } as any);
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

  // Total ("Todos os locais") aggregated from per-location summary
  const allTotals = useMemo(() => {
    const base = { total: 0, in_stock: 0, assigned: 0, shipped: 0, product_count: 0 };
    if (!locations) return base;
    return locations.reduce((acc, l) => ({
      total: acc.total + l.total,
      in_stock: acc.in_stock + l.in_stock,
      assigned: acc.assigned + l.assigned,
      shipped: acc.shipped + l.shipped,
      product_count: Math.max(acc.product_count, l.product_count), // approx (cross-loc dedup unknown)
    }), base);
  }, [locations]);

  // Filter products by text/status
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

  const selectedLocation = locations?.find(l => l.location_id === locationId) || null;

  return (
    <div className="container max-w-5xl mx-auto p-4 space-y-4">
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

      {/* Location filter cards */}
      {locations && locations.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            <Warehouse className="h-3.5 w-3.5" />
            Filtrar por local de estoque
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {/* "Todos os locais" card */}
            <LocationCard
              active={locationId === null}
              onClick={() => setLocationId(null)}
              name="Todos os locais"
              code={null}
              isDefault={false}
              inStock={allTotals.in_stock}
              assigned={allTotals.assigned}
              shipped={allTotals.shipped}
              total={allTotals.total}
            />
            {locations.map((loc) => (
              <LocationCard
                key={loc.location_id}
                active={locationId === loc.location_id}
                onClick={() => setLocationId(loc.location_id)}
                name={loc.location_name}
                code={loc.location_code}
                isDefault={loc.is_default}
                inStock={loc.in_stock}
                assigned={loc.assigned}
                shipped={loc.shipped}
                total={loc.total}
              />
            ))}
          </div>
        </div>
      )}

      {selectedLocation && (
        <div className="text-xs text-muted-foreground -mt-2">
          Exibindo etiquetas em <strong>{selectedLocation.location_name}</strong>.{' '}
          <button onClick={() => setLocationId(null)} className="underline hover:text-foreground">
            limpar filtro
          </button>
        </div>
      )}

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
            <p>
              {locationId
                ? 'Nenhuma etiqueta neste local de estoque.'
                : 'Nenhuma etiqueta associada a produto ainda.'}
            </p>
            <Button variant="link" asChild className="mt-2">
              <Link to="/expedicao/etiquetas-seriais/associar">Ir para Associar Etiquetas</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {visible.length > 0 && (
        <div className="space-y-3">
          {visible.map((p) => (
            <ProductStockCard key={p.product_id} product={p} orgId={orgId!} locationId={locationId} />
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

interface LocationCardProps {
  active: boolean;
  onClick: () => void;
  name: string;
  code: string | null;
  isDefault: boolean;
  inStock: number;
  assigned: number;
  shipped: number;
  total: number;
}

function LocationCard({ active, onClick, name, code, isDefault, inStock, assigned, shipped, total }: LocationCardProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'text-left rounded-lg border p-3 transition-all hover:shadow-sm hover:border-primary/50',
        active
          ? 'border-primary bg-primary/5 shadow-sm ring-1 ring-primary/30'
          : 'border-border bg-card'
      )}
    >
      <div className="flex items-start justify-between gap-1 mb-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <Warehouse className={cn('h-3.5 w-3.5 shrink-0', active ? 'text-primary' : 'text-muted-foreground')} />
          <span className="text-sm font-medium truncate">{name}</span>
        </div>
        {active && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
      </div>
      {(code || isDefault) && (
        <div className="text-[10px] text-muted-foreground mb-1.5 flex gap-1 items-center">
          {code && <span className="font-mono">{code}</span>}
          {isDefault && <span className="px-1 py-0.5 rounded bg-muted text-[9px] uppercase">padrão</span>}
        </div>
      )}
      <div className="flex items-baseline gap-1">
        <span className="text-lg font-bold text-green-700">{inStock.toLocaleString()}</span>
        <span className="text-[10px] text-muted-foreground">em estoque</span>
      </div>
      <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground mt-1">
        {assigned > 0 && <span>{assigned.toLocaleString()} separadas</span>}
        {shipped > 0 && <span>{shipped.toLocaleString()} enviadas</span>}
        <span className="ml-auto">total {total.toLocaleString()}</span>
      </div>
    </button>
  );
}
