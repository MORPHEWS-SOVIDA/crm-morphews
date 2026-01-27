import { useState } from 'react';
import { ArrowLeft, Image, FileText, Layers, Package, Settings, Mail, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useStorefront } from '@/hooks/ecommerce';
import { StorefrontBannersTab } from './tabs/StorefrontBannersTab';
import { StorefrontPagesTab } from './tabs/StorefrontPagesTab';
import { StorefrontCategoriesTab } from './tabs/StorefrontCategoriesTab';
import { StorefrontProductsTab } from './tabs/StorefrontProductsTab';
import { StorefrontSettingsTab } from './tabs/StorefrontSettingsTab';
import { StorefrontEmailSequences } from './StorefrontEmailSequences';
import { AffiliatesTab } from './affiliates/AffiliatesTab';
interface StorefrontDetailManagerProps {
  storefrontId: string;
  onBack: () => void;
}

export function StorefrontDetailManager({ storefrontId, onBack }: StorefrontDetailManagerProps) {
  const { data: storefront, isLoading } = useStorefront(storefrontId);
  const [activeTab, setActiveTab] = useState('banners');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!storefront) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Loja não encontrada</p>
        <Button variant="outline" onClick={onBack} className="mt-4">
          Voltar
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-3">
          {storefront.logo_url ? (
            <img
              src={storefront.logo_url}
              alt={storefront.name}
              className="h-10 w-10 rounded object-cover"
            />
          ) : (
            <div
              className="h-10 w-10 rounded flex items-center justify-center text-white font-bold"
              style={{ backgroundColor: storefront.primary_color }}
            >
              {storefront.name.charAt(0)}
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold">{storefront.name}</h1>
            <p className="text-sm text-muted-foreground">/{storefront.slug}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="banners" className="gap-2">
            <Image className="h-4 w-4" />
            <span className="hidden sm:inline">Banners</span>
          </TabsTrigger>
          <TabsTrigger value="pages" className="gap-2">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Páginas</span>
          </TabsTrigger>
          <TabsTrigger value="categories" className="gap-2">
            <Layers className="h-4 w-4" />
            <span className="hidden sm:inline">Categorias</span>
          </TabsTrigger>
          <TabsTrigger value="products" className="gap-2">
            <Package className="h-4 w-4" />
            <span className="hidden sm:inline">Produtos</span>
          </TabsTrigger>
          <TabsTrigger value="emails" className="gap-2">
            <Mail className="h-4 w-4" />
            <span className="hidden sm:inline">E-mails</span>
          </TabsTrigger>
          <TabsTrigger value="affiliates" className="gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Afiliados</span>
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-2">
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">Config</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="banners" className="mt-6">
          <StorefrontBannersTab storefrontId={storefrontId} />
        </TabsContent>

        <TabsContent value="pages" className="mt-6">
          <StorefrontPagesTab storefrontId={storefrontId} />
        </TabsContent>

        <TabsContent value="categories" className="mt-6">
          <StorefrontCategoriesTab storefrontId={storefrontId} />
        </TabsContent>

        <TabsContent value="products" className="mt-6">
          <StorefrontProductsTab storefrontId={storefrontId} storefront={storefront} />
        </TabsContent>

        <TabsContent value="emails" className="mt-6">
          <StorefrontEmailSequences 
            storefrontId={storefrontId} 
            storefrontName={storefront.name}
          />
        </TabsContent>

        <TabsContent value="affiliates" className="mt-6">
          <AffiliatesTab
            assetType="storefront"
            assetId={storefrontId}
            assetSlug={storefront.slug}
          />
        </TabsContent>

        <TabsContent value="settings" className="mt-6">
          <StorefrontSettingsTab storefront={storefront} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
