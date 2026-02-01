import { ReactNode } from 'react';
import { Link, useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useMyWhiteLabelConfig, useIsWhiteLabelOwner } from '@/hooks/useWhiteAdmin';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { 
  LogOut, 
  Home,
  LayoutDashboard,
  Building2,
  Users,
  Package,
  Palette,
  Wallet,
  Settings,
  Loader2,
  Crown,
} from 'lucide-react';

interface WhiteAdminLayoutProps {
  children: ReactNode;
}

const navItems = [
  { path: '/white-admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { path: '/white-admin/organizacoes', label: 'Organizações', icon: Building2 },
  { path: '/white-admin/usuarios', label: 'Usuários', icon: Users },
  { path: '/white-admin/planos', label: 'Planos', icon: Package },
  { path: '/white-admin/branding', label: 'Marca', icon: Palette },
  { path: '/white-admin/financeiro', label: 'Financeiro', icon: Wallet },
  { path: '/white-admin/configuracoes', label: 'Configurações', icon: Settings },
];

export function WhiteAdminLayout({ children }: WhiteAdminLayoutProps) {
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { data: isOwner, isLoading: ownerLoading } = useIsWhiteLabelOwner();
  const { data: wlData, isLoading: configLoading } = useMyWhiteLabelConfig();
  
  const isLoading = ownerLoading || configLoading;
  
  // Get white label config from nested data
  const config = wlData?.white_label_configs;
  const brandName = config?.brand_name || 'White Admin';
  const logoUrl = config?.logo_url;
  const primaryColor = config?.primary_color || '#8B5CF6';
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }
  
  // Redirect if not a WL owner
  if (!isOwner) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <div 
      className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20"
      style={{ '--wl-primary': primaryColor } as React.CSSProperties}
    >
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="flex items-center justify-between px-4 lg:px-6 py-3">
          {/* Logo + Brand */}
          <div className="flex items-center gap-3">
            {logoUrl ? (
              <img src={logoUrl} alt={brandName} className="h-8 w-auto" />
            ) : (
              <div 
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-white"
                style={{ backgroundColor: primaryColor }}
              >
                <Crown className="w-5 h-5" />
                <span className="font-bold">{brandName}</span>
              </div>
            )}
            
            <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-muted rounded-full">
              <span className="text-xs font-medium text-muted-foreground">
                Painel Administrativo
              </span>
            </div>
          </div>
          
          {/* User Actions */}
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="sm"
              asChild
              className="gap-2 text-muted-foreground hover:text-foreground"
            >
              <Link to="/dashboard">
                <Home className="w-4 h-4" />
                <span className="hidden sm:inline">Voltar ao CRM</span>
              </Link>
            </Button>
            
            <div className="h-6 w-px bg-border" />
            
            <div className="flex items-center gap-2">
              <Avatar className="h-8 w-8">
                <AvatarImage src={logoUrl || undefined} />
                <AvatarFallback style={{ backgroundColor: primaryColor, color: 'white' }}>
                  {brandName[0]}
                </AvatarFallback>
              </Avatar>
              
              <Button
                variant="ghost"
                size="icon"
                onClick={handleSignOut}
                className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>
      
      <div className="flex">
        {/* Sidebar */}
        <aside className="hidden lg:block w-56 shrink-0 border-r border-border/50 min-h-[calc(100vh-57px)]">
          <nav className="sticky top-[57px] p-4 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = item.exact 
                ? location.pathname === item.path
                : location.pathname.startsWith(item.path);
              
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                    isActive 
                      ? "text-white"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                  style={isActive ? { backgroundColor: primaryColor } : undefined}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>
        
        {/* Mobile Nav */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border/50 px-2 py-2">
          <div className="flex justify-around">
            {navItems.slice(0, 5).map((item) => {
              const Icon = item.icon;
              const isActive = item.exact 
                ? location.pathname === item.path
                : location.pathname.startsWith(item.path);
              
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "flex flex-col items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium transition-colors",
                    isActive 
                      ? "text-white"
                      : "text-muted-foreground"
                  )}
                  style={isActive ? { backgroundColor: primaryColor } : undefined}
                >
                  <Icon className="h-5 w-5" />
                  <span className="hidden sm:inline">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
        
        {/* Main Content */}
        <main className="flex-1 min-w-0 p-4 lg:p-6 pb-20 lg:pb-6">
          {children}
        </main>
      </div>
    </div>
  );
}
