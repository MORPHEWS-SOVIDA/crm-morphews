import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Plus,
  Settings,
  Menu,
  MessageSquare,
  Package,
  Truck,
  ShoppingCart as SalesIcon,
  FileText,
  Headphones,
  DollarSign,
  LogOut,
  UserPlus,
  ShoppingCart,
  Crown,
  UsersRound,
  Instagram,
  Shield,
  ClipboardList,
  TicketCheck,
  Bot,
  ListTodo,
  Send,
  ChevronRight,
  X,
  Home,
  Kanban,
  User,
  BarChart3,
  Link2,
  Phone,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, useMemo } from 'react';
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';
import { useMyPermissions } from '@/hooks/useUserPermissions';
import { useIsManager } from '@/hooks/useDiscountAuthorization';
import { useOrgFeatures } from '@/hooks/usePlanFeatures';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { useNavigate } from 'react-router-dom';
import { useOrgWhiteLabelBranding } from '@/hooks/useOrgWhiteLabelBranding';
import { useTheme } from 'next-themes';
import logoMorphews from '@/assets/logo-morphews.png';
import { ScrollArea } from '@/components/ui/scroll-area';

const MASTER_ADMIN_EMAIL = "thiago.morphews@gmail.com";

// Define module groups for organized navigation
interface NavItem {
  icon: typeof LayoutDashboard;
  label: string;
  path: string;
  badge?: string;
}

interface NavGroup {
  id: string;
  label: string;
  icon: typeof LayoutDashboard;
  items: NavItem[];
}

export function MobileNav() {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const { user, profile, isAdmin, signOut, isLoading: authLoading } = useAuth();
  const { role } = useTenant();
  const { data: permissions } = useMyPermissions();
  const { data: isManager } = useIsManager();
  const { data: orgFeatures, isLoading: featuresLoading } = useOrgFeatures();
  const { data: wlBranding, isLoading: wlBrandingLoading } = useOrgWhiteLabelBranding();
  const { resolvedTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  
  const isMasterAdmin = user?.email === MASTER_ADMIN_EMAIL;
  const isPartner = role?.startsWith('partner_') ?? false;
  
  // Determine logo to use based on white label branding
  // Wait for auth AND branding to load before showing any logo to avoid flash
  const isDark = resolvedTheme === 'dark';
  const isBrandingReady = !authLoading && !wlBrandingLoading;
  const displayLogo = !isBrandingReady
    ? null
    : wlBranding 
      ? (isDark && wlBranding.logo_dark_url ? wlBranding.logo_dark_url : wlBranding.logo_url) || logoMorphews
      : logoMorphews;

  const hasFeature = (key: string) => {
    if (isMasterAdmin) return true;
    if (featuresLoading || !orgFeatures) return true;
    return orgFeatures[key as keyof typeof orgFeatures] ?? true;
  };
  
  // Permission checks
  const canSeeLeads = isAdmin || permissions?.leads_view;
  const canCreateLeads = isAdmin || permissions?.leads_create;
  const canSeeSales = isAdmin || permissions?.sales_view;
  const canSeeProducts = isAdmin || permissions?.products_view;
  const canSeeSettings = isAdmin || permissions?.settings_view;
  const canSeeEcommerce = isAdmin || permissions?.settings_view;
  const canSeeDeliveries = permissions?.deliveries_view_own || permissions?.deliveries_view_all;
  const canSeeAllDeliveries = permissions?.deliveries_view_all;
  const canSeeReceptive = isAdmin || permissions?.receptive_module_access;
  const canSeeFinanceiro = isAdmin || permissions?.reports_view;
  const canSeeExpedition = isAdmin || permissions?.expedition_view;
  const canSeeWhatsApp = isAdmin || permissions?.whatsapp_view;
  const canSeeTeam = isAdmin || permissions?.team_view;
  const canSeeInstagram = isAdmin || permissions?.instagram_view;
  const canSeePostSale = isAdmin || permissions?.post_sale_view;
  const canSeeSac = isAdmin || permissions?.sac_view;
  const canSeeSalesReport = isAdmin || permissions?.sales_report_view;
  const canSeeExpeditionReport = isAdmin || permissions?.expedition_report_view;
  const canSeeWhatsAppManage = isAdmin || permissions?.whatsapp_manage_view;
  const canSeeAIBots = isAdmin || permissions?.ai_bots_view;
  const canSeeVoiceAI = isAdmin || permissions?.voice_ai_view;
  const canSeeDemands = isAdmin || permissions?.demands_view;
  const canSeeScheduledMessages = isAdmin || permissions?.scheduled_messages_view;
  const canSeeDashboardFunnel = isAdmin || permissions?.dashboard_funnel_view;
  const canSeeDashboardKanban = isAdmin || permissions?.dashboard_kanban_view;
  const canSeeSellerPanel = isAdmin || permissions?.seller_panel_view;
  const canSeeSalesDashboard = isAdmin || permissions?.sales_dashboard_view;
  const canSeePaymentLinks = isAdmin || permissions?.payment_links_view_transactions || permissions?.payment_links_create;

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  // Build dynamic nav groups based on permissions
  const navGroups = useMemo<NavGroup[]>(() => {
    const groups: NavGroup[] = [];

    // Dashboard Group
    const dashboardItems: NavItem[] = [];
    if (canSeeDashboardFunnel && hasFeature('dashboard_funnel')) {
      dashboardItems.push({ icon: LayoutDashboard, label: 'Dashboard Funil', path: '/' });
    }
    if (canSeeDashboardKanban && hasFeature('dashboard_kanban')) {
      dashboardItems.push({ icon: Kanban, label: 'Dashboard Kanban', path: '/dashboard-kanban' });
    }
    if (canSeeSellerPanel) {
      dashboardItems.push({ icon: User, label: 'Meu Painel', path: '/meu-painel' });
    }
    if (canSeeSalesDashboard && hasFeature('sales_dashboard')) {
      dashboardItems.push({ icon: BarChart3, label: 'Dashboard Vendas', path: '/dashboard-vendas' });
    }
    if (dashboardItems.length > 0) {
      groups.push({ id: 'dashboard', label: 'Dashboards', icon: LayoutDashboard, items: dashboardItems });
    }

    // Leads & Sales Group
    const salesItems: NavItem[] = [];
    if (canSeeLeads && hasFeature('leads')) {
      salesItems.push({ icon: Users, label: 'Lista de Leads', path: '/leads' });
    }
    if (canCreateLeads && hasFeature('leads')) {
      salesItems.push({ icon: Plus, label: 'Novo Lead', path: '/leads/new' });
    }
    if (canSeeReceptive && hasFeature('receptive')) {
      salesItems.push({ icon: Headphones, label: 'Add Receptivo', path: '/add-receptivo' });
    }
    if (canSeeSales && hasFeature('sales') && !isPartner) {
      salesItems.push({ icon: SalesIcon, label: 'Vendas', path: '/vendas' });
    }
    if (salesItems.length > 0) {
      groups.push({ id: 'sales', label: 'Vendas', icon: SalesIcon, items: salesItems });
    }

    // Communication Group
    const commItems: NavItem[] = [];
    if (canSeeWhatsApp && hasFeature('whatsapp_v1')) {
      commItems.push({ icon: MessageSquare, label: 'Chat WhatsApp', path: '/whatsapp/chat' });
    }
    if (canSeeWhatsApp && canSeeWhatsAppManage && hasFeature('whatsapp_manage')) {
      commItems.push({ icon: Settings, label: 'Gerenciar WhatsApp', path: '/whatsapp' });
    }
    if (canSeeScheduledMessages && hasFeature('scheduled_messages')) {
      commItems.push({ icon: Send, label: 'Mensagens Agendadas', path: '/mensagens-agendadas' });
    }
    if (canSeeInstagram && hasFeature('instagram')) {
      commItems.push({ icon: Instagram, label: 'Instagram DMs', path: '/instagram' });
    }
    if (commItems.length > 0) {
      groups.push({ id: 'communication', label: 'Comunicação', icon: MessageSquare, items: commItems });
    }

    // Operations Group (Expedition, Deliveries)
    const opsItems: NavItem[] = [];
    if (canSeeExpedition && hasFeature('expedition')) {
      opsItems.push({ icon: Package, label: 'Expedição', path: '/expedicao' });
    }
    if (canSeeDeliveries && hasFeature('deliveries')) {
      opsItems.push({ icon: Truck, label: 'Minhas Entregas', path: '/minhas-entregas' });
    }
    if (canSeeAllDeliveries && hasFeature('deliveries')) {
      opsItems.push({ icon: Truck, label: 'Todas Entregas', path: '/todas-entregas' });
    }
    if (opsItems.length > 0) {
      groups.push({ id: 'operations', label: 'Operações', icon: Truck, items: opsItems });
    }

    // Post-Sale & Support Group
    const supportItems: NavItem[] = [];
    if (canSeePostSale && hasFeature('post_sale')) {
      supportItems.push({ icon: ClipboardList, label: 'Pós-Venda', path: '/pos-venda' });
    }
    if (canSeeSac && hasFeature('sac')) {
      supportItems.push({ icon: TicketCheck, label: 'SAC', path: '/sac' });
    }
    if (supportItems.length > 0) {
      groups.push({ id: 'support', label: 'Pós-Venda', icon: ClipboardList, items: supportItems });
    }

    // Management Group
    const mgmtItems: NavItem[] = [];
    if (canSeeProducts && hasFeature('products')) {
      mgmtItems.push({ icon: Package, label: 'Produtos', path: '/produtos' });
    }
    if (canSeeTeam && hasFeature('team')) {
      mgmtItems.push({ icon: UsersRound, label: 'Minha Equipe', path: '/equipe' });
    }
    if (canSeeAIBots && hasFeature('ai_bots')) {
      mgmtItems.push({ icon: Bot, label: 'Robôs IA', path: '/robos-ia' });
    }
    if (canSeeVoiceAI && hasFeature('voice_ai_calls')) {
      mgmtItems.push({ icon: Phone, label: 'Voice AI', path: '/voice-ai' });
    }
    if (canSeeDemands && hasFeature('demands')) {
      mgmtItems.push({ icon: ListTodo, label: 'Demandas', path: '/demandas' });
    }
    // E-commerce - check feature
    if (canSeeEcommerce && hasFeature('ecommerce')) {
      mgmtItems.push({ icon: ShoppingCart, label: 'E-commerce', path: '/ecommerce' });
    }
    if (mgmtItems.length > 0) {
      groups.push({ id: 'management', label: 'Gestão', icon: UsersRound, items: mgmtItems });
    }

    // Financial & Reports Group
    const finItems: NavItem[] = [];
    if (canSeeFinanceiro && hasFeature('financial')) {
      finItems.push({ icon: DollarSign, label: 'Financeiro', path: '/financeiro' });
    }
    if (canSeePaymentLinks && hasFeature('payment_links')) {
      finItems.push({ icon: Link2, label: 'Cobrar', path: '/cobrar' });
    }
    if (canSeeSalesReport && hasFeature('sales_report')) {
      finItems.push({ icon: FileText, label: 'Relatório Vendas', path: '/relatorios/vendas' });
    }
    if (canSeeExpeditionReport && hasFeature('expedition_report')) {
      finItems.push({ icon: FileText, label: 'Relatório Expedição', path: '/relatorios/expedicao' });
    }
    if (finItems.length > 0) {
      groups.push({ id: 'financial', label: 'Financeiro', icon: DollarSign, items: finItems });
    }

    // Settings & Admin Group
    const adminItems: NavItem[] = [];
    if (isManager) {
      adminItems.push({ icon: Shield, label: 'Código 2FA', path: '/2fa' });
    }
    if (canSeeSettings && hasFeature('settings')) {
      adminItems.push({ icon: Settings, label: 'Configurações', path: '/settings' });
    }
    if (isAdmin && hasFeature('new_organization')) {
      adminItems.push({ icon: UserPlus, label: 'Cadastrar Usuário', path: '/cadastro' });
    }
    if (isAdmin && hasFeature('interested_leads')) {
      adminItems.push({ icon: ShoppingCart, label: 'Interessados', path: '/interessados' });
    }
    if (isMasterAdmin) {
      adminItems.push({ icon: Crown, label: 'Super Admin', path: '/super-admin' });
    }
    if (adminItems.length > 0) {
      groups.push({ id: 'admin', label: 'Admin', icon: Settings, items: adminItems });
    }

    return groups;
  }, [
    permissions, isAdmin, isManager, isMasterAdmin, orgFeatures, featuresLoading,
    canSeeLeads, canCreateLeads, canSeeSales, canSeeProducts, canSeeSettings,
    canSeeDeliveries, canSeeAllDeliveries, canSeeReceptive, canSeeFinanceiro,
    canSeeExpedition, canSeeWhatsApp, canSeeTeam, canSeeInstagram,
    canSeePostSale, canSeeSac, canSeeSalesReport, canSeeExpeditionReport,
    canSeeWhatsAppManage, canSeeAIBots, canSeeDemands, canSeeScheduledMessages,
    canSeeDashboardFunnel, canSeeDashboardKanban, canSeeSellerPanel, canSeeSalesDashboard,
    canSeeEcommerce
  ]);

  // Smart quick access items - first 4 items from available groups
  const quickAccessItems = useMemo(() => {
    const items: NavItem[] = [];
    
    // Priority order: most used modules
    const priorityPaths = isPartner
      ? ['/', '/ecommerce', '/ecommerce/vendas', '/ecommerce/carrinhos', '/whatsapp/chat']
      : ['/', '/leads', '/vendas', '/whatsapp/chat', '/add-receptivo', '/minhas-entregas', '/expedicao'];
    
    for (const path of priorityPaths) {
      if (items.length >= 4) break;
      for (const group of navGroups) {
        const found = group.items.find(item => item.path === path);
        if (found && !items.some(i => i.path === found.path)) {
          items.push(found);
          break;
        }
      }
    }

    return items;
  }, [navGroups]);

  // Find current group based on location
  const currentGroup = useMemo(() => {
    for (const group of navGroups) {
      if (group.items.some(item => location.pathname === item.path || location.pathname.startsWith(item.path + '/'))) {
        return group.id;
      }
    }
    return null;
  }, [navGroups, location.pathname]);

  const handleNavigate = (path: string) => {
    navigate(path);
    setIsOpen(false);
    setExpandedGroup(null);
  };

  const toggleGroup = (groupId: string) => {
    setExpandedGroup(prev => prev === groupId ? null : groupId);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border lg:hidden safe-area-bottom">
      <div className="flex items-center justify-around h-16 px-1">
        {quickAccessItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => cn(
              'flex flex-col items-center justify-center gap-0.5 px-2 py-2 rounded-lg transition-all flex-1 max-w-[72px]',
              isActive
                ? 'text-primary bg-primary/10'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <item.icon className="w-5 h-5" />
            <span className="text-[9px] font-medium truncate w-full text-center">{item.label}</span>
          </NavLink>
        ))}
        
        {/* Full Menu Sheet */}
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>
            <button className={cn(
              "flex flex-col items-center justify-center gap-0.5 px-2 py-2 rounded-lg transition-all flex-1 max-w-[72px]",
              isOpen ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground"
            )}>
              <Menu className="w-5 h-5" />
              <span className="text-[9px] font-medium">Todos</span>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[85vh] rounded-t-3xl p-0">
            <div className="flex flex-col h-full">
              {/* Header */}
              <SheetHeader className="px-4 py-4 border-b border-border flex-shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {displayLogo ? (
                      <img src={displayLogo} alt="Menu" className="h-8 w-auto max-w-[140px] object-contain" />
                    ) : (
                      <div className="h-8 w-24 bg-muted animate-pulse rounded" />
                    )}
                    <SheetTitle className="text-lg">Menu</SheetTitle>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}>
                    <X className="w-5 h-5" />
                  </Button>
                </div>
              </SheetHeader>

              {/* User Info */}
              {user && (
                <div className="px-4 py-3 border-b border-border flex-shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold">
                      {profile?.first_name?.[0] || user.email?.[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate text-sm">
                        {profile ? `${profile.first_name} ${profile.last_name}` : user.email}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {isAdmin ? 'Administrador' : 'Usuário'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Navigation Groups */}
              <ScrollArea className="flex-1 px-2 py-2">
                <div className="space-y-1">
                  {navGroups.map((group) => (
                    <div key={group.id} className="rounded-xl overflow-hidden">
                      {/* Group Header - Expandable */}
                      <button
                        onClick={() => toggleGroup(group.id)}
                        className={cn(
                          "w-full flex items-center justify-between px-4 py-3 transition-colors",
                          expandedGroup === group.id || currentGroup === group.id
                            ? "bg-primary/10 text-primary"
                            : "bg-muted/50 text-foreground hover:bg-muted"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <group.icon className="w-5 h-5" />
                          <span className="font-medium">{group.label}</span>
                          <span className="text-xs text-muted-foreground bg-background/50 px-2 py-0.5 rounded-full">
                            {group.items.length}
                          </span>
                        </div>
                        <ChevronRight className={cn(
                          "w-4 h-4 transition-transform",
                          expandedGroup === group.id && "rotate-90"
                        )} />
                      </button>

                      {/* Group Items */}
                      {expandedGroup === group.id && (
                        <div className="bg-background/50 py-1">
                          {group.items.map((item) => (
                            <button
                              key={item.path}
                              onClick={() => handleNavigate(item.path)}
                              className={cn(
                                "w-full flex items-center gap-3 px-6 py-3 transition-colors",
                                location.pathname === item.path
                                  ? "bg-primary/10 text-primary"
                                  : "text-foreground hover:bg-muted/50"
                              )}
                            >
                              <item.icon className="w-4 h-4" />
                              <span className="text-sm">{item.label}</span>
                              {item.badge && (
                                <span className="ml-auto px-2 py-0.5 text-[10px] rounded-full bg-primary/20 text-primary">
                                  {item.badge}
                                </span>
                              )}
                              {location.pathname === item.path && (
                                <div className="ml-auto w-2 h-2 rounded-full bg-primary" />
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>

              {/* Footer - Theme Toggle and Logout */}
              <div className="px-4 py-4 border-t border-border flex-shrink-0 safe-area-bottom">
                <div className="flex items-center gap-2">
                  <ThemeToggle />
                  <Button
                    variant="ghost"
                    className="flex-1 justify-start gap-3 text-destructive hover:text-destructive hover:bg-destructive/10 h-12"
                    onClick={handleSignOut}
                  >
                    <LogOut className="w-5 h-5" />
                    Sair da conta
                  </Button>
                </div>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}
