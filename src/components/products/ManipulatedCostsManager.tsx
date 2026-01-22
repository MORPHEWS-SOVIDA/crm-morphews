import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ArrowLeft,
  Search,
  Filter,
  DollarSign,
  Package,
  AlertCircle,
  Check,
  ExternalLink,
  Loader2,
  Calendar,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CurrencyInput } from '@/components/ui/currency-input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import {
  useManipulatedSaleItems,
  useUpdateItemCost,
  useManipulatedCostsSummary,
  type ManipulatedSaleItem,
} from '@/hooks/useManipulatedCosts';

interface ManipulatedCostsManagerProps {
  onClose: () => void;
}

export function ManipulatedCostsManager({ onClose }: ManipulatedCostsManagerProps) {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [costFilter, setCostFilter] = useState<'all' | 'with_cost' | 'without_cost'>('all');
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [editingCost, setEditingCost] = useState<number>(0);
  const [shouldFetch, setShouldFetch] = useState(false);

  const { data: items, isLoading, refetch } = useManipulatedSaleItems({
    hasCost: costFilter,
    startDate,
    endDate,
  }, shouldFetch);
  const { data: summary } = useManipulatedCostsSummary();
  const updateCost = useUpdateItemCost();

  const handleSearch = () => {
    if (!shouldFetch) {
      setShouldFetch(true);
    } else {
      refetch();
    }
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(cents / 100);
  };

  const filteredItems = items?.filter(item =>
    item.requisition_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.client_name.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const handleStartEdit = (item: ManipulatedSaleItem) => {
    setEditingItem(item.id);
    setEditingCost(item.cost_cents || 0);
  };

  const handleSaveCost = async (itemId: string) => {
    try {
      await updateCost.mutateAsync({ itemId, costCents: editingCost });
      toast.success('Custo salvo com sucesso!');
      setEditingItem(null);
    } catch (error) {
      toast.error('Erro ao salvar custo');
    }
  };

  const handleCancelEdit = () => {
    setEditingItem(null);
    setEditingCost(0);
  };

  const clearFilters = () => {
    setStartDate(undefined);
    setEndDate(undefined);
    setCostFilter('all');
    setSearchTerm('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onClose}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Custos de Manipulados</h1>
          <p className="text-muted-foreground">
            Gerencie os custos das requisições de produtos manipulados
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total de Requisições
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.totalItems}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {summary.itemsWithCost} com custo • {summary.itemsWithoutCost} sem custo
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Pendentes de Custo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">
                {summary.itemsWithoutCost}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Requisições aguardando lançamento
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Receita Total
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">
                {formatCurrency(summary.totalRevenue)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Valor vendido em manipulados
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Margem Calculada
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={cn(
                "text-2xl font-bold",
                summary.margin >= 0 ? "text-green-600" : "text-destructive"
              )}>
                {formatCurrency(summary.margin)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {summary.marginPercent.toFixed(1)}% de margem
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por requisição, produto ou cliente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        <Select value={costFilter} onValueChange={(v) => setCostFilter(v as any)}>
          <SelectTrigger className="w-[180px]">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Filtrar custos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="without_cost">Sem custo</SelectItem>
            <SelectItem value="with_cost">Com custo</SelectItem>
          </SelectContent>
        </Select>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-[180px] justify-start">
              <Calendar className="w-4 h-4 mr-2" />
              {startDate ? format(startDate, 'dd/MM/yyyy') : 'Data início'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <CalendarComponent
              mode="single"
              selected={startDate}
              onSelect={setStartDate}
              locale={ptBR}
            />
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-[180px] justify-start">
              <Calendar className="w-4 h-4 mr-2" />
              {endDate ? format(endDate, 'dd/MM/yyyy') : 'Data fim'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <CalendarComponent
              mode="single"
              selected={endDate}
              onSelect={setEndDate}
              locale={ptBR}
            />
          </PopoverContent>
        </Popover>

        {(startDate || endDate || costFilter !== 'all' || searchTerm) && (
          <Button variant="ghost" onClick={clearFilters}>
            Limpar filtros
          </Button>
        )}

        <Button onClick={handleSearch} disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Carregando...
            </>
          ) : (
            <>
              <Search className="w-4 h-4 mr-2" />
              Mostrar Vendas
            </>
          )}
        </Button>
      </div>

      {/* Table */}
      {!shouldFetch ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Package className="w-12 h-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium">Clique em "Mostrar Vendas" para carregar</h3>
          <p className="text-muted-foreground">
            Use os filtros acima e clique no botão para buscar as requisições.
          </p>
        </div>
      ) : isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Package className="w-12 h-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium">Nenhuma requisição encontrada</h3>
          <p className="text-muted-foreground">
            {costFilter === 'without_cost' 
              ? 'Todas as requisições já possuem custo lançado!'
              : 'Não há requisições de produtos manipulados com os filtros selecionados.'}
          </p>
        </div>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Requisição</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Vendedor</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="text-right">Valor Venda</TableHead>
                <TableHead className="text-right">Custo</TableHead>
                <TableHead className="text-right">Margem</TableHead>
                <TableHead className="w-[120px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems.map((item) => {
                const isEditing = editingItem === item.id;
                const margin = item.cost_cents !== null 
                  ? item.total_cents - item.cost_cents 
                  : null;

                return (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Badge variant="outline" className="font-mono bg-amber-50 border-amber-300">
                        {item.requisition_number}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">{item.product_name}</TableCell>
                    <TableCell>{item.client_name}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {item.seller_name}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {format(new Date(item.sale_created_at), 'dd/MM/yyyy')}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(item.total_cents)}
                    </TableCell>
                    <TableCell className="text-right">
                      {isEditing ? (
                        <CurrencyInput
                          value={editingCost}
                          onChange={setEditingCost}
                          className="w-28 text-right"
                        />
                      ) : item.cost_cents !== null ? (
                        <span className="text-muted-foreground">
                          {formatCurrency(item.cost_cents)}
                        </span>
                      ) : (
                        <span className="text-amber-600 flex items-center justify-end gap-1">
                          <AlertCircle className="w-4 h-4" />
                          Pendente
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {margin !== null ? (
                        <span className={cn(
                          "font-medium",
                          margin >= 0 ? "text-green-600" : "text-destructive"
                        )}>
                          {formatCurrency(margin)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {isEditing ? (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleSaveCost(item.id)}
                              disabled={updateCost.isPending}
                            >
                              <Check className="w-4 h-4 text-green-600" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={handleCancelEdit}
                            >
                              ✕
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleStartEdit(item)}
                            >
                              <DollarSign className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => navigate(`/vendas/${item.sale_id}`)}
                            >
                              <ExternalLink className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
