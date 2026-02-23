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
import { useParams, useNavigate } from 'react-router-dom';

const TAB_SLUG_MAP: Record<string, string> = {
  links: 'links',
  transacoes: 'transactions',
  televendas: 'telesales',
  carteira: 'wallet',
};
const SLUG_FROM_TAB: Record<string, string> = {
  links: 'links',
  transactions: 'transacoes',
  telesales: 'televendas',
  wallet: 'carteira',
};

export default function Cobrar() {
  const { tab: urlTab } = useParams<{ tab?: string }>();
  const navigate = useNavigate();
  const mappedTab = urlTab ? TAB_SLUG_MAP[urlTab] || 'links' : 'links';
  const { isAdmin } = useAuth();
  const { data: permissions } = useMyPermissions();
  const { data: orgFeatures, isLoading: featuresLoading } = useOrgFeatures();
  
  // Check features
  const hasPaymentLinks = orgFeatures?.payment_links ?? true;
  const hasTelesales = orgFeatures?.telesales ?? true;
  const hasVirtualWallet = orgFeatures?.virtual_wallet ?? true;
  
  // Check permissions - using actual permission fields
  const canCreateLinks = isAdmin || permissions?.payment_links_create;
  const canViewTransactions = isAdmin || permissions?.payment_links_view_transactions;
  const canTelesales = isAdmin || permissions?.telesales_charge_card;
  const canManageBank = isAdmin || permissions?.withdrawal_request;
  const canWithdraw = isAdmin || permissions?.withdrawal_request;

  if (featuresLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </Layout>
    );
  }

  // Determine visible tabs
  const visibleTabs = [
    hasPaymentLinks && canCreateLinks && 'links',
    canViewTransactions && 'transactions',
    hasTelesales && canTelesales && 'telesales',
    hasVirtualWallet && (canManageBank || canWithdraw) && 'wallet',
  ].filter(Boolean);

  const getDefaultTab = () => visibleTabs[0] as string || 'links';

  if (visibleTabs.length === 0) {
    return (
      <Layout>
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold">Cobranças</h1>
            <p className="text-muted-foreground">
              Crie links de pagamento, gerencie transações e realize cobranças
            </p>
          </div>
          <div className="flex items-center justify-center min-h-[300px] text-muted-foreground">
            <p>Você não possui permissões para acessar esta área. Solicite ao administrador.</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Cobranças</h1>
          <p className="text-muted-foreground">
            Crie links de pagamento, gerencie transações e realize cobranças
          </p>
        </div>

        <Tabs value={mappedTab} onValueChange={(v) => navigate(`/cobrar/${SLUG_FROM_TAB[v] || v}`, { replace: true })} defaultValue={getDefaultTab()}>
          <TabsList className={`grid w-full max-w-2xl`} style={{ gridTemplateColumns: `repeat(${visibleTabs.length}, minmax(0, 1fr))` }}>
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
