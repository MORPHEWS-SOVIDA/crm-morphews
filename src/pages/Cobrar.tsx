import { useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PaymentLinksTab } from '@/components/payment-links/PaymentLinksTab';
import { TransactionsTab } from '@/components/payment-links/TransactionsTab';
import { TelesalesTab } from '@/components/payment-links/TelesalesTab';
import { WalletTab } from '@/components/payment-links/WalletTab';
import { useOrgFeatures } from '@/hooks/usePlanFeatures';
import { useMyPermissions } from '@/hooks/useUserPermissions';
import { useAuth } from '@/hooks/useAuth';
import { Link2, Receipt, Phone, Wallet } from 'lucide-react';

export default function Cobrar() {
  const [activeTab, setActiveTab] = useState('links');
  const { isAdmin } = useAuth();
  const { data: permissions } = useMyPermissions();
  const { data: orgFeatures, isLoading: featuresLoading } = useOrgFeatures();
  
  // Check features
  const hasPaymentLinks = orgFeatures?.payment_links ?? true;
  const hasTelesales = orgFeatures?.telesales ?? true;
  const hasVirtualWallet = orgFeatures?.virtual_wallet ?? true;
  
  // Check permissions - using existing permission fields
  const canCreateLinks = isAdmin || permissions?.payment_gateways_manage;
  const canViewTransactions = isAdmin || permissions?.virtual_wallet_view;
  const canTelesales = isAdmin || permissions?.telesales_manage;
  const canManageBank = isAdmin || permissions?.virtual_wallet_view;
  const canWithdraw = isAdmin || permissions?.virtual_wallet_view;

  if (featuresLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </Layout>
    );
  }

  // Determine the first available tab
  const getDefaultTab = () => {
    if (hasPaymentLinks && canCreateLinks) return 'links';
    if (canViewTransactions) return 'transactions';
    if (hasTelesales && canTelesales) return 'telesales';
    if (hasVirtualWallet && (canManageBank || canWithdraw)) return 'wallet';
    return 'links';
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Cobranças</h1>
          <p className="text-muted-foreground">
            Crie links de pagamento, gerencie transações e realize cobranças
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} defaultValue={getDefaultTab()}>
          <TabsList className="grid w-full max-w-2xl grid-cols-4">
            {hasPaymentLinks && canCreateLinks && (
              <TabsTrigger value="links" className="flex items-center gap-2">
                <Link2 className="h-4 w-4" />
                <span className="hidden sm:inline">Links</span>
              </TabsTrigger>
            )}
            {canViewTransactions && (
              <TabsTrigger value="transactions" className="flex items-center gap-2">
                <Receipt className="h-4 w-4" />
                <span className="hidden sm:inline">Transações</span>
              </TabsTrigger>
            )}
            {hasTelesales && canTelesales && (
              <TabsTrigger value="telesales" className="flex items-center gap-2">
                <Phone className="h-4 w-4" />
                <span className="hidden sm:inline">Televendas</span>
              </TabsTrigger>
            )}
            {hasVirtualWallet && (canManageBank || canWithdraw) && (
              <TabsTrigger value="wallet" className="flex items-center gap-2">
                <Wallet className="h-4 w-4" />
                <span className="hidden sm:inline">Carteira</span>
              </TabsTrigger>
            )}
          </TabsList>

          {hasPaymentLinks && canCreateLinks && (
            <TabsContent value="links" className="mt-6">
              <PaymentLinksTab />
            </TabsContent>
          )}
          
          {canViewTransactions && (
            <TabsContent value="transactions" className="mt-6">
              <TransactionsTab />
            </TabsContent>
          )}
          
          {hasTelesales && canTelesales && (
            <TabsContent value="telesales" className="mt-6">
              <TelesalesTab />
            </TabsContent>
          )}
          
          {hasVirtualWallet && (canManageBank || canWithdraw) && (
            <TabsContent value="wallet" className="mt-6">
              <WalletTab 
                canManageBank={canManageBank ?? false} 
                canWithdraw={canWithdraw ?? false} 
              />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </Layout>
  );
}
