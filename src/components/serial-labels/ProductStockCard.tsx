import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tag, ChevronDown, ChevronUp, Calendar, User, Layers } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import type { ProductSummary, StockGroup } from '@/pages/serial-labels/SerialStockPage';

interface ProductStockCardProps {
  product: ProductSummary;
  orgId: string;
}

export function ProductStockCard({ product: p, orgId }: ProductStockCardProps) {
  const [open, setOpen] = useState(false);

  // Lazy-load batch details only when expanded
  const { data: batches, isLoading } = useQuery({
    queryKey: ['serial-stock-batches', orgId, p.product_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc('get_serial_stock_overview', { p_organization_id: orgId });
      if (error) throw error;
      return (data || [])
        .filter((row: any) => row.product_id === p.product_id)
        .map((row: any) => ({
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
    enabled: open,
  });

  const usedPercent = p.total > 0 ? Math.round(((p.assigned + p.shipped) / p.total) * 100) : 0;

  return (
    <Card>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Tag className="h-4 w-4 text-primary" />
            <span className="flex-1 truncate">{p.product_name}</span>
            <Badge variant="outline" className="shrink-0">{p.total.toLocaleString()} un.</Badge>
            <CollapsibleTrigger asChild>
              <button className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-muted">
                {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
            </CollapsibleTrigger>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {/* Status badges */}
          <div className="flex flex-wrap gap-2">
            <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
              Estoque: {p.in_stock.toLocaleString()}
            </Badge>
            {p.assigned > 0 && (
              <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
                Separadas: {p.assigned.toLocaleString()}
              </Badge>
            )}
            {p.shipped > 0 && (
              <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
                Enviadas: {p.shipped.toLocaleString()}
              </Badge>
            )}
          </div>

          {/* Progress bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Layers className="h-3 w-3" />
                {p.prefix_count} prefixo{p.prefix_count !== 1 ? 's' : ''}
              </span>
              <span>{usedPercent}% utilizado</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full flex">
                {p.shipped > 0 && (
                  <div className="bg-blue-400 h-full" style={{ width: `${(p.shipped / p.total) * 100}%` }} />
                )}
                {p.assigned > 0 && (
                  <div className="bg-amber-400 h-full" style={{ width: `${(p.assigned / p.total) * 100}%` }} />
                )}
              </div>
            </div>
          </div>

          {/* Expanded: batch details */}
          <CollapsibleContent className="space-y-2 pt-2 border-t">
            {isLoading && <p className="text-xs text-muted-foreground py-2">Carregando lotes...</p>}
            {batches && batches.map((b, idx) => (
              <div key={`${b.prefix}-${b.stocked_by}-${idx}`} className="bg-muted/50 rounded-lg p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm font-medium">{b.prefix}</span>
                  <Badge variant="outline" className="text-xs">{b.total} un.</Badge>
                </div>
                <div className="text-xs text-muted-foreground font-mono">
                  {b.min_code} → {b.max_code}
                </div>
                <div className="flex flex-wrap gap-1.5 text-xs">
                  <span className="text-green-700">✓ {b.in_stock} estoque</span>
                  {b.assigned > 0 && <span className="text-amber-700">⏳ {b.assigned} separadas</span>}
                  {b.shipped > 0 && <span className="text-blue-700">📦 {b.shipped} enviadas</span>}
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  {b.stocked_by_name && (
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3" /> {b.stocked_by_name}
                    </span>
                  )}
                  {b.stocked_at && (
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" /> {format(new Date(b.stocked_at), 'dd/MM/yyyy HH:mm')}
                    </span>
                  )}
                </div>
              </div>
            ))}
            {batches && batches.length === 0 && (
              <p className="text-xs text-muted-foreground py-2">Nenhum lote encontrado.</p>
            )}
          </CollapsibleContent>

          {/* Last stocked info */}
          {p.last_stocked_at && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground pt-1 border-t">
              <Calendar className="h-3 w-3" />
              Última entrada: {format(new Date(p.last_stocked_at), 'dd/MM/yyyy HH:mm')}
            </div>
          )}
        </CardContent>
      </Collapsible>
    </Card>
  );
}
