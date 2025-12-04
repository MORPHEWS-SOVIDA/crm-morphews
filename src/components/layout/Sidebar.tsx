import { NavLink, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  Plus, 
  Settings, 
  Instagram,
  Menu,
  X,
  UserPlus,
  LogOut,
  ShoppingCart,
  Crown,
  UsersRound
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import logoMorphews from '@/assets/logo-morphews.png';

const MASTER_ADMIN_EMAIL = "thiago.morphews@gmail.com";

export function Sidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const { user, profile, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  
  const isMasterAdmin = user?.email === MASTER_ADMIN_EMAIL;

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  // Check if user is org admin (owner or admin role in organization_members)
  const isOrgAdmin = isAdmin || profile?.organization_id;

  const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
    { icon: Users, label: 'Todos os Leads', path: '/leads' },
    { icon: Plus, label: 'Novo Lead', path: '/leads/new' },
    { icon: UsersRound, label: 'Minha Equipe', path: '/equipe' },
    ...(isAdmin ? [
      { icon: UserPlus, label: 'Cadastrar Usuário', path: '/cadastro' },
      { icon: ShoppingCart, label: 'Interessados', path: '/interessados' },
    ] : []),
    ...(isMasterAdmin ? [
      { icon: Crown, label: 'Super Admin', path: '/super-admin' },
    ] : []),
    { icon: Instagram, label: 'Instagram DMs', path: '/instagram', badge: 'Em breve' },
    { icon: Settings, label: 'Configurações', path: '/settings' },
  ];

  return (
    <>
      {/* Sidebar - Desktop Only */}
      <aside className="fixed top-0 left-0 h-full w-64 bg-sidebar border-r border-sidebar-border z-40 hidden lg:block">
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-6 border-b border-sidebar-border">
            <img src={logoMorphews} alt="Morphews CRM" className="h-8 w-auto" />
            <p className="text-sm text-muted-foreground mt-2">Gestão de leads intuitiva</p>
          </div>

          {/* User Info */}
          {user && (
            <div className="p-4 border-b border-sidebar-border">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold">
                  {profile?.first_name?.[0] || user.email?.[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate">
                    {profile ? `${profile.first_name} ${profile.last_name}` : user.email}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {isAdmin ? 'Administrador' : 'Usuário'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-2">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setIsOpen(false)}
                className={({ isActive }) => cn(
                  'flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200',
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
                )}
              >
                <item.icon className="w-5 h-5" />
                <span className="flex-1">{item.label}</span>
                {item.badge && (
                  <span className="px-2 py-0.5 text-xs rounded-full bg-primary/10 text-primary">
                    {item.badge}
                  </span>
                )}
              </NavLink>
            ))}
          </nav>

          {/* Footer */}
          <div className="p-4 border-t border-sidebar-border space-y-3">
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={handleSignOut}
            >
              <LogOut className="w-5 h-5" />
              Sair
            </Button>
          </div>
        </div>
      </aside>
    </>
  );
}
