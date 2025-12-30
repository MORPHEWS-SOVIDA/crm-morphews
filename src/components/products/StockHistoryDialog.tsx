import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Loader2, ArrowDownToLine, ArrowUpFromLine, RefreshCw, ShoppingCart, RotateCcw } from 'lucide-react';
import { useProductStockMovements, getMovementTypeLabel } from '@/hooks/useStock';
import type { Product } from '@/hooks/useProducts';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface StockHistoryDialogProps {
  product: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const movementIcons: Record<string, typeof ArrowDownToLine> = {
  entry: ArrowDownToLine,
  exit: ArrowUpFromLine,
  adjustment: RefreshCw,
  sale: ShoppingCart,
  return: RotateCcw,
};

const movementColors: Record<string, string> = {
  entry: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  exit: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  adjustment: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  sale: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  return: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
};

export function StockHistoryDialog({ product, open, onOpenChange }: StockHistoryDialogProps) {
  const { data: movements, isLoading } = useProductStockMovements(product?.id);

  if (!product) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Histórico de Estoque - {product.name}</DialogTitle>
        </DialogHeader>

        <div className="p-4 rounded-lg bg-muted/50 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Estoque Atual</p>
              <p className="text-3xl font-bold">{product.stock_quantity || 0}</p>
            </div>
            {product.minimum_stock > 0 && (
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Mínimo</p>
                <p className="text-xl font-semibold">{product.minimum_stock}</p>
              </div>
            )}
          </div>
        </div>

        <ScrollArea className="max-h-[50vh]">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : movements && movements.length > 0 ? (
            <div className="space-y-3">
              {movements.map((movement) => {
                const Icon = movementIcons[movement.movement_type] || RefreshCw;
                const colorClass = movementColors[movement.movement_type] || movementColors.adjustment;
                
                return (
                  <div
                    key={movement.id}
                    className="p-3 rounded-lg border flex items-start gap-3"
                  >
                    <div className={`p-2 rounded-lg ${colorClass}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="secondary" className={colorClass}>
                          {getMovementTypeLabel(movement.movement_type)}
                        </Badge>
                        <span className="text-sm font-medium">
                          {movement.movement_type === 'adjustment' ? (
                            `→ ${movement.new_quantity}`
                          ) : (
                            <>
                              {movement.movement_type === 'entry' || movement.movement_type === 'return' ? '+' : '-'}
                              {movement.quantity}
                            </>
                          )}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {movement.previous_quantity} → {movement.new_quantity}
                      </div>
                      {movement.notes && (
                        <p className="text-sm text-muted-foreground mt-1 truncate">
                          {movement.notes}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(new Date(movement.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p>Nenhuma movimentação registrada</p>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
