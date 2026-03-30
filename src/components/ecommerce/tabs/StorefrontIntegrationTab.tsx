import { useState } from 'react';
import { Copy, Check, ExternalLink, Info, Save, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { useStorefrontProducts } from '@/hooks/ecommerce';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface StorefrontIntegrationTabProps {
  storefrontId: string;
  storefrontSlug: string;
}

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success(label ? `${label} copiado!` : 'Copiado!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button variant="ghost" size="icon" onClick={handleCopy} className="h-7 w-7 shrink-0">
      {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
    </Button>
  );
}

function formatCents(cents: number) {
  return `R$ ${(cents / 100).toFixed(2).replace('.', ',')}`;
}

export function StorefrontIntegrationTab({ storefrontId, storefrontSlug }: StorefrontIntegrationTabProps) {
  const { data: products, isLoading, refetch } = useStorefrontProducts(storefrontId);
  const [externalIds, setExternalIds] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const checkoutBaseUrl = `${window.location.origin}/loja/${storefrontSlug}/checkout`;

  const visibleProducts = (products || []).filter(p => p.is_visible !== false);

  // Initialize external IDs from DB data
  const getExternalId = (sp: any): string => {
    if (externalIds[sp.id] !== undefined) return externalIds[sp.id];
    return (sp as any).external_product_id || '';
  };

  const handleSaveExternalId = async (spId: string, value: string) => {
    setSavingId(spId);
    try {
      const { error } = await supabase
        .from('storefront_products')
        .update({ external_product_id: value || null } as any)
        .eq('id', spId);
      if (error) throw error;
      toast.success('ID externo salvo!');
      refetch();
    } catch (err: any) {
      toast.error('Erro ao salvar: ' + err.message);
    } finally {
      setSavingId(null);
    }
  };

  const catalog = visibleProducts.map(sp => {
    const product = sp.product as any;
    const combo = sp.combo as any;
    const name = sp.custom_name || combo?.name || product?.name || 'Produto';
    const productId = sp.product_id || '';
    const comboId = sp.combo_id || '';
    const isCombo = !!comboId;
    const internalId = productId || comboId;
    
    let price1 = 0;
    let price3 = 0;
    let price5 = 0;

    if (isCombo && combo?.product_combo_prices) {
      const comboPrices = combo.product_combo_prices as any[];
      for (const cp of comboPrices) {
        if (cp.multiplier === 1) price1 = cp.regular_price_cents || 0;
        else if (cp.multiplier === 3) price3 = cp.regular_price_cents || 0;
        else if (cp.multiplier === 5) price5 = cp.regular_price_cents || 0;
      }
    } else if (product) {
      price1 = sp.custom_price_cents || product.price_1_unit || product.base_price_cents || 0;
      price3 = product.price_3_units || 0;
      price5 = product.price_6_units || 0;
    }

    const quantities: { qty: number; price: number }[] = [];
    if (price1) quantities.push({ qty: 1, price: price1 });
    if (price3) quantities.push({ qty: 3, price: price3 });
    if (price5) quantities.push({ qty: 5, price: price5 });

    return {
      storefrontProductId: sp.id,
      internalId,
      isCombo,
      name,
      imageUrl: product?.image_url || combo?.image_url,
      quantities,
      externalId: getExternalId(sp),
    };
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          <strong>Como funciona:</strong> O site externo envia os seus próprios IDs de produto. 
          Cole abaixo o ID que o site externo usa para cada produto — o checkout vai mapear automaticamente.
          Se o site já usa os nossos IDs internos, não precisa configurar nada.
        </AlertDescription>
      </Alert>

      {catalog.map(item => (
        <Card key={item.storefrontProductId}>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              {item.imageUrl && (
                <img src={item.imageUrl} alt={item.name} className="h-10 w-10 rounded object-cover shrink-0" />
              )}
              <div className="flex-1">
                <CardTitle className="text-base flex items-center gap-2">
                  {item.name}
                  {item.isCombo && <Badge variant="secondary" className="text-[10px]">Combo</Badge>}
                </CardTitle>
                <CardDescription className="text-xs font-mono mt-0.5">
                  ID interno: {item.internalId}
                  <CopyButton text={item.internalId} label="ID interno" />
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* External ID mapping */}
            <div className="flex items-center gap-2 p-3 rounded-lg border border-dashed border-primary/30 bg-primary/5">
              <Link2 className="h-4 w-4 text-primary shrink-0" />
              <div className="flex-1 space-y-1">
                <label className="text-xs font-medium text-primary">ID do site externo</label>
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Cole aqui o UUID que o site externo usa"
                    value={externalIds[item.storefrontProductId] ?? item.externalId}
                    onChange={(e) => setExternalIds(prev => ({ ...prev, [item.storefrontProductId]: e.target.value }))}
                    className="h-8 text-xs font-mono"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 shrink-0"
                    disabled={savingId === item.storefrontProductId}
                    onClick={() => handleSaveExternalId(
                      item.storefrontProductId,
                      externalIds[item.storefrontProductId] ?? item.externalId
                    )}
                  >
                    <Save className="h-3.5 w-3.5 mr-1" />
                    Salvar
                  </Button>
                </div>
              </div>
            </div>

            {/* Price tiers */}
            {item.quantities.map(q => (
              <div
                key={q.qty}
                className="flex items-center gap-3 rounded-lg border p-3 bg-muted/30"
              >
                <Badge variant="outline" className="shrink-0 w-14 justify-center">
                  {q.qty} un
                </Badge>
                <span className="text-sm font-semibold shrink-0 w-24">
                  {formatCents(q.price)}
                </span>
              </div>
            ))}

            {item.quantities.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum preço configurado para este produto.</p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
