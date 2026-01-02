import { NavLink, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  Plus, 
  Settings, 
  Instagram,
  MessageSquare,
  LogOut,
  ShoppingCart,
  Crown,
  UsersRound,
  FileText,
  Package,
  ShoppingCart as SalesIcon,
  Truck,
  Headphones,
  DollarSign,
  UserPlus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useOrganizationSettings } from '@/hooks/useOrganizationSettings';
import { useMyPermissions } from '@/hooks/useUserPermissions';
import { useReceptiveModuleAccess } from '@/hooks/useReceptiveModule';
import logoMorphews from '@/assets/logo-morphews.png';

const MASTER_ADMIN_EMAIL = "thiago.morphews@gmail.com";

export function Sidebar() {
  const { user, profile, isAdmin, signOut } = useAuth();
  const { data: orgSettings } = useOrganizationSettings();
  const { data: permissions } = useMyPermissions();
  const { data: receptiveAccess } = useReceptiveModuleAccess();
  const navigate = useNavigate();
  
  const isMasterAdmin = user?.email === MASTER_ADMIN_EMAIL;
  
  // Permission-based visibility
  const canSeeLeads = isAdmin || permissions?.leads_view;
  const canCreateLeads = isAdmin || permissions?.leads_create;
  const canSeeSales = isAdmin || permissions?.sales_view;
  const canSeeProducts = isAdmin || permissions?.products_view;
  const canSeeSettings = isAdmin || permissions?.settings_view;
  const canSeeReports = isAdmin || permissions?.reports_view;
  const canSeeDeliveries = permissions?.deliveries_view_own || permissions?.deliveries_view_all;
  const canSeeReceptive = receptiveAccess?.hasAccess;
  const canSeeFinanceiro = isAdmin || permissions?.reports_view || permissions?.sales_confirm_payment;
  const canSeeWhatsApp = isAdmin || permissions?.whatsapp_view;
  
  // WhatsApp DMs is visible for master admin or if organization has it enabled
  const canSeeWhatsAppDMs = (isMasterAdmin || orgSettings?.whatsapp_dms_enabled) && canSeeWhatsApp;

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  // Build nav items based on permissions
  const navItems = [
    // Dashboard - everyone can see (but content will be filtered by permissions)
    { icon: LayoutDashboard, label: 'Dashboard', path: '/', visible: true },
    
    // Receptivo (special module)
    { icon: Headphones, label: 'Add Receptivo', path: '/add-receptivo', visible: canSeeReceptive },
    
    // Leads
    { icon: Users, label: 'Todos os Leads', path: '/leads', visible: canSeeLeads },
    { icon: Plus, label: 'Novo Lead', path: '/leads/new', visible: canCreateLeads },
    
    // Products
    { icon: Package, label: 'Produtos', path: '/produtos', visible: canSeeProducts },
    
    // Sales
    { icon: SalesIcon, label: 'Vendas', path: '/vendas', visible: canSeeSales },
    
    // Financial
    { icon: DollarSign, label: 'Financeiro', path: '/financeiro', visible: canSeeFinanceiro },
    
    // Reports
    { icon: FileText, label: 'Relatórios', path: '/relatorios/vendas', visible: canSeeReports },
    
    // Deliveries
    { icon: Truck, label: 'Minhas Entregas', path: '/minhas-entregas', visible: canSeeDeliveries },
    
    // WhatsApp
    { icon: MessageSquare, label: 'Chat WhatsApp', path: '/whatsapp/chat', visible: canSeeWhatsAppDMs },
    { icon: Settings, label: 'Gerenciar WhatsApp', path: '/whatsapp', visible: canSeeWhatsAppDMs && isAdmin },
    
    // WhatsApp 2.0
    { icon: MessageSquare, label: 'WhatsApp 2.0', path: '/whatsapp-v2', badge: 'Novo', visible: canSeeWhatsApp },
    
    // Team (everyone can view their team)
    { icon: UsersRound, label: 'Minha Equipe', path: '/equipe', visible: true },
    
    // Admin only
    { icon: UserPlus, label: 'Nova Organização', path: '/cadastro', visible: isAdmin },
    { icon: ShoppingCart, label: 'Interessados', path: '/interessados', visible: isAdmin },
    
    // Master admin only
    { icon: Crown, label: 'Super Admin', path: '/super-admin', visible: isMasterAdmin },
    
    // Instagram (coming soon)
    { icon: Instagram, label: 'Instagram DMs', path: '/instagram', badge: 'Em breve', visible: true },
    
    // Settings
    { icon: Settings, label: 'Configurações', path: '/settings', visible: canSeeSettings },
  ].filter(item => item.visible);

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
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 text-sm',
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
                )}
              >
                <item.icon className="w-4 h-4 flex-shrink-0" />
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
