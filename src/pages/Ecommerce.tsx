import { useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Store, FileText, ShoppingCart, Wallet, Users, Phone, Mail, Factory } from 'lucide-react';
import { StorefrontsManager } from '@/components/ecommerce/StorefrontsManager';
import { LandingPagesManager } from '@/components/ecommerce/LandingPagesManager';
import { CartsManager } from '@/components/ecommerce/CartsManager';
import { VirtualAccountPanel } from '@/components/ecommerce/VirtualAccountPanel';
import { AffiliatesManager } from '@/components/ecommerce/AffiliatesManager';
import { IndustriesManager } from '@/components/ecommerce/IndustriesManager';
import TelesalesPanel from '@/pages/ecommerce/TelesalesPanel';
import { EmailMarketingManager } from '@/pages/ecommerce/EmailMarketingManager';
export default function Ecommerce() {
  const [activeTab, setActiveTab] = useState('storefronts');

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
          <TabsList className="grid w-full grid-cols-4 lg:grid-cols-7 lg:w-auto lg:inline-grid">
            <TabsTrigger value="storefronts" className="gap-2">
              <Store className="h-4 w-4" />
              <span className="hidden sm:inline">Lojas</span>
            </TabsTrigger>
            <TabsTrigger value="landing-pages" className="gap-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Landings</span>
            </TabsTrigger>
            <TabsTrigger value="carts" className="gap-2">
              <ShoppingCart className="h-4 w-4" />
              <span className="hidden sm:inline">Carrinhos</span>
            </TabsTrigger>
            <TabsTrigger value="email" className="gap-2">
              <Mail className="h-4 w-4" />
              <span className="hidden sm:inline">E-mails</span>
            </TabsTrigger>
            <TabsTrigger value="affiliates" className="gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Afiliados</span>
            </TabsTrigger>
            <TabsTrigger value="industries" className="gap-2">
              <Factory className="h-4 w-4" />
              <span className="hidden sm:inline">Indústrias</span>
            </TabsTrigger>
            <TabsTrigger value="wallet" className="gap-2">
              <Wallet className="h-4 w-4" />
              <span className="hidden sm:inline">Carteira</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="storefronts" className="mt-6">
            <StorefrontsManager />
          </TabsContent>

          <TabsContent value="landing-pages" className="mt-6">
            <LandingPagesManager />
          </TabsContent>

          <TabsContent value="carts" className="mt-6">
            <CartsManager />
          </TabsContent>

          <TabsContent value="email" className="mt-6">
            <EmailMarketingManager />
          </TabsContent>

          <TabsContent value="affiliates" className="mt-6">
            <AffiliatesManager />
          </TabsContent>

          <TabsContent value="industries" className="mt-6">
            <IndustriesManager />
          </TabsContent>

          <TabsContent value="wallet" className="mt-6">
            <VirtualAccountPanel />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
