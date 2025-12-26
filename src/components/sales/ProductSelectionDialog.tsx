import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Package, Check, Minus, Plus, Percent, DollarSign } from 'lucide-react';
import { Product } from '@/hooks/useProducts';

interface ProductSelectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product | null;
  onConfirm: (selection: {
    product_id: string;
    product_name: string;
    quantity: number;
    unit_price_cents: number;
    discount_cents: number;
  }) => void;
}

type PriceOption = '1' | '3' | '6' | '12' | 'custom';

export function ProductSelectionDialog({
  open,
  onOpenChange,
  product,
  onConfirm,
}: ProductSelectionDialogProps) {
  const [selectedPriceOption, setSelectedPriceOption] = useState<PriceOption>('1');
  const [customQuantity, setCustomQuantity] = useState(1);
  const [customUnitPrice, setCustomUnitPrice] = useState(0);
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('fixed');
  const [discountValue, setDiscountValue] = useState(0);

  if (!product) return null;

  const getPriceForOption = (option: PriceOption): number => {
    switch (option) {
      case '1': return product.price_1_unit;
      case '3': return product.price_3_units;
      case '6': return product.price_6_units;
      case '12': return product.price_12_units;
      case 'custom': return customUnitPrice;
      default: return product.price_1_unit;
    }
  };

  const getQuantityForOption = (option: PriceOption): number => {
    switch (option) {
      case '1': return 1;
      case '3': return 3;
      case '6': return 6;
      case '12': return 12;
      case 'custom': return customQuantity;
      default: return 1;
    }
  };

  const unitPrice = getPriceForOption(selectedPriceOption);
  const quantity = getQuantityForOption(selectedPriceOption);
  const subtotal = unitPrice * quantity;
  
  let discountCents = 0;
  if (discountType === 'percentage' && discountValue > 0) {
    discountCents = Math.round(subtotal * (discountValue / 100));
  } else if (discountType === 'fixed') {
    discountCents = discountValue;
  }
  
  const total = subtotal - discountCents;
  const isValidPrice = unitPrice >= product.minimum_price || product.minimum_price === 0;

  const formatPrice = (cents: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(cents / 100);
  };

  const handleConfirm = () => {
    onConfirm({
      product_id: product.id,
      product_name: product.name,
      quantity,
      unit_price_cents: unitPrice,
      discount_cents: discountCents,
    });
    onOpenChange(false);
    // Reset state
    setSelectedPriceOption('1');
    setCustomQuantity(1);
    setCustomUnitPrice(0);
    setDiscountValue(0);
  };

  const priceOptions = [
    { key: '1' as PriceOption, label: '1 un', price: product.price_1_unit },
    { key: '3' as PriceOption, label: '3 un', price: product.price_3_units },
    { key: '6' as PriceOption, label: '6 un', price: product.price_6_units },
    { key: '12' as PriceOption, label: '12 un', price: product.price_12_units },
  ].filter(opt => opt.price > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            {product.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Product Info */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Informações do Produto
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {product.description && (
                <p className="text-sm">{product.description}</p>
              )}
              
              {product.sales_script && (
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Script de Vendas:</p>
                  <p className="text-sm whitespace-pre-wrap">{product.sales_script}</p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {product.key_question_1 && (
                  <div className="p-2 bg-primary/5 rounded border border-primary/10">
                    <p className="text-xs font-medium text-primary">Pergunta 1:</p>
                    <p className="text-sm">{product.key_question_1}</p>
                  </div>
                )}
                {product.key_question_2 && (
                  <div className="p-2 bg-primary/5 rounded border border-primary/10">
                    <p className="text-xs font-medium text-primary">Pergunta 2:</p>
                    <p className="text-sm">{product.key_question_2}</p>
                  </div>
                )}
                {product.key_question_3 && (
                  <div className="p-2 bg-primary/5 rounded border border-primary/10">
                    <p className="text-xs font-medium text-primary">Pergunta 3:</p>
                    <p className="text-sm">{product.key_question_3}</p>
                  </div>
                )}
              </div>

              {product.usage_period_days > 0 && (
                <Badge variant="secondary">
                  Período de uso: {product.usage_period_days} dias
                </Badge>
              )}

              {product.minimum_price > 0 && (
                <Badge variant="outline" className="text-orange-600">
                  Preço mínimo: {formatPrice(product.minimum_price)}
                </Badge>
              )}
            </CardContent>
          </Card>

          {/* Price Selection */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Selecione a Quantidade
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs value={selectedPriceOption} onValueChange={(v) => setSelectedPriceOption(v as PriceOption)}>
                <TabsList className="w-full grid grid-cols-5 mb-4">
                  {priceOptions.map(opt => (
                    <TabsTrigger key={opt.key} value={opt.key} className="text-xs">
                      {opt.label}
                    </TabsTrigger>
                  ))}
                  <TabsTrigger value="custom" className="text-xs">
                    Outro
                  </TabsTrigger>
                </TabsList>

                {priceOptions.map(opt => (
                  <TabsContent key={opt.key} value={opt.key} className="mt-0">
                    <div className="text-center py-4">
                      <p className="text-3xl font-bold text-primary">
                        {formatPrice(opt.price)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        por unidade ({parseInt(opt.key)} {parseInt(opt.key) === 1 ? 'unidade' : 'unidades'})
                      </p>
                    </div>
                  </TabsContent>
                ))}

                <TabsContent value="custom" className="mt-0">
                  <div className="grid grid-cols-2 gap-4 py-4">
                    <div>
                      <Label>Quantidade</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => setCustomQuantity(Math.max(1, customQuantity - 1))}
                        >
                          <Minus className="w-4 h-4" />
                        </Button>
                        <Input
                          type="number"
                          min={1}
                          value={customQuantity}
                          onChange={(e) => setCustomQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                          className="text-center"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => setCustomQuantity(customQuantity + 1)}
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    <div>
                      <Label>Preço Unitário</Label>
                      <CurrencyInput
                        value={customUnitPrice}
                        onChange={setCustomUnitPrice}
                        className="mt-1"
                      />
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Discount */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Desconto no Produto
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="flex gap-2 mb-2">
                    <Button
                      type="button"
                      variant={discountType === 'fixed' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setDiscountType('fixed')}
                    >
                      <DollarSign className="w-4 h-4 mr-1" />
                      R$
                    </Button>
                    <Button
                      type="button"
                      variant={discountType === 'percentage' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setDiscountType('percentage')}
                    >
                      <Percent className="w-4 h-4 mr-1" />
                      %
                    </Button>
                  </div>
                  {discountType === 'fixed' ? (
                    <CurrencyInput
                      value={discountValue}
                      onChange={setDiscountValue}
                      placeholder="Valor do desconto"
                    />
                  ) : (
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={discountValue}
                      onChange={(e) => setDiscountValue(Math.min(100, parseInt(e.target.value) || 0))}
                      placeholder="% de desconto"
                    />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Summary */}
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="pt-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Subtotal ({quantity} x {formatPrice(unitPrice)})</span>
                  <span>{formatPrice(subtotal)}</span>
                </div>
                {discountCents > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Desconto</span>
                    <span>- {formatPrice(discountCents)}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold border-t pt-2">
                  <span>Total</span>
                  <span className="text-primary">{formatPrice(total)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {!isValidPrice && product.minimum_price > 0 && (
            <p className="text-sm text-destructive text-center">
              ⚠️ O preço unitário está abaixo do mínimo permitido ({formatPrice(product.minimum_price)})
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleConfirm} disabled={!isValidPrice || total <= 0}>
              <Check className="w-4 h-4 mr-2" />
              Adicionar à Venda
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
