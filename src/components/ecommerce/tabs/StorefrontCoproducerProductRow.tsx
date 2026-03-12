import { useState } from 'react';
import { DollarSign, Loader2, Package, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useUpdateCoproducerCommission } from '@/hooks/useCoproducers';

export interface StorefrontCoproducerProduct {
  coproducerId: string;
  productId: string;
  productName: string;
  productImage: string | null;
  commissionType: string;
  commissionPercentage: number;
  fixed1: number;
  fixed3: number;
  fixed5: number;
}

interface StorefrontCoproducerProductRowProps {
  product: StorefrontCoproducerProduct;
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

function parseCurrency(value: string): number {
  const cleaned = value.replace(/[^\d,.-]/g, '').replace(',', '.');
  return Math.round(parseFloat(cleaned || '0') * 100);
}

function formatCentsToInput(cents: number): string {
  if (!cents) return '';
  return (cents / 100).toFixed(2).replace('.', ',');
}

export function StorefrontCoproducerProductRow({ product }: StorefrontCoproducerProductRowProps) {
  const updateCommission = useUpdateCoproducerCommission();

  const [isEditing, setIsEditing] = useState(false);
  const [fixed1, setFixed1] = useState(formatCentsToInput(product.fixed1));
  const [fixed3, setFixed3] = useState(formatCentsToInput(product.fixed3));
  const [fixed5, setFixed5] = useState(formatCentsToInput(product.fixed5));

  const showEmpty = product.fixed1 === 0 && product.fixed3 === 0 && product.fixed5 === 0;

  const handleCancel = () => {
    setFixed1(formatCentsToInput(product.fixed1));
    setFixed3(formatCentsToInput(product.fixed3));
    setFixed5(formatCentsToInput(product.fixed5));
    setIsEditing(false);
  };

  const handleSave = () => {
    updateCommission.mutate(
      {
        id: product.coproducerId,
        commission_fixed_1_cents: parseCurrency(fixed1),
        commission_fixed_3_cents: parseCurrency(fixed3),
        commission_fixed_5_cents: parseCurrency(fixed5),
      },
      {
        onSuccess: () => setIsEditing(false),
      }
    );
  };

  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <div className="flex items-start gap-3">
        {product.productImage ? (
          <img
            src={product.productImage}
            alt={product.productName}
            className="h-12 w-12 rounded-md object-cover flex-shrink-0"
            loading="lazy"
          />
        ) : (
          <div className="h-12 w-12 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
            <Package className="h-5 w-5 text-muted-foreground" />
          </div>
        )}

        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <p className="font-medium text-sm truncate">{product.productName}</p>

            {product.commissionType === 'fixed_per_quantity' && !isEditing && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 px-2 text-xs"
                onClick={() => setIsEditing(true)}
              >
                <Pencil className="h-3 w-3 mr-1" />
                Editar
              </Button>
            )}
          </div>

          {product.commissionType === 'fixed_per_quantity' ? (
            isEditing ? (
              <div className="space-y-2">
                <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                  <div className="space-y-1">
                    <Label className="text-xs">1 un</Label>
                    <Input
                      value={fixed1}
                      onChange={(e) => setFixed1(e.target.value)}
                      className="h-8 text-xs"
                      placeholder="0,00"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">3 un</Label>
                    <Input
                      value={fixed3}
                      onChange={(e) => setFixed3(e.target.value)}
                      className="h-8 text-xs"
                      placeholder="0,00"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">5 un</Label>
                    <Input
                      value={fixed5}
                      onChange={(e) => setFixed5(e.target.value)}
                      className="h-8 text-xs"
                      placeholder="0,00"
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleSave}
                    disabled={updateCommission.isPending}
                  >
                    {updateCommission.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
                    Salvar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleCancel}
                    disabled={updateCommission.isPending}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {product.fixed1 > 0 && (
                  <Badge variant="outline" className="text-xs font-mono gap-1">
                    <DollarSign className="h-3 w-3" />
                    1 un → {formatCurrency(product.fixed1)}
                  </Badge>
                )}
                {product.fixed3 > 0 && (
                  <Badge variant="outline" className="text-xs font-mono gap-1">
                    <DollarSign className="h-3 w-3" />
                    3 un → {formatCurrency(product.fixed3)}
                  </Badge>
                )}
                {product.fixed5 > 0 && (
                  <Badge variant="outline" className="text-xs font-mono gap-1">
                    <DollarSign className="h-3 w-3" />
                    5 un → {formatCurrency(product.fixed5)}
                  </Badge>
                )}
                {showEmpty && (
                  <span className="text-xs text-muted-foreground italic">
                    Valores não configurados
                  </span>
                )}
              </div>
            )
          ) : (
            <p className="text-xs text-muted-foreground">
              Comissão: <span className="font-bold">{product.commissionPercentage}%</span> sobre o valor líquido
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
