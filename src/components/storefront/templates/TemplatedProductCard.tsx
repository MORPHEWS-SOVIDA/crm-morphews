import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Star, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  getTemplateStyles, 
  formatCurrency, 
  getProductPrice, 
  getDiscountPercentage,
  type TemplateStyleKey 
} from './templateUtils';
import { calculateInstallmentWithInterest } from '@/hooks/ecommerce/useTenantInstallmentFees';
import type { PublicProduct } from '@/hooks/ecommerce/usePublicStorefront';

interface InstallmentConfig {
  installment_fees: Record<string, number>;
  installment_fee_passed_to_buyer: boolean;
  max_installments: number;
}

interface TemplatedProductCardProps {
  product: PublicProduct;
  storefrontSlug: string;
  customPriceCents: number | null;
  isFeatured?: boolean;
  templateSlug?: string | null;
  primaryColor?: string;
  showQuickAdd?: boolean;
  onQuickAdd?: () => void;
  installmentConfig?: InstallmentConfig;
  reviewCount?: number;
}

export function TemplatedProductCard({
  product,
  storefrontSlug,
  customPriceCents,
  isFeatured,
  templateSlug,
  primaryColor,
  showQuickAdd,
  onQuickAdd,
  installmentConfig,
  reviewCount,
}: TemplatedProductCardProps) {
  const styles = getTemplateStyles(templateSlug);
  const displayName = product.ecommerce_title || product.name;
  const displayImage = product.ecommerce_images?.[0] || product.image_url;
  const price = getProductPrice(customPriceCents, product);
  const originalPrice = product.price_1_unit || product.base_price_cents || 0;
  const discount = getDiscountPercentage(originalPrice, price);

  // Calculate 12x installment with real interest rates
  const maxInstallments = installmentConfig?.max_installments || 12;
  const installmentInfo = calculateInstallmentWithInterest(
    price,
    maxInstallments,
    installmentConfig?.installment_fees,
    installmentConfig?.installment_fee_passed_to_buyer ?? true
  );

  return (
    <Link to={`/loja/${storefrontSlug}/produto/${product.id}`}>
      <Card className={styles.card}>
        {/* Image Container */}
        <div className={`${styles.cardImage} relative`}>
          {displayImage ? (
            <img 
              src={displayImage} 
              alt={displayName}
              className={`w-full h-full object-cover ${styles.cardImageHover}`}
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-muted">
              <ShoppingCart className="h-12 w-12 text-muted-foreground/30" />
            </div>
          )}
          
          {/* Badges */}
          <div className="absolute top-3 left-3 flex flex-col gap-2">
            {isFeatured && (
              <Badge className={styles.cardBadge}>
                Destaque
              </Badge>
            )}
            {discount > 0 && (
              <Badge className="bg-red-500 text-white text-xs px-2 py-1">
                -{discount}%
              </Badge>
            )}
          </div>

          {/* Quick Add Button (for some templates) */}
          {showQuickAdd && onQuickAdd && (
            <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                size="sm"
                className={styles.button}
                onClick={(e) => {
                  e.preventDefault();
                  onQuickAdd();
                }}
              >
                <ShoppingCart className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-4 space-y-2">
          <h3 className={`${styles.cardTitle} line-clamp-2`}>
            {displayName}
          </h3>
          
          {/* Rating */}
          <div className="flex items-center gap-1">
            {[...Array(5)].map((_, i) => (
              <Star 
                key={i} 
                className="h-3 w-3 fill-yellow-400 text-yellow-400" 
              />
            ))}
            <span className="text-xs text-muted-foreground ml-1">({reviewCount ?? product.review_count ?? 0})</span>
          </div>

          {/* Price Display - Emphasis on installment value */}
          {price > 0 && (
            <div className="space-y-1">
              {/* Installment - Main highlight */}
              <div className="flex items-baseline gap-1">
                <span className="text-sm text-muted-foreground">{maxInstallments}x</span>
                <span 
                  className="text-xl font-bold"
                  style={{ color: primaryColor }}
                >
                  {formatCurrency(installmentInfo.installmentValue)}
                </span>
              </div>
              
              {/* Cash price - secondary */}
              <p className="text-sm text-muted-foreground">
                ou {formatCurrency(price)} à vista
              </p>
            </div>
          )}
        </div>
      </Card>
    </Link>
  );
}
