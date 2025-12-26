import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
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
import SignupSuccess from "./pages/SignupSuccess";
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
            
            {/* Protected routes */}
            <Route path="/leads" element={
              <ProtectedRoute>
                <LeadsList />
              </ProtectedRoute>
            } />
            <Route path="/leads/new" element={
              <ProtectedRoute>
                <NewLead />
              </ProtectedRoute>
            } />
            <Route path="/leads/:id" element={
              <ProtectedRoute>
                <LeadDetail />
              </ProtectedRoute>
            } />
            <Route path="/leads/:id/edit" element={
              <ProtectedRoute>
                <EditLead />
              </ProtectedRoute>
            } />
            <Route path="/cadastro" element={
              <ProtectedRoute requireAdmin>
                <Cadastro />
              </ProtectedRoute>
            } />
            <Route path="/settings" element={
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            } />
            <Route path="/instagram" element={
              <ProtectedRoute>
                <InstagramDMs />
              </ProtectedRoute>
            } />
            <Route path="/whatsapp" element={
              <ProtectedRoute>
                <WhatsAppDMs />
              </ProtectedRoute>
            } />
            <Route path="/whatsapp/chat" element={
              <ProtectedRoute>
                <WhatsAppChat />
              </ProtectedRoute>
            } />
            <Route path="/interessados" element={
              <ProtectedRoute requireAdmin>
                <InterestedLeads />
              </ProtectedRoute>
            } />
            <Route path="/super-admin" element={
              <ProtectedRoute requireAdmin>
                <SuperAdmin />
              </ProtectedRoute>
            } />
            <Route path="/onboarding" element={
              <ProtectedRoute>
                <Onboarding />
              </ProtectedRoute>
            } />
            <Route path="/equipe" element={
              <ProtectedRoute>
                <Team />
              </ProtectedRoute>
            } />
            <Route path="/produtos" element={
              <ProtectedRoute>
                <Products />
              </ProtectedRoute>
            } />
            <Route path="/vendas" element={
              <ProtectedRoute>
                <Sales />
              </ProtectedRoute>
            } />
            <Route path="/vendas/nova" element={
              <ProtectedRoute>
                <NewSale />
              </ProtectedRoute>
            } />
            
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
