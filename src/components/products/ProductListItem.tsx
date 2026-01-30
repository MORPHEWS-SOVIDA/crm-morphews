import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2, Eye, Package, AlertTriangle, Copy } from 'lucide-react';
import type { Product } from '@/hooks/useProducts';
import { getAvailableStock } from '@/hooks/useProducts';

interface ProductListItemProps {
  product: Product;
  brandName?: string;
  onView: (product: Product) => void;
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
  onClone?: (product: Product) => void;
  canManage: boolean;
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

export function ProductListItem({ 
  product, 
  brandName,
  onView, 
  onEdit, 
  onDelete,
  onClone, 
  canManage 
}: ProductListItemProps) {
  const availableStock = getAvailableStock(product);
  const isLowStock = product.track_stock && availableStock <= product.minimum_stock;

  return (
    <div className="flex items-center gap-4 p-4 bg-card border rounded-lg hover:bg-muted/50 transition-colors">
      {/* Image */}
      <div className="flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden bg-muted flex items-center justify-center">
        {product.image_url ? (
          <img 
            src={product.image_url} 
            alt={product.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <Package className="h-6 w-6 text-muted-foreground" />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="font-medium truncate">{product.name}</h3>
          {product.is_active ? (
            <Badge variant="secondary" className="bg-green-100 text-green-800 text-xs">
              Ativo
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-xs">Inativo</Badge>
          )}
          {isLowStock && (
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          )}
        </div>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          {brandName && (
            <span className="bg-muted px-2 py-0.5 rounded text-xs">{brandName}</span>
          )}
          {product.sku && (
            <span>SKU: {product.sku}</span>
          )}
        </div>
      </div>

      {/* Price */}
      <div className="text-right flex-shrink-0 w-28">
        <div className="font-semibold">
          {formatCurrency(product.price_1_unit)}
        </div>
        <div className="text-xs text-muted-foreground">
          1 un.
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <Button variant="ghost" size="sm" onClick={() => onView(product)}>
          <Eye className="h-4 w-4" />
        </Button>
        {canManage && (
          <>
            {onClone && (
              <Button variant="ghost" size="sm" onClick={() => onClone(product)} title="Clonar produto">
                <Copy className="h-4 w-4 text-blue-500" />
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => onEdit(product)}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onDelete(product)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
