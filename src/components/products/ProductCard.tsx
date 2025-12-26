import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Pencil, Trash2, Eye, Package } from 'lucide-react';
import type { Product } from '@/hooks/useProducts';

interface ProductCardProps {
  product: Product;
  onView: (product: Product) => void;
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
  canManage: boolean;
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

export function ProductCard({ product, onView, onEdit, onDelete, canManage }: ProductCardProps) {
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
          <Badge variant={product.is_active ? 'default' : 'secondary'}>
            {product.is_active ? 'Ativo' : 'Inativo'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Preços */}
          <div className="grid grid-cols-2 gap-2 text-sm">
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
          </div>

          {/* Info adicional */}
          <div className="flex gap-4 text-xs text-muted-foreground border-t pt-3">
            {product.minimum_price > 0 && (
              <span>Mín: {formatCurrency(product.minimum_price)}</span>
            )}
            {product.usage_period_days > 0 && (
              <span>{product.usage_period_days} dias de uso</span>
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
