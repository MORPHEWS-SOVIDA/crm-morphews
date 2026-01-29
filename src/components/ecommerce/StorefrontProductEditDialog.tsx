import { useState, useEffect, useMemo } from 'react';
import { Package, Settings, Tag, DollarSign, Info, Eye, EyeOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import type { StorefrontProduct } from '@/hooks/ecommerce';
import { useProductPriceKits } from '@/hooks/useProductPriceKits';

interface ProductData {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  base_price_cents: number | null;
  price_1_unit: number;
  price_3_units: number;
  price_6_units: number;
  price_12_units: number;
  ecommerce_title?: string | null;
  ecommerce_description?: string | null;
  ecommerce_short_description?: string | null;
  ecommerce_images?: string[];
  ecommerce_benefits?: string[];
}

interface StorefrontProductEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storefrontProduct: StorefrontProduct & { product: ProductData };
  onSave: (updates: Partial<StorefrontProduct>) => void;
  isPending?: boolean;
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

function parseCurrency(value: string): number {
  const cleaned = value.replace(/[^\d,.-]/g, '').replace(',', '.');
  return Math.round(parseFloat(cleaned || '0') * 100);
}

function formatCentsToInput(cents: number | null | undefined): string {
  if (!cents) return '';
  return (cents / 100).toFixed(2).replace('.', ',');
}

export function StorefrontProductEditDialog({
  open,
  onOpenChange,
  storefrontProduct,
  onSave,
  isPending = false,
}: StorefrontProductEditDialogProps) {
  const product = storefrontProduct.product;
  
  // Fetch product price kits
  const { data: priceKits, isLoading: isLoadingKits } = useProductPriceKits(product?.id);

  // Form state - overrides
  const [customName, setCustomName] = useState('');
  const [customDescription, setCustomDescription] = useState('');
  const [useCustomPrice, setUseCustomPrice] = useState(false);
  
  // Single unit price (base price)
  const [customUnitPrice, setCustomUnitPrice] = useState('');
  
  // Dynamic kit prices: { "2": "297,00", "3": "397,00", ... }
  const [customKitPrices, setCustomKitPrices] = useState<Record<string, string>>({});
  
  const [isVisible, setIsVisible] = useState(true);
  const [isFeatured, setIsFeatured] = useState(false);
  const [showCrosssell, setShowCrosssell] = useState(true);
  const [showKitUpsell, setShowKitUpsell] = useState(true);
  const [categoryLabel, setCategoryLabel] = useState('');
  const [highlightBadge, setHighlightBadge] = useState('');
  const [displayOrder, setDisplayOrder] = useState(0);

  // Load existing values
  useEffect(() => {
    if (storefrontProduct) {
      setCustomName(storefrontProduct.custom_name || '');
      setCustomDescription(storefrontProduct.custom_description || '');
      
      // Check if has custom pricing
      const hasCustomPrice = storefrontProduct.custom_price_cents !== null || 
        (storefrontProduct.custom_kit_prices && Object.keys(storefrontProduct.custom_kit_prices).length > 0);
      setUseCustomPrice(hasCustomPrice);
      
      // Load single unit custom price
      setCustomUnitPrice(formatCentsToInput(storefrontProduct.custom_price_cents));
      
      // Load kit custom prices
      if (storefrontProduct.custom_kit_prices) {
        const kitPricesFormatted: Record<string, string> = {};
        for (const [qty, cents] of Object.entries(storefrontProduct.custom_kit_prices)) {
          kitPricesFormatted[qty] = formatCentsToInput(cents as number);
        }
        setCustomKitPrices(kitPricesFormatted);
      } else {
        setCustomKitPrices({});
      }
      
      setIsVisible(storefrontProduct.is_visible !== false);
      setIsFeatured(storefrontProduct.is_featured || false);
      setShowCrosssell(storefrontProduct.show_crosssell !== false);
      setShowKitUpsell(storefrontProduct.show_kit_upsell !== false);
      setCategoryLabel(storefrontProduct.category_label || '');
      setHighlightBadge(storefrontProduct.highlight_badge || '');
      setDisplayOrder(storefrontProduct.display_order || 0);
    }
  }, [storefrontProduct]);

  // Get base price for single unit
  const baseUnitPrice = product?.price_1_unit || product?.base_price_cents || 0;

  const handleKitPriceChange = (quantity: number, value: string) => {
    setCustomKitPrices(prev => ({
      ...prev,
      [quantity.toString()]: value,
    }));
  };

  const handleSave = () => {
    // Build custom kit prices object
    const kitPricesCents: Record<string, number> = {};
    for (const [qty, value] of Object.entries(customKitPrices)) {
      if (value && value.trim()) {
        kitPricesCents[qty] = parseCurrency(value);
      }
    }
    
    onSave({
      custom_name: customName || null,
      custom_description: customDescription || null,
      custom_price_cents: useCustomPrice && customUnitPrice ? parseCurrency(customUnitPrice) : null,
      custom_kit_prices: useCustomPrice && Object.keys(kitPricesCents).length > 0 ? kitPricesCents : null,
      is_visible: isVisible,
      is_featured: isFeatured,
      show_crosssell: showCrosssell,
      show_kit_upsell: showKitUpsell,
      category_label: categoryLabel || null,
      highlight_badge: highlightBadge || null,
      display_order: displayOrder,
    });
  };

  // Sort kits by quantity
  const sortedKits = useMemo(() => {
    if (!priceKits) return [];
    return [...priceKits].sort((a, b) => a.quantity - b.quantity);
  }, [priceKits]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            {product?.image_url ? (
              <img src={product.image_url} alt="" className="w-12 h-12 rounded object-cover" />
            ) : (
              <div className="w-12 h-12 rounded bg-muted flex items-center justify-center">
                <Package className="h-6 w-6 text-muted-foreground" />
              </div>
            )}
            <div>
              <span>Editar Produto na Loja</span>
              <p className="text-sm font-normal text-muted-foreground mt-1">
                {product?.name}
              </p>
            </div>
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="general" className="mt-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="general" className="gap-2">
              <Info className="h-4 w-4" />
              Geral
            </TabsTrigger>
            <TabsTrigger value="pricing" className="gap-2">
              <DollarSign className="h-4 w-4" />
              Preços
            </TabsTrigger>
            <TabsTrigger value="display" className="gap-2">
              <Eye className="h-4 w-4" />
              Exibição
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2">
              <Settings className="h-4 w-4" />
              Config
            </TabsTrigger>
          </TabsList>

          {/* General Tab */}
          <TabsContent value="general" className="space-y-4 mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Informações Personalizadas</CardTitle>
                <CardDescription>
                  Sobrescreva as informações do produto para esta loja específica
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="custom-name">Nome do Produto (personalizado)</Label>
                  <Input
                    id="custom-name"
                    placeholder={product?.name || 'Nome do produto'}
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Deixe em branco para usar: <span className="font-medium">{product?.ecommerce_title || product?.name}</span>
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="custom-description">Descrição Personalizada</Label>
                  <RichTextEditor
                    value={customDescription}
                    onChange={setCustomDescription}
                    placeholder="Descrição do produto para esta loja... Você pode usar HTML para criar layouts ricos!"
                    rows={6}
                  />
                  <p className="text-xs text-muted-foreground">
                    Use o editor visual ou alterne para HTML. Deixe em branco para usar a descrição padrão.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category-label">Rótulo de Categoria</Label>
                  <Input
                    id="category-label"
                    placeholder="Ex: Suplementos, Vitaminas, Emagrecimento..."
                    value={categoryLabel}
                    onChange={(e) => setCategoryLabel(e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Original Product Info - Read Only */}
            <Card className="bg-muted/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Informações do Produto Original
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-muted-foreground">Nome:</span>
                    <p className="font-medium">{product?.name}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Título E-commerce:</span>
                    <p className="font-medium">{product?.ecommerce_title || '-'}</p>
                  </div>
                </div>
                {product?.ecommerce_short_description && (
                  <div>
                    <span className="text-muted-foreground">Descrição Curta:</span>
                    <p className="text-sm">{product.ecommerce_short_description}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Pricing Tab */}
          <TabsContent value="pricing" className="space-y-4 mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Preços Personalizados</CardTitle>
                <CardDescription>
                  Defina preços promocionais para esta loja. O preço de tabela será riscado.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div>
                    <p className="font-medium">Usar preços personalizados</p>
                    <p className="text-sm text-muted-foreground">
                      Sobrescrever os preços padrão do produto
                    </p>
                  </div>
                  <Switch
                    checked={useCustomPrice}
                    onCheckedChange={setUseCustomPrice}
                  />
                </div>

                {isLoadingKits ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <>
                    {/* Single Unit Price */}
                    <div className="rounded-lg border p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h4 className="font-medium">1 Unidade</h4>
                          <p className="text-xs text-muted-foreground">Preço base unitário</p>
                        </div>
                        <div className="text-right">
                          <span className={`text-sm ${useCustomPrice && customUnitPrice ? 'line-through text-muted-foreground' : 'font-medium'}`}>
                            {formatCurrency(baseUnitPrice)}
                          </span>
                          {useCustomPrice && customUnitPrice && (
                            <span className="block text-lg font-bold text-primary">
                              {formatCurrency(parseCurrency(customUnitPrice))}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      {useCustomPrice && (
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">R$</span>
                          <Input
                            className="pl-10"
                            placeholder="Preço promocional..."
                            value={customUnitPrice}
                            onChange={(e) => setCustomUnitPrice(e.target.value)}
                          />
                        </div>
                      )}
                    </div>

                    {/* Kit Prices */}
                    {sortedKits.length > 0 && (
                      <div className="space-y-3">
                        <h4 className="text-sm font-medium flex items-center gap-2">
                          <Package className="h-4 w-4" />
                          Kits Disponíveis
                        </h4>
                        
                        {sortedKits.map((kit) => {
                          const customValue = customKitPrices[kit.quantity.toString()] || '';
                          const hasCustom = useCustomPrice && customValue.trim();
                          const unitPrice = kit.regular_price_cents / kit.quantity;
                          
                          return (
                            <div key={kit.id} className="rounded-lg border p-4">
                              <div className="flex items-center justify-between mb-3">
                                <div>
                                  <h4 className="font-medium">Kit {kit.quantity} unidades</h4>
                                  <p className="text-xs text-muted-foreground">
                                    {formatCurrency(unitPrice)}/un
                                  </p>
                                </div>
                                <div className="text-right">
                                  <span className={`text-sm ${hasCustom ? 'line-through text-muted-foreground' : 'font-medium'}`}>
                                    {formatCurrency(kit.regular_price_cents)}
                                  </span>
                                  {hasCustom && (
                                    <span className="block text-lg font-bold text-primary">
                                      {formatCurrency(parseCurrency(customValue))}
                                    </span>
                                  )}
                                </div>
                              </div>
                              
                              {useCustomPrice && (
                                <div className="relative">
                                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">R$</span>
                                  <Input
                                    className="pl-10"
                                    placeholder="Preço promocional..."
                                    value={customValue}
                                    onChange={(e) => handleKitPriceChange(kit.quantity, e.target.value)}
                                  />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {sortedKits.length === 0 && !isLoadingKits && (
                      <div className="rounded-lg border border-dashed p-6 text-center">
                        <Package className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">
                          Nenhum kit de preço configurado para este produto.
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Configure kits em Produtos → Editar Produto → Preços
                        </p>
                      </div>
                    )}
                  </>
                )}

                <Separator />

                {/* Original prices summary */}
                <div className="rounded-lg border p-4 bg-muted/30">
                  <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    Resumo de Preços de Tabela
                  </h4>
                  <div className="flex flex-wrap gap-2 text-sm">
                    <Badge variant="outline" className="font-mono">
                      1 UN: {formatCurrency(baseUnitPrice)}
                    </Badge>
                    {sortedKits.map((kit) => (
                      <Badge key={kit.id} variant="outline" className="font-mono">
                        {kit.quantity} UN: {formatCurrency(kit.regular_price_cents)}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Display Tab */}
          <TabsContent value="display" className="space-y-4 mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Visibilidade e Destaque</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-3">
                    {isVisible ? <Eye className="h-5 w-5 text-green-500" /> : <EyeOff className="h-5 w-5 text-muted-foreground" />}
                    <div>
                      <p className="font-medium">Produto Visível</p>
                      <p className="text-sm text-muted-foreground">
                        Exibir este produto na loja
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={isVisible}
                    onCheckedChange={setIsVisible}
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <Tag className="h-5 w-5 text-yellow-500" />
                    <div>
                      <p className="font-medium">Produto em Destaque</p>
                      <p className="text-sm text-muted-foreground">
                        Exibir na seção de destaques da loja
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={isFeatured}
                    onCheckedChange={setIsFeatured}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="highlight-badge">Badge de Destaque</Label>
                  <Input
                    id="highlight-badge"
                    placeholder="Ex: Mais Vendido, Novo, Promoção..."
                    value={highlightBadge}
                    onChange={(e) => setHighlightBadge(e.target.value)}
                  />
                  {highlightBadge && (
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-sm text-muted-foreground">Prévia:</span>
                      <Badge variant="secondary">{highlightBadge}</Badge>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="display-order">Ordem de Exibição</Label>
                  <Input
                    id="display-order"
                    type="number"
                    placeholder="0"
                    value={displayOrder}
                    onChange={(e) => setDisplayOrder(parseInt(e.target.value) || 0)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Produtos com menor número aparecem primeiro
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-4 mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Configurações de Venda</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <p className="font-medium">Cross-sell</p>
                    <p className="text-sm text-muted-foreground">
                      Mostrar produtos relacionados
                    </p>
                  </div>
                  <Switch
                    checked={showCrosssell}
                    onCheckedChange={setShowCrosssell}
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <p className="font-medium">Upsell de Kits</p>
                    <p className="text-sm text-muted-foreground">
                      Sugerir kits maiores com desconto
                    </p>
                  </div>
                  <Switch
                    checked={showKitUpsell}
                    onCheckedChange={setShowKitUpsell}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-6">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              'Salvar Alterações'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
