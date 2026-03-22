import { useMemo } from 'react';
import { Users2, Loader2, Package } from 'lucide-react';
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

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
}

export function StorefrontCoproducersTab({ storefrontId, storefrontName }: StorefrontCoproducersTabProps) {
  const { data: storefrontProducts, isLoading: loadingProducts } = useStorefrontProducts(storefrontId);

  const productIds = useMemo(
    () => storefrontProducts?.filter(sp => sp.product_id).map(sp => sp.product_id!) || [],
    [storefrontProducts]
  );

  const comboIds = useMemo(
    () => storefrontProducts?.filter(sp => sp.combo_id).map(sp => sp.combo_id!) || [],
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

  const { data: comboItems, isLoading: loadingComboItems } = useQuery({
    queryKey: ['storefront-combo-items', comboIds.sort().join(',')],
    enabled: comboIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_combo_items')
        .select('combo_id, product_id, quantity')
        .in('combo_id', comboIds);
      if (error) throw error;
      return data || [];
    },
  });

  const comboProductIds = useMemo(() => {
    if (!comboItems) return [];
    return Array.from(new Set(comboItems.map(ci => ci.product_id)));
  }, [comboItems]);

  const { data: comboCoproducers, isLoading: loadingComboCoproducers } = useQuery({
    queryKey: ['storefront-combo-coproducers', comboProductIds.sort().join(',')],
    enabled: comboProductIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('coproducers')
        .select('id, product_id, commission_type, commission_percentage, commission_fixed_1_cents, commission_fixed_3_cents, commission_fixed_5_cents, virtual_account:virtual_accounts(holder_name, holder_email)')
        .in('product_id', comboProductIds)
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

  const comboMap = useMemo(() => {
    const map: Record<string, { name: string; image_url: string | null }> = {};
    storefrontProducts?.forEach(sp => {
      if (sp.combo_id && sp.combo) {
        const combo = sp.combo as any;
        map[sp.combo_id] = {
          name: sp.custom_name || combo.name || 'Combo',
          image_url: combo.image_url || null,
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
      comboAggregates: Array<{
        comboId: string;
        comboName: string;
        comboImage: string | null;
        fixed1Total: number;
        fixed3Total: number;
        fixed5Total: number;
        componentDetails: Array<{ name: string; qty: number }>;
      }>;
    }>();

    for (const c of coproducers) {
      const va = c.virtual_account as { holder_name: string; holder_email: string } | null;
      const name = va?.holder_name || 'Co-produtor';
      const email = va?.holder_email || '';
      const key = email || name;

      if (!partnerMap.has(key)) {
        partnerMap.set(key, { name, email, products: [], comboAggregates: [] });
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

    if (comboCoproducers && comboItems) {
      const coproducersByPartnerProduct = new Map<string, Map<string, any>>();
      for (const c of comboCoproducers) {
        const va = c.virtual_account as { holder_name: string; holder_email: string } | null;
        const email = va?.holder_email || '';
        const name = va?.holder_name || 'Co-produtor';
        const key = email || name;

        if (!coproducersByPartnerProduct.has(key)) {
          coproducersByPartnerProduct.set(key, new Map());
        }
        coproducersByPartnerProduct.get(key)!.set(c.product_id, c);

        if (!partnerMap.has(key)) {
          partnerMap.set(key, { name, email, products: [], comboAggregates: [] });
        }
      }

      for (const comboId of comboIds) {
        const items = comboItems.filter(ci => ci.combo_id === comboId);
        const cInfo = comboMap[comboId] || { name: 'Combo', image_url: null };

        for (const [partnerKey, productCoproducers] of coproducersByPartnerProduct) {
          let fixed1Total = 0;
          let fixed3Total = 0;
          let fixed5Total = 0;
          const componentDetails: Array<{ name: string; qty: number }> = [];

          for (const item of items) {
            const coprod = productCoproducers.get(item.product_id);
            if (coprod) {
              const qty = item.quantity || 1;
              fixed1Total += (coprod.commission_fixed_1_cents || 0) * qty;
              fixed3Total += (coprod.commission_fixed_3_cents || 0) * qty;
              fixed5Total += (coprod.commission_fixed_5_cents || 0) * qty;
              componentDetails.push({
                name: productMap[item.product_id]?.name || 'Produto',
                qty,
              });
            }
          }

          if (fixed1Total > 0 || fixed3Total > 0 || fixed5Total > 0) {
            partnerMap.get(partnerKey)!.comboAggregates.push({
              comboId,
              comboName: cInfo.name,
              comboImage: cInfo.image_url,
              fixed1Total,
              fixed3Total,
              fixed5Total,
              componentDetails,
            });
          }
        }
      }
    }

    return Array.from(partnerMap.values());
  }, [coproducers, comboCoproducers, comboItems, productMap, comboMap, comboIds]);

  const isLoading = loadingProducts || loadingCoproducers || loadingComboItems || loadingComboCoproducers;

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

      {groupedByPartner.map((partner) => {
        const totalItems = partner.products.length + partner.comboAggregates.length;
        return (
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
                  {totalItems} {totalItems === 1 ? 'produto' : 'produtos'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {partner.products.map((prod) => (
                  <StorefrontCoproducerProductRow key={prod.coproducerId} product={prod} />
                ))}

                {partner.comboAggregates.map((combo) => (
                  <div key={combo.comboId} className="rounded-lg border bg-muted/20 p-3">
                    <div className="flex items-start gap-3">
                      {combo.comboImage ? (
                        <img
                          src={combo.comboImage}
                          alt={combo.comboName}
                          className="h-12 w-12 rounded-md object-cover flex-shrink-0"
                          loading="lazy"
                        />
                      ) : (
                        <div className="h-12 w-12 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                          <Package className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm truncate">{combo.comboName}</p>
                          <Badge variant="secondary" className="text-[10px]">Combo</Badge>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {combo.fixed1Total > 0 && (
                            <Badge variant="outline" className="text-xs font-mono gap-1">
                              $ 1 un → {formatCurrency(combo.fixed1Total)}
                            </Badge>
                          )}
                          {combo.fixed3Total > 0 && (
                            <Badge variant="outline" className="text-xs font-mono gap-1">
                              $ 3 un → {formatCurrency(combo.fixed3Total)}
                            </Badge>
                          )}
                          {combo.fixed5Total > 0 && (
                            <Badge variant="outline" className="text-xs font-mono gap-1">
                              $ 5 un → {formatCurrency(combo.fixed5Total)}
                            </Badge>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          Soma automática: {combo.componentDetails.map(d => d.name).join(' + ')}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
