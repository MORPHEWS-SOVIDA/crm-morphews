import { useParams, useOutletContext, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePublicPage } from '@/hooks/ecommerce/usePublicStorefront';
import type { StorefrontData } from '@/hooks/ecommerce/usePublicStorefront';

export function StorefrontPage() {
  const { slug, pageSlug } = useParams<{ slug: string; pageSlug: string }>();
  const { storefront } = useOutletContext<{ storefront: StorefrontData }>();
  const { data, isLoading, error } = usePublicPage(slug, pageSlug);

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-3xl mx-auto animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/2" />
          <div className="h-4 bg-muted rounded w-full" />
          <div className="h-4 bg-muted rounded w-3/4" />
          <div className="h-4 bg-muted rounded w-full" />
        </div>
      </div>
    );
  }

  if (error || !data?.page) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <h1 className="text-2xl font-bold mb-2">Página não encontrada</h1>
        <Link to={`/loja/${slug}`}>
          <Button variant="outline" className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar para a loja
          </Button>
        </Link>
      </div>
    );
  }

  const { page } = data;

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="max-w-3xl mx-auto">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <Link to={`/loja/${slug}`} className="hover:text-foreground">Início</Link>
          <span>/</span>
          <span>{page.title}</span>
        </nav>

        <h1 
          className="text-3xl font-bold mb-8"
          style={{ color: storefront.primary_color }}
        >
          {page.title}
        </h1>

        <div 
          className="prose prose-lg max-w-none"
          dangerouslySetInnerHTML={{ __html: page.content || '' }}
        />
      </div>
    </div>
  );
}
