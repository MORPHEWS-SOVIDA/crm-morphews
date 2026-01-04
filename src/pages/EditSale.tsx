import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
  ArrowLeft, 
  Package, 
  Plus, 
  Trash2, 
  Save, 
  Percent, 
  DollarSign,
  ShoppingCart,
  AlertTriangle,
  History
} from 'lucide-react';
import { toast } from 'sonner';
import { useSale, formatCurrency, SaleItem } from '@/hooks/useSales';
import { useProducts, Product } from '@/hooks/useProducts';
import { useAuth } from '@/hooks/useAuth';
import { useMyPermissions } from '@/hooks/useUserPermissions';
import { useCreateMultipleSaleChangeLogs, CreateChangeLogData } from '@/hooks/useSaleChangesLog';
import { supabase } from '@/integrations/supabase/client';
import { ProductSelectorForSale } from '@/components/products/ProductSelectorForSale';
import { ProductSelectionDialog } from '@/components/sales/ProductSelectionDialog';
import { useQueryClient } from '@tanstack/react-query';

interface EditableItem {
  id: string; // Sale item ID (existing) or temp ID (new)
  isNew?: boolean;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price_cents: number;
  discount_cents: number;
  requisition_number?: string | null;
  original?: SaleItem; // Keep original for comparison
}

export default function EditSale() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: sale, isLoading: saleLoading } = useSale(id);
  const { data: products = [] } = useProducts();
  const { user } = useAuth();
  const { data: permissions, isLoading: permissionsLoading } = useMyPermissions();
  const createChangeLogs = useCreateMultipleSaleChangeLogs();

  const [items, setItems] = useState<EditableItem[]>([]);
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('fixed');
  const [discountValue, setDiscountValue] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Permission check - can only edit drafts
  const canEditSale = permissions?.sales_edit_draft;
  
  // Check if sale can be edited (not payment_confirmed or cancelled)
  const isEditable = sale && !['payment_confirmed', 'cancelled'].includes(sale.status);

  // Initialize form with sale data
  useEffect(() => {
    if (sale) {
      setItems(
        (sale.items || []).map(item => ({
          id: item.id,
          product_id: item.product_id,
          product_name: item.product_name,
          quantity: item.quantity,
          unit_price_cents: item.unit_price_cents,
          discount_cents: item.discount_cents,
          requisition_number: item.requisition_number,
          original: item,
        }))
      );
      setDiscountType(sale.discount_type || 'fixed');
      setDiscountValue(sale.discount_type === 'percentage' ? sale.discount_value : sale.discount_cents);
    }
  }, [sale]);

  // Calculate totals
  const subtotal = items.reduce((sum, item) => {
    return sum + (item.unit_price_cents * item.quantity) - item.discount_cents;
  }, 0);

  let totalDiscount = 0;
  if (discountType === 'percentage' && discountValue > 0) {
    totalDiscount = Math.round(subtotal * (discountValue / 100));
  } else if (discountType === 'fixed') {
    totalDiscount = discountValue;
  }

  const shippingCost = sale?.shipping_cost_cents || 0;
  const total = subtotal - totalDiscount + shippingCost;

  // Detect changes
  const changes = useMemo(() => {
    if (!sale) return [];
    
    const changeList: CreateChangeLogData[] = [];
    const originalItems = sale.items || [];

    // Check for removed items
    originalItems.forEach(original => {
      const current = items.find(i => i.id === original.id);
      if (!current) {
        changeList.push({
          sale_id: sale.id,
          change_type: 'item_removed',
          item_id: original.id,
          product_name: original.product_name,
          old_value: `${original.quantity}x ${formatCurrency(original.unit_price_cents)}`,
          notes: `Removido: ${original.product_name}`,
        });
      }
    });

    // Check for modified and new items
    items.forEach(current => {
      if (current.isNew) {
        changeList.push({
          sale_id: sale.id,
          change_type: 'item_added',
          product_name: current.product_name,
          new_value: `${current.quantity}x ${formatCurrency(current.unit_price_cents)}`,
          notes: `Adicionado: ${current.product_name}`,
        });
      } else if (current.original) {
        const original = current.original;
        
        if (current.quantity !== original.quantity) {
          changeList.push({
            sale_id: sale.id,
            change_type: 'item_quantity_changed',
            item_id: current.id,
            product_name: current.product_name,
            field_name: 'quantity',
            old_value: String(original.quantity),
            new_value: String(current.quantity),
          });
        }
        
        if (current.unit_price_cents !== original.unit_price_cents) {
          changeList.push({
            sale_id: sale.id,
            change_type: 'item_price_changed',
            item_id: current.id,
            product_name: current.product_name,
            field_name: 'unit_price_cents',
            old_value: formatCurrency(original.unit_price_cents),
            new_value: formatCurrency(current.unit_price_cents),
          });
        }
        
        if (current.discount_cents !== original.discount_cents) {
          changeList.push({
            sale_id: sale.id,
            change_type: 'item_price_changed',
            item_id: current.id,
            product_name: current.product_name,
            field_name: 'discount_cents',
            old_value: formatCurrency(original.discount_cents),
            new_value: formatCurrency(current.discount_cents),
          });
        }
      }
    });

    // Check discount changes
    const originalDiscountCents = sale.discount_cents;
    if (totalDiscount !== originalDiscountCents) {
      changeList.push({
        sale_id: sale.id,
        change_type: 'discount_changed',
        field_name: 'discount',
        old_value: formatCurrency(originalDiscountCents),
        new_value: formatCurrency(totalDiscount),
      });
    }

    return changeList;
  }, [sale, items, totalDiscount]);

  const hasChanges = changes.length > 0;

  const handleProductSelect = (product: Product) => {
    setSelectedProduct(product);
    setProductDialogOpen(true);
  };

  const handleAddItem = (selection: {
    product_id: string;
    product_name: string;
    quantity: number;
    unit_price_cents: number;
    discount_cents: number;
    requisition_number?: string | null;
  }) => {
    const newItem: EditableItem = {
      id: `new_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      isNew: true,
      product_id: selection.product_id,
      product_name: selection.product_name,
      quantity: selection.quantity,
      unit_price_cents: selection.unit_price_cents,
      discount_cents: selection.discount_cents,
      requisition_number: selection.requisition_number || null,
    };
    setItems(prev => [...prev, newItem]);
    setProductDialogOpen(false);
    setSelectedProduct(null);
  };

  const handleRemoveItem = (itemId: string) => {
    setItems(prev => prev.filter(item => item.id !== itemId));
  };

  const handleQuantityChange = (itemId: string, quantity: number) => {
    if (quantity < 1) return;
    setItems(prev => prev.map(item => 
      item.id === itemId ? { ...item, quantity } : item
    ));
  };

  const handlePriceChange = (itemId: string, price: number) => {
    setItems(prev => prev.map(item => 
      item.id === itemId ? { ...item, unit_price_cents: price } : item
    ));
  };

  const handleSave = async () => {
    if (!sale || !user || items.length === 0) return;
    
    setIsSaving(true);
    
    try {
      // 1. Delete removed items
      const currentItemIds = items.filter(i => !i.isNew).map(i => i.id);
      const originalItemIds = (sale.items || []).map(i => i.id);
      const removedItemIds = originalItemIds.filter(id => !currentItemIds.includes(id));
      
      if (removedItemIds.length > 0) {
        const { error: deleteError } = await supabase
          .from('sale_items')
          .delete()
          .in('id', removedItemIds);
        
        if (deleteError) throw deleteError;
      }

      // 2. Update existing items
      for (const item of items.filter(i => !i.isNew)) {
        const { error: updateError } = await supabase
          .from('sale_items')
          .update({
            quantity: item.quantity,
            unit_price_cents: item.unit_price_cents,
            discount_cents: item.discount_cents,
            total_cents: (item.unit_price_cents * item.quantity) - item.discount_cents,
          })
          .eq('id', item.id);
        
        if (updateError) throw updateError;
      }

      // 3. Insert new items
      const newItems = items.filter(i => i.isNew);
      if (newItems.length > 0) {
        const itemsToInsert = newItems.map(item => ({
          sale_id: sale.id,
          product_id: item.product_id,
          product_name: item.product_name,
          quantity: item.quantity,
          unit_price_cents: item.unit_price_cents,
          discount_cents: item.discount_cents,
          total_cents: (item.unit_price_cents * item.quantity) - item.discount_cents,
          requisition_number: item.requisition_number,
        }));
        
        const { error: insertError } = await supabase
          .from('sale_items')
          .insert(itemsToInsert);
        
        if (insertError) throw insertError;
      }

      // 4. Update sale totals
      const { error: saleError } = await supabase
        .from('sales')
        .update({
          subtotal_cents: subtotal,
          discount_type: discountType,
          discount_value: discountType === 'percentage' ? discountValue : 0,
          discount_cents: totalDiscount,
          total_cents: total,
          was_edited: true,
        })
        .eq('id', sale.id);

      if (saleError) throw saleError;

      // 5. Log all changes
      if (changes.length > 0) {
        await createChangeLogs.mutateAsync(changes);
      }

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['sale', sale.id] });
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['sale-changes-log', sale.id] });

      toast.success('Venda atualizada com sucesso!');
      navigate(`/vendas/${sale.id}`);
    } catch (error) {
      console.error('Erro ao salvar venda:', error);
      toast.error('Erro ao salvar alterações');
    } finally {
      setIsSaving(false);
      setShowConfirmDialog(false);
    }
  };

  if (saleLoading || permissionsLoading) {
    return (
      <Layout>
        <div className="container mx-auto py-6 space-y-6">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-96 w-full" />
        </div>
      </Layout>
    );
  }

  if (!sale) {
    return (
      <Layout>
        <div className="container mx-auto py-6">
          <p className="text-muted-foreground">Venda não encontrada.</p>
        </div>
      </Layout>
    );
  }

  if (!canEditSale) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <h1 className="text-2xl font-bold text-foreground mb-2">Acesso Negado</h1>
          <p className="text-muted-foreground mb-4">Você não tem permissão para editar vendas.</p>
          <Button onClick={() => navigate(`/vendas/${sale.id}`)}>Voltar para Venda</Button>
        </div>
      </Layout>
    );
  }

  if (!isEditable) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <AlertTriangle className="w-16 h-16 text-amber-500 mb-4" />
          <h1 className="text-2xl font-bold text-foreground mb-2">Venda não pode ser editada</h1>
          <p className="text-muted-foreground mb-4">
            {sale.status === 'payment_confirmed' 
              ? 'Vendas com pagamento confirmado não podem ser alteradas.' 
              : 'Esta venda não pode ser alterada no status atual.'}
          </p>
          <Button onClick={() => navigate(`/vendas/${sale.id}`)}>Voltar para Venda</Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto py-6 max-w-6xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(`/vendas/${sale.id}`)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                Editar Venda #{sale.romaneio_number}
              </h1>
              <p className="text-muted-foreground text-sm">
                Cliente: {sale.lead?.name}
              </p>
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate(`/vendas/${sale.id}`)}>
              Cancelar
            </Button>
            <Button 
              onClick={() => setShowConfirmDialog(true)}
              disabled={!hasChanges || isSaving}
            >
              <Save className="w-4 h-4 mr-2" />
              Salvar Alterações
            </Button>
          </div>
        </div>

        {/* Changes indicator */}
        {hasChanges && (
          <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg flex items-center gap-2">
            <History className="w-4 h-4 text-amber-600" />
            <span className="text-sm text-amber-700 dark:text-amber-400">
              {changes.length} alteração(ões) pendente(s) de salvamento
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Add Product */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="w-5 h-5" />
                  Adicionar Produto
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ProductSelectorForSale 
                  products={products} 
                  onSelect={handleProductSelect} 
                />
              </CardContent>
            </Card>

            {/* Items List */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="w-5 h-5" />
                  Produtos ({items.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {items.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    Nenhum produto na venda
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produto</TableHead>
                        <TableHead className="w-24">Qtd</TableHead>
                        <TableHead className="w-32">Preço Un.</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map(item => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{item.product_name}</span>
                              {item.isNew && (
                                <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                                  Novo
                                </Badge>
                              )}
                              {item.requisition_number && (
                                <Badge variant="secondary" className="text-xs">
                                  Req: {item.requisition_number}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min={1}
                              value={item.quantity}
                              onChange={(e) => handleQuantityChange(item.id, parseInt(e.target.value) || 1)}
                              className="w-20"
                            />
                          </TableCell>
                          <TableCell>
                            <CurrencyInput
                              value={item.unit_price_cents}
                              onChange={(value) => handlePriceChange(item.id, value)}
                              className="w-28"
                            />
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency((item.unit_price_cents * item.quantity) - item.discount_cents)}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => handleRemoveItem(item.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* Discount */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Percent className="w-5 h-5" />
                  Desconto Total
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4 items-end">
                  <div className="flex-1">
                    <Label>Tipo de Desconto</Label>
                    <div className="flex gap-2 mt-1">
                      <Button
                        type="button"
                        variant={discountType === 'percentage' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setDiscountType('percentage')}
                      >
                        <Percent className="w-4 h-4 mr-1" />
                        Percentual
                      </Button>
                      <Button
                        type="button"
                        variant={discountType === 'fixed' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setDiscountType('fixed')}
                      >
                        <DollarSign className="w-4 h-4 mr-1" />
                        Valor Fixo
                      </Button>
                    </div>
                  </div>
                  <div className="w-40">
                    <Label>Valor</Label>
                    {discountType === 'percentage' ? (
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={discountValue}
                        onChange={(e) => setDiscountValue(parseFloat(e.target.value) || 0)}
                        className="mt-1"
                        placeholder="0%"
                      />
                    ) : (
                      <CurrencyInput
                        value={discountValue}
                        onChange={setDiscountValue}
                        className="mt-1"
                      />
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Summary Sidebar */}
          <div className="lg:col-span-1">
            <Card className="sticky top-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5" />
                  Resumo
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>{formatCurrency(subtotal)}</span>
                  </div>
                  
                  {totalDiscount > 0 && (
                    <div className="flex justify-between text-sm text-green-600">
                      <span>Desconto</span>
                      <span>-{formatCurrency(totalDiscount)}</span>
                    </div>
                  )}
                  
                  {shippingCost > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Frete</span>
                      <span>{formatCurrency(shippingCost)}</span>
                    </div>
                  )}
                  
                  <div className="border-t pt-2 flex justify-between font-bold text-lg">
                    <span>Total</span>
                    <span className="text-primary">{formatCurrency(total)}</span>
                  </div>
                </div>

                {/* Changes preview */}
                {hasChanges && (
                  <div className="border-t pt-4">
                    <Label className="text-xs text-muted-foreground">Alterações a serem salvas:</Label>
                    <ul className="mt-2 space-y-1 text-xs">
                      {changes.slice(0, 5).map((change, idx) => (
                        <li key={idx} className="flex items-center gap-1 text-muted-foreground">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                          {change.notes || change.change_type}
                        </li>
                      ))}
                      {changes.length > 5 && (
                        <li className="text-muted-foreground">
                          +{changes.length - 5} mais...
                        </li>
                      )}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Product Selection Dialog */}
      <ProductSelectionDialog
        open={productDialogOpen}
        onOpenChange={setProductDialogOpen}
        product={selectedProduct}
        onConfirm={handleAddItem}
      />

      {/* Confirm Save Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar alterações</AlertDialogTitle>
            <AlertDialogDescription>
              Você está prestes a salvar {changes.length} alteração(ões) nesta venda.
              Todas as mudanças serão registradas no histórico.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="max-h-48 overflow-y-auto py-2">
            <ul className="space-y-1 text-sm">
              {changes.map((change, idx) => (
                <li key={idx} className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  {change.notes || `${change.change_type}: ${change.field_name || ''}`}
                </li>
              ))}
            </ul>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSaving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Salvando...' : 'Confirmar e Salvar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
