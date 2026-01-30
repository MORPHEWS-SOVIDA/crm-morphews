import { useLocation, Routes, Route } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { useCustomDomainDetection } from '@/hooks/useCustomDomainDetection';

// Import storefront components
const StorefrontPublic = lazy(() => import('@/pages/StorefrontPublic'));
const StorefrontHome = lazy(() => import('@/components/storefront/StorefrontHome').then(m => ({ default: m.StorefrontHome })));
const StorefrontProducts = lazy(() => import('@/components/storefront/StorefrontProducts').then(m => ({ default: m.StorefrontProducts })));
const StorefrontCategory = lazy(() => import('@/components/storefront/StorefrontCategory').then(m => ({ default: m.StorefrontCategory })));
const StorefrontProductPage = lazy(() => import('@/components/storefront/StorefrontProductPage').then(m => ({ default: m.StorefrontProductPage })));
const StorefrontCart = lazy(() => import('@/components/storefront/StorefrontCart').then(m => ({ default: m.StorefrontCart })));
const StorefrontCheckout = lazy(() => import('@/components/storefront/StorefrontCheckout').then(m => ({ default: m.StorefrontCheckout })));
const StorefrontPage = lazy(() => import('@/components/storefront/StorefrontPage').then(m => ({ default: m.StorefrontPage })));
const StorefrontOrderConfirmed = lazy(() => import('@/components/storefront/StorefrontOrderConfirmed').then(m => ({ default: m.StorefrontOrderConfirmed })));
const StorefrontPixPayment = lazy(() => import('@/components/storefront/StorefrontPixPayment').then(m => ({ default: m.StorefrontPixPayment })));

const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
  </div>
);

/**
 * Component that handles custom domain routing.
 * When accessed via a custom domain (e.g., vvero.store), it renders
 * the storefront directly WITHOUT changing the URL.
 */
export function CustomDomainRedirect({ children }: { children: React.ReactNode }) {
  const { isCustomDomain, storefrontSlug, isLoading } = useCustomDomainDetection();
  const location = useLocation();

  // While loading, show loader
  if (isLoading) {
    return <PageLoader />;
  }

  // If it's a custom domain with a valid slug, render the storefront directly
  if (isCustomDomain && storefrontSlug) {
    // Map the current path to the appropriate storefront route
    // The URL stays as vvero.store/produtos but we render /loja/vvvero/produtos internally
    const path = location.pathname;
    
    return (
      <Suspense fallback={<PageLoader />}>
        <CustomDomainStorefront slug={storefrontSlug} path={path} />
      </Suspense>
    );
  }

  // Not a custom domain, render children (normal routing)
  return <>{children}</>;
}

/**
 * Renders the storefront for a custom domain, mapping paths correctly.
 * e.g., vvero.store/produtos → renders StorefrontProducts with slug='vvvero'
 */
function CustomDomainStorefront({ slug, path }: { slug: string; path: string }) {
  // We need to provide the slug via URL params context
  // The simplest way is to render the routes with the slug injected
  return (
    <Routes>
      {/* Map custom domain paths to storefront routes */}
      <Route path="/" element={<StorefrontPublicWithSlug slug={slug} />}>
        <Route index element={<StorefrontHome />} />
        <Route path="produtos" element={<StorefrontProducts />} />
        <Route path="categoria/:categorySlug" element={<StorefrontCategory />} />
        <Route path="produto/:productId" element={<StorefrontProductPage />} />
        <Route path="carrinho" element={<StorefrontCart />} />
        <Route path="checkout" element={<StorefrontCheckout />} />
        <Route path="pagina/:pageSlug" element={<StorefrontPage />} />
        <Route path="pedido-confirmado" element={<StorefrontOrderConfirmed />} />
        <Route path="pix-pagamento" element={<StorefrontPixPayment />} />
      </Route>
      {/* Fallback - render home for any unmatched path */}
      <Route path="*" element={<StorefrontPublicWithSlug slug={slug} />}>
        <Route path="*" element={<StorefrontHome />} />
      </Route>
    </Routes>
  );
}

// Import the cart provider and layout
import { CartProvider } from '@/components/storefront/cart/CartContext';
import { StorefrontLayoutWithSlug } from '@/components/storefront/StorefrontLayoutWithSlug';

/**
 * Wrapper that provides the slug directly instead of reading from URL params
 */
function StorefrontPublicWithSlug({ slug }: { slug: string }) {
  return (
    <CartProvider>
      <StorefrontLayoutWithSlug slug={slug} />
    </CartProvider>
  );
}
