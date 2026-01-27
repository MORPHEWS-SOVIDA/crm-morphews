import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { 
  User, Mail, Phone, FileText, DollarSign, Wallet, 
  Copy, ExternalLink, Package, ShoppingCart, FileImage,
  Store, Link2, AlertTriangle, UserCheck, CheckCircle,
  XCircle
} from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { 
  PartnerAssociation, 
  partnerTypeLabels, 
  formatCommission 
} from '@/hooks/ecommerce/usePartners';

interface PartnerDetailSheetProps {
  partner: PartnerAssociation | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function formatCurrency(cents: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

// Fetch all associations for a virtual_account_id
function useAllPartnerAssociations(virtualAccountId: string | undefined) {
  return useQuery({
    queryKey: ['partner-all-associations', virtualAccountId],
    queryFn: async () => {
      if (!virtualAccountId) return [];

      const { data, error } = await supabase
        .from('partner_associations')
        .select(`
          *,
          linked_product:lead_products!partner_associations_linked_product_id_fkey(id, name, images),
          linked_landing:landing_pages!partner_associations_linked_landing_id_fkey(id, name, slug),
          linked_checkout:standalone_checkouts!partner_associations_linked_checkout_id_fkey(id, name, slug),
          linked_storefront:tenant_storefronts!partner_associations_linked_storefront_id_fkey(id, name, slug),
          linked_quiz:quizzes!partner_associations_linked_quiz_id_fkey(id, name, slug)
        `)
        .eq('virtual_account_id', virtualAccountId)
        .eq('is_active', true);

      if (error) throw error;
      return data || [];
    },
    enabled: !!virtualAccountId,
  });
}

export function PartnerDetailSheet({ partner, open, onOpenChange }: PartnerDetailSheetProps) {
  const [activeTab, setActiveTab] = useState('info');

  const { data: allAssociations, isLoading: loadingAssociations } = useAllPartnerAssociations(
    partner?.virtual_account_id
  );

  const handleCopyLink = (url: string, label: string) => {
    navigator.clipboard.writeText(url);
    toast.success(`Link ${label} copiado!`);
  };

  if (!partner) return null;

  const account = partner.virtual_account;
  const baseUrl = window.location.origin;
  const code = partner.affiliate_code;

  // Generate links for each association
  const getAssociationLinks = () => {
    if (!allAssociations) return [];

    return allAssociations.map((assoc: any) => {
      const links: { type: string; name: string; url: string }[] = [];
      
      if (assoc.linked_storefront) {
        links.push({
          type: 'Loja',
          name: assoc.linked_storefront.name,
          url: `${baseUrl}/loja/${assoc.linked_storefront.slug}?ref=${code}`,
        });
      }
      
      if (assoc.linked_landing) {
        links.push({
          type: 'Landing Page',
          name: assoc.linked_landing.name,
          url: `${baseUrl}/p/${assoc.linked_landing.slug}?ref=${code}`,
        });
      }
      
      if (assoc.linked_checkout) {
        links.push({
          type: 'Checkout',
          name: assoc.linked_checkout.name,
          url: `${baseUrl}/pay/${assoc.linked_checkout.slug}?ref=${code}`,
        });
      }
      
      if (assoc.linked_quiz) {
        links.push({
          type: 'Quiz',
          name: assoc.linked_quiz.name,
          url: `${baseUrl}/quiz/${assoc.linked_quiz.slug}?ref=${code}`,
        });
      }

      if (assoc.linked_product && !assoc.linked_storefront && !assoc.linked_landing && !assoc.linked_checkout && !assoc.linked_quiz) {
        // Product-only association - might go to a default storefront
        links.push({
          type: 'Produto',
          name: assoc.linked_product.name,
          url: `${baseUrl}?ref=${code}`, // Generic, as there's no specific page
        });
      }

      return {
        association: assoc,
        links,
        commission: formatCommission(assoc.commission_type, assoc.commission_value),
      };
    }).filter((item: any) => item.links.length > 0);
  };

  const associationLinks = getAssociationLinks();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-hidden flex flex-col">
        <SheetHeader className="pb-4">
          <SheetTitle className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div>
              <span className={!account?.holder_name ? 'text-muted-foreground italic' : ''}>{account?.holder_name || 'Sem nome cadastrado'}</span>
              <Badge variant="secondary" className="ml-2 text-xs">
                {partnerTypeLabels[partner.partner_type]}
              </Badge>
            </div>
          </SheetTitle>
          <SheetDescription>
            Código: <strong>{code || 'Não definido'}</strong>
          </SheetDescription>
        </SheetHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="info">Cadastro</TabsTrigger>
            <TabsTrigger value="offers">Ofertas</TabsTrigger>
            <TabsTrigger value="links">Links</TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 mt-4">
            {/* Tab: Cadastro */}
            <TabsContent value="info" className="mt-0 space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Dados Pessoais
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-3">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className={`text-sm ${!account?.holder_name ? 'text-muted-foreground italic' : ''}`}>{account?.holder_name || 'Não informado'}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span className={`text-sm ${!account?.holder_email ? 'text-muted-foreground italic' : ''}`}>{account?.holder_email || 'Não informado'}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{account?.holder_document || 'Não informado'}</span>
                  </div>
                  {account?.user_id && (
                    <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                      <UserCheck className="h-4 w-4" />
                      <span className="text-sm font-medium">Conta Morphews vinculada</span>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Comissão & Saldo
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">Comissão Padrão</span>
                    </div>
                    <Badge variant="secondary">
                      {formatCommission(partner.commission_type, partner.commission_value)}
                    </Badge>
                  </div>
                  
                  <Separator />
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Wallet className="h-4 w-4 text-emerald-500" />
                      <span className="text-sm">Saldo Disponível</span>
                    </div>
                    <span className="font-medium text-emerald-600">
                      {formatCurrency(account?.balance_cents || 0)}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Wallet className="h-4 w-4 text-amber-500" />
                      <span className="text-sm">Saldo Pendente</span>
                    </div>
                    <span className="font-medium text-amber-600">
                      {formatCurrency(account?.pending_balance_cents || 0)}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Responsabilidades
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center gap-2">
                    {partner.responsible_for_refunds ? (
                      <CheckCircle className="h-4 w-4 text-amber-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="text-sm">
                      Responsável por estornos
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {partner.responsible_for_chargebacks ? (
                      <CheckCircle className="h-4 w-4 text-amber-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="text-sm">
                      Responsável por chargebacks
                    </span>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Tab: Ofertas Vinculadas */}
            <TabsContent value="offers" className="mt-0 space-y-3">
              {loadingAssociations ? (
                <div className="space-y-3">
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                </div>
              ) : associationLinks.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="h-10 w-10 mx-auto mb-2 opacity-40" />
                  <p>Nenhuma oferta vinculada</p>
                  <p className="text-xs">
                    Vincule este parceiro a produtos, lojas, checkouts ou quizzes
                  </p>
                </div>
              ) : (
                associationLinks.map((item: any, index: number) => (
                  <Card key={index}>
                    <CardContent className="pt-4">
                      {item.links.map((link: any, linkIndex: number) => (
                        <div key={linkIndex} className="flex items-center justify-between py-2">
                          <div className="flex items-center gap-2">
                            {link.type === 'Loja' && <Store className="h-4 w-4 text-muted-foreground" />}
                            {link.type === 'Landing Page' && <FileImage className="h-4 w-4 text-muted-foreground" />}
                            {link.type === 'Checkout' && <ShoppingCart className="h-4 w-4 text-muted-foreground" />}
                            {link.type === 'Quiz' && <FileText className="h-4 w-4 text-muted-foreground" />}
                            {link.type === 'Produto' && <Package className="h-4 w-4 text-muted-foreground" />}
                            <div>
                              <p className="text-sm font-medium">{link.name}</p>
                              <p className="text-xs text-muted-foreground">{link.type}</p>
                            </div>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {item.commission}
                          </Badge>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>

            {/* Tab: Links de Divulgação */}
            <TabsContent value="links" className="mt-0 space-y-3">
              {loadingAssociations ? (
                <div className="space-y-3">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : associationLinks.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Link2 className="h-10 w-10 mx-auto mb-2 opacity-40" />
                  <p>Nenhum link disponível</p>
                  <p className="text-xs">
                    Vincule ofertas para gerar links de divulgação
                  </p>
                </div>
              ) : (
                associationLinks.flatMap((item: any) =>
                  item.links.map((link: any, index: number) => (
                    <Card key={`${link.url}-${index}`} className="overflow-hidden">
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="secondary" className="text-xs shrink-0">
                                {link.type}
                              </Badge>
                              <span className="text-sm font-medium truncate">
                                {link.name}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground truncate">
                              {link.url}
                            </p>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleCopyLink(link.url, link.name)}
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => window.open(link.url, '_blank')}
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )
              )}

              {!loadingAssociations && associationLinks.length > 0 && (
                <p className="text-xs text-muted-foreground text-center pt-4">
                  Todos os links incluem o código <strong>?ref={code}</strong> para rastreamento
                </p>
              )}
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
