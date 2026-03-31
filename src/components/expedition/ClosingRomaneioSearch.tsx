import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentTenantId } from '@/hooks/useTenant';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Loader2, Package, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { closingTypeConfig, type ClosingType } from '@/hooks/useDeliveryClosings';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ClosingRomaneioSearchProps {
  /** If provided, only search within this closing type. If omitted, search all types. */
  closingType?: ClosingType;
  /** Callback when user clicks on a result to navigate to that closing */
  onSelectClosing?: (closingId: string) => void;
}

interface SearchResult {
  sale_number: string;
  closing_id: string;
  closing_number: number;
  closing_type: string;
  closing_status: string;
  closing_date: string;
  lead_name: string | null;
  total_cents: number | null;
}

export function ClosingRomaneioSearch({ closingType, onSelectClosing }: ClosingRomaneioSearchProps) {
  const [searchValue, setSearchValue] = useState('');
  const { data: tenantId } = useCurrentTenantId();

  const debouncedSearch = searchValue.trim();

  const { data: results, isLoading } = useQuery({
    queryKey: ['closing-romaneio-search', tenantId, debouncedSearch, closingType],
    queryFn: async (): Promise<SearchResult[]> => {
      if (!tenantId || !debouncedSearch) return [];

      // Search pickup_closing_sales by sale_number (romaneio)
      let query = supabase
        .from('pickup_closing_sales')
        .select(`
          sale_number,
          lead_name,
          total_cents,
          closing_id,
          closing:pickup_closings(closing_number, closing_type, status, closing_date)
        `)
        .eq('organization_id', tenantId)
        .ilike('sale_number', `%${debouncedSearch}%`);

      if (closingType) {
        query = query.eq('closing_type', closingType);
      }

      const { data, error } = await query.limit(10);
      if (error) throw error;

      return (data || []).map((row: any) => ({
        sale_number: row.sale_number,
        closing_id: row.closing_id,
        closing_number: row.closing?.closing_number,
        closing_type: row.closing?.closing_type,
        closing_status: row.closing?.status,
        closing_date: row.closing?.closing_date,
        lead_name: row.lead_name,
        total_cents: row.total_cents,
      }));
    },
    enabled: !!tenantId && debouncedSearch.length >= 2,
    staleTime: 10000,
  });

  const getClosingTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      pickup: 'Balcão',
      motoboy: 'Motoboy',
      carrier: 'Transportadora',
    };
    return labels[type] || type;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300 text-xs">Pendente</Badge>;
      case 'confirmed_auxiliar':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300 text-xs">Auxiliar Confirmou</Badge>;
      case 'confirmed_final':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300 text-xs">Confirmado</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar nº venda (romaneio) no histórico..."
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          className="pl-9 pr-9"
        />
        {searchValue && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
            onClick={() => setSearchValue('')}
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        )}
        {isLoading && (
          <Loader2 className="absolute right-10 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {debouncedSearch.length >= 2 && !isLoading && results && results.length > 0 && (
        <div className="absolute z-50 mt-1 w-full bg-background border rounded-md shadow-lg max-h-[300px] overflow-y-auto">
          {results.map((result, idx) => (
            <button
              key={`${result.closing_id}-${result.sale_number}-${idx}`}
              className="w-full text-left px-4 py-3 hover:bg-muted/50 border-b last:border-b-0 transition-colors"
              onClick={() => {
                onSelectClosing?.(result.closing_id);
                setSearchValue('');
              }}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Package className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <span className="font-semibold text-sm">Venda #{result.sale_number}</span>
                  {result.lead_name && (
                    <span className="text-xs text-muted-foreground truncate">• {result.lead_name}</span>
                  )}
                </div>
                {getStatusBadge(result.closing_status)}
              </div>
              <div className="mt-1 text-xs text-muted-foreground flex items-center gap-2">
                <span className="font-medium text-foreground">
                  Fechamento #{result.closing_number}
                </span>
                <span>•</span>
                <span>{getClosingTypeLabel(result.closing_type)}</span>
                {result.closing_date && (
                  <>
                    <span>•</span>
                    <span>{format(parseISO(result.closing_date), "dd/MM/yyyy", { locale: ptBR })}</span>
                  </>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {debouncedSearch.length >= 2 && !isLoading && results && results.length === 0 && (
        <div className="absolute z-50 mt-1 w-full bg-background border rounded-md shadow-lg px-4 py-3 text-sm text-muted-foreground text-center">
          Nenhuma venda encontrada com nº "{debouncedSearch}"
        </div>
      )}
    </div>
  );
}
