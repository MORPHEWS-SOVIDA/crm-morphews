import { useEffect } from 'react';
import { Link, useOutletContext, useSearchParams, useNavigate } from 'react-router-dom';
import { ShoppingCart, Trash2, Plus, Minus, ArrowLeft, ArrowRight, Package, Truck, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useCart } from './cart/CartContext';
import { useCartRecommendations } from '@/hooks/ecommerce/useCrosssellProducts';
import { ProductRecommendations } from './ProductRecommendations';
import { useTenantInstallmentFees, calculateInstallmentWithInterest } from '@/hooks/ecommerce/useTenantInstallmentFees';
import type { StorefrontData } from '@/hooks/ecommerce/usePublicStorefront';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

// Resolve product prices and details from DB when external cart items have price 0
// Supports both regular products (product_id) and combos (combo_id)
async function resolveProductDetails(
  productId: string,
  storefrontId: string,
  quantity?: number
): Promise<{ name: string; imageUrl: string | null; unitPrice: number; isCombo?: boolean } | null> {
  try {
    // Try regular product first
    const { data } = await supabase
      .from('storefront_products')
      .select(`
        custom_price_cents,
        product:lead_products(
          name, ecommerce_title, image_url, ecommerce_images,
          price_1_unit, price_3_units, price_6_units, base_price_cents
        )
      `)
      .eq('storefront_id', storefrontId)
      .eq('product_id', productId)
      .eq('is_visible', true)
      .single();

    if (data?.product) {
      const p = data.product as any;
      // Use tiered pricing based on quantity
      let price = data.custom_price_cents || p.price_1_unit || p.base_price_cents || 0;
      if (quantity && quantity >= 5 && p.price_6_units) {
        price = Math.round(p.price_6_units / quantity); // price_6_units is total, we need per-unit
      } else if (quantity && quantity >= 3 && p.price_3_units) {
        price = Math.round(p.price_3_units / quantity);
      }
      const name = p.ecommerce_title || p.name || 'Produto';
      const imageUrl = p.ecommerce_images?.[0] || p.image_url || null;
      return { name, imageUrl, unitPrice: price };
    }

    // Try as combo
    const { data: comboData } = await supabase
      .from('storefront_products')
      .select(`
        custom_price_cents,
        combo:product_combos(name, image_url)
      `)
      .eq('storefront_id', storefrontId)
      .eq('combo_id', productId)
      .eq('is_visible', true)
      .single();

    if (comboData?.combo) {
      const c = comboData.combo as any;
      // Get combo price from product_combo_prices based on quantity (multiplier)
      let price = comboData.custom_price_cents || 0;
      if (!price) {
        const multiplier = quantity || 1;
        const { data: comboPrice } = await supabase
          .from('product_combo_prices')
          .select('regular_price_cents')
          .eq('combo_id', productId)
          .eq('multiplier', multiplier)
          .single();
        price = comboPrice?.regular_price_cents || 0;
      }
      const name = c.name || 'Kit';
      const imageUrl = c.image_url || null;
      return { name, imageUrl, unitPrice: price, isCombo: true };
    }

    return null;
  } catch {
    return null;
  }
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

function formatCurrencyParts(cents: number): { main: string; decimals: string } {
  const formatted = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
  
  const match = formatted.match(/^(R\$\s*\d+(?:\.\d{3})*)(,\d{2})$/);
  if (match) {
    return { main: match[1], decimals: match[2] };
  }
  return { main: formatted, decimals: '' };
}

export function StorefrontCart() {
  const { storefront } = useOutletContext<{ storefront: StorefrontData }>();
  const { items, updateQuantity, removeItem, subtotal, clearCart, storefrontSlug, storefrontId, addItem } = useCart();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Decode ?cart= base64 param AND/OR simple query params (from external sites)
  useEffect(() => {
    const cartParam = searchParams.get('cart');
    // Simple query params for customer data (name, email, phone, cpf)
    const qpName = searchParams.get('name');
    const qpEmail = searchParams.get('email');
    const qpPhone = searchParams.get('phone') || searchParams.get('whatsapp');
    const qpCpf = searchParams.get('cpf');

    if (!cartParam && !qpName) return;

    try {
      let customerData: Record<string, string> = {};
      
      // Read customer from simple query params (higher priority, easier for external sites)
      if (qpName || qpEmail || qpPhone) {
        customerData = {
          name: qpName || '',
          email: qpEmail || '',
          phone: qpPhone || '',
          cpf: qpCpf || '',
        };
      }

      if (cartParam) {
        const decoded = JSON.parse(decodeURIComponent(atob(cartParam)));
        console.log('[Cart] 📦 Received external cart data:', JSON.stringify(decoded, null, 2));
        console.log('[Cart] Items count:', decoded.items?.length || 0);
        console.log('[Cart] Customer:', decoded.customer?.name, decoded.customer?.email);

        // Merge customer from base64 (lower priority than query params)
        if (decoded.customer) {
          customerData = {
            name: customerData.name || decoded.customer.name || '',
            email: customerData.email || decoded.customer.email || '',
            phone: customerData.phone || decoded.customer.whatsapp || decoded.customer.phone || '',
            cpf: customerData.cpf || decoded.customer.cpf || '',
          };
        }

        // Restore cart items (support both full and compact key formats)
        // Resolve prices from DB when external items don't include pricing
        const cartItems = decoded.items || [];
        const resolveAndAddItems = async () => {
          for (const item of cartItems) {
            const productId = item.product_id || item.pid;
            const quantity = item.quantity || item.q;
            if (productId && quantity) {
              let unitPrice = item.unit_price_cents || item.upc || item.price_cents || 0;
              let itemName = item.name || item.n || '';
              let imageUrl = item.image_url || item.img || null;

              // If price is 0 or name is missing, resolve from DB
              if (!unitPrice || !itemName || itemName === 'Produto') {
                const resolved = await resolveProductDetails(productId, storefront.id, quantity);
                if (resolved) {
                  unitPrice = unitPrice || resolved.unitPrice;
                  itemName = (!itemName || itemName === 'Produto') ? resolved.name : itemName;
                  imageUrl = imageUrl || resolved.imageUrl;
                }
              }

              addItem({
                productId,
                storefrontProductId: item.storefront_product_id || item.spid || productId,
                name: itemName || 'Produto',
                imageUrl,
                quantity,
                kitSize: item.kit_size || item.ks || 1,
                unitPrice,
              }, storefront.slug, storefront.id);
            }
          }
        };
        resolveAndAddItems();
      }

      // Save customer data for checkout to pick up
      if (customerData.name || customerData.email || customerData.phone) {
        localStorage.setItem('checkout_customer', JSON.stringify(customerData));
        console.log('[Cart] 👤 Customer data saved:', customerData);
      }

      // Clean URL
      const newUrl = new URL(window.location.href);
      ['cart', 'name', 'email', 'phone', 'whatsapp', 'cpf'].forEach(p => newUrl.searchParams.delete(p));
      window.history.replaceState({}, '', newUrl.pathname);

      // Auto-redirect to checkout if customer data is present
      if (customerData.name && customerData.email) {
        navigate(`/loja/${storefront.slug}/checkout`, { replace: true });
      }
    } catch (err) {
      console.error('[Cart] Error decoding cart param:', err);
    }
  }, [searchParams, storefront.slug, storefront.id, addItem, navigate]);

  const cartProductIds = items.map(item => item.productId);
  
  // Fetch recommendations based on cart items
  const { data: recommendations = [] } = useCartRecommendations(
    storefrontId || storefront.id,
    cartProductIds
  );

  // Fetch tenant installment fees
  const { data: installmentConfig } = useTenantInstallmentFees(storefront.organization_id);

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

  // Check if crosssell is enabled in cart settings
  const showCrosssell = cartConfig.showCrosssell !== false && recommendations.length > 0;

  // Calculate installment with interest for the total
  const maxInstallments = installmentConfig?.max_installments || 12;
  const installmentInfo = calculateInstallmentWithInterest(
    subtotal,
    maxInstallments,
    installmentConfig?.installment_fees,
    installmentConfig?.installment_fee_passed_to_buyer ?? true
  );
  const totalParts = formatCurrencyParts(installmentInfo.installmentValue);

  const handleQuickAddRecommendation = (product: any) => {
    const price = product.customPriceCents || product.price_1_unit || product.base_price_cents || 0;
    addItem({
      productId: product.id,
      storefrontProductId: product.storefrontProductId,
      name: product.ecommerce_title || product.name,
      imageUrl: product.ecommerce_images?.[0] || product.image_url || null,
      quantity: 1,
      kitSize: 1,
      unitPrice: price,
    }, storefront.slug, storefront.id);
    toast.success('Produto adicionado ao carrinho!');
  };

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

          {/* Cart Recommendations */}
          {showCrosssell && (
            <ProductRecommendations
              products={recommendations}
              storefrontSlug={storefront.slug}
              primaryColor={storefront.primary_color}
              title="Complete sua compra"
              subtitle="Produtos que combinam com seu pedido"
              variant="cart"
              onQuickAdd={handleQuickAddRecommendation}
            />
          )}
        </div>

        {/* Order Summary */}
        <div>
          <Card className="sticky top-24">
            <CardHeader>
              <CardTitle>Resumo do Pedido</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Subtotal and Frete hidden for cleaner UX - go straight to Total */}

              {/* Total with installment highlight */}
              <div className="flex items-center justify-between">
                <span className="text-lg font-bold">Total</span>
                <div className="text-right">
                  {/* Installment value - HIGHLIGHT */}
                  <div className="flex items-baseline justify-end gap-0.5">
                    <span className="text-sm text-muted-foreground">{maxInstallments}x</span>
                    <span 
                      className="text-2xl font-bold"
                      style={{ color: storefront.primary_color }}
                    >
                      {totalParts.main}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {totalParts.decimals}
                    </span>
                  </div>
                  {/* Cash price - secondary */}
                  <p className="text-sm text-muted-foreground">
                    ou {formatCurrency(subtotal)} à vista
                  </p>
                </div>
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
