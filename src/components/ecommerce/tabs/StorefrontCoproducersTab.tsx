import { useMemo } from 'react';
import { Users2, DollarSign, Package, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useStorefrontProducts } from '@/hooks/ecommerce';

interface StorefrontCoproducersTabProps {
  storefrontId: string;
  storefrontName: string;
}

interface CoproducerWithProduct {
  id: string;
  product_id: string;
  product_name: string;
  product_image_url: string | null;
  commission_type: string;
  commission_percentage: number;
  commission_fixed_1_cents: number;
  commission_fixed_3_cents: number;
  commission_fixed_5_cents: number;
  holder_name: string;
  holder_email: string;
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

export function StorefrontCoproducersTab({ storefrontId, storefrontName }: StorefrontCoproducersTabProps) {
  const { data: storefrontProducts, isLoading: loadingProducts } = useStorefrontProducts(storefrontId);

  const productIds = useMemo(
    () => storefrontProducts?.filter(sp => sp.product_id).map(sp => sp.product_id!) || [],
    [storefrontProducts]
  );

  const { data: coproducers, isLoading: loadingCoproducers } = useQuery({
    queryKey: ['storefront-coproducers', storefrontId, productIds.sort().join(',')],
    enabled: productIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('coproducers')
        .select('id, product_id, commission_type, commission_percentage, commission_fixed_1_cents, commission_fixed_3_cents, commission_fixed_5_cents, virtual_account:virtual_accounts(holder_name, holder_email)')
        .in('product_id', productIds)
        .eq('is_active', true);

      if (error) throw error;
      return data || [];
    },
  });

  // Build product info map from storefront products
  const productMap = useMemo(() => {
    const map: Record<string, { name: string; image_url: string | null }> = {};
    storefrontProducts?.forEach(sp => {
      if (sp.product_id && sp.product) {
        map[sp.product_id] = {
          name: sp.product.name || 'Produto',
          image_url: sp.product.image_url || null,
        };
      }
    });
    return map;
  }, [storefrontProducts]);

  // Group coproducers by partner
  const groupedByPartner = useMemo(() => {
    if (!coproducers) return [];

    const partnerMap = new Map<string, {
      name: string;
      email: string;
      products: {
        productId: string;
        productName: string;
        productImage: string | null;
        commissionType: string;
        commissionPercentage: number;
        fixed1: number;
        fixed3: number;
        fixed5: number;
      }[];
    }>();

    for (const c of coproducers) {
      const va = c.virtual_account as { holder_name: string; holder_email: string } | null;
      const name = va?.holder_name || 'Co-produtor';
      const email = va?.holder_email || '';
      const key = email || name;

      if (!partnerMap.has(key)) {
        partnerMap.set(key, { name, email, products: [] });
      }

      const pInfo = productMap[c.product_id] || { name: 'Produto', image_url: null };

      partnerMap.get(key)!.products.push({
        productId: c.product_id,
        productName: pInfo.name,
        productImage: pInfo.image_url,
        commissionType: c.commission_type || 'percentage',
        commissionPercentage: c.commission_percentage || 0,
        fixed1: c.commission_fixed_1_cents || 0,
        fixed3: c.commission_fixed_3_cents || 0,
        fixed5: c.commission_fixed_5_cents || 0,
      });
    }

    return Array.from(partnerMap.values());
  }, [coproducers, productMap]);

  const isLoading = loadingProducts || loadingCoproducers;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (groupedByPartner.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Users2 className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-1">Nenhum co-produtor vinculado</h3>
          <p className="text-sm text-muted-foreground max-w-md">
            Para adicionar um co-produtor, edite cada produto desta loja e vá na aba "Co-produtor" para configurar os repasses.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="bg-muted/30 border-dashed">
        <CardContent className="py-3 px-4">
          <p className="text-sm text-muted-foreground">
            <Users2 className="h-4 w-4 inline mr-1.5 -mt-0.5" />
            Co-produtores da loja <strong>{storefrontName}</strong>. Os valores são configurados por produto na aba "Co-produtor" da edição de cada produto.
          </p>
        </CardContent>
      </Card>

      {groupedByPartner.map((partner) => (
        <Card key={partner.email || partner.name}>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Users2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">{partner.name}</CardTitle>
                {partner.email && (
                  <CardDescription className="text-xs">{partner.email}</CardDescription>
                )}
              </div>
              <Badge variant="secondary" className="ml-auto text-xs">
                {partner.products.length} {partner.products.length === 1 ? 'produto' : 'produtos'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {partner.products.map((prod) => (
                <div
                  key={prod.productId}
                  className="flex items-start gap-3 p-3 rounded-lg border bg-muted/20"
                >
                  {/* Product image */}
                  {prod.productImage ? (
                    <img
                      src={prod.productImage}
                      alt={prod.productName}
                      className="h-12 w-12 rounded-md object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="h-12 w-12 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                      <Package className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{prod.productName}</p>

                    {prod.commissionType === 'fixed_per_quantity' ? (
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {prod.fixed1 > 0 && (
                          <Badge variant="outline" className="text-xs font-mono gap-1">
                            <DollarSign className="h-3 w-3" />
                            1 un → {formatCurrency(prod.fixed1)}
                          </Badge>
                        )}
                        {prod.fixed3 > 0 && (
                          <Badge variant="outline" className="text-xs font-mono gap-1">
                            <DollarSign className="h-3 w-3" />
                            3 un → {formatCurrency(prod.fixed3)}
                          </Badge>
                        )}
                        {prod.fixed5 > 0 && (
                          <Badge variant="outline" className="text-xs font-mono gap-1">
                            <DollarSign className="h-3 w-3" />
                            5 un → {formatCurrency(prod.fixed5)}
                          </Badge>
                        )}
                        {prod.fixed1 === 0 && prod.fixed3 === 0 && prod.fixed5 === 0 && (
                          <span className="text-xs text-muted-foreground italic">
                            Valores não configurados
                          </span>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground mt-1">
                        Comissão: <span className="font-bold">{prod.commissionPercentage}%</span> sobre o valor líquido
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
