import { useState, useEffect } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Store, FileText, ShoppingCart, Wallet, Users, Mail, Factory, ClipboardList } from 'lucide-react';
import { StorefrontsManager } from '@/components/ecommerce/StorefrontsManager';
import { LandingPagesManager } from '@/components/ecommerce/LandingPagesManager';
import { CartsManager } from '@/components/ecommerce/CartsManager';
import { VirtualAccountPanel } from '@/components/ecommerce/VirtualAccountPanel';
import { AffiliatesManager } from '@/components/ecommerce/AffiliatesManager';
import { IndustriesManager } from '@/components/ecommerce/IndustriesManager';
import { EmailMarketingManager } from '@/pages/ecommerce/EmailMarketingManager';
import { QuizManager } from '@/components/ecommerce/quiz';
import { useTenant } from '@/hooks/useTenant';

export default function Ecommerce() {
  const { role } = useTenant();
  const isPartner = role?.startsWith('partner_') ?? false;
  
  // Partners default to 'carts' tab, admins to 'storefronts'
  const [activeTab, setActiveTab] = useState(isPartner ? 'carts' : 'storefronts');
  
  // Update tab when role loads
  useEffect(() => {
    if (isPartner && activeTab === 'storefronts') {
      setActiveTab('carts');
    }
  }, [isPartner, activeTab]);

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">E-commerce</h1>
          <p className="text-muted-foreground">
            Gerencie suas lojas, landing pages e vendas online
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className={`grid w-full ${isPartner ? 'grid-cols-2 lg:w-auto lg:inline-grid' : 'grid-cols-4 lg:grid-cols-8 lg:w-auto lg:inline-grid'}`}>
            {!isPartner && (
              <TabsTrigger value="storefronts" className="gap-2">
                <Store className="h-4 w-4" />
                <span className="hidden sm:inline">Lojas</span>
              </TabsTrigger>
            )}
            {!isPartner && (
              <TabsTrigger value="landing-pages" className="gap-2">
                <FileText className="h-4 w-4" />
                <span className="hidden sm:inline">Landings</span>
              </TabsTrigger>
            )}
            {!isPartner && (
              <TabsTrigger value="quiz" className="gap-2">
                <ClipboardList className="h-4 w-4" />
                <span className="hidden sm:inline">Quiz</span>
              </TabsTrigger>
            )}
            <TabsTrigger value="carts" className="gap-2">
              <ShoppingCart className="h-4 w-4" />
              <span className="hidden sm:inline">Carrinhos</span>
            </TabsTrigger>
            {!isPartner && (
              <TabsTrigger value="email" className="gap-2">
                <Mail className="h-4 w-4" />
                <span className="hidden sm:inline">E-mails</span>
              </TabsTrigger>
            )}
            {!isPartner && (
              <TabsTrigger value="affiliates" className="gap-2">
                <Users className="h-4 w-4" />
                <span className="hidden sm:inline">Afiliados</span>
              </TabsTrigger>
            )}
            {!isPartner && (
              <TabsTrigger value="industries" className="gap-2">
                <Factory className="h-4 w-4" />
                <span className="hidden sm:inline">Indústrias</span>
              </TabsTrigger>
            )}
            <TabsTrigger value="wallet" className="gap-2">
              <Wallet className="h-4 w-4" />
              <span className="hidden sm:inline">Carteira</span>
            </TabsTrigger>
          </TabsList>

          {!isPartner && (
            <TabsContent value="storefronts" className="mt-6">
              <StorefrontsManager />
            </TabsContent>
          )}

          {!isPartner && (
            <TabsContent value="landing-pages" className="mt-6">
              <LandingPagesManager />
            </TabsContent>
          )}

          {!isPartner && (
            <TabsContent value="quiz" className="mt-6">
              <QuizManager />
            </TabsContent>
          )}

          <TabsContent value="carts" className="mt-6">
            <CartsManager />
          </TabsContent>

          {!isPartner && (
            <TabsContent value="email" className="mt-6">
              <EmailMarketingManager />
            </TabsContent>
          )}

          {!isPartner && (
            <TabsContent value="affiliates" className="mt-6">
              <AffiliatesManager />
            </TabsContent>
          )}

          {!isPartner && (
            <TabsContent value="industries" className="mt-6">
              <IndustriesManager />
            </TabsContent>
          )}

          <TabsContent value="wallet" className="mt-6">
            <VirtualAccountPanel />
          </TabsContent>

          <TabsContent value="wallet" className="mt-6">
            <VirtualAccountPanel />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
