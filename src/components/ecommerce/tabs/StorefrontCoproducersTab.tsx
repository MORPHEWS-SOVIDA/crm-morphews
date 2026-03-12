import { useMemo } from 'react';
import { Users2, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useStorefrontProducts } from '@/hooks/ecommerce';
import {
  StorefrontCoproducerProductRow,
  type StorefrontCoproducerProduct,
} from '@/components/ecommerce/tabs/StorefrontCoproducerProductRow';

interface StorefrontCoproducersTabProps {
  storefrontId: string;
  storefrontName: string;
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

  const groupedByPartner = useMemo(() => {
    if (!coproducers) return [];

    const partnerMap = new Map<string, {
      name: string;
      email: string;
      products: StorefrontCoproducerProduct[];
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
        coproducerId: c.id,
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
            Co-produtores da loja <strong>{storefrontName}</strong>. Você pode editar os valores de 1, 3 e 5 unidades diretamente abaixo.
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
                <StorefrontCoproducerProductRow key={prod.coproducerId} product={prod} />
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
