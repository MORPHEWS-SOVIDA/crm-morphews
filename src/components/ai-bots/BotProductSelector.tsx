import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Package, Search, Sparkles, AlertCircle, Brain, Image, Youtube, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BotProductSelectorProps {
  botId?: string;
  productScope: 'all' | 'selected' | 'none';
  selectedProductIds: string[];
  useRagSearch: boolean;
  onProductScopeChange: (scope: 'all' | 'selected' | 'none') => void;
  onSelectedProductsChange: (productIds: string[]) => void;
  onUseRagSearchChange: (enabled: boolean) => void;
  // Novos campos para mídia de produtos
  sendProductImages?: boolean;
  sendProductVideos?: boolean;
  sendProductLinks?: boolean;
  onSendProductImagesChange?: (enabled: boolean) => void;
  onSendProductVideosChange?: (enabled: boolean) => void;
  onSendProductLinksChange?: (enabled: boolean) => void;
}

interface Product {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  is_active: boolean;
  faqs_count?: number;
  ingredients_count?: number;
  kits_count?: number;
}

export function BotProductSelector({
  botId,
  productScope,
  selectedProductIds,
  useRagSearch,
  onProductScopeChange,
  onSelectedProductsChange,
  onUseRagSearchChange,
  sendProductImages = true,
  sendProductVideos = true,
  sendProductLinks = true,
  onSendProductImagesChange,
  onSendProductVideosChange,
  onSendProductLinksChange,
}: BotProductSelectorProps) {
  const { tenantId } = useTenant();
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch all products (simplified - no counts for now)
  const { data: products = [], isLoading } = useQuery({
    queryKey: ['products-for-bot', tenantId],
    queryFn: async (): Promise<Product[]> => {
      if (!tenantId) return [];

      const { data, error } = await supabase
        .from('lead_products')
        .select('id, name, description, image_url, is_active')
        .eq('organization_id', tenantId)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return (data || []).map(p => ({
        ...p,
        faqs_count: 0,
        ingredients_count: 0,
        kits_count: 0,
      }));
    },
    enabled: !!tenantId,
  });

  const productsWithCounts = products;

  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return products;
    const query = searchQuery.toLowerCase();
    return products.filter(p => 
      p.name.toLowerCase().includes(query) ||
      p.description?.toLowerCase().includes(query)
    );
  }, [products, searchQuery]);

  const toggleProduct = (productId: string) => {
    if (selectedProductIds.includes(productId)) {
      onSelectedProductsChange(selectedProductIds.filter(id => id !== productId));
    } else {
      onSelectedProductsChange([...selectedProductIds, productId]);
    }
  };

  const selectAll = () => {
    onSelectedProductsChange(products.map(p => p.id));
  };

  const selectNone = () => {
    onSelectedProductsChange([]);
  };

  // Calculate total context richness
  const totalFaqs = products.reduce((sum, p) => sum + (p.faqs_count || 0), 0);
  const totalIngredients = products.reduce((sum, p) => sum + (p.ingredients_count || 0), 0);
  const totalKits = products.reduce((sum, p) => sum + (p.kits_count || 0), 0);

  return (
    <div className="space-y-4">
      {/* Scope Selection */}
      <div className="space-y-3">
        <Label className="text-base font-medium">Acesso ao Catálogo de Produtos</Label>
        <RadioGroup
          value={productScope}
          onValueChange={(v) => onProductScopeChange(v as 'all' | 'selected' | 'none')}
          className="grid grid-cols-1 sm:grid-cols-3 gap-3"
        >
          {[
            { 
              value: 'all', 
              label: '🌐 Todos os Produtos', 
              desc: 'Bot acessa todo o catálogo',
              highlight: true 
            },
            { 
              value: 'selected', 
              label: '📦 Produtos Selecionados', 
              desc: 'Escolha quais produtos' 
            },
            { 
              value: 'none', 
              label: '🚫 Nenhum Produto', 
              desc: 'Sem acesso ao catálogo' 
            },
          ].map((option) => (
            <Label
              key={option.value}
              className={cn(
                "flex flex-col gap-1 p-3 border rounded-lg cursor-pointer transition-all hover:border-primary",
                productScope === option.value && "border-primary bg-primary/5",
                option.highlight && productScope !== option.value && "border-dashed"
              )}
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value={option.value} />
                <span className="font-medium text-sm">{option.label}</span>
              </div>
              <span className="text-xs text-muted-foreground ml-6">{option.desc}</span>
            </Label>
          ))}
        </RadioGroup>
      </div>

      {/* Semantic Search Toggle */}
      {productScope !== 'none' && (
        <Card className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20 border-blue-200 dark:border-blue-800">
          <CardContent className="py-3 px-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-blue-600" />
                <div>
                  <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                    Busca Semântica (RAG)
                  </span>
                  <p className="text-xs text-muted-foreground">
                    IA busca informações relevantes automaticamente
                  </p>
                </div>
              </div>
              <Switch
                checked={useRagSearch}
                onCheckedChange={onUseRagSearchChange}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Context Richness Indicator */}
      {productScope !== 'none' && (
        <Card className="bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950/20 dark:to-purple-950/20 border-violet-200 dark:border-violet-800">
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-violet-600" />
              <span className="text-sm font-medium text-violet-700 dark:text-violet-300">
                Contexto RAG disponível
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" className="bg-white/80">
                {products.length} produtos
              </Badge>
              <Badge variant="secondary" className="bg-white/80">
                {totalFaqs} FAQs
              </Badge>
              <Badge variant="secondary" className="bg-white/80">
                {totalIngredients} ingredientes
              </Badge>
              <Badge variant="secondary" className="bg-white/80">
                {totalKits} kits
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              A IA usará essas informações para responder perguntas sobre produtos
            </p>
          </CardContent>
        </Card>
      )}

      {/* Product Media Sharing */}
      {productScope !== 'none' && onSendProductImagesChange && (
        <Card className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 border-green-200 dark:border-green-800">
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-2 mb-3">
              <Image className="w-4 h-4 text-green-600" />
              <span className="text-sm font-medium text-green-700 dark:text-green-300">
                Envio automático de mídia
              </span>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Quando o robô identificar um produto, ele pode enviar automaticamente:
            </p>
            <div className="space-y-2">
              <div className="flex items-center justify-between py-2 px-3 bg-white/60 dark:bg-black/20 rounded-lg">
                <div className="flex items-center gap-2">
                  <Image className="w-4 h-4 text-blue-500" />
                  <span className="text-sm">Foto do produto</span>
                </div>
                <Switch
                  checked={sendProductImages}
                  onCheckedChange={onSendProductImagesChange}
                />
              </div>
              <div className="flex items-center justify-between py-2 px-3 bg-white/60 dark:bg-black/20 rounded-lg">
                <div className="flex items-center gap-2">
                  <Youtube className="w-4 h-4 text-red-500" />
                  <span className="text-sm">Vídeo YouTube</span>
                </div>
                <Switch
                  checked={sendProductVideos}
                  onCheckedChange={onSendProductVideosChange}
                />
              </div>
              <div className="flex items-center justify-between py-2 px-3 bg-white/60 dark:bg-black/20 rounded-lg">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-purple-500" />
                  <span className="text-sm">Link do site</span>
                </div>
                <Switch
                  checked={sendProductLinks}
                  onCheckedChange={onSendProductLinksChange}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              💡 O produto precisa ter a mídia configurada E habilitada no cadastro
            </p>
          </CardContent>
        </Card>
      )}

      {/* Product Selection (only if scope is 'selected') */}
      {productScope === 'selected' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Selecione os produtos</Label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={selectAll}
                className="text-xs text-primary hover:underline"
              >
                Selecionar todos
              </button>
              <span className="text-muted-foreground">|</span>
              <button
                type="button"
                onClick={selectNone}
                className="text-xs text-muted-foreground hover:underline"
              >
                Limpar
              </button>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar produtos..."
              className="pl-9"
            />
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Nenhum produto encontrado</p>
            </div>
          ) : (
            <ScrollArea className="h-64 border rounded-lg">
              <div className="p-2 space-y-1">
                {filteredProducts.map((product) => {
                  const isSelected = selectedProductIds.includes(product.id);
                  const hasRichContent = (product.faqs_count || 0) > 0 || (product.ingredients_count || 0) > 0;
                  
                  return (
                    <div
                      key={product.id}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all",
                        isSelected 
                          ? "bg-primary/10 border border-primary/30" 
                          : "hover:bg-muted/50 border border-transparent"
                      )}
                      onClick={() => toggleProduct(product.id)}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleProduct(product.id)}
                      />
                      
                      {product.image_url ? (
                        <img
                          src={product.image_url}
                          alt={product.name}
                          className="w-10 h-10 rounded object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                          <Package className="w-5 h-5 text-muted-foreground" />
                        </div>
                      )}
                      
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{product.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {(product.faqs_count || 0) > 0 && (
                            <span className="text-xs text-muted-foreground">
                              {product.faqs_count} FAQs
                            </span>
                          )}
                          {(product.ingredients_count || 0) > 0 && (
                            <span className="text-xs text-muted-foreground">
                              {product.ingredients_count} ingredientes
                            </span>
                          )}
                          {(product.kits_count || 0) > 0 && (
                            <span className="text-xs text-muted-foreground">
                              {product.kits_count} kits
                            </span>
                          )}
                          {!hasRichContent && (
                            <span className="text-xs text-amber-600 flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" />
                              Sem FAQs
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}

          {selectedProductIds.length > 0 && (
            <p className="text-sm text-muted-foreground">
              {selectedProductIds.length} produto(s) selecionado(s)
            </p>
          )}
        </div>
      )}

      {/* Warning for no products */}
      {productScope === 'none' && (
        <Card className="bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
          <CardContent className="py-3 px-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                Bot sem acesso ao catálogo
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                O robô não poderá responder perguntas sobre produtos, preços ou composição. 
                Recomendado apenas para bots de suporte geral.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
