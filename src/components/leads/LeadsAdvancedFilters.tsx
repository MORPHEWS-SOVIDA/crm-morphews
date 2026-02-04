import { useMemo } from 'react';
import { Filter, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useUsers } from '@/hooks/useUsers';
import { FUNNEL_STAGES, FunnelStage } from '@/types/lead';

export interface LeadsFilters {
  stage: string;
  stars: string;
  responsavel: string | null;
  // New filters
  assignedUserId: string | null;
  salesStatus: 'all' | 'no_sales' | 'has_sales_this_month' | 'no_sales_x_days';
  noSalesDays: number | null;
}

interface LeadsAdvancedFiltersProps {
  filters: LeadsFilters;
  onFiltersChange: (filters: LeadsFilters) => void;
  responsaveis: string[];
}

export function LeadsAdvancedFilters({
  filters,
  onFiltersChange,
  responsaveis,
}: LeadsAdvancedFiltersProps) {
  const { data: users } = useUsers();

  const userOptions = useMemo(
    () => (users || []).map(u => ({ 
      value: u.user_id, 
      label: `${u.first_name} ${u.last_name}`.trim() || 'Sem nome'
    })),
    [users]
  );

  const hasActiveFilters = !!(
    filters.stage !== 'all' ||
    filters.stars !== 'all' ||
    filters.responsavel ||
    filters.assignedUserId ||
    filters.salesStatus !== 'all'
  );

  const clearFilters = () => {
    onFiltersChange({
      stage: 'all',
      stars: 'all',
      responsavel: null,
      assignedUserId: null,
      salesStatus: 'all',
      noSalesDays: null,
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Filter className="w-4 h-4" />
        <span>Filtros avançados</span>
      </div>

      <div className="flex flex-wrap gap-3 items-end">
        {/* Stage filter */}
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Etapa</Label>
          <Select 
            value={filters.stage} 
            onValueChange={(value) => onFiltersChange({ ...filters, stage: value })}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Etapa" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as etapas</SelectItem>
              {Object.entries(FUNNEL_STAGES).map(([key, value]) => (
                <SelectItem key={key} value={key}>
                  {value.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Stars filter */}
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Estrelas</Label>
          <Select 
            value={filters.stars} 
            onValueChange={(value) => onFiltersChange({ ...filters, stars: value })}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Estrelas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="5">5 estrelas</SelectItem>
              <SelectItem value="4">4 estrelas</SelectItem>
              <SelectItem value="3">3 estrelas</SelectItem>
              <SelectItem value="2">2 estrelas</SelectItem>
              <SelectItem value="1">1 estrela</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Seller/User filter */}
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Vendedor</Label>
          <Select 
            value={filters.assignedUserId || 'all'} 
            onValueChange={(value) => onFiltersChange({ 
              ...filters, 
              assignedUserId: value === 'all' ? null : value 
            })}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Qual vendedor?" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os vendedores</SelectItem>
              {userOptions.map((u) => (
                <SelectItem key={u.value} value={u.value}>
                  {u.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Sales status filter */}
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Status de Vendas</Label>
          <Select 
            value={filters.salesStatus} 
            onValueChange={(value: LeadsFilters['salesStatus']) => onFiltersChange({ 
              ...filters, 
              salesStatus: value,
              noSalesDays: value === 'no_sales_x_days' ? (filters.noSalesDays || 30) : null,
            })}
          >
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Status de vendas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="no_sales">Clientes sem venda</SelectItem>
              <SelectItem value="has_sales_this_month">Com venda nesse mês</SelectItem>
              <SelectItem value="no_sales_x_days">Sem venda há X dias</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Days input - only show when no_sales_x_days is selected */}
        {filters.salesStatus === 'no_sales_x_days' && (
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Dias sem venda</Label>
            <Input
              type="number"
              min={1}
              value={filters.noSalesDays || 30}
              onChange={(e) => onFiltersChange({
                ...filters,
                noSalesDays: parseInt(e.target.value) || 30,
              })}
              className="w-[100px]"
              placeholder="30"
            />
          </div>
        )}

        {/* Clear filters button */}
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1">
            <X className="h-4 w-4" />
            Limpar
          </Button>
        )}
      </div>
    </div>
  );
}
