import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Link2, Copy, ExternalLink, Store } from 'lucide-react';

interface AffiliateLink {
  checkoutId: string;
  checkoutName: string;
  checkoutSlug: string;
  storefrontName: string;
  externalSiteUrl: string | null;
  internalLink: string;
  externalLink: string | null;
  affiliateCode: string;
  commissionType: string;
  commissionValue: number;
}

export default function AffiliateLinksPage() {
  const { profile } = useAuth();

  const { data: links, isLoading } = useQuery({
    queryKey: ['affiliate-links-external', profile?.user_id],
    queryFn: async () => {
      if (!profile?.user_id) return [];

      // Get user's affiliate records
      const { data: affiliates } = await supabase
        .from('organization_affiliates')
        .select('id, affiliate_code, organization_id, default_commission_type, default_commission_value')
        .eq('user_id', profile.user_id)
        .eq('is_active', true);

      if (!affiliates?.length) return [];

      const result: AffiliateLink[] = [];

      for (const aff of affiliates) {
        // Get checkout links for this affiliate
        const { data: checkoutLinks } = await supabase
          .from('checkout_affiliate_links')
          .select(`
            checkout_id,
            commission_type,
            commission_value,
            checkout:standalone_checkouts(id, name, slug, is_active)
          `)
          .eq('affiliate_id', aff.id);

        // Get storefronts for this org (to get external_site_url)
        const { data: storefronts } = await supabase
          .from('tenant_storefronts')
          .select('id, name, slug, external_site_url')
          .eq('organization_id', aff.organization_id)
          .eq('is_active', true);

        for (const link of checkoutLinks || []) {
          const checkout = link.checkout as any;
          if (!checkout?.is_active) continue;

          // Find which storefront this checkout belongs to (by matching org)
          const sf = storefronts?.[0]; // Use first storefront as default

          const internalLink = `${window.location.origin}/pay/${checkout.slug}?ref=${aff.affiliate_code}`;
          const externalLink = sf?.external_site_url
            ? `${sf.external_site_url.replace(/\/$/, '')}?ref=${aff.affiliate_code}`
            : null;

          result.push({
            checkoutId: checkout.id,
            checkoutName: checkout.name,
            checkoutSlug: checkout.slug,
            storefrontName: sf?.name || 'Loja',
            externalSiteUrl: sf?.external_site_url,
            internalLink,
            externalLink,
            affiliateCode: aff.affiliate_code,
            commissionType: link.commission_type || aff.default_commission_type || 'percentage',
            commissionValue: link.commission_value || aff.default_commission_value || 10,
          });
        }

        // Also add storefront-level links if there are storefronts with external URLs
        if (storefronts?.length) {
          for (const sf of storefronts) {
            if (sf.external_site_url) {
              // Check if we already added any link for this storefront
              const alreadyHas = result.some(r => r.externalSiteUrl === sf.external_site_url);
              if (!alreadyHas) {
                result.push({
                  checkoutId: `sf-${sf.id}`,
                  checkoutName: `Loja ${sf.name}`,
                  checkoutSlug: sf.slug,
                  storefrontName: sf.name,
                  externalSiteUrl: sf.external_site_url,
                  internalLink: `${window.location.origin}/loja/${sf.slug}?ref=${aff.affiliate_code}`,
                  externalLink: `${sf.external_site_url.replace(/\/$/, '')}?ref=${aff.affiliate_code}`,
                  affiliateCode: aff.affiliate_code,
                  commissionType: aff.default_commission_type || 'percentage',
                  commissionValue: aff.default_commission_value || 10,
                });
              }
            }
          }
        }
      }

      return result;
    },
    enabled: !!profile?.user_id,
  });

  const copyLink = (link: string) => {
    navigator.clipboard.writeText(link);
    toast.success('Link copiado!');
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Meus Links de Afiliado</h1>
          <p className="text-muted-foreground">
            Copie e compartilhe seus links para ganhar comissões
          </p>
        </div>

        {!links?.length ? (
          <Card>
            <CardContent className="py-8 text-center">
              <Link2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">
                Nenhum link disponível. Aguarde a aprovação do administrador ou a vinculação a produtos.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {/* Show affiliate code */}
            <Card>
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Seu código de afiliado</p>
                    <p className="text-xl font-mono font-bold text-primary">{links[0]?.affiliateCode}</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => copyLink(links[0]?.affiliateCode)}>
                    <Copy className="h-4 w-4 mr-1" /> Copiar
                  </Button>
                </div>
              </CardContent>
            </Card>

            {links.map((link) => (
              <Card key={link.checkoutId}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Store className="h-4 w-4" />
                        {link.checkoutName}
                      </CardTitle>
                      <CardDescription>{link.storefrontName}</CardDescription>
                    </div>
                    <Badge variant="secondary">
                      {link.commissionType === 'percentage'
                        ? `${link.commissionValue}%`
                        : `R$ ${(link.commissionValue / 100).toFixed(2)}`}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* External link (priority) */}
                  {link.externalLink && (
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">Link de Divulgação (Site Externo)</p>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 text-xs bg-muted p-2 rounded overflow-x-auto">
                          {link.externalLink}
                        </code>
                        <Button variant="outline" size="sm" onClick={() => copyLink(link.externalLink!)}>
                          <Copy className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => window.open(link.externalLink!, '_blank')}>
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Internal link */}
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">
                      {link.externalLink ? 'Link Direto (Checkout)' : 'Link de Divulgação'}
                    </p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-xs bg-muted p-2 rounded overflow-x-auto">
                        {link.internalLink}
                      </code>
                      <Button variant="outline" size="sm" onClick={() => copyLink(link.internalLink)}>
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Instructions for external site */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">📋 Como funciona?</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>1. Compartilhe seu <strong>Link de Divulgação</strong> nas redes sociais, WhatsApp, etc.</p>
            <p>2. Quando alguém clicar e comprar, a venda será atribuída a você automaticamente.</p>
            <p>3. Sua comissão aparecerá em <strong>Minhas Vendas</strong> e na <strong>Carteira</strong>.</p>
            <p>4. Se o cliente usar um cupom vinculado a você, a venda também será atribuída.</p>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
