import { Link } from 'react-router-dom';
import { Package, ShoppingCart, Plus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

interface RecommendedProduct {
  id: string;
  name: string;
  ecommerce_title: string | null;
  image_url: string | null;
  ecommerce_images: string[];
  base_price_cents: number | null;
  price_1_unit: number;
  storefrontProductId: string;
  customPriceCents: number | null;
}

interface ProductRecommendationsProps {
  products: RecommendedProduct[];
  storefrontSlug: string;
  primaryColor: string;
  title?: string;
  subtitle?: string;
  variant?: 'product-page' | 'cart';
  onQuickAdd?: (product: RecommendedProduct) => void;
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

export function ProductRecommendations({
  products,
  storefrontSlug,
  primaryColor,
  title = 'Você também pode gostar',
  subtitle,
  variant = 'product-page',
  onQuickAdd,
}: ProductRecommendationsProps) {
  if (products.length === 0) return null;

  return (
    <section className="py-8">
      <div className="mb-6">
        <h2 className="text-xl font-bold">{title}</h2>
        {subtitle && (
          <p className="text-muted-foreground text-sm mt-1">{subtitle}</p>
        )}
      </div>

      {variant === 'cart' ? (
        // Horizontal scroll for cart
        <ScrollArea className="w-full">
          <div className="flex gap-4 pb-4">
            {products.map((product) => (
              <RecommendationCard
                key={product.id}
                product={product}
                storefrontSlug={storefrontSlug}
                primaryColor={primaryColor}
                compact
                onQuickAdd={onQuickAdd}
              />
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      ) : (
        // Grid for product page
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {products.map((product) => (
            <RecommendationCard
              key={product.id}
              product={product}
              storefrontSlug={storefrontSlug}
              primaryColor={primaryColor}
              onQuickAdd={onQuickAdd}
            />
          ))}
        </div>
      )}
    </section>
  );
}

interface RecommendationCardProps {
  product: RecommendedProduct;
  storefrontSlug: string;
  primaryColor: string;
  compact?: boolean;
  onQuickAdd?: (product: RecommendedProduct) => void;
}

function RecommendationCard({
  product,
  storefrontSlug,
  primaryColor,
  compact,
  onQuickAdd,
}: RecommendationCardProps) {
  const displayName = product.ecommerce_title || product.name;
  const displayImage = product.ecommerce_images?.[0] || product.image_url;
  const price = product.customPriceCents || product.price_1_unit || product.base_price_cents || 0;

  return (
    <Card 
      className={`group overflow-hidden transition-all hover:shadow-lg ${compact ? 'min-w-[200px] max-w-[200px]' : ''}`}
    >
      <Link to={`/loja/${storefrontSlug}/produto/${product.id}`}>
        <div className={`relative ${compact ? 'aspect-square' : 'aspect-[4/3]'} bg-muted overflow-hidden`}>
          {displayImage ? (
            <img 
              src={displayImage} 
              alt={displayName}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Package className="h-10 w-10 text-muted-foreground/30" />
            </div>
          )}
        </div>
      </Link>

      <CardContent className="p-3">
        <Link to={`/loja/${storefrontSlug}/produto/${product.id}`}>
          <h3 className="font-medium text-sm line-clamp-2 hover:underline mb-2">
            {displayName}
          </h3>
        </Link>
        
        <div className="flex items-center justify-between gap-2">
          <span 
            className="font-bold text-base"
            style={{ color: primaryColor }}
          >
            {formatCurrency(price)}
          </span>

          {onQuickAdd && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 w-8 p-0 rounded-full"
              style={{ borderColor: primaryColor, color: primaryColor }}
              onClick={(e) => {
                e.preventDefault();
                onQuickAdd(product);
              }}
            >
              <Plus className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
