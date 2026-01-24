import { useParams, useOutletContext, Link } from 'react-router-dom';
import { ShoppingCart, Package, Check, ArrowLeft, ArrowUpRight, Plus, Minus } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { usePublicProduct, type StorefrontData, type PublicProduct } from '@/hooks/ecommerce/usePublicStorefront';
import { useCart } from './cart/CartContext';
import type { StorefrontProduct } from '@/hooks/ecommerce';

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

function KitOption({ 
  size, 
  price, 
  originalPrice,
  selected, 
  onSelect,
  primaryColor,
  showUpsell,
}: { 
  size: 1 | 3 | 6 | 12;
  price: number;
  originalPrice?: number;
  selected: boolean;
  onSelect: () => void;
  primaryColor: string;
  showUpsell?: boolean;
}) {
  const unitPrice = price / size;
  const savings = originalPrice ? ((1 - price / originalPrice) * 100).toFixed(0) : null;

  return (
    <div
      className={`relative border-2 rounded-lg p-4 cursor-pointer transition-all ${
        selected 
          ? 'border-primary bg-primary/5' 
          : 'border-muted hover:border-muted-foreground/30'
      }`}
      style={selected ? { borderColor: primaryColor } : undefined}
      onClick={onSelect}
    >
      {savings && parseInt(savings) >= 10 && (
        <Badge 
          className="absolute -top-2 -right-2 text-xs"
          style={{ backgroundColor: primaryColor }}
        >
          -{savings}%
        </Badge>
      )}
      {showUpsell && (
        <Badge 
          variant="outline"
          className="absolute -top-2 left-2 text-xs border-amber-500 text-amber-600 bg-amber-50"
        >
          <ArrowUpRight className="h-3 w-3 mr-1" />
          Mais vendido
        </Badge>
      )}
      
      <div className="flex items-center gap-3">
        <div 
          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
            selected ? 'border-primary' : 'border-muted-foreground/30'
          }`}
          style={selected ? { borderColor: primaryColor, backgroundColor: primaryColor } : undefined}
        >
          {selected && <Check className="h-3 w-3 text-white" />}
        </div>
        
        <div className="flex-1">
          <div className="flex items-baseline gap-2">
            <span className="font-semibold">{size} {size === 1 ? 'frasco' : 'frascos'}</span>
            <span className="text-lg font-bold" style={{ color: primaryColor }}>
              {formatCurrency(price)}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            {formatCurrency(unitPrice)} por unidade
          </p>
        </div>
      </div>
    </div>
  );
}

export function StorefrontProductPage() {
  const { slug, productId } = useParams<{ slug: string; productId: string }>();
  const { storefront } = useOutletContext<{ storefront: StorefrontData }>();
  const { data: storefrontProduct, isLoading, error } = usePublicProduct(slug, productId);
  const { addItem } = useCart();
  
  const [selectedKit, setSelectedKit] = useState<1 | 3 | 6 | 12>(1);
  const [quantity, setQuantity] = useState(1);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="animate-pulse">
          <div className="grid gap-8 lg:grid-cols-2">
            <div className="aspect-square bg-muted rounded-lg" />
            <div className="space-y-4">
              <div className="h-8 bg-muted rounded w-3/4" />
              <div className="h-4 bg-muted rounded w-1/2" />
              <div className="h-32 bg-muted rounded" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !storefrontProduct) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <Package className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
        <h1 className="text-2xl font-bold mb-2">Produto não encontrado</h1>
        <Link to={`/loja/${slug}`}>
          <Button variant="outline" className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar para a loja
          </Button>
        </Link>
      </div>
    );
  }

  const product = storefrontProduct.product;
  const displayName = product.ecommerce_title || product.name;
  const displayDescription = product.ecommerce_description || product.description;
  const images = product.ecommerce_images?.length > 0 
    ? product.ecommerce_images 
    : product.image_url ? [product.image_url] : [];
  const benefits = product.ecommerce_benefits || [];

  const basePrice = storefrontProduct.custom_price_cents || product.price_1_unit || product.base_price_cents || 0;
  
  const kitPrices = {
    1: basePrice,
    3: product.price_3_units || basePrice * 3,
    6: product.price_6_units || basePrice * 6,
    12: product.price_12_units || basePrice * 12,
  };

  const originalPrices = {
    1: basePrice,
    3: basePrice * 3,
    6: basePrice * 6,
    12: basePrice * 12,
  };

  const totalPrice = kitPrices[selectedKit] * quantity;

  const handleAddToCart = () => {
    if (!slug) return;
    
    addItem({
      productId: product.id,
      storefrontProductId: storefrontProduct.id,
      name: displayName,
      imageUrl: images[0] || null,
      quantity,
      kitSize: selectedKit,
      unitPrice: kitPrices[selectedKit] / selectedKit,
    }, slug);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Link to={`/loja/${slug}`} className="hover:text-foreground">Início</Link>
        <span>/</span>
        <span>{displayName}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Images */}
        <div className="space-y-4">
          <div className="aspect-square rounded-lg overflow-hidden bg-muted">
            {images.length > 0 ? (
              <img 
                src={images[currentImageIndex]} 
                alt={displayName}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Package className="h-24 w-24 text-muted-foreground" />
              </div>
            )}
          </div>
          
          {images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-2">
              {images.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentImageIndex(idx)}
                  className={`flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 ${
                    idx === currentImageIndex ? 'border-primary' : 'border-transparent'
                  }`}
                  style={idx === currentImageIndex ? { borderColor: storefront.primary_color } : undefined}
                >
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}

          {/* Video */}
          {product.ecommerce_video_url && (
            <Card>
              <CardContent className="p-4">
                <iframe
                  src={product.ecommerce_video_url}
                  className="w-full aspect-video rounded"
                  allowFullScreen
                />
              </CardContent>
            </Card>
          )}
        </div>

        {/* Product Info */}
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold mb-2">{displayName}</h1>
            {displayDescription && (
              <p className="text-muted-foreground">{displayDescription}</p>
            )}
          </div>

          {/* Benefits */}
          {benefits.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-semibold">Benefícios:</h3>
              <ul className="space-y-1">
                {benefits.map((benefit, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <Check className="h-5 w-5 flex-shrink-0" style={{ color: storefront.primary_color }} />
                    <span>{String(benefit)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <Separator />

          {/* Kit Selection - Upsell */}
          {storefrontProduct.show_kit_upsell !== false && (
            <div className="space-y-3">
              <h3 className="font-semibold">Escolha seu kit:</h3>
              <div className="space-y-2">
                {([1, 3, 6, 12] as const).map((size) => (
                  kitPrices[size] > 0 && (
                    <KitOption
                      key={size}
                      size={size}
                      price={kitPrices[size]}
                      originalPrice={size > 1 ? originalPrices[size] : undefined}
                      selected={selectedKit === size}
                      onSelect={() => setSelectedKit(size)}
                      primaryColor={storefront.primary_color}
                      showUpsell={size === 3}
                    />
                  )
                ))}
              </div>
            </div>
          )}

          {/* Quantity */}
          <div className="flex items-center gap-4">
            <span className="font-semibold">Quantidade:</span>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="icon"
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <span className="w-12 text-center font-semibold">{quantity}</span>
              <Button 
                variant="outline" 
                size="icon"
                onClick={() => setQuantity(quantity + 1)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <Separator />

          {/* Price & Add to Cart */}
          <div className="space-y-4">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold" style={{ color: storefront.primary_color }}>
                {formatCurrency(totalPrice)}
              </span>
              {selectedKit > 1 && (
                <span className="text-sm text-muted-foreground line-through">
                  {formatCurrency(originalPrices[selectedKit] * quantity)}
                </span>
              )}
            </div>

            <Button 
              size="lg" 
              className="w-full gap-2"
              style={{ backgroundColor: storefront.primary_color }}
              onClick={handleAddToCart}
            >
              <ShoppingCart className="h-5 w-5" />
              Adicionar ao Carrinho
            </Button>
          </div>
        </div>
      </div>

      {/* Cross-sell */}
      {storefrontProduct.show_crosssell !== false && (product.crosssell_product_1_id || product.crosssell_product_2_id) && (
        <div className="mt-12">
          <h2 className="text-2xl font-bold mb-6">Você também pode gostar</h2>
          {/* Cross-sell products would be fetched and displayed here */}
          <p className="text-muted-foreground">Produtos relacionados em breve...</p>
        </div>
      )}
    </div>
  );
}
