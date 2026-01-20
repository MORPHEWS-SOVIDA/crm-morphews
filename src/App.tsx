import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import Home from "./pages/Home";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import ForcePasswordChange from "./pages/ForcePasswordChange";
import Setup from "./pages/Setup";
import Cadastro from "./pages/Cadastro";
import LeadsList from "./pages/LeadsList";
import LeadDetail from "./pages/LeadDetail";
import NewLead from "./pages/NewLead";
import EditLead from "./pages/EditLead";
import Settings from "./pages/Settings";
import InstagramDMs from "./pages/InstagramDMs";
import WhatsAppDMs from "./pages/WhatsAppDMs";
import WhatsAppChat from "./pages/WhatsAppChat";
import Planos from "./pages/Planos";
import DirectCheckout from "./pages/DirectCheckout";
import InterestedLeads from "./pages/InterestedLeads";
import SuperAdmin from "./pages/SuperAdmin";
import Onboarding from "./pages/Onboarding";
import Team from "./pages/Team";
import Products from "./pages/Products";
import Sales from "./pages/Sales";
import NewSale from "./pages/NewSale";
import EditSale from "./pages/EditSale";
import SaleDetail from "./pages/SaleDetail";
import RomaneioPrint from "./pages/RomaneioPrint";
import RomaneioBatchPrint from "./pages/RomaneioBatchPrint";
import MyDeliveries from "./pages/MyDeliveries";
import AllDeliveries from "./pages/AllDeliveries";
import SalesReport from "./pages/SalesReport";
import Financial from "./pages/Financial";
import SignupSuccess from "./pages/SignupSuccess";
import AddReceptivo from "./pages/AddReceptivo";
import ReceptiveManagement from "./pages/ReceptiveManagement";
import WhatsAppV2 from "./pages/WhatsAppV2";
import TwoFactorAuth from "./pages/TwoFactorAuth";
import PostSaleKanban from "./pages/PostSaleKanban";
import SalesDashboard from "./pages/SalesDashboard";
import SAC from "./pages/SAC";
import ScheduledMessages from "./pages/ScheduledMessages";
import ExpeditionReport from "./pages/ExpeditionReport";
import Expedition from "./pages/Expedition";
import Legal from "./pages/Legal";
import NotFound from "./pages/NotFound";
import AuthError from "./pages/AuthError";
import AIBots from "./pages/AIBots";
import Demands from "./pages/Demands";
import DemandsSettings from "./pages/DemandsSettings";
import SellerPanel from "./pages/SellerPanel";
import DashboardKanban from "./pages/DashboardKanban";
import Integrations from "./pages/Integrations";
import Power from "./pages/Power";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <ErrorBoundary title="Ops! Algo deu errado">
            <Routes>
              {/* Public routes */}
              <Route path="/login" element={<Login />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/force-password-change" element={<ForcePasswordChange />} />
              <Route path="/setup" element={<Setup />} />
              <Route path="/planos" element={<Planos />} />
              <Route path="/power" element={<Power />} />
              <Route path="/checkout" element={<DirectCheckout />} />
              <Route path="/signup-success" element={<SignupSuccess />} />
              <Route path="/auth/error" element={<AuthError />} />
              <Route path="/legal" element={<Legal />} />

              {/* Home - shows landing for non-auth, dashboard funnel for auth */}
              <Route path="/" element={<Home />} />
              
              {/* Dashboard Kanban - separate view */}
              <Route
                path="/dashboard-kanban"
                element={
                  <ProtectedRoute requiredPermissions={['dashboard_kanban_view']}>
                    <DashboardKanban />
                  </ProtectedRoute>
                }
              />

              {/* Leads - require leads_view permission */}
              <Route
                path="/leads"
                element={
                  <ProtectedRoute requiredPermissions={['leads_view']}>
                    <LeadsList />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/leads/new"
                element={
                  <ProtectedRoute requiredPermissions={['leads_create']}>
                    <NewLead />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/leads/:id"
                element={
                  <ProtectedRoute requiredPermissions={['leads_view']}>
                    <LeadDetail />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/leads/:id/edit"
                element={
                  <ProtectedRoute requiredPermissions={['leads_edit']}>
                    <EditLead />
                  </ProtectedRoute>
                }
              />
              
              {/* Admin only routes */}
              <Route
                path="/cadastro"
                element={
                  <ProtectedRoute requireAdmin>
                    <Cadastro />
                  </ProtectedRoute>
                }
              />
              
              {/* Settings - require settings_view */}
              <Route
                path="/settings"
                element={
                  <ProtectedRoute requiredPermissions={['settings_view']}>
                    <Settings />
                  </ProtectedRoute>
                }
              />
              
              {/* Instagram - require instagram_view */}
              <Route
                path="/instagram"
                element={
                  <ProtectedRoute requiredPermissions={['instagram_view']}>
                    <InstagramDMs />
                  </ProtectedRoute>
                }
              />
              
              {/* WhatsApp - require whatsapp_view */}
              <Route
                path="/whatsapp"
                element={
                  <ProtectedRoute requiredPermissions={['whatsapp_view']}>
                    <WhatsAppDMs />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/whatsapp/chat"
                element={
                  <ProtectedRoute requiredPermissions={['whatsapp_view']}>
                    <WhatsAppChat />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/whatsapp-v2"
                element={
                  <ProtectedRoute requiredPermissions={['whatsapp_view']}>
                    <WhatsAppV2 />
                  </ProtectedRoute>
                }
              />
              
              {/* Post-Sale - require post_sale_view */}
              <Route
                path="/pos-venda"
                element={
                  <ProtectedRoute requiredPermissions={['post_sale_view']}>
                    <PostSaleKanban />
                  </ProtectedRoute>
                }
              />
              
              {/* SAC - require sac_view */}
              <Route
                path="/sac"
                element={
                  <ProtectedRoute requiredPermissions={['sac_view']}>
                    <SAC />
                  </ProtectedRoute>
                }
              />
              
              {/* Admin only */}
              <Route
                path="/interessados"
                element={
                  <ProtectedRoute requireAdmin>
                    <InterestedLeads />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/super-admin"
                element={
                  <ProtectedRoute requireAdmin>
                    <SuperAdmin />
                  </ProtectedRoute>
                }
              />
              
              {/* Onboarding - any authenticated user */}
              <Route
                path="/onboarding"
                element={
                  <ProtectedRoute>
                    <Onboarding />
                  </ProtectedRoute>
                }
              />
              
              {/* Team - require team_view */}
              <Route
                path="/equipe"
                element={
                  <ProtectedRoute requiredPermissions={['team_view']}>
                    <Team />
                  </ProtectedRoute>
                }
              />
              
              {/* Products - require products_view */}
              <Route
                path="/produtos"
                element={
                  <ProtectedRoute requiredPermissions={['products_view']}>
                    <Products />
                  </ProtectedRoute>
                }
              />
              
              {/* Sales Dashboard - require sales_view */}
              <Route
                path="/dashboard-vendas"
                element={
                  <ProtectedRoute requiredPermissions={['sales_view']}>
                    <SalesDashboard />
                  </ProtectedRoute>
                }
              />
              
              {/* Seller Panel - personal seller dashboard */}
              <Route
                path="/meu-painel"
                element={
                  <ProtectedRoute requiredPermissions={['seller_panel_view']}>
                    <SellerPanel />
                  </ProtectedRoute>
                }
              />

              {/* Sales - require sales_view */}
              <Route
                path="/vendas"
                element={
                  <ProtectedRoute requiredPermissions={['sales_view']}>
                    <Sales />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/vendas/nova"
                element={
                  <ProtectedRoute requiredPermissions={['sales_create']}>
                    <NewSale />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/vendas/:id"
                element={
                  <ProtectedRoute requiredPermissions={['sales_view']}>
                    <SaleDetail />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/vendas/:id/editar"
                element={
                  <ProtectedRoute requiredPermissions={['sales_edit_draft']}>
                    <EditSale />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/vendas/:id/romaneio"
                element={
                  <ProtectedRoute requiredPermissions={['sales_view']}>
                    <RomaneioPrint />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/romaneios/lote"
                element={
                  <ProtectedRoute requiredPermissions={['sales_view']}>
                    <RomaneioBatchPrint />
                  </ProtectedRoute>
                }
              />
              
              {/* Deliveries - require deliveries_view_own or deliveries_view_all */}
              <Route
                path="/minhas-entregas"
                element={
                  <ProtectedRoute requiredPermissions={['deliveries_view_own', 'deliveries_view_all']}>
                    <MyDeliveries />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/todas-entregas"
                element={
                  <ProtectedRoute requiredPermissions={['deliveries_view_all']}>
                    <AllDeliveries />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/expedicao"
                element={
                  <ProtectedRoute requiredPermissions={['deliveries_view_all', 'sales_validate_expedition']}>
                    <Expedition />
                  </ProtectedRoute>
                }
              />
              
              {/* 2FA - for managers only */}
              <Route
                path="/2fa"
                element={
                  <ProtectedRoute>
                    <TwoFactorAuth />
                  </ProtectedRoute>
                }
              />
              
              {/* Reports - require reports_view */}
              <Route
                path="/relatorios/vendas"
                element={
                  <ProtectedRoute requiredPermissions={['reports_view']}>
                    <ErrorBoundary title="Relatórios indisponíveis">
                      <SalesReport />
                    </ErrorBoundary>
                  </ProtectedRoute>
                }
              />
              
              {/* Financial - require reports_view only (sales_confirm_payment is for motoboy actions, not menu access) */}
              <Route
                path="/financeiro"
                element={
                  <ProtectedRoute requiredPermissions={['reports_view']}>
                    <Financial />
                  </ProtectedRoute>
                }
              />
              
              {/* Receptive - handled by its own module access hook but protected */}
              <Route
                path="/add-receptivo"
                element={
                  <ProtectedRoute requiredPermissions={['receptive_module_access']}>
                    <AddReceptivo />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/gerencia-receptivo"
                element={
                  <ProtectedRoute requiredPermissions={['receptive_module_access']}>
                    <ReceptiveManagement />
                  </ProtectedRoute>
                }
              />
              
              {/* Scheduled Messages - require scheduled_messages_view */}
              <Route
                path="/mensagens-agendadas"
                element={
                  <ProtectedRoute requiredPermissions={['scheduled_messages_view']}>
                    <ScheduledMessages />
                  </ProtectedRoute>
                }
              />
              
              {/* Expedition Report - require sales_view */}
              <Route
                path="/relatorios/expedicao"
                element={
                  <ProtectedRoute requiredPermissions={['sales_view']}>
                    <ExpeditionReport />
                  </ProtectedRoute>
                }
              />
              
              {/* AI Bots - require settings_view (admin) */}
              <Route
                path="/robos-ia"
                element={
                  <ProtectedRoute requiredPermissions={['settings_view']}>
                    <AIBots />
                  </ProtectedRoute>
                }
              />
              
              {/* Demands */}
              <Route
                path="/demandas"
                element={
                  <ProtectedRoute requiredPermissions={['settings_view']}>
                    <Demands />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/demandas/configuracoes"
                element={
                  <ProtectedRoute requiredPermissions={['settings_view']}>
                    <DemandsSettings />
                  </ProtectedRoute>
                }
              />
              
              {/* Integrations - require settings_view (admin) */}
              <Route
                path="/integracoes"
                element={
                  <ProtectedRoute requiredPermissions={['settings_view']}>
                    <Integrations />
                  </ProtectedRoute>
                }
              />

              <Route path="*" element={<NotFound />} />
            </Routes>
          </ErrorBoundary>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
