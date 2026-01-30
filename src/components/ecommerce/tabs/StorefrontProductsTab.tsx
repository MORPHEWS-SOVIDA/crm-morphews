import { useState, useMemo } from 'react';
import { Plus, Package, Layers, Search, Check, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  useStorefrontProducts,
  useUpdateStorefrontProducts,
  useUpdateStorefrontProduct,
  type Storefront,
  type StorefrontProduct,
} from '@/hooks/ecommerce';
import { useProducts } from '@/hooks/useProducts';
import { useProductCombos } from '@/hooks/useProductCombos';
import { StorefrontProductEditDialog } from '../StorefrontProductEditDialog';

interface StorefrontProductsTabProps {
  storefrontId: string;
  storefront: Storefront;
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

export function StorefrontProductsTab({ storefrontId, storefront }: StorefrontProductsTabProps) {
  const { data: storefrontProducts, isLoading } = useStorefrontProducts(storefrontId);
  const { data: allProducts } = useProducts();
  const { data: allCombos } = useProductCombos();
  const updateProducts = useUpdateStorefrontProducts();
  const updateProduct = useUpdateStorefrontProduct();

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [selectedComboIds, setSelectedComboIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [addDialogTab, setAddDialogTab] = useState<'products' | 'combos'>('products');
  const [editingProduct, setEditingProduct] = useState<(StorefrontProduct & { product: any }) | null>(null);

  // Items already in storefront
  const existingProductIds = useMemo(() => 
    storefrontProducts?.filter(sp => sp.product_id).map(sp => sp.product_id!) || [], 
    [storefrontProducts]
  );

  const existingComboIds = useMemo(() => 
    storefrontProducts?.filter(sp => sp.combo_id).map(sp => sp.combo_id!) || [], 
    [storefrontProducts]
  );

  // Available products (not yet added)
  const availableProducts = useMemo(() => 
    allProducts?.filter(p => 
      p.is_active && 
      !existingProductIds.includes(p.id) &&
      p.name.toLowerCase().includes(searchTerm.toLowerCase())
    ) || [],
    [allProducts, existingProductIds, searchTerm]
  );

  // Available combos (not yet added)
  const availableCombos = useMemo(() => 
    allCombos?.filter(c => 
      c.is_active && 
      !existingComboIds.includes(c.id) &&
      c.name.toLowerCase().includes(searchTerm.toLowerCase())
    ) || [],
    [allCombos, existingComboIds, searchTerm]
  );

  const handleOpenAddDialog = () => {
    setSelectedProductIds([]);
    setSelectedComboIds([]);
    setSearchTerm('');
    setAddDialogTab('products');
    setAddDialogOpen(true);
  };

  const handleToggleProduct = (productId: string) => {
    setSelectedProductIds(prev => 
      prev.includes(productId)
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
  };

  const handleToggleCombo = (comboId: string) => {
    setSelectedComboIds(prev => 
      prev.includes(comboId)
        ? prev.filter(id => id !== comboId)
        : [...prev, comboId]
    );
  };

  const handleAddItems = () => {
    const currentItems = storefrontProducts?.map(sp => ({
      product_id: sp.product_id,
      combo_id: sp.combo_id,
      display_order: sp.display_order,
      is_featured: sp.is_featured,
      custom_price_cents: sp.custom_price_cents,
    })) || [];

    const newProducts = selectedProductIds.map((id, idx) => ({
      product_id: id,
      combo_id: null,
      display_order: currentItems.length + idx,
      is_featured: false,
      custom_price_cents: null,
    }));

    const newCombos = selectedComboIds.map((id, idx) => ({
      product_id: null,
      combo_id: id,
      display_order: currentItems.length + newProducts.length + idx,
      is_featured: false,
      custom_price_cents: null,
    }));

    updateProducts.mutate({
      storefrontId,
      items: [...currentItems, ...newProducts, ...newCombos],
    }, {
      onSuccess: () => {
        setAddDialogOpen(false);
        setSelectedProductIds([]);
        setSelectedComboIds([]);
      },
    });
  };

  const handleRemoveItem = (sp: StorefrontProduct) => {
    const updatedItems = storefrontProducts
      ?.filter(item => item.id !== sp.id)
      .map((item, idx) => ({
        product_id: item.product_id,
        combo_id: item.combo_id,
        display_order: idx,
        is_featured: item.is_featured,
        custom_price_cents: item.custom_price_cents,
      })) || [];

    updateProducts.mutate({ storefrontId, items: updatedItems });
  };

  const handleToggleFeatured = (sp: StorefrontProduct, isFeatured: boolean) => {
    const updatedItems = storefrontProducts?.map(item => ({
      product_id: item.product_id,
      combo_id: item.combo_id,
      display_order: item.display_order,
      is_featured: item.id === sp.id ? isFeatured : item.is_featured,
      custom_price_cents: item.custom_price_cents,
    })) || [];

    updateProducts.mutate({ storefrontId, items: updatedItems });
  };

  const handleEditProduct = (sp: StorefrontProduct & { product: any }) => {
    setEditingProduct(sp);
  };

  const handleSaveProductEdit = (updates: Partial<StorefrontProduct>) => {
    if (!editingProduct) return;
    
    updateProduct.mutate({
      id: editingProduct.id,
      storefrontId,
      ...updates,
    }, {
      onSuccess: () => {
        setEditingProduct(null);
      },
    });
  };

  const getItemName = (sp: StorefrontProduct) => {
    if (sp.custom_name) return sp.custom_name;
    if (sp.product) return sp.product.name;
    if (sp.combo) return sp.combo.name;
    return 'Item';
  };

  const getItemImage = (sp: StorefrontProduct) => {
    if (sp.product?.image_url) return sp.product.image_url;
    if (sp.combo?.image_url) return sp.combo.image_url;
    return null;
  };

  const getItemPrice = (sp: StorefrontProduct) => {
    if (sp.custom_price_cents) return sp.custom_price_cents;
    if (sp.product?.price_1_unit) return sp.product.price_1_unit;
    if (sp.product?.base_price_cents) return sp.product.base_price_cents;
    return null;
  };

  const isCombo = (sp: StorefrontProduct) => !!sp.combo_id;

  const totalSelected = selectedProductIds.length + selectedComboIds.length;

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Produtos e Combos da Loja</h3>
          <p className="text-sm text-muted-foreground">
            Selecione e personalize os produtos e combos desta loja
          </p>
        </div>
        <Button onClick={handleOpenAddDialog} className="gap-2">
          <Plus className="h-4 w-4" />
          Adicionar Itens
        </Button>
      </div>

      {storefrontProducts?.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Package className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhum produto ou combo adicionado</h3>
            <p className="text-muted-foreground mb-4 max-w-md">
              Adicione produtos e combos do seu catálogo para exibir nesta loja.
            </p>
            <Button onClick={handleOpenAddDialog} className="gap-2">
              <Plus className="h-4 w-4" />
              Adicionar Itens
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {storefrontProducts?.map((sp) => (
            <Card key={sp.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  {getItemImage(sp) ? (
                    <img
                      src={getItemImage(sp)!}
                      alt={getItemName(sp)}
                      className="w-16 h-16 rounded object-cover"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded bg-muted flex items-center justify-center">
                      {isCombo(sp) ? (
                        <Layers className="h-6 w-6 text-muted-foreground" />
                      ) : (
                        <Package className="h-6 w-6 text-muted-foreground" />
                      )}
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium truncate">
                      {getItemName(sp)}
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      {getItemPrice(sp) 
                        ? formatCurrency(getItemPrice(sp)!)
                        : 'Preço não definido'
                      }
                      {sp.custom_price_cents && (
                        <span className="text-xs text-primary ml-1">(personalizado)</span>
                      )}
                    </p>
                    <div className="flex items-center gap-1 mt-2 flex-wrap">
                      {isCombo(sp) && (
                        <Badge variant="secondary" className="text-xs">
                          <Layers className="h-3 w-3 mr-1" />
                          Combo
                        </Badge>
                      )}
                      {sp.is_featured && (
                        <Badge variant="default" className="text-xs">
                          Destaque
                        </Badge>
                      )}
                      {sp.highlight_badge && (
                        <Badge variant="secondary" className="text-xs">
                          {sp.highlight_badge}
                        </Badge>
                      )}
                      {!sp.is_visible && (
                        <Badge variant="outline" className="text-xs text-muted-foreground">
                          Oculto
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-4 pt-3 border-t">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={sp.is_featured}
                      onCheckedChange={(checked) => handleToggleFeatured(sp, checked)}
                    />
                    <span className="text-sm text-muted-foreground">Destaque</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {/* Only show edit for products, not combos */}
                    {!isCombo(sp) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditProduct(sp as StorefrontProduct & { product: any })}
                        className="gap-1"
                      >
                        <Pencil className="h-3 w-3" />
                        Editar
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveItem(sp)}
                      className="text-destructive"
                    >
                      Remover
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Items Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Adicionar Produtos e Combos à Loja</DialogTitle>
          </DialogHeader>

          <Tabs value={addDialogTab} onValueChange={(v) => setAddDialogTab(v as 'products' | 'combos')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="products" className="gap-2">
                <Package className="h-4 w-4" />
                Produtos {selectedProductIds.length > 0 && `(${selectedProductIds.length})`}
              </TabsTrigger>
              <TabsTrigger value="combos" className="gap-2">
                <Layers className="h-4 w-4" />
                Combos {selectedComboIds.length > 0 && `(${selectedComboIds.length})`}
              </TabsTrigger>
            </TabsList>

            <div className="relative mt-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={addDialogTab === 'products' ? 'Buscar produtos...' : 'Buscar combos...'}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>

            <TabsContent value="products" className="mt-4 flex-1 overflow-auto min-h-[300px]">
              {availableProducts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Package className="h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-muted-foreground">
                    {searchTerm ? 'Nenhum produto encontrado' : 'Todos os produtos já foram adicionados'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {availableProducts.map((product) => (
                    <div
                      key={product.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedProductIds.includes(product.id)
                          ? 'border-primary bg-primary/5'
                          : 'hover:bg-muted/50'
                      }`}
                      onClick={() => handleToggleProduct(product.id)}
                    >
                      <Checkbox
                        checked={selectedProductIds.includes(product.id)}
                        onCheckedChange={() => handleToggleProduct(product.id)}
                      />

                      {product.image_url ? (
                        <img
                          src={product.image_url}
                          alt={product.name}
                          className="w-12 h-12 rounded object-cover"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded bg-muted flex items-center justify-center">
                          <Package className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}

                      <div className="flex-1">
                        <p className="font-medium">{product.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatCurrency(product.price_1_unit)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="combos" className="mt-4 flex-1 overflow-auto min-h-[300px]">
              {availableCombos.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Layers className="h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-muted-foreground">
                    {searchTerm ? 'Nenhum combo encontrado' : allCombos?.length === 0 ? 'Nenhum combo cadastrado. Cadastre combos em Produtos → Combos.' : 'Todos os combos já foram adicionados'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {availableCombos.map((combo) => (
                    <div
                      key={combo.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedComboIds.includes(combo.id)
                          ? 'border-primary bg-primary/5'
                          : 'hover:bg-muted/50'
                      }`}
                      onClick={() => handleToggleCombo(combo.id)}
                    >
                      <Checkbox
                        checked={selectedComboIds.includes(combo.id)}
                        onCheckedChange={() => handleToggleCombo(combo.id)}
                      />

                      {combo.image_url ? (
                        <img
                          src={combo.image_url}
                          alt={combo.name}
                          className="w-12 h-12 rounded object-cover"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded bg-muted flex items-center justify-center">
                          <Layers className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}

                      <div className="flex-1">
                        <p className="font-medium">{combo.name}</p>
                        {combo.description && (
                          <p className="text-sm text-muted-foreground line-clamp-1">
                            {combo.description}
                          </p>
                        )}
                      </div>

                      <Badge variant="secondary" className="text-xs">
                        Combo
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleAddItems}
              disabled={totalSelected === 0 || updateProducts.isPending}
            >
              <Check className="h-4 w-4 mr-2" />
              Adicionar {totalSelected > 0 && `(${totalSelected})`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Product Dialog */}
      {editingProduct && (
        <StorefrontProductEditDialog
          open={!!editingProduct}
          onOpenChange={(open) => !open && setEditingProduct(null)}
          storefrontProduct={editingProduct}
          onSave={handleSaveProductEdit}
          isPending={updateProduct.isPending}
        />
      )}
    </div>
  );
}
