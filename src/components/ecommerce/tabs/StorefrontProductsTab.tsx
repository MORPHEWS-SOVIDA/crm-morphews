import { useState, useMemo } from 'react';
import { Plus, Package, ArrowUpRight, Search, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
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
  type Storefront,
} from '@/hooks/ecommerce';
import { useProducts } from '@/hooks/useProducts';

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
  const updateProducts = useUpdateStorefrontProducts();

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  // Products already in storefront
  const existingProductIds = useMemo(() => 
    storefrontProducts?.map(sp => sp.product_id) || [], 
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

  const handleOpenAddDialog = () => {
    setSelectedProductIds([]);
    setSearchTerm('');
    setAddDialogOpen(true);
  };

  const handleToggleProduct = (productId: string) => {
    setSelectedProductIds(prev => 
      prev.includes(productId)
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
  };

  const handleAddProducts = () => {
    const currentProducts = storefrontProducts?.map(sp => ({
      product_id: sp.product_id,
      display_order: sp.display_order,
      is_featured: sp.is_featured,
      custom_price_cents: sp.custom_price_cents,
    })) || [];

    const newProducts = selectedProductIds.map((id, idx) => ({
      product_id: id,
      display_order: currentProducts.length + idx,
      is_featured: false,
      custom_price_cents: null,
    }));

    updateProducts.mutate({
      storefrontId,
      products: [...currentProducts, ...newProducts],
    }, {
      onSuccess: () => {
        setAddDialogOpen(false);
        setSelectedProductIds([]);
      },
    });
  };

  const handleRemoveProduct = (productId: string) => {
    const updatedProducts = storefrontProducts
      ?.filter(sp => sp.product_id !== productId)
      .map((sp, idx) => ({
        product_id: sp.product_id,
        display_order: idx,
        is_featured: sp.is_featured,
        custom_price_cents: sp.custom_price_cents,
      })) || [];

    updateProducts.mutate({ storefrontId, products: updatedProducts });
  };

  const handleToggleFeatured = (productId: string, isFeatured: boolean) => {
    const updatedProducts = storefrontProducts?.map(sp => ({
      product_id: sp.product_id,
      display_order: sp.display_order,
      is_featured: sp.product_id === productId ? isFeatured : sp.is_featured,
      custom_price_cents: sp.custom_price_cents,
    })) || [];

    updateProducts.mutate({ storefrontId, products: updatedProducts });
  };

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
          <h3 className="text-lg font-semibold">Produtos da Loja</h3>
          <p className="text-sm text-muted-foreground">
            Selecione quais produtos aparecem nesta loja
          </p>
        </div>
        <Button onClick={handleOpenAddDialog} className="gap-2">
          <Plus className="h-4 w-4" />
          Adicionar Produtos
        </Button>
      </div>

      {storefrontProducts?.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Package className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhum produto adicionado</h3>
            <p className="text-muted-foreground mb-4 max-w-md">
              Adicione produtos do seu catálogo para exibir nesta loja.
            </p>
            <Button onClick={handleOpenAddDialog} className="gap-2">
              <Plus className="h-4 w-4" />
              Adicionar Produtos
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {storefrontProducts?.map((sp) => (
            <Card key={sp.id}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  {sp.product?.image_url ? (
                    <img
                      src={sp.product.image_url}
                      alt={sp.product?.name}
                      className="w-16 h-16 rounded object-cover"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded bg-muted flex items-center justify-center">
                      <Package className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium truncate">{sp.product?.name}</h4>
                    <p className="text-sm text-muted-foreground">
                      {sp.custom_price_cents 
                        ? formatCurrency(sp.custom_price_cents)
                        : sp.product?.price_1_unit 
                          ? formatCurrency(sp.product.price_1_unit)
                          : sp.product?.base_price_cents
                            ? formatCurrency(sp.product.base_price_cents)
                            : 'Preço não definido'
                      }
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      {sp.is_featured && (
                        <Badge variant="default" className="text-xs">
                          Destaque
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-4 pt-3 border-t">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={sp.is_featured}
                      onCheckedChange={(checked) => handleToggleFeatured(sp.product_id, checked)}
                    />
                    <span className="text-sm text-muted-foreground">Destaque</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveProduct(sp.product_id)}
                    className="text-destructive"
                  >
                    Remover
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Products Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Adicionar Produtos à Loja</DialogTitle>
          </DialogHeader>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar produtos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="flex-1 overflow-auto min-h-[300px]">
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

                    {product.crosssell_product_1_id && (
                      <Badge variant="outline" className="text-xs">
                        <ArrowUpRight className="h-3 w-3 mr-1" />
                        Cross-sell
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleAddProducts}
              disabled={selectedProductIds.length === 0 || updateProducts.isPending}
            >
              <Check className="h-4 w-4 mr-2" />
              Adicionar {selectedProductIds.length > 0 && `(${selectedProductIds.length})`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
