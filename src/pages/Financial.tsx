import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useMyPermissions } from '@/hooks/useUserPermissions';
import { type FinancialInstallment } from '@/hooks/useFinancialData';

// Components
import { FinancialDashboard } from '@/components/financial/FinancialDashboard';
import { ReceivablesTab } from '@/components/financial/ReceivablesTab';
import { PayablesTab } from '@/components/financial/PayablesTab';
import { CostCentersTab } from '@/components/financial/CostCentersTab';
import { CostCentersManager } from '@/components/financial/CostCentersManager';
import { BankAccountsTab } from '@/components/financial/BankAccountsTab';
import { CashFlowTab } from '@/components/financial/CashFlowTab';
import { ReconciliationTab } from '@/components/financial/ReconciliationTab';
import { SuppliersManager } from '@/components/financial/SuppliersManager';
import { BankAccountsManager } from '@/components/financial/BankAccountsManager';
import { ConfirmPaymentDialog, InstallmentDetailDialog } from '@/components/financial/FinancialDialogs';

import { 
  Wallet, 
  Receipt, 
  CreditCard,
  Building2, 
  Landmark, 
  TrendingUp, 
  FileCheck,
  Users,
  Settings
} from 'lucide-react';

export default function Financial() {
  const { data: permissions, isLoading: permissionsLoading } = useMyPermissions();
  
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedInstallment, setSelectedInstallment] = useState<FinancialInstallment | null>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  
  // Check permissions - only reports_view grants access to Financial module
  if (!permissionsLoading && !permissions?.reports_view) {
    return <Navigate to="/" replace />;
  }
  
  const handleViewInstallment = (item: FinancialInstallment) => {
    setSelectedInstallment(item);
    setDetailDialogOpen(true);
  };
  
  const handleConfirmPayment = (item: FinancialInstallment) => {
    setSelectedInstallment(item);
    setConfirmDialogOpen(true);
  };
  
  return (
    <Layout>
      <div className="container mx-auto py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              <Wallet className="h-8 w-8" />
              Financeiro
            </h1>
            <p className="text-muted-foreground mt-1">
              Gerencie contas a receber, fluxo de caixa e conciliação bancária
            </p>
          </div>
        </div>
        
        {/* Dashboard - Always visible */}
        <FinancialDashboard />
        
        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4 lg:grid-cols-8 lg:w-auto lg:inline-grid">
            <TabsTrigger value="receivables" className="gap-2">
              <Receipt className="h-4 w-4 hidden sm:inline" />
              A Receber
            </TabsTrigger>
            <TabsTrigger value="payables" className="gap-2">
              <CreditCard className="h-4 w-4 hidden sm:inline" />
              A Pagar
            </TabsTrigger>
            <TabsTrigger value="cash-flow" className="gap-2">
              <TrendingUp className="h-4 w-4 hidden sm:inline" />
              Fluxo
            </TabsTrigger>
            <TabsTrigger value="reconciliation" className="gap-2">
              <FileCheck className="h-4 w-4 hidden sm:inline" />
              Conciliação
            </TabsTrigger>
            <TabsTrigger value="banks-manage" className="gap-2">
              <Landmark className="h-4 w-4 hidden sm:inline" />
              Contas
            </TabsTrigger>
            <TabsTrigger value="suppliers" className="gap-2">
              <Users className="h-4 w-4 hidden sm:inline" />
              Fornecedores
            </TabsTrigger>
            <TabsTrigger value="cost-centers" className="gap-2">
              <Building2 className="h-4 w-4 hidden sm:inline" />
              Centros
            </TabsTrigger>
            <TabsTrigger value="banks" className="gap-2">
              <Settings className="h-4 w-4 hidden sm:inline" />
              Relatórios
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="receivables" className="mt-6">
            <ReceivablesTab 
              onViewInstallment={handleViewInstallment}
              onConfirmPayment={handleConfirmPayment}
            />
          </TabsContent>
          
          <TabsContent value="payables" className="mt-6">
            <PayablesTab />
          </TabsContent>
          
          <TabsContent value="cash-flow" className="mt-6">
            <CashFlowTab />
          </TabsContent>
          
          <TabsContent value="reconciliation" className="mt-6">
            <ReconciliationTab />
          </TabsContent>
          
          <TabsContent value="banks-manage" className="mt-6">
            <BankAccountsManager />
          </TabsContent>
          
          <TabsContent value="suppliers" className="mt-6">
            <SuppliersManager />
          </TabsContent>
          
          <TabsContent value="cost-centers" className="mt-6">
            <CostCentersManager />
          </TabsContent>
          
          <TabsContent value="banks" className="mt-6">
            <BankAccountsTab />
          </TabsContent>
        </Tabs>
      </div>
      
      {/* Dialogs */}
      <ConfirmPaymentDialog
        installment={selectedInstallment}
        open={confirmDialogOpen}
        onClose={() => {
          setConfirmDialogOpen(false);
          setSelectedInstallment(null);
        }}
      />
      
      <InstallmentDetailDialog
        installment={selectedInstallment}
        open={detailDialogOpen}
        onClose={() => {
          setDetailDialogOpen(false);
          setSelectedInstallment(null);
        }}
      />
    </Layout>
  );
}
