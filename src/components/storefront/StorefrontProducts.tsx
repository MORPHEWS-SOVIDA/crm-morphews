import { useOutletContext, Link } from 'react-router-dom';
import { Package } from 'lucide-react';
import type { StorefrontData } from '@/hooks/ecommerce/usePublicStorefront';
import { TemplatedProductCard } from './templates/TemplatedProductCard';

export function StorefrontProducts() {
  const { storefront } = useOutletContext<{ storefront: StorefrontData & { all_products: any[], installment_config?: any } }>();
  const products = storefront.all_products || [];
  const templateSlug = storefront.template?.slug;

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
            <TemplatedProductCard 
              key={sp.id}
              product={sp.product}
              storefrontSlug={storefront.slug}
              customPriceCents={sp.custom_price_cents}
              isFeatured={sp.is_featured}
              templateSlug={templateSlug}
              primaryColor={storefront.primary_color}
              installmentConfig={storefront.installment_config}
            />
          ))}
        </div>
      )}
    </div>
  );
}
