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
  BarChart3,
  Headphones,
  DollarSign,
  UserPlus,
  Shield,
  ClipboardList,
  Trophy,
  TicketCheck,
  Send,
  Scale,
  Bot,
  ListTodo,
  User,
  Filter,
  Columns3,
  Plug2,
  Store,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useMyPermissions } from '@/hooks/useUserPermissions';
import { useIsManager } from '@/hooks/useDiscountAuthorization';
import { useTenant } from '@/hooks/useTenant';
import { useOrgFeatures } from '@/hooks/usePlanFeatures';
import logoMorphews from '@/assets/logo-morphews.png';

const MASTER_ADMIN_EMAIL = "thiago.morphews@gmail.com";

export function Sidebar() {
  const { user, profile, isAdmin: isGlobalAdmin, signOut } = useAuth();
  const { data: permissions } = useMyPermissions();
  const { data: isManager } = useIsManager();
  const { isAdmin: isTenantAdmin, isOwner } = useTenant();
  const { data: orgFeatures, isLoading: featuresLoading } = useOrgFeatures();
  const navigate = useNavigate();
  
  const isMasterAdmin = user?.email === MASTER_ADMIN_EMAIL;
  
  // User is admin if they have global admin role OR are org owner/admin
  const isAdmin = isGlobalAdmin || isTenantAdmin || isOwner;

  // Helper to check if a feature is enabled in the plan
  const hasFeature = (key: string) => {
    if (isMasterAdmin) return true; // Master admin sees everything
    if (featuresLoading || !orgFeatures) return true; // Default to true while loading
    return orgFeatures[key as keyof typeof orgFeatures] ?? true;
  };
  
  // Permission-based visibility (user permissions within org)
  const canSeeDashboardFunnel = isAdmin || permissions?.dashboard_funnel_view;
  const canSeeDashboardKanban = isAdmin || permissions?.dashboard_kanban_view;
  const canSeeSellerPanel = isAdmin || permissions?.seller_panel_view;
  const canSeeSalesDashboard = isAdmin || permissions?.sales_dashboard_view;
  const canSeeLeads = isAdmin || permissions?.leads_view;
  const canCreateLeads = (isAdmin || permissions?.leads_create) && !permissions?.leads_hide_new_button;
  const canSeeSales = isAdmin || permissions?.sales_view;
  const canSeeProducts = isAdmin || permissions?.products_view;
  const canSeeSettings = isAdmin || permissions?.settings_view;
  const canSeeReports = isAdmin || permissions?.reports_view;
  const canSeeDeliveries = permissions?.deliveries_view_own || permissions?.deliveries_view_all;
  // Expedition: requires ONLY expedition_view - validate_expedition is an action, not menu access
  const canSeeExpedition = isAdmin || permissions?.expedition_view;
  // Financial menu: requires reports_view permission - NOT sales_confirm_payment (which is for motoboy payment actions only)
  const canSeeFinanceiro = isAdmin || permissions?.reports_view;
  const canSeeWhatsApp = isAdmin || permissions?.whatsapp_view;
  const canSeeTeam = isAdmin || permissions?.team_view;
  const canSeeInstagram = isAdmin || permissions?.instagram_view;
  const canSeePostSale = isAdmin || permissions?.post_sale_view;
  const canSeeSac = isAdmin || permissions?.sac_view;
  const canSeeScheduledMessages = isAdmin || permissions?.scheduled_messages_view;
  const canSeeSalesReport = isAdmin || permissions?.sales_report_view;
  const canSeeExpeditionReport = isAdmin || permissions?.expedition_report_view;
  const canSeeWhatsAppManage = isAdmin || permissions?.whatsapp_manage_view;
  const canSeeAIBots = isAdmin || permissions?.ai_bots_view;
  const canSeeDemands = isAdmin || permissions?.demands_view;
  const canSeeReceptive = isAdmin || permissions?.receptive_module_access;
  const canSeeIntegrations = isAdmin || permissions?.integrations_view;

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  // Build nav items based on permissions AND plan features
  // Each item checks: 1) User has permission, 2) Feature is in plan
  const navItems = [
    // Dashboard FUNIL - separate permission
    { icon: Filter, label: 'Dashboard Funil', path: '/', visible: canSeeDashboardFunnel && hasFeature('dashboard_funnel') },
    
    // Dashboard KANBAN - separate permission
    { icon: Columns3, label: 'Dashboard Kanban', path: '/dashboard-kanban', visible: canSeeDashboardKanban && hasFeature('dashboard_kanban') },
    
    // Seller Panel - personal seller dashboard
    { icon: User, label: 'Meu Painel', path: '/meu-painel', visible: canSeeSellerPanel && canSeeSales && hasFeature('seller_panel') },
    
    // Receptivo (special module) - requires receptive feature in plan
    { icon: Headphones, label: 'Add Receptivo', path: '/add-receptivo', visible: canSeeReceptive && hasFeature('receptive') },
    { icon: BarChart3, label: 'Gerência Receptivo', path: '/gerencia-receptivo', visible: (isAdmin || isManager) && canSeeReceptive && hasFeature('receptive_manage') },
    
    // Leads
    { icon: Users, label: 'Todos os Leads', path: '/leads', visible: canSeeLeads && hasFeature('leads') },
    { icon: Plus, label: 'Novo Lead', path: '/leads/new', visible: canCreateLeads && hasFeature('leads') },
    
    // Products
    { icon: Package, label: 'Produtos', path: '/produtos', visible: canSeeProducts && hasFeature('products') },
    
    // Sales Dashboard - requires sales + sales_dashboard features + permission
    { icon: Trophy, label: 'Dashboard Vendas', path: '/dashboard-vendas', visible: canSeeSalesDashboard && hasFeature('sales') && hasFeature('sales_dashboard') },
    
    // Sales
    { icon: SalesIcon, label: 'Vendas', path: '/vendas', visible: canSeeSales && hasFeature('sales') },
    
    // Post-Sale
    { icon: ClipboardList, label: 'Pós-Venda', path: '/pos-venda', visible: canSeePostSale && hasFeature('post_sale') },
    
    // SAC
    { icon: TicketCheck, label: 'SAC', path: '/sac', visible: canSeeSac && hasFeature('sac') },
    
    // Scheduled Messages
    { icon: Send, label: 'Mensagens Agendadas', path: '/mensagens-agendadas', visible: canSeeScheduledMessages && hasFeature('scheduled_messages') },
    
    // Financial
    { icon: DollarSign, label: 'Financeiro', path: '/financeiro', visible: canSeeFinanceiro && hasFeature('financial') },
    
    // Fiscal Invoices (admin only)
    { icon: FileText, label: 'Notas Fiscais', path: '/notas-fiscais', visible: canSeeSettings && hasFeature('fiscal_invoices') },
    
    // Reports
    { icon: FileText, label: 'Relatório Vendas', path: '/relatorios/vendas', visible: canSeeSalesReport && hasFeature('sales_report') },
    { icon: FileText, label: 'Relatório Expedição', path: '/relatorios/expedicao', visible: canSeeExpeditionReport && hasFeature('expedition_report') },
    { icon: BarChart3, label: 'Atribuição de Tráfego', path: '/relatorios/atribuicao', visible: canSeeSalesReport && hasFeature('sales_report') },
    
    // Deliveries & Expedition
    { icon: Package, label: 'Expedição', path: '/expedicao', visible: canSeeExpedition && hasFeature('expedition') },
    { icon: Truck, label: 'Minhas Entregas', path: '/minhas-entregas', visible: canSeeDeliveries && hasFeature('deliveries') },
    { icon: Truck, label: 'Todas as Entregas', path: '/todas-entregas', visible: permissions?.deliveries_view_all && hasFeature('deliveries') },
    
    // WhatsApp 1.0 (DMs)
    { icon: MessageSquare, label: 'Chat WhatsApp', path: '/whatsapp/chat', visible: canSeeWhatsApp && hasFeature('whatsapp_v1') },
    { icon: Settings, label: 'Gerenciar WhatsApp', path: '/whatsapp', visible: canSeeWhatsApp && canSeeWhatsAppManage && hasFeature('whatsapp_manage') },
    
    // AI Bots (permission controlled)
    { icon: Bot, label: 'Robôs IA', path: '/robos-ia', visible: canSeeAIBots && hasFeature('ai_bots') },
    
    // Team (permission controlled)
    { icon: UsersRound, label: 'Minha Equipe', path: '/equipe', visible: canSeeTeam && hasFeature('team') },
    
    // Demands (permission controlled)
    { icon: ListTodo, label: 'Demandas', path: '/demandas', visible: canSeeDemands && hasFeature('demands') },
    
    // Integrations (permission controlled)
    { icon: Plug2, label: 'Integrações', path: '/integracoes', visible: canSeeIntegrations && hasFeature('integrations') },
    
    // 2FA for managers
    { icon: Shield, label: 'Código 2FA', path: '/2fa', visible: isManager },
    
    // Admin only - controlled by plan features
    { icon: UserPlus, label: 'Nova Organização', path: '/cadastro', visible: isAdmin && hasFeature('new_organization') },
    { icon: ShoppingCart, label: 'Interessados', path: '/interessados', visible: isAdmin && hasFeature('interested_leads') },
    
    // Master admin only
    { icon: Crown, label: 'Super Admin', path: '/super-admin', visible: isMasterAdmin },
    
    // Instagram (permission controlled)
    { icon: Instagram, label: 'Instagram DMs', path: '/instagram', badge: 'Em breve', visible: canSeeInstagram && hasFeature('instagram') },
    
    // Ecommerce
    { icon: Store, label: 'E-commerce', path: '/ecommerce', visible: canSeeSettings && hasFeature('settings') },
    
    // Settings
    { icon: Settings, label: 'Configurações', path: '/settings', visible: canSeeSettings && hasFeature('settings') },
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
          <div className="p-4 border-t border-sidebar-border space-y-2">
            <NavLink
              to="/legal"
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-sidebar-accent/50 transition-colors"
            >
              <Scale className="w-4 h-4" />
              Termos e Privacidade
            </NavLink>
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
