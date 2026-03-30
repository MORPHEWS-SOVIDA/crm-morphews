import { useState } from 'react';
import { Copy, Check, ExternalLink, ShoppingCart, Info, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useStorefrontProducts } from '@/hooks/ecommerce';
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

function buildCheckoutUrl(baseUrl: string, productId: string, qty: number) {
  const payload = { items: [{ pid: productId, q: qty }] };
  const base64 = btoa(JSON.stringify(payload));
  return `${baseUrl}?cart=${encodeURIComponent(base64)}`;
}

export function StorefrontIntegrationTab({ storefrontId, storefrontSlug }: StorefrontIntegrationTabProps) {
  const { data: products, isLoading } = useStorefrontProducts(storefrontId);

  const checkoutBaseUrl = `${window.location.origin}/loja/${storefrontSlug}/checkout`;

  const visibleProducts = (products || []).filter(p => p.is_visible !== false);

  const catalog = visibleProducts.map(sp => {
    const product = sp.product as any;
    const combo = sp.combo as any;
    const name = sp.custom_name || combo?.name || product?.name || 'Produto';
    const productId = sp.product_id || '';
    const comboId = sp.combo_id || '';
    const isCombo = !!comboId;
    const id = productId || comboId;
    
    let price1 = 0;
    let price3 = 0;
    let price5 = 0;

    if (isCombo && combo?.product_combo_prices) {
      const comboPrices = combo.product_combo_prices as any[];
      const sorted = [...comboPrices].sort((a: any, b: any) => (a.multiplier || 0) - (b.multiplier || 0));
      for (const cp of sorted) {
        if (cp.multiplier === 1) price1 = cp.regular_price_cents || 0;
        else if (cp.multiplier === 3) price3 = cp.regular_price_cents || 0;
        else if (cp.multiplier === 5) price5 = cp.regular_price_cents || 0;
      }
    } else if (product) {
      price1 = sp.custom_price_cents || product.price_1_unit || product.base_price_cents || 0;
      price3 = product.price_3_units || 0;
      price5 = product.price_6_units || 0;
    }

    const quantities: { qty: number; price: number; url: string }[] = [];
    if (price1) quantities.push({ qty: 1, price: price1, url: buildCheckoutUrl(checkoutBaseUrl, id, 1) });
    if (price3) quantities.push({ qty: 3, price: price3, url: buildCheckoutUrl(checkoutBaseUrl, id, 3) });
    if (price5) quantities.push({ qty: 5, price: price5, url: buildCheckoutUrl(checkoutBaseUrl, id, 5) });

    return {
      storefrontProductId: sp.id,
      id,
      isCombo,
      name,
      imageUrl: product?.image_url || combo?.image_url,
      quantities,
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
          Cada produto abaixo tem <strong>links prontos</strong> para cada quantidade.
          Copie o link e use no botão de compra do seu site externo. O checkout resolve tudo automaticamente.
        </AlertDescription>
      </Alert>

      {/* Per-product ready links */}
      {catalog.map(item => (
        <Card key={item.storefrontProductId}>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              {item.imageUrl && (
                <img src={item.imageUrl} alt={item.name} className="h-10 w-10 rounded object-cover shrink-0" />
              )}
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  {item.name}
                  {item.isCombo && <Badge variant="secondary" className="text-[10px]">Combo</Badge>}
                </CardTitle>
                <CardDescription className="text-xs font-mono mt-0.5">
                  ID: {item.id}
                  <CopyButton text={item.id} label={`ID ${item.name}`} />
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
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
                <code className="text-[10px] font-mono text-muted-foreground flex-1 truncate hidden sm:block">
                  {q.url.substring(0, 80)}...
                </code>
                <div className="flex items-center gap-1 shrink-0">
                  <CopyButton text={q.url} label={`Link ${item.name} ${q.qty}un`} />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => window.open(q.url, '_blank')}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}

            {item.quantities.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum preço configurado para este produto.</p>
            )}
          </CardContent>
        </Card>
      ))}

      {/* Multi-product link builder */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShoppingCart className="h-5 w-5" />
            Carrinho com Múltiplos Produtos
          </CardTitle>
          <CardDescription>
            Para enviar mais de um produto no mesmo link, monte o JSON abaixo e converta para Base64.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <pre className="bg-muted p-4 rounded-lg text-xs overflow-x-auto">
              <code>{`// JSON do carrinho (converter para Base64):
{
  "items": [
${catalog.slice(0, 2).map(p => `    { "pid": "${p.id}", "q": 1 }  // ${p.name}`).join(',\n')}
  ]
}

// URL final:
// ${checkoutBaseUrl}?cart=BASE64_AQUI`}</code>
            </pre>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            <strong>Dica:</strong> Para a maioria dos casos, os links prontos acima são suficientes. 
            Use este formato apenas se precisar montar carrinhos com múltiplos produtos programaticamente.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
