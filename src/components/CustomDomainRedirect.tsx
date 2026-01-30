import { Navigate, useLocation } from 'react-router-dom';
import { useCustomDomainDetection } from '@/hooks/useCustomDomainDetection';

/**
 * Component that handles custom domain routing.
 * When accessed via a custom domain (e.g., vvero.store), it redirects
 * to the appropriate storefront route internally.
 */
export function CustomDomainRedirect({ children }: { children: React.ReactNode }) {
  const { isCustomDomain, storefrontSlug, isLoading } = useCustomDomainDetection();
  const location = useLocation();

  // While loading, show nothing (or a loader)
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  // If it's a custom domain and we're at the root, redirect to the storefront
  if (isCustomDomain && storefrontSlug) {
    // Don't redirect if already on a storefront path
    if (location.pathname.startsWith(`/loja/${storefrontSlug}`)) {
      return <>{children}</>;
    }

    // Build the new path
    let newPath: string;
    if (location.pathname === '/' || location.pathname === '') {
      // Root path -> storefront home
      newPath = `/loja/${storefrontSlug}`;
    } else if (location.pathname.startsWith('/loja/')) {
      // Already a storefront path but wrong slug? Keep as is
      return <>{children}</>;
    } else {
      // Any other path on custom domain -> append to storefront
      // e.g., /produto/123 -> /loja/vvvero/produto/123
      newPath = `/loja/${storefrontSlug}${location.pathname}`;
    }

    return <Navigate to={newPath + location.search} replace />;
  }

  // Not a custom domain, render normally
  return <>{children}</>;
}
