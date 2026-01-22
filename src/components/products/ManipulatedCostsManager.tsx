import { useState, useRef, useCallback, useMemo } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ArrowLeft,
  Search,
  Filter,
  Package,
  AlertCircle,
  Check,
  ExternalLink,
  Loader2,
  Calendar,
  Download,
  Upload,
  Percent,
  CheckSquare,
  Square,
  Pencil,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Checkbox } from '@/components/ui/checkbox';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
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
  const [searchTerm, setSearchTerm] = useState('');
  const [costFilter, setCostFilter] = useState<'all' | 'with_cost' | 'without_cost'>('all');
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [shouldFetch, setShouldFetch] = useState(false);
  
  // Inline editing state - store cost values per item
  const [editedCosts, setEditedCosts] = useState<Record<string, number>>({});
  const [savingItems, setSavingItems] = useState<Set<string>>(new Set());
  
  // Selection state for bulk operations
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  
  // Bulk percentage dialog
  const [bulkPercentDialog, setBulkPercentDialog] = useState(false);
  const [bulkPercent, setBulkPercent] = useState<number>(25);
  
  // Import dialog
  const [importDialog, setImportDialog] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const filteredItems = useMemo(() => items?.filter(item =>
    item.requisition_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.client_name.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [], [items, searchTerm]);

  // Get the current cost value for an item (edited or original)
  const getItemCost = useCallback((item: ManipulatedSaleItem): number | null => {
    if (editedCosts[item.id] !== undefined) {
      return editedCosts[item.id];
    }
    return item.cost_cents;
  }, [editedCosts]);

  // Check if item has unsaved changes
  const hasUnsavedChanges = useCallback((item: ManipulatedSaleItem): boolean => {
    if (editedCosts[item.id] === undefined) return false;
    return editedCosts[item.id] !== (item.cost_cents ?? 0);
  }, [editedCosts]);

  const handleCostChange = (itemId: string, value: number) => {
    setEditedCosts(prev => ({ ...prev, [itemId]: value }));
  };

  const handleSaveCost = async (itemId: string) => {
    const costValue = editedCosts[itemId];
    if (costValue === undefined) return;
    
    setSavingItems(prev => new Set(prev).add(itemId));
    try {
      await updateCost.mutateAsync({ itemId, costCents: costValue });
      // Remove from edited costs after successful save
      setEditedCosts(prev => {
        const next = { ...prev };
        delete next[itemId];
        return next;
      });
      toast.success('Custo salvo!');
    } catch (error) {
      toast.error('Erro ao salvar custo');
    } finally {
      setSavingItems(prev => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    }
  };

  const handleCancelEdit = (itemId: string) => {
    setEditedCosts(prev => {
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent, itemId: string, index: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (hasUnsavedChanges(filteredItems.find(i => i.id === itemId)!)) {
        handleSaveCost(itemId);
      }
      // Move to next row
      const nextItem = filteredItems[index + 1];
      if (nextItem) {
        const nextInput = document.querySelector(`[data-cost-input="${nextItem.id}"]`) as HTMLInputElement;
        nextInput?.focus();
      }
    }
  };

  const clearFilters = () => {
    setStartDate(undefined);
    setEndDate(undefined);
    setCostFilter('all');
    setSearchTerm('');
  };

  // Selection handlers
  const toggleSelectAll = () => {
    if (selectedItems.size === filteredItems.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(filteredItems.map(i => i.id)));
    }
  };

  const toggleSelectItem = (itemId: string) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  // Bulk percentage update
  const handleBulkPercentUpdate = async () => {
    const itemsToUpdate = filteredItems.filter(i => selectedItems.has(i.id));
    if (itemsToUpdate.length === 0) {
      toast.error('Selecione itens para atualizar');
      return;
    }

    // Calculate costs based on percentage of sale value
    const updates: Record<string, number> = {};
    itemsToUpdate.forEach(item => {
      const costCents = Math.round(item.total_cents * (bulkPercent / 100));
      updates[item.id] = costCents;
    });

    setEditedCosts(prev => ({ ...prev, ...updates }));
    setBulkPercentDialog(false);
    toast.success(`Custo de ${bulkPercent}% aplicado a ${itemsToUpdate.length} itens. Clique em salvar para confirmar.`);
  };

  // Save all pending changes
  const handleSaveAllPending = async () => {
    const pendingIds = Object.keys(editedCosts);
    if (pendingIds.length === 0) {
      toast.info('Não há alterações pendentes');
      return;
    }

    for (const itemId of pendingIds) {
      await handleSaveCost(itemId);
    }
  };

  // Export to CSV
  const handleExport = () => {
    if (filteredItems.length === 0) {
      toast.error('Não há dados para exportar');
      return;
    }

    const headers = ['ID', 'Requisição', 'Produto', 'Cliente', 'Vendedor', 'Data', 'Valor Venda (centavos)', 'Custo (centavos)'];
    const rows = filteredItems.map(item => [
      item.id,
      item.requisition_number,
      item.product_name,
      item.client_name,
      item.seller_name,
      format(new Date(item.sale_created_at), 'dd/MM/yyyy'),
      item.total_cents,
      getItemCost(item) ?? '',
    ]);

    const csvContent = [
      headers.join(';'),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(';'))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `custos-manipulados-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Arquivo exportado com sucesso!');
  };

  // Import from CSV
  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split('\n').filter(line => line.trim());
        
        // Skip header
        const dataLines = lines.slice(1);
        const updates: Record<string, number> = {};
        let importCount = 0;

        dataLines.forEach(line => {
          // Handle both comma and semicolon separators
          const cells = line.includes(';') 
            ? line.split(';').map(c => c.replace(/^"|"$/g, '').trim())
            : line.split(',').map(c => c.replace(/^"|"$/g, '').trim());
          
          const id = cells[0];
          const costValue = cells[7]; // Cost column
          
          if (id && costValue && costValue !== '') {
            const costCents = parseInt(costValue, 10);
            if (!isNaN(costCents) && costCents >= 0) {
              // Only update if item exists in current list
              if (filteredItems.some(item => item.id === id)) {
                updates[id] = costCents;
                importCount++;
              }
            }
          }
        });

        if (Object.keys(updates).length > 0) {
          setEditedCosts(prev => ({ ...prev, ...updates }));
          toast.success(`${importCount} custos importados. Clique em salvar para confirmar.`);
        } else {
          toast.warning('Nenhum custo válido encontrado no arquivo');
        }
      } catch (error) {
        toast.error('Erro ao processar arquivo CSV');
      }
      
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setImportDialog(false);
    };
    reader.readAsText(file);
  };

  const pendingChangesCount = Object.keys(editedCosts).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
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
        
        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {pendingChangesCount > 0 && (
            <Button onClick={handleSaveAllPending} variant="default">
              <Check className="w-4 h-4 mr-2" />
              Salvar Todos ({pendingChangesCount})
            </Button>
          )}
          <Button variant="outline" onClick={handleExport} disabled={filteredItems.length === 0}>
            <Download className="w-4 h-4 mr-2" />
            Exportar
          </Button>
          <Button variant="outline" onClick={() => setImportDialog(true)}>
            <Upload className="w-4 h-4 mr-2" />
            Importar
          </Button>
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
      <div className="flex flex-col sm:flex-row gap-4 flex-wrap">
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

      {/* Bulk actions bar */}
      {selectedItems.size > 0 && (
        <div className="flex items-center gap-4 p-3 bg-muted rounded-lg">
          <span className="text-sm font-medium">
            {selectedItems.size} item(s) selecionado(s)
          </span>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setBulkPercentDialog(true)}
          >
            <Percent className="w-4 h-4 mr-2" />
            Aplicar % sobre valor
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSelectedItems(new Set())}
          >
            Limpar seleção
          </Button>
        </div>
      )}

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
                <TableHead className="w-10">
                  <Checkbox
                    checked={selectedItems.size === filteredItems.length && filteredItems.length > 0}
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                <TableHead>Requisição</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Vendedor</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="text-right">Valor Venda</TableHead>
                <TableHead className="text-right w-[140px]">Custo</TableHead>
                <TableHead className="text-right">Margem</TableHead>
                <TableHead className="w-[80px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems.map((item, index) => {
                const currentCost = getItemCost(item);
                const hasChanges = hasUnsavedChanges(item);
                const isSaving = savingItems.has(item.id);
                const margin = currentCost !== null 
                  ? item.total_cents - currentCost 
                  : null;

                return (
                  <TableRow key={item.id} className={hasChanges ? 'bg-amber-50/50' : undefined}>
                    <TableCell>
                      <Checkbox
                        checked={selectedItems.has(item.id)}
                        onCheckedChange={() => toggleSelectItem(item.id)}
                      />
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono bg-amber-50 border-amber-300">
                        {item.requisition_number}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium max-w-[200px] truncate" title={item.product_name}>
                      {item.product_name}
                    </TableCell>
                    <TableCell className="max-w-[150px] truncate" title={item.client_name}>
                      {item.client_name}
                    </TableCell>
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
                      <CurrencyInput
                        value={currentCost ?? 0}
                        onChange={(value) => handleCostChange(item.id, value)}
                        onKeyDown={(e) => handleKeyDown(e, item.id, index)}
                        className={cn(
                          "w-28 text-right",
                          hasChanges && "border-amber-400 bg-amber-50"
                        )}
                        data-cost-input={item.id}
                        placeholder="R$ 0,00"
                      />
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
                        {hasChanges && (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleSaveCost(item.id)}
                              disabled={isSaving}
                              title="Salvar"
                            >
                              {isSaving ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Check className="w-4 h-4 text-green-600" />
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleCancelEdit(item.id)}
                              title="Cancelar"
                            >
                              <X className="w-4 h-4 text-muted-foreground" />
                            </Button>
                          </>
                        )}
                        <a
                          href={`/vendas/${item.sale_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-accent"
                          title="Abrir venda"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Bulk Percentage Dialog */}
      <Dialog open={bulkPercentDialog} onOpenChange={setBulkPercentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aplicar Custo em Massa</DialogTitle>
            <DialogDescription>
              Defina o custo como uma porcentagem do valor de venda para os {selectedItems.size} itens selecionados.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium">Porcentagem do valor de venda</label>
            <div className="flex items-center gap-2 mt-2">
              <Input
                type="number"
                value={bulkPercent}
                onChange={(e) => setBulkPercent(Number(e.target.value))}
                className="w-24"
                min={0}
                max={100}
              />
              <span className="text-muted-foreground">%</span>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Exemplo: Se o valor da venda é R$ 100,00 e você definir 25%, o custo será R$ 25,00.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkPercentDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleBulkPercentUpdate}>
              Aplicar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={importDialog} onOpenChange={setImportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Importar Custos</DialogTitle>
            <DialogDescription>
              Importe um arquivo CSV com os custos atualizados. O arquivo deve ter a mesma estrutura do exportado.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-4">
              O arquivo deve conter as colunas: ID, Requisição, Produto, Cliente, Vendedor, Data, Valor Venda (centavos), Custo (centavos)
            </p>
            <Input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleImport}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportDialog(false)}>
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
