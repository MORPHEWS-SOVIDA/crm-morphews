import { useState } from 'react';
import { 
  ShoppingBag, 
  FileText, 
  Link2, 
  Copy, 
  ExternalLink,
  Check,
  MousePointerClick,
  MousePointer2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { useAffiliateAvailableOffers, type AvailableOffer } from '@/hooks/ecommerce/useAffiliateLinks';

function OfferCard({ offer }: { offer: AvailableOffer }) {
  const [copied, setCopied] = useState(false);

  const handleCopyLink = () => {
    if (!offer.affiliate_link) {
      toast.error('Link não disponível');
      return;
    }
    navigator.clipboard.writeText(offer.affiliate_link);
    setCopied(true);
    toast.success('Link copiado!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenLink = () => {
    if (offer.affiliate_link) {
      window.open(offer.affiliate_link, '_blank');
    }
  };

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex gap-4">
          {/* Product Image */}
          {offer.product_image ? (
            <img
              src={offer.product_image}
              alt={offer.product_name || offer.name}
              className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
            />
          ) : (
            <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
              {offer.type === 'checkout' ? (
                <ShoppingBag className="h-6 w-6 text-muted-foreground" />
              ) : (
                <FileText className="h-6 w-6 text-muted-foreground" />
              )}
            </div>
          )}

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-medium truncate">{offer.name}</h3>
              <Badge variant="outline" className="text-xs flex-shrink-0">
                {offer.type === 'checkout' ? 'Checkout' : 'Landing'}
              </Badge>
            </div>
            
            {offer.product_name && (
              <p className="text-sm text-muted-foreground truncate mb-2">
                {offer.product_name}
              </p>
            )}

            {/* Attribution Model */}
            <div className="flex items-center gap-1 text-xs text-muted-foreground mb-3">
              {offer.attribution_model === 'first_click' ? (
                <>
                  <MousePointer2 className="h-3 w-3" />
                  <span>Primeiro clique</span>
                </>
              ) : (
                <>
                  <MousePointerClick className="h-3 w-3" />
                  <span>Último clique</span>
                </>
              )}
            </div>

            {/* Link */}
            {offer.is_enrolled && offer.affiliate_link ? (
              <div className="space-y-2">
                <div className="flex items-center gap-1 text-xs bg-muted rounded px-2 py-1.5">
                  <Link2 className="h-3 w-3 flex-shrink-0" />
                  <code className="truncate flex-1 text-xs">
                    {offer.affiliate_link}
                  </code>
                </div>
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    variant="default" 
                    className="flex-1"
                    onClick={handleCopyLink}
                  >
                    {copied ? (
                      <>
                        <Check className="h-3 w-3 mr-1" />
                        Copiado!
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3 mr-1" />
                        Copiar Link
                      </>
                    )}
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={handleOpenLink}
                  >
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ) : (
              <Badge variant="secondary" className="text-xs">
                Não disponível
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function AffiliateOffersSection() {
  const { data: offers, isLoading } = useAffiliateAvailableOffers();

  const checkoutOffers = offers?.filter(o => o.type === 'checkout') || [];
  const landingOffers = offers?.filter(o => o.type === 'landing') || [];
  const enrolledOffers = offers?.filter(o => o.is_enrolled) || [];

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!offers?.length) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <ShoppingBag className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Nenhuma oferta disponível</h3>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">
            A organização ainda não configurou produtos para afiliação. 
            Entre em contato com o administrador.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Link2 className="h-5 w-5" />
          Meus Links de Divulgação
        </CardTitle>
        <CardDescription>
          Copie seus links únicos e comece a divulgar
        </CardDescription>
      </CardHeader>
      <CardContent>
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

          <TabsContent value="all" className="space-y-3">
            {enrolledOffers.length === 0 ? (
              <p className="text-center text-muted-foreground py-6">
                Você ainda não está vinculado a nenhuma oferta.
              </p>
            ) : (
              enrolledOffers.map((offer) => (
                <OfferCard key={offer.id} offer={offer} />
              ))
            )}
          </TabsContent>

          <TabsContent value="checkouts" className="space-y-3">
            {checkoutOffers.filter(o => o.is_enrolled).length === 0 ? (
              <p className="text-center text-muted-foreground py-6">
                Nenhum checkout disponível.
              </p>
            ) : (
              checkoutOffers.filter(o => o.is_enrolled).map((offer) => (
                <OfferCard key={offer.id} offer={offer} />
              ))
            )}
          </TabsContent>

          <TabsContent value="landings" className="space-y-3">
            {landingOffers.filter(o => o.is_enrolled).length === 0 ? (
              <p className="text-center text-muted-foreground py-6">
                Nenhuma landing page disponível.
              </p>
            ) : (
              landingOffers.filter(o => o.is_enrolled).map((offer) => (
                <OfferCard key={offer.id} offer={offer} />
              ))
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
