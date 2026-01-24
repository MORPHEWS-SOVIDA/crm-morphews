import { useOutletContext, Link } from 'react-router-dom';
import { Package } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Star } from 'lucide-react';
import type { StorefrontData, PublicProduct } from '@/hooks/ecommerce/usePublicStorefront';
import type { StorefrontProduct } from '@/hooks/ecommerce';

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

function ProductCard({ 
  storefrontProduct, 
  storefrontSlug,
  primaryColor 
}: { 
  storefrontProduct: StorefrontProduct & { product: PublicProduct };
  storefrontSlug: string;
  primaryColor: string;
}) {
  const product = storefrontProduct.product;
  const displayName = product.ecommerce_title || product.name;
  const displayDescription = product.ecommerce_short_description || product.description;
  const displayImage = (product.ecommerce_images?.[0]) || product.image_url;
  const price = storefrontProduct.custom_price_cents || product.price_1_unit || product.base_price_cents || 0;

  return (
    <Link to={`/loja/${storefrontSlug}/produto/${product.id}`}>
      <Card className="group overflow-hidden hover:shadow-lg transition-shadow">
        <div className="aspect-square relative overflow-hidden bg-muted">
          {displayImage ? (
            <img 
              src={displayImage} 
              alt={displayName}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Package className="h-16 w-16 text-muted-foreground" />
            </div>
          )}
          {storefrontProduct.is_featured && (
            <Badge 
              className="absolute top-2 left-2"
              style={{ backgroundColor: primaryColor }}
            >
              <Star className="h-3 w-3 mr-1" />
              Destaque
            </Badge>
          )}
          {storefrontProduct.highlight_badge && (
            <Badge 
              className="absolute top-2 right-2"
              variant="secondary"
            >
              {storefrontProduct.highlight_badge}
            </Badge>
          )}
        </div>
        <CardContent className="p-4">
          <h3 className="font-semibold line-clamp-2 mb-1">{displayName}</h3>
          {displayDescription && (
            <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
              {displayDescription}
            </p>
          )}
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-bold" style={{ color: primaryColor }}>
              {formatCurrency(price)}
            </span>
            {product.price_3_units && product.price_3_units < product.price_1_unit * 3 && (
              <span className="text-xs text-muted-foreground">
                ou 3 por {formatCurrency(product.price_3_units)}
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export function StorefrontProducts() {
  const { storefront } = useOutletContext<{ storefront: StorefrontData & { all_products: any[] } }>();
  const products = storefront.all_products || [];

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Link to={`/loja/${storefront.slug}`} className="hover:text-foreground">
          Início
        </Link>
        <span>/</span>
        <span className="text-foreground">Todos os Produtos</span>
      </nav>

      <h1 className="text-3xl font-bold mb-8">Todos os Produtos</h1>

      {products.length === 0 ? (
        <div className="text-center py-12">
          <Package className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Nenhum produto disponível</h2>
          <p className="text-muted-foreground">
            Esta loja ainda não possui produtos cadastrados.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {products.map(sp => (
            <ProductCard 
              key={sp.id}
              storefrontProduct={sp}
              storefrontSlug={storefront.slug}
              primaryColor={storefront.primary_color}
            />
          ))}
        </div>
      )}
    </div>
  );
}
