import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertTriangle, Package, DollarSign } from 'lucide-react';
import type { Product } from '@/hooks/useProducts';
import { getAvailableStock } from '@/hooks/useProducts';

interface ProductDetailDialogProps {
  product: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

export function ProductDetailDialog({ product, open, onOpenChange }: ProductDetailDialogProps) {
  if (!product) return null;

  const availableStock = getAvailableStock(product);
  const isLowStock = product.track_stock && availableStock <= product.minimum_stock;
  const profitMargin = product.price_1_unit > 0 && product.cost_cents > 0
    ? ((product.price_1_unit - product.cost_cents) / product.price_1_unit * 100).toFixed(1)
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <div className="flex items-center gap-3 flex-wrap">
            <DialogTitle className="text-xl">{product.name}</DialogTitle>
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
        </DialogHeader>

        <ScrollArea className="max-h-[70vh] pr-4">
          <div className="space-y-6">
            {/* Descrição */}
            {product.description && (
              <div>
                <h4 className="font-medium text-sm text-muted-foreground mb-2">Descrição</h4>
                <p className="text-foreground">{product.description}</p>
              </div>
            )}

            <Separator />

            {/* Custo e Estoque */}
            <div>
              <h4 className="font-medium text-sm text-muted-foreground mb-3 flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Custo e Estoque
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-3 rounded-lg border text-center">
                  <p className="text-xs text-muted-foreground">Custo</p>
                  <p className="text-lg font-semibold">{formatCurrency(product.cost_cents)}</p>
                </div>
                {profitMargin && (
                  <div className="p-3 rounded-lg border text-center bg-green-50 dark:bg-green-950">
                    <p className="text-xs text-muted-foreground">Margem</p>
                    <p className="text-lg font-semibold text-green-600">{profitMargin}%</p>
                  </div>
                )}
                {product.track_stock && (
                  <>
                    <div className="p-3 rounded-lg border text-center">
                      <p className="text-xs text-muted-foreground">Estoque Físico</p>
                      <p className="text-lg font-semibold">{product.stock_quantity}</p>
                    </div>
                    <div className="p-3 rounded-lg border text-center bg-amber-50 dark:bg-amber-950">
                      <p className="text-xs text-muted-foreground">Reservado</p>
                      <p className="text-lg font-semibold text-amber-600">{product.stock_reserved || 0}</p>
                    </div>
                    <div className={`p-3 rounded-lg border text-center ${isLowStock ? 'bg-destructive/10' : 'bg-blue-50 dark:bg-blue-950'}`}>
                      <p className="text-xs text-muted-foreground">Disponível</p>
                      <p className={`text-lg font-semibold ${isLowStock ? 'text-destructive' : 'text-blue-600'}`}>
                        {availableStock}
                      </p>
                    </div>
                    <div className="p-3 rounded-lg border text-center">
                      <p className="text-xs text-muted-foreground">Mínimo</p>
                      <p className="text-lg font-semibold">{product.minimum_stock}</p>
                    </div>
                  </>
                )}
                {!product.track_stock && (
                  <div className="p-3 rounded-lg border text-center col-span-2">
                    <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                      <Package className="h-3 w-3" />
                      Controle de Estoque
                    </p>
                    <p className="text-sm text-muted-foreground">Desativado</p>
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* Tabela de Preços */}
            <div>
              <h4 className="font-medium text-sm text-muted-foreground mb-3">Tabela de Preços</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-3 rounded-lg bg-muted/50 text-center">
                  <p className="text-xs text-muted-foreground">1 Unidade</p>
                  <p className="text-lg font-semibold">{formatCurrency(product.price_1_unit)}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50 text-center">
                  <p className="text-xs text-muted-foreground">3 Unidades</p>
                  <p className="text-lg font-semibold">{formatCurrency(product.price_3_units)}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50 text-center">
                  <p className="text-xs text-muted-foreground">6 Unidades</p>
                  <p className="text-lg font-semibold">{formatCurrency(product.price_6_units)}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50 text-center">
                  <p className="text-xs text-muted-foreground">12 Unidades</p>
                  <p className="text-lg font-semibold">{formatCurrency(product.price_12_units)}</p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Configurações ERP */}
            <div>
              <h4 className="font-medium text-sm text-muted-foreground mb-3">Configurações ERP</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 rounded-lg border">
                  <p className="text-xs text-muted-foreground">Valor Mínimo</p>
                  <p className="text-lg font-semibold">{formatCurrency(product.minimum_price)}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Vendas abaixo precisam de autorização
                  </p>
                </div>
                <div className="p-3 rounded-lg border">
                  <p className="text-xs text-muted-foreground">Período de Uso</p>
                  <p className="text-lg font-semibold">{product.usage_period_days} dias</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Para alertas de reposição
                  </p>
                </div>
              </div>
            </div>

            {/* Script de Vendas */}
            {product.sales_script && (
              <>
                <Separator />
                <div>
                  <h4 className="font-medium text-sm text-muted-foreground mb-2">Script de Vendas</h4>
                  <div className="p-4 rounded-lg bg-muted/50 whitespace-pre-wrap text-sm">
                    {product.sales_script}
                  </div>
                </div>
              </>
            )}

            {/* Perguntas Personalizadas */}
            {(product.key_question_1 || product.key_question_2 || product.key_question_3) && (
              <>
                <Separator />
                <div>
                  <h4 className="font-medium text-sm text-muted-foreground mb-3">Perguntas Personalizadas</h4>
                  <div className="space-y-3">
                    {product.key_question_1 && (
                      <div className="p-3 rounded-lg border-l-4 border-primary bg-muted/30">
                        <p className="text-xs text-muted-foreground mb-1">Pergunta 1</p>
                        <p>{product.key_question_1}</p>
                      </div>
                    )}
                    {product.key_question_2 && (
                      <div className="p-3 rounded-lg border-l-4 border-primary bg-muted/30">
                        <p className="text-xs text-muted-foreground mb-1">Pergunta 2</p>
                        <p>{product.key_question_2}</p>
                      </div>
                    )}
                    {product.key_question_3 && (
                      <div className="p-3 rounded-lg border-l-4 border-primary bg-muted/30">
                        <p className="text-xs text-muted-foreground mb-1">Pergunta 3</p>
                        <p>{product.key_question_3}</p>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
