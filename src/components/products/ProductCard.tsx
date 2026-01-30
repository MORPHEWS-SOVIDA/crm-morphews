import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Pencil, Trash2, Eye, Package, AlertTriangle, Copy } from 'lucide-react';
import type { Product } from '@/hooks/useProducts';
import { getAvailableStock } from '@/hooks/useProducts';
import { useProductPriceKits } from '@/hooks/useProductPriceKits';

interface ProductCardProps {
  product: Product;
  onView: (product: Product) => void;
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
  onClone?: (product: Product) => void;
  canManage: boolean;
}

// Categories that use the new kit system
const CATEGORIES_WITH_KITS = ['produto_pronto', 'print_on_demand', 'dropshipping'];

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

export function ProductCard({ product, onView, onEdit, onDelete, onClone, canManage }: ProductCardProps) {
  const availableStock = getAvailableStock(product);
  const isLowStock = product.track_stock && availableStock <= product.minimum_stock;
  
  const usesKitSystem = CATEGORIES_WITH_KITS.includes(product.category);
  const { data: priceKits = [] } = useProductPriceKits(usesKitSystem ? product.id : undefined);
  
  // For kit-based products, get prices from kits
  const getKitPrices = () => {
    if (!usesKitSystem || priceKits.length === 0) return null;
    
    // Get first 4 kits for display
    return priceKits.slice(0, 4).map(kit => ({
      quantity: kit.quantity,
      price: kit.regular_price_cents,
    }));
  };
  
  const kitPrices = getKitPrices();
  
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Package className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">{product.name}</CardTitle>
              {product.description && (
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                  {product.description}
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-1 items-end">
            <Badge variant={product.is_active ? 'default' : 'secondary'}>
              {product.is_active ? 'Ativo' : 'Inativo'}
            </Badge>
            {isLowStock && (
              <Badge variant="destructive" className="flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Estoque baixo
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Preços */}
          <div className="grid grid-cols-2 gap-2 text-sm">
            {kitPrices ? (
              // Show kit-based prices
              kitPrices.map((kit, index) => (
                <div key={index} className="flex justify-between">
                  <span className="text-muted-foreground">{kit.quantity} un:</span>
                  <span className="font-medium">{formatCurrency(kit.price)}</span>
                </div>
              ))
            ) : (
              // Show legacy prices for non-kit products
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">1 un:</span>
                  <span className="font-medium">{formatCurrency(product.price_1_unit)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">3 un:</span>
                  <span className="font-medium">{formatCurrency(product.price_3_units)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">6 un:</span>
                  <span className="font-medium">{formatCurrency(product.price_6_units)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">12 un:</span>
                  <span className="font-medium">{formatCurrency(product.price_12_units)}</span>
                </div>
              </>
            )}
          </div>

          {/* Info adicional */}
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground border-t pt-3">
            {product.cost_cents > 0 && (
              <span className="bg-muted px-2 py-1 rounded">
                Custo: {formatCurrency(product.cost_cents)}
              </span>
            )}
            {product.track_stock && (
              <span className={`px-2 py-1 rounded ${isLowStock ? 'bg-destructive/10 text-destructive' : 'bg-muted'}`}>
                Disponível: {availableStock}
                {product.stock_reserved > 0 && (
                  <span className="text-muted-foreground ml-1">
                    ({product.stock_reserved} reservado)
                  </span>
                )}
              </span>
            )}
            {product.minimum_price > 0 && (
              <span className="bg-muted px-2 py-1 rounded">
                Mín: {formatCurrency(product.minimum_price)}
              </span>
            )}
            {product.usage_period_days > 0 && (
              <span className="bg-muted px-2 py-1 rounded">
                {product.usage_period_days} dias de uso
              </span>
            )}
          </div>

          {/* Ações */}
          <div className="flex gap-2 pt-2 border-t">
            <Button variant="outline" size="sm" className="flex-1" onClick={() => onView(product)}>
              <Eye className="h-4 w-4 mr-1" />
              Ver
            </Button>
            {canManage && (
              <>
                {onClone && (
                  <Button variant="outline" size="sm" onClick={() => onClone(product)} title="Clonar produto">
                    <Copy className="h-4 w-4 text-blue-500" />
                  </Button>
                )}
                <Button variant="outline" size="sm" className="flex-1" onClick={() => onEdit(product)}>
                  <Pencil className="h-4 w-4 mr-1" />
                  Editar
                </Button>
                <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => onDelete(product)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}