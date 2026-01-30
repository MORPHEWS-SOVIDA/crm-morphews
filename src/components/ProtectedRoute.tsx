import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useMyPermissions, PermissionKey } from '@/hooks/useUserPermissions';
import { useTenant } from '@/hooks/useTenant';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
  /** 
   * Require at least ONE of these permissions to access the route.
   * If not provided, only authentication is checked.
   */
  requiredPermissions?: PermissionKey[];
  /**
   * If true, require ALL permissions instead of ANY.
   */
  requireAll?: boolean;
  /**
   * Route to redirect to if permissions are denied. Defaults to '/'.
   */
  redirectTo?: string;
  /**
   * If true, allow users with partner roles (partner_affiliate, partner_coproducer, etc.) to access.
   */
  allowPartners?: boolean;
}

export function ProtectedRoute({ 
  children, 
  requireAdmin = false,
  requiredPermissions,
  requireAll = false,
  redirectTo = '/',
  allowPartners = false
}: ProtectedRouteProps) {
  const { user, isAdmin, isLoading: authLoading } = useAuth();
  const { data: permissions, isLoading: permissionsLoading } = useMyPermissions();
  const { role } = useTenant();
  const location = useLocation();

  // Check if user is a partner (any partner role)
  const isPartner = role?.startsWith('partner_') ?? false;

  // Show loading while auth or permissions are loading
  if (authLoading || (user && permissionsLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Partners with allowPartners flag bypass normal permission checks
  if (isPartner && allowPartners) {
    return <>{children}</>;
  }

  // Handle initial redirect based on user's default_landing_page
  // Only do this for the root path to avoid loops
  // Partners should go to their dedicated portal
  if (location.pathname === '/' && isPartner) {
    // Affiliates go to a dedicated mobile-optimized portal
    if (role === 'partner_affiliate') {
      return <Navigate to="/afiliado" replace />;
    }
    // Other partners (coproducer, etc.) go to ecommerce
    return <Navigate to="/ecommerce" replace />;
  }
  
  if (location.pathname === '/' && permissions?.default_landing_page && permissions.default_landing_page !== '/' && permissions.default_landing_page !== '/dashboard') {
    return <Navigate to={permissions.default_landing_page} replace />;
  }

  // Check admin requirement
  if (requireAdmin && !isAdmin) {
    return <Navigate to={redirectTo} replace />;
  }

  // If specific permissions are required, check them
  if (requiredPermissions && requiredPermissions.length > 0 && permissions) {
    // Admins (master admin or org admin) bypass permission checks
    if (!isAdmin) {
      const hasPermission = requireAll
        ? requiredPermissions.every(perm => permissions[perm])
        : requiredPermissions.some(perm => permissions[perm]);
      
      if (!hasPermission) {
        return <Navigate to={redirectTo} replace />;
      }
    }
  }

  return <>{children}</>;
}
