import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { 
  Link2, 
  Copy, 
  ExternalLink, 
  Check, 
  ShoppingBag, 
  FileText,
  MousePointerClick,
  MousePointer2,
  TrendingUp,
  Wallet,
  DollarSign,
  Clock
} from 'lucide-react';
import { EcommerceLayout } from '@/components/ecommerce/EcommerceLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { useAffiliateAvailableOffers, useMyAffiliateCode, type AvailableOffer } from '@/hooks/ecommerce/useAffiliateLinks';
import { useMyPartnerAssociations } from '@/hooks/ecommerce/usePartners';
import { useTenant } from '@/hooks/useTenant';

function formatCurrency(cents: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

function OfferCard({ offer }: { offer: AvailableOffer }) {
  const [copied, setCopied] = useState(false);

  const handleCopyLink = () => {
    if (!offer.affiliate_link) {
      toast.error('Link não disponível');
      return;
    }
    navigator.clipboard.writeText(offer.affiliate_link);
    setCopied(true);
    toast.success('Link copiado para a área de transferência!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenLink = () => {
    if (offer.affiliate_link) {
      window.open(offer.affiliate_link, '_blank');
    }
  };

  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex gap-4">
          {/* Product Image */}
          {offer.product_image ? (
            <img
              src={offer.product_image}
              alt={offer.product_name || offer.name}
              className="w-20 h-20 rounded-lg object-cover flex-shrink-0"
            />
          ) : (
            <div className="w-20 h-20 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center flex-shrink-0">
              {offer.type === 'checkout' ? (
                <ShoppingBag className="h-8 w-8 text-primary/60" />
              ) : (
                <FileText className="h-8 w-8 text-primary/60" />
              )}
            </div>
          )}

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold truncate text-lg">{offer.name}</h3>
              <Badge variant="outline" className="text-xs flex-shrink-0">
                {offer.type === 'checkout' ? 'Checkout' : 'Landing'}
              </Badge>
            </div>
            
            {offer.product_name && (
              <p className="text-sm text-muted-foreground truncate mb-2">
                Produto: {offer.product_name}
              </p>
            )}

            {/* Attribution Model */}
            <div className="flex items-center gap-1 text-xs text-muted-foreground mb-3">
              {offer.attribution_model === 'first_click' ? (
                <>
                  <MousePointer2 className="h-3 w-3" />
                  <span>Atribuição: Primeiro clique</span>
                </>
              ) : (
                <>
                  <MousePointerClick className="h-3 w-3" />
                  <span>Atribuição: Último clique</span>
                </>
              )}
            </div>

            {/* Link Actions */}
            {offer.is_enrolled && offer.affiliate_link ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs bg-muted rounded-lg px-3 py-2">
                  <Link2 className="h-4 w-4 flex-shrink-0 text-primary" />
                  <code className="truncate flex-1 text-xs font-mono">
                    {offer.affiliate_link}
                  </code>
                </div>
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    className="flex-1"
                    onClick={handleCopyLink}
                  >
                    {copied ? (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        Copiado!
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4 mr-2" />
                        Copiar Link
                      </>
                    )}
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={handleOpenLink}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <Badge variant="secondary" className="text-xs">
                Não vinculado
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function PartnerLinksPage() {
  const { role, isAdmin } = useTenant();
  const { data: offers, isLoading: offersLoading } = useAffiliateAvailableOffers();
  const { data: associations, isLoading: associationsLoading } = useMyPartnerAssociations();
  const { data: affiliateCodeData, isLoading: codeLoading } = useMyAffiliateCode();

  // Check if user is a partner
  const isPartner = role?.startsWith('partner_') ?? false;

  // Admins should go to lojas page instead
  if (!isPartner && isAdmin) {
    return <Navigate to="/ecommerce/lojas" replace />;
  }

  const isLoading = offersLoading || associationsLoading || codeLoading;

  const checkoutOffers = offers?.filter(o => o.type === 'checkout') || [];
  const landingOffers = offers?.filter(o => o.type === 'landing') || [];
  const enrolledOffers = offers?.filter(o => o.is_enrolled && o.affiliate_link) || [];

  // Calculate totals from associations
  const totalBalance = associations?.reduce(
    (sum, a) => sum + (a.virtual_account?.balance_cents || 0),
    0
  ) || 0;
  
  const totalPending = associations?.reduce(
    (sum, a) => sum + (a.virtual_account?.pending_balance_cents || 0),
    0
  ) || 0;

  // Prioriza código V2 (AFF...) sobre legado (P...)
  const affiliateCode = affiliateCodeData?.code || associations?.find(a => a.affiliate_code)?.affiliate_code;

  if (isLoading) {
    return (
      <EcommerceLayout 
        title="Meus Links" 
        description="Copie seus links de divulgação e acompanhe seus ganhos"
      >
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
          </div>
          <Skeleton className="h-64" />
        </div>
      </EcommerceLayout>
    );
  }

  return (
    <EcommerceLayout 
      title="Meus Links" 
      description="Copie seus links de divulgação e acompanhe seus ganhos"
    >
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Affiliate Code */}
          {affiliateCode && (
            <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-full bg-primary/20">
                    <Link2 className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Seu Código</p>
                    <p className="text-xl font-bold font-mono">{affiliateCode}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Available Balance */}
          <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-full bg-green-500/20">
                  <Wallet className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Saldo Disponível</p>
                  <p className="text-xl font-bold text-green-600">{formatCurrency(totalBalance)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Pending Balance */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-full bg-amber-100 dark:bg-amber-900/30">
                  <Clock className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Saldo Pendente</p>
                  <p className="text-xl font-bold text-amber-600">{formatCurrency(totalPending)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* How It Works */}
        <Card className="border-dashed">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Como Funciona
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold flex-shrink-0">
                  1
                </div>
                <div>
                  <p className="font-medium">Copie seu link</p>
                  <p className="text-muted-foreground">Escolha um produto abaixo e copie o link</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold flex-shrink-0">
                  2
                </div>
                <div>
                  <p className="font-medium">Divulgue</p>
                  <p className="text-muted-foreground">Compartilhe nas redes sociais, grupos ou contatos</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold flex-shrink-0">
                  3
                </div>
                <div>
                  <p className="font-medium">Cliente compra</p>
                  <p className="text-muted-foreground">Quando alguém comprar pelo seu link, você ganha comissão</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-green-600 text-white flex items-center justify-center font-bold flex-shrink-0">
                  4
                </div>
                <div>
                  <p className="font-medium">Receba</p>
                  <p className="text-muted-foreground">Acompanhe em "Carteira" e solicite saque</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Links Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              Links de Divulgação
            </CardTitle>
            <CardDescription>
              Copie seus links únicos e comece a divulgar. Você ganha comissão em cada venda!
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!offers?.length ? (
              <div className="text-center py-12">
                <ShoppingBag className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Nenhuma oferta disponível</h3>
                <p className="text-muted-foreground text-sm max-w-md mx-auto">
                  A organização ainda não configurou produtos para você promover. 
                  Entre em contato com o administrador.
                </p>
              </div>
            ) : (
              <Tabs defaultValue="all" className="w-full">
                <TabsList className="mb-4">
                  <TabsTrigger value="all">
                    Todos ({enrolledOffers.length})
                  </TabsTrigger>
                  <TabsTrigger value="checkouts">
                    Checkouts ({checkoutOffers.filter(o => o.is_enrolled).length})
                  </TabsTrigger>
                  <TabsTrigger value="landings">
                    Landings ({landingOffers.filter(o => o.is_enrolled).length})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="all" className="space-y-4">
                  {enrolledOffers.length === 0 ? (
                    <p className="text-center text-muted-foreground py-6">
                      Você ainda não está vinculado a nenhuma oferta. Entre em contato com o administrador.
                    </p>
                  ) : (
                    <div className="grid gap-4">
                      {enrolledOffers.map((offer) => (
                        <OfferCard key={offer.id} offer={offer} />
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="checkouts" className="space-y-4">
                  {checkoutOffers.filter(o => o.is_enrolled).length === 0 ? (
                    <p className="text-center text-muted-foreground py-6">
                      Nenhum checkout vinculado.
                    </p>
                  ) : (
                    <div className="grid gap-4">
                      {checkoutOffers.filter(o => o.is_enrolled).map((offer) => (
                        <OfferCard key={offer.id} offer={offer} />
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="landings" className="space-y-4">
                  {landingOffers.filter(o => o.is_enrolled).length === 0 ? (
                    <p className="text-center text-muted-foreground py-6">
                      Nenhuma landing page vinculada.
                    </p>
                  ) : (
                    <div className="grid gap-4">
                      {landingOffers.filter(o => o.is_enrolled).map((offer) => (
                        <OfferCard key={offer.id} offer={offer} />
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>
      </div>
    </EcommerceLayout>
  );
}
