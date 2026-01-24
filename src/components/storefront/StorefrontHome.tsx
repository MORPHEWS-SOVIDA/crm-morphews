import { useOutletContext, Link } from 'react-router-dom';
import { ArrowRight, Package, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { StorefrontData, PublicProduct } from '@/hooks/ecommerce/usePublicStorefront';
import type { StorefrontProduct } from '@/hooks/ecommerce';

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

function HeroBanners({ storefront }: { storefront: StorefrontData }) {
  const activeBanners = storefront.banners || [];
  
  if (activeBanners.length === 0) {
    return null;
  }

  // Simple single banner for now (carousel can be added later)
  const banner = activeBanners[0];

  return (
    <div 
      className="relative h-[400px] md:h-[500px] bg-cover bg-center"
      style={{ backgroundImage: `url(${banner.image_url})` }}
    >
      <div 
        className="absolute inset-0"
        style={{ backgroundColor: banner.overlay_color || 'rgba(0,0,0,0.4)' }}
      />
      <div className="relative container mx-auto px-4 h-full flex items-center">
        <div className={`max-w-xl ${banner.position === 'center' ? 'mx-auto text-center' : banner.position === 'right' ? 'ml-auto text-right' : ''}`}>
          {banner.title && (
            <h1 
              className="text-4xl md:text-5xl font-bold mb-4"
              style={{ color: banner.text_color || '#ffffff' }}
            >
              {banner.title}
            </h1>
          )}
          {banner.subtitle && (
            <p 
              className="text-lg md:text-xl mb-6"
              style={{ color: banner.text_color || '#ffffff' }}
            >
              {banner.subtitle}
            </p>
          )}
          {banner.button_text && banner.link_url && (
            <Button 
              size="lg"
              asChild
              style={{ 
                backgroundColor: storefront.primary_color,
                color: '#ffffff',
              }}
            >
              <a href={banner.link_url} target={banner.link_target || '_self'}>
                {banner.button_text}
                <ArrowRight className="ml-2 h-5 w-5" />
              </a>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
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

function FeaturedProducts({ storefront }: { storefront: StorefrontData }) {
  const featuredProducts = storefront.featured_products || [];

  if (featuredProducts.length === 0) {
    return null;
  }

  return (
    <section className="py-12">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold">Produtos em Destaque</h2>
          <Link 
            to={`/loja/${storefront.slug}/produtos`}
            className="text-sm font-medium hover:underline"
            style={{ color: storefront.primary_color }}
          >
            Ver todos
            <ArrowRight className="inline ml-1 h-4 w-4" />
          </Link>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {featuredProducts.slice(0, 8).map(sp => (
            <ProductCard 
              key={sp.id}
              storefrontProduct={sp}
              storefrontSlug={storefront.slug}
              primaryColor={storefront.primary_color}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function CategoriesSection({ storefront }: { storefront: StorefrontData }) {
  const categories = storefront.categories?.filter(c => !c.parent_id) || [];

  if (categories.length === 0) {
    return null;
  }

  return (
    <section className="py-12 bg-muted/30">
      <div className="container mx-auto px-4">
        <h2 className="text-2xl font-bold mb-8 text-center">Navegue por Categoria</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {categories.map(cat => (
            <Link 
              key={cat.id}
              to={`/loja/${storefront.slug}/categoria/${cat.slug}`}
              className="group"
            >
              <Card className="overflow-hidden hover:shadow-lg transition-shadow">
                <div className="aspect-video relative overflow-hidden bg-muted">
                  {cat.image_url ? (
                    <img 
                      src={cat.image_url} 
                      alt={cat.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div 
                      className="w-full h-full flex items-center justify-center"
                      style={{ backgroundColor: storefront.primary_color + '20' }}
                    >
                      <span className="text-3xl font-bold" style={{ color: storefront.primary_color }}>
                        {cat.name.charAt(0)}
                      </span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    <h3 className="text-lg font-semibold text-white">{cat.name}</h3>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function AllProducts({ storefront }: { storefront: StorefrontData & { all_products: any[] } }) {
  const products = storefront.all_products || [];

  if (products.length === 0) {
    return (
      <section className="py-12">
        <div className="container mx-auto px-4 text-center">
          <Package className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Nenhum produto disponível</h2>
          <p className="text-muted-foreground">
            Esta loja ainda não possui produtos cadastrados.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="py-12">
      <div className="container mx-auto px-4">
        <h2 className="text-2xl font-bold mb-8">Todos os Produtos</h2>
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
      </div>
    </section>
  );
}

export function StorefrontHome() {
  const { storefront } = useOutletContext<{ storefront: StorefrontData & { all_products: any[] } }>();

  return (
    <div>
      <HeroBanners storefront={storefront} />
      <FeaturedProducts storefront={storefront} />
      <CategoriesSection storefront={storefront} />
      <AllProducts storefront={storefront} />
    </div>
  );
}
