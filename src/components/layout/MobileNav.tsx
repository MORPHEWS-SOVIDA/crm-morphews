import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, Plus, Settings, Menu, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useAuth } from '@/hooks/useAuth';
import { useOrganizationSettings } from '@/hooks/useOrganizationSettings';
import { Button } from '@/components/ui/button';
import { LogOut, UserPlus, ShoppingCart, Crown, UsersRound, Instagram } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import logoMorphews from '@/assets/logo-morphews.png';

const MASTER_ADMIN_EMAIL = "thiago.morphews@gmail.com";

export function MobileNav() {
  const [isOpen, setIsOpen] = useState(false);
  const { user, profile, isAdmin, signOut } = useAuth();
  const { data: orgSettings } = useOrganizationSettings();
  const navigate = useNavigate();
  const isMasterAdmin = user?.email === MASTER_ADMIN_EMAIL;
  
  // WhatsApp DMs is visible for master admin or if organization has it enabled
  const canSeeWhatsAppDMs = isMasterAdmin || orgSettings?.whatsapp_dms_enabled;

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const mainNavItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
    { icon: Users, label: 'Leads', path: '/leads' },
    { icon: Plus, label: 'Novo', path: '/leads/new' },
    { icon: UsersRound, label: 'Equipe', path: '/equipe' },
  ];

  const menuNavItems = [
    ...(canSeeWhatsAppDMs ? [
      { icon: MessageSquare, label: 'WhatsApp DMs', path: '/whatsapp' },
    ] : []),
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
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border lg:hidden safe-area-bottom">
      <div className="flex items-center justify-around h-16 px-2">
        {mainNavItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => cn(
              'flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-all min-w-[60px]',
              isActive
                ? 'text-primary bg-primary/10'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <item.icon className="w-5 h-5" />
            <span className="text-[10px] font-medium">{item.label}</span>
          </NavLink>
        ))}
        
        {/* Menu Sheet */}
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>
            <button className="flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg text-muted-foreground hover:text-foreground min-w-[60px]">
              <Menu className="w-5 h-5" />
              <span className="text-[10px] font-medium">Menu</span>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-auto max-h-[80vh] rounded-t-2xl">
            <div className="flex flex-col gap-2 py-4">
              {/* User Info */}
              {user && (
                <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-xl mb-2">
                  <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold text-lg">
                    {profile?.first_name?.[0] || user.email?.[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">
                      {profile ? `${profile.first_name} ${profile.last_name}` : user.email}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {isAdmin ? 'Administrador' : 'Usuário'}
                    </p>
                  </div>
                </div>
              )}

              {/* Menu Items */}
              <div className="grid grid-cols-2 gap-2">
                {menuNavItems.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => setIsOpen(false)}
                    className={({ isActive }) => cn(
                      'flex items-center gap-3 p-4 rounded-xl transition-all',
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'bg-muted/50 text-foreground hover:bg-muted'
                    )}
                  >
                    <item.icon className="w-5 h-5" />
                    <div className="flex-1">
                      <span className="font-medium text-sm">{item.label}</span>
                      {item.badge && (
                        <span className="ml-2 px-2 py-0.5 text-[10px] rounded-full bg-primary/10 text-primary">
                          {item.badge}
                        </span>
                      )}
                    </div>
                  </NavLink>
                ))}
              </div>

              {/* Logout */}
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 mt-4 text-destructive hover:text-destructive hover:bg-destructive/10 h-12"
                onClick={handleSignOut}
              >
                <LogOut className="w-5 h-5" />
                Sair da conta
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}
