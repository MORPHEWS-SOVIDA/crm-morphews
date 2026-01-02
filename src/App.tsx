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
import InterestedLeads from "./pages/InterestedLeads";
import SuperAdmin from "./pages/SuperAdmin";
import Onboarding from "./pages/Onboarding";
import Team from "./pages/Team";
import Products from "./pages/Products";
import Sales from "./pages/Sales";
import NewSale from "./pages/NewSale";
import SaleDetail from "./pages/SaleDetail";
import RomaneioPrint from "./pages/RomaneioPrint";
import MyDeliveries from "./pages/MyDeliveries";
import SalesReport from "./pages/SalesReport";
import FinancialReport from "./pages/FinancialReport";
import SignupSuccess from "./pages/SignupSuccess";
import AddReceptivo from "./pages/AddReceptivo";
import WhatsAppV2 from "./pages/WhatsAppV2";
import NotFound from "./pages/NotFound";
import AuthError from "./pages/AuthError";

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
              <Route path="/signup-success" element={<SignupSuccess />} />
              <Route path="/auth/error" element={<AuthError />} />

              {/* Home - shows landing for non-auth, dashboard for auth */}
              <Route path="/" element={<Home />} />

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
              
              {/* Instagram - available to all authenticated */}
              <Route
                path="/instagram"
                element={
                  <ProtectedRoute>
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
              
              {/* Team - any authenticated user can view their team */}
              <Route
                path="/equipe"
                element={
                  <ProtectedRoute>
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
                path="/vendas/:id/romaneio"
                element={
                  <ProtectedRoute requiredPermissions={['sales_view']}>
                    <RomaneioPrint />
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
              
              {/* Financial - require reports_view or sales_confirm_payment */}
              <Route
                path="/financeiro"
                element={
                  <ProtectedRoute requiredPermissions={['reports_view', 'sales_confirm_payment']}>
                    <FinancialReport />
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

              <Route path="*" element={<NotFound />} />
            </Routes>
          </ErrorBoundary>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
