import { useState } from 'react';
import { Copy, Check, Code, ExternalLink, ShoppingCart, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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

export function StorefrontIntegrationTab({ storefrontId, storefrontSlug }: StorefrontIntegrationTabProps) {
  const { data: products, isLoading } = useStorefrontProducts(storefrontId);
  const [activeSnippet, setActiveSnippet] = useState('javascript');

  const checkoutBaseUrl = `${window.location.origin}/loja/${storefrontSlug}/checkout`;

  const visibleProducts = (products || []).filter(p => p.is_visible !== false);

  // Build product catalog for display
  const catalog = visibleProducts.map(sp => {
    const product = sp.product as any;
    const combo = sp.combo as any;
    const name = sp.custom_name || combo?.name || product?.name || 'Produto';
    const productId = sp.product_id || '';
    const comboId = sp.combo_id || '';
    const isCombo = !!comboId;
    
    const price1 = sp.custom_price_cents || product?.price_1_unit || product?.base_price_cents || 0;
    const price3 = sp.custom_price_3_cents || 0;
    const price5 = sp.custom_price_6_cents || 0;

    return {
      storefrontProductId: sp.id,
      productId,
      comboId,
      isCombo,
      name,
      imageUrl: product?.image_url || combo?.image_url,
      prices: [
        { qty: 1, price: price1, code: `${productId || comboId}` },
        ...(price3 ? [{ qty: 3, price: price3, code: `${productId || comboId}` }] : []),
        ...(price5 ? [{ qty: 5, price: price5, code: `${productId || comboId}` }] : []),
      ],
    };
  });

  const sampleCart = catalog.slice(0, 2).map(p => ({
    pid: p.productId || p.comboId,
    q: 1,
  }));

  const sampleBase64 = btoa(JSON.stringify({ items: sampleCart }));

  const jsSnippet = `// === AtomicSales Checkout Integration ===
// Cole este script no seu site ${storefrontSlug}

// 1. Catálogo de Produtos (IDs do AtomicSales)
const CATALOGO = {
${catalog.map(p => `  // ${p.name}
  '${p.name.toUpperCase().replace(/[^A-Z0-9]/g, '_')}': '${p.productId || p.comboId}',`).join('\n')}
};

// 2. Função para montar o checkout
function enviarParaCheckout(itensDoCarrinho) {
  // itensDoCarrinho = [{ id: 'UUID_DO_PRODUTO', quantidade: 1 }, ...]
  const payload = {
    items: itensDoCarrinho.map(item => ({
      pid: item.id,       // ID do produto no AtomicSales
      q: item.quantidade, // Quantidade (1, 3 ou 5)
    }))
  };

  const base64 = btoa(JSON.stringify(payload));
  const url = '${checkoutBaseUrl}?cart=' + base64;
  
  window.location.href = url;
}

// 3. Exemplo de uso:
// enviarParaCheckout([
//   { id: CATALOGO.BALESTRERO_POWER, quantidade: 3 },
//   { id: CATALOGO.COMBAT_CREATINA, quantidade: 1 },
// ]);`;

  const htmlSnippet = `<!-- AtomicSales Checkout - ${storefrontSlug} -->
<!-- Cole no seu site onde quiser o botão de checkout -->

<script>
${jsSnippet}
</script>

<!-- Botão de exemplo -->
<button onclick="enviarParaCheckout(meusItens)">
  Finalizar Compra no AtomicSales
</button>`;

  const urlSnippet = `URL direta para checkout com carrinho pré-montado:

${checkoutBaseUrl}?cart=BASE64_AQUI

Formato do JSON (antes de converter para Base64):
{
  "items": [
    { "pid": "UUID_PRODUTO_1", "q": 1 },
    { "pid": "UUID_PRODUTO_2", "q": 3 }
  ]
}

Exemplo real com seus produtos:
${checkoutBaseUrl}?cart=${sampleBase64}

Campos aceitos por item:
  pid  = ID do produto (obrigatório)
  q    = Quantidade (obrigatório) 
  upc  = Preço unitário em centavos (opcional, resolve do banco)
  n    = Nome do produto (opcional, resolve do banco)
  ks   = Tamanho do kit (opcional)`;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Use os <strong>códigos de produto</strong> abaixo para integrar seu site externo com o checkout do AtomicSales. 
          O site externo envia os IDs + quantidades e o checkout resolve preços e dados automaticamente.
        </AlertDescription>
      </Alert>

      {/* Product Catalog with IDs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Catálogo de Produtos — Códigos de Integração
          </CardTitle>
          <CardDescription>
            Cada produto tem um <strong>ID único</strong>. Use esse ID ao enviar itens do carrinho para o checkout.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border overflow-hidden">
            {/* Table Header */}
            <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-2 p-3 bg-muted/50 text-xs font-semibold text-muted-foreground uppercase">
              <span>Produto</span>
              <span className="text-center w-24">1 un</span>
              <span className="text-center w-24">3 un</span>
              <span className="text-center w-24">5 un</span>
              <span className="text-center w-10">ID</span>
            </div>

            {catalog.map((item, idx) => (
              <div
                key={item.storefrontProductId}
                className={`grid grid-cols-[1fr_auto_auto_auto_auto] gap-2 p-3 items-center ${
                  idx % 2 === 0 ? 'bg-background' : 'bg-muted/20'
                }`}
              >
                {/* Product name + image */}
                <div className="flex items-center gap-3 min-w-0">
                  {item.imageUrl && (
                    <img src={item.imageUrl} alt={item.name} className="h-8 w-8 rounded object-cover shrink-0" />
                  )}
                  <div className="min-w-0">
                    <span className="font-medium text-sm truncate block">{item.name}</span>
                    {item.isCombo && <Badge variant="secondary" className="text-[10px] mt-0.5">Combo</Badge>}
                  </div>
                </div>

                {/* Prices */}
                <span className="text-sm text-center w-24">
                  {item.prices[0] ? formatCents(item.prices[0].price) : '—'}
                </span>
                <span className="text-sm text-center w-24">
                  {item.prices[1] ? formatCents(item.prices[1].price) : '—'}
                </span>
                <span className="text-sm text-center w-24">
                  {item.prices[2] ? formatCents(item.prices[2].price) : '—'}
                </span>

                {/* Copy ID */}
                <div className="w-10 flex justify-center">
                  <CopyButton 
                    text={item.productId || item.comboId} 
                    label={`ID de ${item.name}`} 
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Individual IDs expanded list */}
          <div className="mt-4 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase">IDs para copiar</p>
            {catalog.map(item => (
              <div key={item.storefrontProductId} className="flex items-center gap-2 text-xs">
                <code className="bg-muted px-2 py-1 rounded font-mono flex-1 truncate">
                  {item.productId || item.comboId}
                </code>
                <span className="text-muted-foreground shrink-0">← {item.name}</span>
                <CopyButton text={item.productId || item.comboId} label={item.name} />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Code Snippets */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code className="h-5 w-5" />
            Código de Integração
          </CardTitle>
          <CardDescription>
            Copie e cole no seu site externo para enviar o carrinho ao checkout AtomicSales.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeSnippet} onValueChange={setActiveSnippet}>
            <TabsList>
              <TabsTrigger value="javascript">JavaScript</TabsTrigger>
              <TabsTrigger value="html">HTML Completo</TabsTrigger>
              <TabsTrigger value="url">URL Direta</TabsTrigger>
            </TabsList>

            <TabsContent value="javascript" className="mt-4">
              <div className="relative">
                <div className="absolute top-2 right-2 z-10">
                  <CopyButton text={jsSnippet} label="Código JavaScript" />
                </div>
                <pre className="bg-muted p-4 rounded-lg text-xs overflow-x-auto max-h-96 overflow-y-auto">
                  <code>{jsSnippet}</code>
                </pre>
              </div>
            </TabsContent>

            <TabsContent value="html" className="mt-4">
              <div className="relative">
                <div className="absolute top-2 right-2 z-10">
                  <CopyButton text={htmlSnippet} label="Código HTML" />
                </div>
                <pre className="bg-muted p-4 rounded-lg text-xs overflow-x-auto max-h-96 overflow-y-auto">
                  <code>{htmlSnippet}</code>
                </pre>
              </div>
            </TabsContent>

            <TabsContent value="url" className="mt-4">
              <div className="relative">
                <div className="absolute top-2 right-2 z-10">
                  <CopyButton text={urlSnippet} label="Documentação URL" />
                </div>
                <pre className="bg-muted p-4 rounded-lg text-xs overflow-x-auto max-h-96 overflow-y-auto whitespace-pre-wrap">
                  <code>{urlSnippet}</code>
                </pre>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Quick test link */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ExternalLink className="h-5 w-5" />
            Teste Rápido
          </CardTitle>
          <CardDescription>
            Clique para abrir o checkout com um carrinho de exemplo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <code className="bg-muted px-3 py-2 rounded text-xs flex-1 truncate font-mono">
              {checkoutBaseUrl}?cart={sampleBase64.substring(0, 40)}...
            </code>
            <CopyButton text={`${checkoutBaseUrl}?cart=${sampleBase64}`} label="URL de teste" />
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(`${checkoutBaseUrl}?cart=${sampleBase64}`, '_blank')}
            >
              <ExternalLink className="h-4 w-4 mr-1" />
              Abrir
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
