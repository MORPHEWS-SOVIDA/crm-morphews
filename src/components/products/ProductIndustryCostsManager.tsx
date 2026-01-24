import { useState } from 'react';
import { Plus, Factory, Trash2, Truck, Package, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  useProductIndustryCosts,
  useCreateProductIndustryCost,
  useUpdateProductIndustryCost,
  useDeleteProductIndustryCost,
  useActiveIndustries,
  type ProductIndustryCost,
  type Industry,
} from '@/hooks/ecommerce/useIndustries';

const formatCurrency = (cents: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
};

interface ProductIndustryCostsManagerProps {
  productId: string;
}

export function ProductIndustryCostsManager({ productId }: ProductIndustryCostsManagerProps) {
  const { data: costs, isLoading: costsLoading } = useProductIndustryCosts(productId);
  const { data: industries, isLoading: industriesLoading } = useActiveIndustries();
  const createCost = useCreateProductIndustryCost();
  const updateCost = useUpdateProductIndustryCost();
  const deleteCost = useDeleteProductIndustryCost();

  const [showAddForm, setShowAddForm] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [newCost, setNewCost] = useState({
    industry_id: '',
    unit_cost_cents: 0,
    shipping_cost_cents: 0,
    additional_cost_cents: 0,
    unit_cost_description: '',
    shipping_cost_description: '',
    additional_cost_description: '',
    is_active: true,
  });

  const isLoading = costsLoading || industriesLoading;

  // Filter out industries that already have costs for this product
  const availableIndustries = industries?.filter(
    (ind) => !costs?.some((c) => c.industry_id === ind.id)
  );

  const handleAddCost = async () => {
    if (!newCost.industry_id) {
      toast.error('Selecione uma indústria');
      return;
    }

    try {
      await createCost.mutateAsync({
        product_id: productId,
        industry_id: newCost.industry_id,
        unit_cost_cents: newCost.unit_cost_cents,
        shipping_cost_cents: newCost.shipping_cost_cents,
        additional_cost_cents: newCost.additional_cost_cents,
        unit_cost_description: newCost.unit_cost_description || null,
        shipping_cost_description: newCost.shipping_cost_description || null,
        additional_cost_description: newCost.additional_cost_description || null,
        is_active: newCost.is_active,
      });
      toast.success('Custo de indústria adicionado!');
      setShowAddForm(false);
      setNewCost({
        industry_id: '',
        unit_cost_cents: 0,
        shipping_cost_cents: 0,
        additional_cost_cents: 0,
        unit_cost_description: '',
        shipping_cost_description: '',
        additional_cost_description: '',
        is_active: true,
      });
    } catch (error) {
      toast.error('Erro ao adicionar custo');
    }
  };

  const handleToggleActive = async (cost: ProductIndustryCost & { industry: Industry }) => {
    try {
      await updateCost.mutateAsync({
        id: cost.id,
        productId,
        is_active: !cost.is_active,
      });
      toast.success(cost.is_active ? 'Custo desativado' : 'Custo ativado');
    } catch (error) {
      toast.error('Erro ao atualizar custo');
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteCost.mutateAsync({ id: deleteId, productId });
      toast.success('Custo removido!');
      setDeleteId(null);
    } catch (error) {
      toast.error('Erro ao remover custo');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-32" />
      </div>
    );
  }

  const totalCostPerUnit = (cost: ProductIndustryCost) =>
    cost.unit_cost_cents + cost.shipping_cost_cents + cost.additional_cost_cents;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium flex items-center gap-2">
            <Factory className="h-4 w-4" />
            Custos de Indústria
          </h3>
          <p className="text-sm text-muted-foreground">
            Valores pagos a fornecedores por unidade vendida
          </p>
        </div>
        {availableIndustries && availableIndustries.length > 0 && !showAddForm && (
          <Button onClick={() => setShowAddForm(true)} size="sm" variant="outline" className="gap-1">
            <Plus className="h-3 w-3" />
            Vincular Indústria
          </Button>
        )}
      </div>

      {/* Add Form */}
      {showAddForm && (
        <Card className="border-primary/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Nova Vinculação</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Indústria / Fornecedor</Label>
              <Select
                value={newCost.industry_id}
                onValueChange={(v) => setNewCost((p) => ({ ...p, industry_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma indústria" />
                </SelectTrigger>
                <SelectContent>
                  {availableIndustries?.map((ind) => (
                    <SelectItem key={ind.id} value={ind.id}>
                      {ind.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <Package className="h-3 w-3" />
                  Custo Unitário
                </Label>
                <CurrencyInput
                  value={newCost.unit_cost_cents}
                  onChange={(v) => setNewCost((p) => ({ ...p, unit_cost_cents: v }))}
                  placeholder="R$ 0,00"
                />
                <Input
                  value={newCost.unit_cost_description}
                  onChange={(e) => setNewCost((p) => ({ ...p, unit_cost_description: e.target.value }))}
                  placeholder="Descrição (opcional)"
                  className="text-xs"
                />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <Truck className="h-3 w-3" />
                  Frete por Unidade
                </Label>
                <CurrencyInput
                  value={newCost.shipping_cost_cents}
                  onChange={(v) => setNewCost((p) => ({ ...p, shipping_cost_cents: v }))}
                  placeholder="R$ 0,00"
                />
                <Input
                  value={newCost.shipping_cost_description}
                  onChange={(e) => setNewCost((p) => ({ ...p, shipping_cost_description: e.target.value }))}
                  placeholder="Descrição (opcional)"
                  className="text-xs"
                />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <DollarSign className="h-3 w-3" />
                  Custo Adicional
                </Label>
                <CurrencyInput
                  value={newCost.additional_cost_cents}
                  onChange={(v) => setNewCost((p) => ({ ...p, additional_cost_cents: v }))}
                  placeholder="R$ 0,00"
                />
                <Input
                  value={newCost.additional_cost_description}
                  onChange={(e) => setNewCost((p) => ({ ...p, additional_cost_description: e.target.value }))}
                  placeholder="Descrição (opcional)"
                  className="text-xs"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-2">
                <Switch
                  checked={newCost.is_active}
                  onCheckedChange={(v) => setNewCost((p) => ({ ...p, is_active: v }))}
                />
                <Label className="text-sm">Ativo</Label>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowAddForm(false)}>
                  Cancelar
                </Button>
                <Button size="sm" onClick={handleAddCost} disabled={createCost.isPending}>
                  Adicionar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Existing Costs */}
      {costs && costs.length > 0 ? (
        <div className="space-y-3">
          {costs.map((cost) => (
            <Card key={cost.id} className={!cost.is_active ? 'opacity-60' : ''}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Factory className="h-4 w-4 text-primary" />
                      <span className="font-medium">{cost.industry?.name || 'Indústria'}</span>
                      <Badge variant={cost.is_active ? 'default' : 'secondary'} className="text-xs">
                        {cost.is_active ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </div>

                    <div className="grid gap-2 md:grid-cols-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Custo Unitário:</span>
                        <div className="font-medium">{formatCurrency(cost.unit_cost_cents)}</div>
                        {cost.unit_cost_description && (
                          <div className="text-xs text-muted-foreground">{cost.unit_cost_description}</div>
                        )}
                      </div>
                      <div>
                        <span className="text-muted-foreground">Frete:</span>
                        <div className="font-medium">{formatCurrency(cost.shipping_cost_cents)}</div>
                        {cost.shipping_cost_description && (
                          <div className="text-xs text-muted-foreground">{cost.shipping_cost_description}</div>
                        )}
                      </div>
                      <div>
                        <span className="text-muted-foreground">Adicional:</span>
                        <div className="font-medium">{formatCurrency(cost.additional_cost_cents)}</div>
                        {cost.additional_cost_description && (
                          <div className="text-xs text-muted-foreground">{cost.additional_cost_description}</div>
                        )}
                      </div>
                      <div>
                        <span className="text-muted-foreground">Total/Unidade:</span>
                        <div className="font-bold text-primary">{formatCurrency(totalCostPerUnit(cost))}</div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Switch
                      checked={cost.is_active}
                      onCheckedChange={() => handleToggleActive(cost)}
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setDeleteId(cost.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Total Summary */}
          <div className="p-3 rounded-lg bg-muted/50 border">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Total de custos de indústria por unidade:</span>
              <span className="text-lg font-bold text-primary">
                {formatCurrency(costs.reduce((sum, c) => sum + (c.is_active ? totalCostPerUnit(c) : 0), 0))}
              </span>
            </div>
          </div>
        </div>
      ) : (
        !showAddForm && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-8">
              <Factory className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground text-center">
                Nenhuma indústria vinculada a este produto
              </p>
              {availableIndustries && availableIndustries.length > 0 ? (
                <Button
                  onClick={() => setShowAddForm(true)}
                  variant="link"
                  size="sm"
                  className="mt-2"
                >
                  Vincular Indústria
                </Button>
              ) : (
                <p className="text-xs text-muted-foreground mt-2">
                  Cadastre indústrias em E-commerce → Indústrias
                </p>
              )}
            </CardContent>
          </Card>
        )
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover vinculação?</AlertDialogTitle>
            <AlertDialogDescription>
              O custo desta indústria não será mais considerado nas vendas deste produto.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
