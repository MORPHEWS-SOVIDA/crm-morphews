import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { queryClient } from "@/lib/queryClient";
import { UtmProvider } from "@/hooks/useUtmTracker";
import { HelmetProvider } from "react-helmet-async";
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
  </div>
);

// Eagerly loaded (critical path)
import Home from "./pages/Home";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";

// Lazy loaded pages - grouped by module for better code splitting
// Auth
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const ForcePasswordChange = lazy(() => import("./pages/ForcePasswordChange"));
const TwoFactorAuth = lazy(() => import("./pages/TwoFactorAuth"));
const AuthError = lazy(() => import("./pages/AuthError"));

// Public
const Planos = lazy(() => import("./pages/Planos"));
const DirectCheckout = lazy(() => import("./pages/DirectCheckout"));
const SignupSuccess = lazy(() => import("./pages/SignupSuccess"));
const Legal = lazy(() => import("./pages/Legal"));
const Power = lazy(() => import("./pages/Power"));
const NichePage = lazy(() => import("./pages/niches"));
const PublicLandingPage = lazy(() => import("./pages/ecommerce/PublicLandingPage"));
const PublicHelper = lazy(() => import("./pages/PublicHelper"));
const PaymentSuccess = lazy(() => import("./pages/ecommerce/PaymentSuccess"));
const PaymentCanceled = lazy(() => import("./pages/ecommerce/PaymentCanceled"));
const UniversalCheckout = lazy(() => import("./pages/ecommerce/UniversalCheckout"));
const PublicCheckoutPage = lazy(() => import("./pages/ecommerce/PublicCheckoutPage"));
const QuizPublic = lazy(() => import("./pages/QuizPublic"));

const LeadsList = lazy(() => import("./pages/LeadsList"));
const LeadDetail = lazy(() => import("./pages/LeadDetail"));
const NewLead = lazy(() => import("./pages/NewLead"));
const EditLead = lazy(() => import("./pages/EditLead"));

// Sales
const Sales = lazy(() => import("./pages/Sales"));
const NewSale = lazy(() => import("./pages/NewSale"));
const EditSale = lazy(() => import("./pages/EditSale"));
const SaleDetail = lazy(() => import("./pages/SaleDetail"));
const SalesDashboard = lazy(() => import("./pages/SalesDashboard"));
const SalesReport = lazy(() => import("./pages/SalesReport"));
const Attribution = lazy(() => import("./pages/Attribution"));
const PosTransactionsReport = lazy(() => import("./pages/PosTransactionsReport"));

// Products & Stock
const Products = lazy(() => import("./pages/Products"));
const ManipulatedCosts = lazy(() => import("./pages/ManipulatedCosts"));
const ProductCombos = lazy(() => import("./pages/ProductCombos"));
const ComboForm = lazy(() => import("./pages/ComboForm"));
const PurchaseInvoices = lazy(() => import("./pages/PurchaseInvoices"));

// Expedition & Deliveries
const Expedition = lazy(() => import("./pages/Expedition"));
const ExpeditionReport = lazy(() => import("./pages/ExpeditionReport"));
const CorreiosLabels = lazy(() => import("./pages/CorreiosLabels"));
const MyDeliveries = lazy(() => import("./pages/MyDeliveries"));
const AllDeliveries = lazy(() => import("./pages/AllDeliveries"));
const RomaneioPrint = lazy(() => import("./pages/RomaneioPrint"));
const RomaneioBatchPrint = lazy(() => import("./pages/RomaneioBatchPrint"));

// WhatsApp
const WhatsAppDMs = lazy(() => import("./pages/WhatsAppDMs"));
const WhatsAppChat = lazy(() => import("./pages/WhatsAppChat"));
const WhatsAppNPS = lazy(() => import("./pages/WhatsAppNPS"));
const WhatsAppGlobalConfig = lazy(() => import("./pages/WhatsAppGlobalConfig"));

// Instagram
const InstagramDMs = lazy(() => import("./pages/InstagramDMs"));

// Team & Settings
const Team = lazy(() => import("./pages/Team"));
const Settings = lazy(() => import("./pages/Settings"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const Integrations = lazy(() => import("./pages/Integrations"));

// Dashboards
const DashboardKanban = lazy(() => import("./pages/DashboardKanban"));
const SellerPanel = lazy(() => import("./pages/SellerPanel"));

// Post-Sale & SAC
const PostSaleKanban = lazy(() => import("./pages/PostSaleKanban"));
const SAC = lazy(() => import("./pages/SAC"));
const ScheduledMessages = lazy(() => import("./pages/ScheduledMessages"));

// Financial
const Financial = lazy(() => import("./pages/Financial"));

// Receptive
const AddReceptivo = lazy(() => import("./pages/AddReceptivo"));
const ReceptiveManagement = lazy(() => import("./pages/ReceptiveManagement"));

// AI & Demands
const AIBots = lazy(() => import("./pages/AIBots"));
const Demands = lazy(() => import("./pages/Demands"));
const DemandsSettings = lazy(() => import("./pages/DemandsSettings"));

// Fiscal
const FiscalInvoices = lazy(() => import("./pages/FiscalInvoices"));
const FiscalInvoiceDetail = lazy(() => import("./pages/FiscalInvoiceDetail"));

// Admin
const SuperAdmin = lazy(() => import("./pages/SuperAdmin"));
const FeatureOverrides = lazy(() => import("./pages/super-admin/FeatureOverrides"));
const PlanEditorPage = lazy(() => import("./pages/super-admin/PlanEditorPage"));
const InterestedLeads = lazy(() => import("./pages/InterestedLeads"));
const Cadastro = lazy(() => import("./pages/Cadastro"));

// Ecommerce
const Ecommerce = lazy(() => import("./pages/Ecommerce"));
const LandingPageEditor = lazy(() => import("./pages/ecommerce/LandingPageEditor"));
const EcommerceLojas = lazy(() => import("./pages/ecommerce/EcommerceLojas"));
const EcommerceLandings = lazy(() => import("./pages/ecommerce/EcommerceLandings"));
const EcommerceCarrinhos = lazy(() => import("./pages/ecommerce/EcommerceCarrinhos"));
const EcommerceVendas = lazy(() => import("./pages/ecommerce/EcommerceVendas"));
const EcommerceOrderDetail = lazy(() => import("./pages/ecommerce/EcommerceOrderDetail"));
const EcommerceEmails = lazy(() => import("./pages/ecommerce/EcommerceEmails"));
const EcommerceAfiliados = lazy(() => import("./pages/ecommerce/EcommerceAfiliados"));
const EcommerceIndustrias = lazy(() => import("./pages/ecommerce/EcommerceIndustrias"));
const EcommerceCarteira = lazy(() => import("./pages/ecommerce/EcommerceCarteira"));
const CheckoutsPage = lazy(() => import("./pages/ecommerce/CheckoutsPage"));
// Public Storefront
const StorefrontPublic = lazy(() => import("./pages/StorefrontPublic"));
const StorefrontHome = lazy(() => import("./components/storefront/StorefrontHome").then(m => ({ default: m.StorefrontHome })));
const StorefrontProducts = lazy(() => import("./components/storefront/StorefrontProducts").then(m => ({ default: m.StorefrontProducts })));
const StorefrontCategory = lazy(() => import("./components/storefront/StorefrontCategory").then(m => ({ default: m.StorefrontCategory })));
const StorefrontProductPage = lazy(() => import("./components/storefront/StorefrontProductPage").then(m => ({ default: m.StorefrontProductPage })));
const StorefrontCart = lazy(() => import("./components/storefront/StorefrontCart").then(m => ({ default: m.StorefrontCart })));
const StorefrontCheckout = lazy(() => import("./components/storefront/StorefrontCheckout").then(m => ({ default: m.StorefrontCheckout })));
const StorefrontPage = lazy(() => import("./components/storefront/StorefrontPage").then(m => ({ default: m.StorefrontPage })));
const StorefrontOrderConfirmed = lazy(() => import("./components/storefront/StorefrontOrderConfirmed").then(m => ({ default: m.StorefrontOrderConfirmed })));
const StorefrontPixPayment = lazy(() => import("./components/storefront/StorefrontPixPayment").then(m => ({ default: m.StorefrontPixPayment })));

const App = () => (
  <HelmetProvider>
  <QueryClientProvider client={queryClient}>
    <UtmProvider>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <ErrorBoundary title="Ops! Algo deu errado">
              <Suspense fallback={<PageLoader />}>
              <Routes>
                {/* Public routes */}
                <Route path="/login" element={<Login />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/force-password-change" element={<ForcePasswordChange />} />
                <Route path="/setup" element={<Login />} />
                <Route path="/planos" element={<Planos />} />
                <Route path="/2026" element={<Power />} />
                <Route path="/para/:niche" element={<NichePage />} />
                <Route path="/checkout" element={<DirectCheckout />} />
                <Route path="/signup-success" element={<SignupSuccess />} />
                <Route path="/auth/error" element={<AuthError />} />
                <Route path="/legal" element={<Legal />} />
                <Route path="/lp/:slug" element={<PublicLandingPage />} />
                <Route path="/helper" element={<PublicHelper />} />
                <Route path="/pagamento-sucesso" element={<PaymentSuccess />} />
                <Route path="/pagamento-cancelado" element={<PaymentCanceled />} />
                <Route path="/c/:cartId" element={<UniversalCheckout />} />
                <Route path="/pay/:slug" element={<PublicCheckoutPage />} />
                <Route path="/quiz/:slug" element={<QuizPublic />} />

                {/* Public Storefront Routes */}
                <Route path="/loja/:slug" element={<StorefrontPublic />}>
                  <Route index element={<StorefrontHome />} />
                  <Route path="produtos" element={<StorefrontProducts />} />
                  <Route path="categoria/:categorySlug" element={<StorefrontCategory />} />
                  <Route path="produto/:productId" element={<StorefrontProductPage />} />
                  <Route path="carrinho" element={<StorefrontCart />} />
                  <Route path="checkout" element={<StorefrontCheckout />} />
                  <Route path="pagina/:pageSlug" element={<StorefrontPage />} />
                  <Route path="pedido-confirmado" element={<StorefrontOrderConfirmed />} />
                  <Route path="pix-pagamento" element={<StorefrontPixPayment />} />
                </Route>

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
                  path="/whatsapp/nps"
                  element={
                    <ProtectedRoute requiredPermissions={['whatsapp_view']}>
                      <WhatsAppNPS />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/whatsapp/global-config"
                  element={
                    <ProtectedRoute requiredPermissions={['whatsapp_ai_settings_view']}>
                      <WhatsAppGlobalConfig />
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
                <Route
                  path="/super-admin/feature-overrides"
                  element={
                    <ProtectedRoute requireAdmin>
                      <FeatureOverrides />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/super-admin/plan-editor"
                  element={
                    <ProtectedRoute requireAdmin>
                      <PlanEditorPage />
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
                <Route
                  path="/produtos/combos"
                  element={
                    <ProtectedRoute requiredPermissions={['products_view']}>
                      <ProductCombos />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/produtos/combos/:id"
                  element={
                    <ProtectedRoute requiredPermissions={['products_view']}>
                      <ComboForm />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/produtos/custos-manipulados"
                  element={
                    <ProtectedRoute requiredPermissions={['products_view_cost']}>
                      <ManipulatedCosts />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/produtos/notas-entrada"
                  element={
                    <ProtectedRoute requiredPermissions={['products_manage']}>
                      <PurchaseInvoices />
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
                <Route
                  path="/expedicao/etiquetas-correios"
                  element={
                    <ProtectedRoute requiredPermissions={['deliveries_view_all']}>
                      <CorreiosLabels />
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
                <Route
                  path="/relatorios/atribuicao"
                  element={
                    <ProtectedRoute requiredPermissions={['reports_view']}>
                      <ErrorBoundary title="Atribuição indisponível">
                        <Attribution />
                      </ErrorBoundary>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/relatorios/transacoes-pos"
                  element={
                    <ProtectedRoute requiredPermissions={['reports_view']}>
                      <ErrorBoundary title="Transações POS indisponíveis">
                        <PosTransactionsReport />
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
                
                {/* Fiscal Invoices */}
                <Route
                  path="/notas-fiscais"
                  element={
                    <ProtectedRoute requiredPermissions={['settings_view']}>
                      <FiscalInvoices />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/notas-fiscais/:id"
                  element={
                    <ProtectedRoute requiredPermissions={['settings_view']}>
                      <FiscalInvoiceDetail />
                    </ProtectedRoute>
                  }
                />
                
                {/* Integrations */}
                <Route
                  path="/integracoes"
                  element={
                    <ProtectedRoute requiredPermissions={['settings_view']}>
                      <Integrations />
                    </ProtectedRoute>
                  }
                />
                
                {/* Demands Settings */}
                <Route
                  path="/demandas/configuracoes"
                  element={
                    <ProtectedRoute requiredPermissions={['settings_view']}>
                      <DemandsSettings />
                    </ProtectedRoute>
                  }
                />
                
                {/* Ecommerce - Main redirect */}
                <Route
                  path="/ecommerce"
                  element={
                    <ProtectedRoute requiredPermissions={['settings_view']}>
                      <EcommerceLojas />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/ecommerce/lojas"
                  element={
                    <ProtectedRoute requiredPermissions={['settings_view']}>
                      <EcommerceLojas />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/ecommerce/landings"
                  element={
                    <ProtectedRoute requiredPermissions={['settings_view']}>
                      <EcommerceLandings />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/ecommerce/checkouts"
                  element={
                    <ProtectedRoute requiredPermissions={['settings_view']}>
                      <CheckoutsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/ecommerce/vendas"
                  element={
                    <ProtectedRoute requiredPermissions={['settings_view']}>
                      <EcommerceVendas />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/ecommerce/vendas/:orderId"
                  element={
                    <ProtectedRoute requiredPermissions={['settings_view']}>
                      <EcommerceOrderDetail />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/ecommerce/carrinhos"
                  element={
                    <ProtectedRoute requiredPermissions={['settings_view']}>
                      <EcommerceCarrinhos />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/ecommerce/emails"
                  element={
                    <ProtectedRoute requiredPermissions={['settings_view']}>
                      <EcommerceEmails />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/ecommerce/afiliados"
                  element={
                    <ProtectedRoute requiredPermissions={['settings_view']}>
                      <EcommerceAfiliados />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/ecommerce/industrias"
                  element={
                    <ProtectedRoute requiredPermissions={['settings_view']}>
                      <EcommerceIndustrias />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/ecommerce/carteira"
                  element={
                    <ProtectedRoute requiredPermissions={['settings_view']}>
                      <EcommerceCarteira />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/ecommerce/landpage-editor/:id"
                  element={
                    <ProtectedRoute requiredPermissions={['settings_view']}>
                      <LandingPageEditor />
                    </ProtectedRoute>
                  }
                />

                {/* 404 */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </UtmProvider>
  </QueryClientProvider>
  </HelmetProvider>
);

export default App;
