import { useOutletContext, Link } from 'react-router-dom';
import { ArrowRight, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { StorefrontData, PublicProduct } from '@/hooks/ecommerce/usePublicStorefront';
import type { StorefrontProduct } from '@/hooks/ecommerce';
import { 
  TemplatedProductCard,
  TemplatedHero,
  TemplatedTrustBadges,
  TemplatedSocialProof,
  getTemplateStyles,
  getGridColumns,
  formatCurrency,
} from './templates';
import { HeroBannerCarousel } from './HeroBannerCarousel';
import { TestimonialsCarousel } from './TestimonialsCarousel';

function HeroBanners({ storefront }: { storefront: StorefrontData }) {
  const activeBanners = storefront.banners || [];
  const templateSlug = storefront.template?.slug;
  
  // If no banners, show templated hero with default content
  if (activeBanners.length === 0) {
    return (
      <TemplatedHero
        templateSlug={templateSlug}
        title={storefront.name}
        subtitle="Descubra produtos de qualidade premium"
        ctaText="Ver Produtos"
        ctaLink={`/loja/${storefront.slug}/produtos`}
        primaryColor={storefront.primary_color}
      />
    );
  }

  // Use carousel for banners
  return (
    <HeroBannerCarousel
      banners={activeBanners}
      storefrontSlug={storefront.slug}
      storefrontName={storefront.name}
      primaryColor={storefront.primary_color}
      autoplayInterval={5000}
    />
  );
}

function FeaturedProducts({ storefront }: { storefront: StorefrontData & { installment_config?: any } }) {
  const featuredProducts = storefront.featured_products || [];
  const templateSlug = storefront.template?.slug;
  const styles = getTemplateStyles(templateSlug);
  const templateConfig = storefront.template?.config as any;

  if (featuredProducts.length === 0) {
    return null;
  }

  return (
    <section className={styles.section}>
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between mb-8">
          <h2 className={styles.sectionTitle}>Produtos em Destaque</h2>
          <Link 
            to={`/loja/${storefront.slug}/produtos`}
            className="text-sm font-medium hover:underline flex items-center gap-1"
            style={{ color: storefront.primary_color }}
          >
            Ver todos
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className={`${styles.grid} ${getGridColumns(templateConfig)}`}>
          {featuredProducts.slice(0, 8).map(sp => (
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
      </div>
    </section>
  );
}

function CategoriesSection({ storefront }: { storefront: StorefrontData }) {
  const categories = storefront.categories?.filter(c => !c.parent_id) || [];
  const templateSlug = storefront.template?.slug;
  const styles = getTemplateStyles(templateSlug);

  if (categories.length === 0) {
    return null;
  }

  return (
    <section className={`${styles.section} bg-muted/30`}>
      <div className="container mx-auto px-4">
        <h2 className={styles.sectionTitle}>Navegue por Categoria</h2>
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

function AllProducts({ storefront }: { storefront: StorefrontData & { all_products: any[], installment_config?: any } }) {
  const products = storefront.all_products || [];
  const templateSlug = storefront.template?.slug;
  const styles = getTemplateStyles(templateSlug);
  const templateConfig = storefront.template?.config as any;

  if (products.length === 0) {
    return (
      <section className={styles.section}>
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
    <section className={styles.section}>
      <div className="container mx-auto px-4">
        <h2 className={styles.sectionTitle}>Todos os Produtos</h2>
        <div className={`${styles.grid} ${getGridColumns(templateConfig)}`}>
          {products.map((sp: any) => (
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
      </div>
    </section>
  );
}

export function StorefrontHome() {
  const { storefront } = useOutletContext<{ storefront: StorefrontData & { all_products: any[], installment_config?: any, testimonials?: any[], testimonials_enabled?: boolean } }>();
  const templateSlug = storefront.template?.slug;
  const showTestimonials = storefront.testimonials_enabled && storefront.testimonials && storefront.testimonials.length > 0;

  return (
    <div className="min-h-screen">
      <HeroBanners storefront={storefront} />
      
      {/* Trust Badges - only for some templates */}
      {templateSlug && ['premium-saude', 'vitrine-moderna'].includes(templateSlug) && (
        <div className="container mx-auto px-4 py-6">
          <TemplatedTrustBadges templateSlug={templateSlug} />
        </div>
      )}
      
      <FeaturedProducts storefront={storefront} />
      
      {/* Testimonials Carousel - between featured and all products */}
      {showTestimonials && (
        <TestimonialsCarousel
          testimonials={storefront.testimonials || []}
          primaryColor={storefront.primary_color}
          autoplayInterval={4000}
        />
      )}
      
      {/* Social Proof - only for some templates */}
      {templateSlug && templateSlug === 'premium-saude' && (
        <div className="bg-muted/50">
          <div className="container mx-auto px-4">
            <TemplatedSocialProof templateSlug={templateSlug} />
          </div>
        </div>
      )}
      
      <CategoriesSection storefront={storefront} />
      <AllProducts storefront={storefront} />
    </div>
  );
}
