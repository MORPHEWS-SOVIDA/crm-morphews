import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useMyPermissions, UserPermissions } from '@/hooks/useUserPermissions';
import { Loader2 } from 'lucide-react';

type PermissionKey = keyof Omit<UserPermissions, 'id' | 'organization_id' | 'user_id' | 'created_at' | 'updated_at'>;

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
}

export function ProtectedRoute({ 
  children, 
  requireAdmin = false,
  requiredPermissions,
  requireAll = false,
  redirectTo = '/'
}: ProtectedRouteProps) {
  const { user, isAdmin, isLoading: authLoading } = useAuth();
  const { data: permissions, isLoading: permissionsLoading } = useMyPermissions();

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
