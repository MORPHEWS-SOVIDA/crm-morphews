import { useOutletContext, useParams, Link } from 'react-router-dom';
import { Package, ArrowLeft } from 'lucide-react';
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
  const price = storefrontProduct.custom_price_cents || product.price_1_unit;

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
        </div>
        <CardContent className="p-4">
          <h3 className="font-semibold line-clamp-2 mb-1">{displayName}</h3>
          {displayDescription && (
            <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
              {displayDescription}
            </p>
          )}
          <span className="text-lg font-bold" style={{ color: primaryColor }}>
            {formatCurrency(price)}
          </span>
        </CardContent>
      </Card>
    </Link>
  );
}

export function StorefrontCategory() {
  const { storefront } = useOutletContext<{ storefront: StorefrontData & { all_products: any[] } }>();
  const { categorySlug } = useParams<{ categorySlug: string }>();
  
  const category = storefront.categories.find(c => c.slug === categorySlug);
  
  if (!category) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <h1 className="text-2xl font-bold mb-2">Categoria não encontrada</h1>
        <Link 
          to={`/loja/${storefront.slug}`}
          className="text-sm hover:underline"
          style={{ color: storefront.primary_color }}
        >
          <ArrowLeft className="inline h-4 w-4 mr-1" />
          Voltar para a loja
        </Link>
      </div>
    );
  }

  // Get products in this category
  const categoryProducts = storefront.all_products.filter(sp => {
    // Check if product is in this category
    const productCategories = (sp as any).categories || [];
    return productCategories.some((pc: any) => pc.category_id === category.id);
  });

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Link to={`/loja/${storefront.slug}`} className="hover:text-foreground">
          Início
        </Link>
        <span>/</span>
        <span className="text-foreground">{category.name}</span>
      </nav>

      <h1 className="text-3xl font-bold mb-8">{category.name}</h1>

      {categoryProducts.length === 0 ? (
        <div className="text-center py-12">
          <Package className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Nenhum produto nesta categoria</h2>
          <p className="text-muted-foreground mb-4">
            Em breve adicionaremos novos produtos.
          </p>
          <Link 
            to={`/loja/${storefront.slug}`}
            className="text-sm hover:underline"
            style={{ color: storefront.primary_color }}
          >
            <ArrowLeft className="inline h-4 w-4 mr-1" />
            Voltar para a loja
          </Link>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {categoryProducts.map(sp => (
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
