import { useOutletContext, useParams, Link } from 'react-router-dom';
import { Package, ArrowLeft } from 'lucide-react';
import type { StorefrontData } from '@/hooks/ecommerce/usePublicStorefront';
import { TemplatedProductCard } from './templates/TemplatedProductCard';

export function StorefrontCategory() {
  const { storefront } = useOutletContext<{ storefront: StorefrontData & { all_products: any[], installment_config?: any } }>();
  const { categorySlug } = useParams<{ categorySlug: string }>();
  const templateSlug = storefront.template?.slug;
  
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
