import { Link, useOutletContext } from 'react-router-dom';
import { ShoppingCart, Trash2, Plus, Minus, ArrowLeft, ArrowRight, Package, Truck, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useCart } from './cart/CartContext';
import type { StorefrontData } from '@/hooks/ecommerce/usePublicStorefront';

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

export function StorefrontCart() {
  const { storefront } = useOutletContext<{ storefront: StorefrontData }>();
  const { items, updateQuantity, removeItem, subtotal, clearCart } = useCart();

  const cartConfig = storefront.cart_config as {
    showCrosssell?: boolean;
    minOrderValue?: number;
    freeShippingThreshold?: number;
  } || {};

  const checkoutConfig = storefront.checkout_config as {
    style?: 'page' | 'modal';
  } || {};

  const minOrderValue = cartConfig.minOrderValue || 0;
  const freeShippingThreshold = cartConfig.freeShippingThreshold || 0;
  const remainingForFreeShipping = freeShippingThreshold > 0 
    ? Math.max(0, freeShippingThreshold - subtotal)
    : 0;
  const canCheckout = subtotal >= minOrderValue;

  if (items.length === 0) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-md mx-auto text-center">
          <ShoppingCart className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h1 className="text-2xl font-bold mb-2">Seu carrinho está vazio</h1>
          <p className="text-muted-foreground mb-6">
            Adicione produtos para começar suas compras.
          </p>
          <Link to={`/loja/${storefront.slug}`}>
            <Button style={{ backgroundColor: storefront.primary_color }}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Continuar Comprando
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Meu Carrinho</h1>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Cart Items */}
        <div className="lg:col-span-2 space-y-4">
          {/* Free Shipping Progress */}
          {freeShippingThreshold > 0 && (
            <Card className="border-dashed">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Truck className="h-5 w-5" style={{ color: storefront.primary_color }} />
                  {remainingForFreeShipping > 0 ? (
                    <p className="text-sm">
                      Faltam <strong>{formatCurrency(remainingForFreeShipping)}</strong> para frete grátis!
                    </p>
                  ) : (
                    <p className="text-sm font-medium" style={{ color: storefront.primary_color }}>
                      Você ganhou frete grátis! 🎉
                    </p>
                  )}
                </div>
                <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full rounded-full transition-all"
                    style={{ 
                      width: `${Math.min(100, (subtotal / freeShippingThreshold) * 100)}%`,
                      backgroundColor: storefront.primary_color,
                    }}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Items */}
          {items.map((item) => (
            <Card key={`${item.productId}-${item.kitSize}`}>
              <CardContent className="p-4">
                <div className="flex gap-4">
                  {/* Image */}
                  <div className="w-24 h-24 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                    {item.imageUrl ? (
                      <img 
                        src={item.imageUrl} 
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-semibold line-clamp-1">{item.name}</h3>
                        <Badge variant="outline" className="mt-1">
                          Kit com {item.kitSize} {item.kitSize === 1 ? 'frasco' : 'frascos'}
                        </Badge>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeItem(item.productId, item.kitSize)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>

                    <div className="flex items-center justify-between mt-4">
                      {/* Quantity */}
                      <div className="flex items-center gap-2">
                        <Button 
                          variant="outline" 
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => updateQuantity(item.productId, item.kitSize, item.quantity - 1)}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-8 text-center font-medium">{item.quantity}</span>
                        <Button 
                          variant="outline" 
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => updateQuantity(item.productId, item.kitSize, item.quantity + 1)}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>

                      {/* Price */}
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">
                          {formatCurrency(item.unitPrice)} × {item.quantity * item.kitSize}
                        </p>
                        <p className="font-bold" style={{ color: storefront.primary_color }}>
                          {formatCurrency(item.totalPrice)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Actions */}
          <div className="flex items-center justify-between">
            <Link to={`/loja/${storefront.slug}`}>
              <Button variant="outline">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Continuar Comprando
              </Button>
            </Link>
            <Button variant="ghost" onClick={clearCart}>
              Limpar Carrinho
            </Button>
          </div>
        </div>

        {/* Order Summary */}
        <div>
          <Card className="sticky top-24">
            <CardHeader>
              <CardTitle>Resumo do Pedido</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-muted-foreground">Frete</span>
                <span className="text-muted-foreground">
                  {remainingForFreeShipping === 0 && freeShippingThreshold > 0 
                    ? 'Grátis' 
                    : 'Calcular no checkout'
                  }
                </span>
              </div>

              <Separator />

              <div className="flex justify-between text-lg font-bold">
                <span>Total</span>
                <span style={{ color: storefront.primary_color }}>
                  {formatCurrency(subtotal)}
                </span>
              </div>

              {/* Min order warning */}
              {!canCheckout && minOrderValue > 0 && (
                <p className="text-sm text-amber-600 bg-amber-50 p-3 rounded-lg">
                  Pedido mínimo de {formatCurrency(minOrderValue)}. 
                  Faltam {formatCurrency(minOrderValue - subtotal)}.
                </p>
              )}

              <Link 
                to={canCheckout ? `/loja/${storefront.slug}/checkout` : '#'}
                className={!canCheckout ? 'pointer-events-none' : ''}
              >
                <Button 
                  size="lg" 
                  className="w-full gap-2"
                  style={{ backgroundColor: storefront.primary_color }}
                  disabled={!canCheckout}
                >
                  <CreditCard className="h-5 w-5" />
                  Finalizar Compra
                  <ArrowRight className="h-5 w-5" />
                </Button>
              </Link>

              {/* Payment methods */}
              <div className="pt-4 border-t">
                <p className="text-xs text-muted-foreground mb-2">Formas de pagamento:</p>
                <div className="flex flex-wrap gap-1">
                  {(storefront.payment_methods_display || ['pix', 'credit_card', 'boleto']).map(m => (
                    <Badge key={m} variant="outline" className="text-xs">
                      {m === 'pix' && 'PIX'}
                      {m === 'credit_card' && 'Cartão'}
                      {m === 'boleto' && 'Boleto'}
                      {m === 'debit_card' && 'Débito'}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
