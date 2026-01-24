import { useState, useEffect } from 'react';
import { Package, Image as ImageIcon, X, Settings, Tag, DollarSign, Info, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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

export function StorefrontProductEditDialog({
  open,
  onOpenChange,
  storefrontProduct,
  onSave,
  isPending = false,
}: StorefrontProductEditDialogProps) {
  const product = storefrontProduct.product;

  // Form state - overrides
  const [customName, setCustomName] = useState('');
  const [customDescription, setCustomDescription] = useState('');
  const [useCustomPrice, setUseCustomPrice] = useState(false);
  const [customPrice, setCustomPrice] = useState('');
  const [customPrice3, setCustomPrice3] = useState('');
  const [customPrice6, setCustomPrice6] = useState('');
  const [customPrice12, setCustomPrice12] = useState('');
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
      setUseCustomPrice(storefrontProduct.custom_price_cents !== null);
      setCustomPrice(storefrontProduct.custom_price_cents 
        ? (storefrontProduct.custom_price_cents / 100).toFixed(2).replace('.', ',')
        : ''
      );
      setCustomPrice3(storefrontProduct.custom_price_3_cents 
        ? (storefrontProduct.custom_price_3_cents / 100).toFixed(2).replace('.', ',')
        : ''
      );
      setCustomPrice6(storefrontProduct.custom_price_6_cents 
        ? (storefrontProduct.custom_price_6_cents / 100).toFixed(2).replace('.', ',')
        : ''
      );
      setCustomPrice12(storefrontProduct.custom_price_12_cents 
        ? (storefrontProduct.custom_price_12_cents / 100).toFixed(2).replace('.', ',')
        : ''
      );
      setIsVisible(storefrontProduct.is_visible !== false);
      setIsFeatured(storefrontProduct.is_featured || false);
      setShowCrosssell(storefrontProduct.show_crosssell !== false);
      setShowKitUpsell(storefrontProduct.show_kit_upsell !== false);
      setCategoryLabel(storefrontProduct.category_label || '');
      setHighlightBadge(storefrontProduct.highlight_badge || '');
      setDisplayOrder(storefrontProduct.display_order || 0);
    }
  }, [storefrontProduct]);

  const handleSave = () => {
    onSave({
      custom_name: customName || null,
      custom_description: customDescription || null,
      custom_price_cents: useCustomPrice ? parseCurrency(customPrice) : null,
      custom_price_3_cents: useCustomPrice && customPrice3 ? parseCurrency(customPrice3) : null,
      custom_price_6_cents: useCustomPrice && customPrice6 ? parseCurrency(customPrice6) : null,
      custom_price_12_cents: useCustomPrice && customPrice12 ? parseCurrency(customPrice12) : null,
      is_visible: isVisible,
      is_featured: isFeatured,
      show_crosssell: showCrosssell,
      show_kit_upsell: showKitUpsell,
      category_label: categoryLabel || null,
      highlight_badge: highlightBadge || null,
      display_order: displayOrder,
    });
  };

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
                  <Textarea
                    id="custom-description"
                    placeholder="Descrição do produto para esta loja..."
                    value={customDescription}
                    onChange={(e) => setCustomDescription(e.target.value)}
                    rows={4}
                  />
                  <p className="text-xs text-muted-foreground">
                    Deixe em branco para usar a descrição padrão do produto
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
                  Defina preços específicos para esta loja
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

                {useCustomPrice && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Preço 1 Unidade</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">R$</span>
                        <Input
                          className="pl-10"
                          placeholder="0,00"
                          value={customPrice}
                          onChange={(e) => setCustomPrice(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Preço 3 Unidades</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">R$</span>
                        <Input
                          className="pl-10"
                          placeholder="0,00"
                          value={customPrice3}
                          onChange={(e) => setCustomPrice3(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Preço 6 Unidades</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">R$</span>
                        <Input
                          className="pl-10"
                          placeholder="0,00"
                          value={customPrice6}
                          onChange={(e) => setCustomPrice6(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Preço 12 Unidades</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">R$</span>
                        <Input
                          className="pl-10"
                          placeholder="0,00"
                          value={customPrice12}
                          onChange={(e) => setCustomPrice12(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                )}

                <Separator />

                {/* Original prices info */}
                <div className="rounded-lg border p-4 bg-muted/30">
                  <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    Preços Originais do Produto
                  </h4>
                  <div className="grid grid-cols-4 gap-3 text-sm">
                    <div className="text-center p-2 rounded bg-background">
                      <span className="block text-muted-foreground text-xs">1 UN</span>
                      <span className="font-medium">
                        {formatCurrency(product?.price_1_unit || product?.base_price_cents || 0)}
                      </span>
                    </div>
                    <div className="text-center p-2 rounded bg-background">
                      <span className="block text-muted-foreground text-xs">3 UN</span>
                      <span className="font-medium">
                        {formatCurrency(product?.price_3_units || 0)}
                      </span>
                    </div>
                    <div className="text-center p-2 rounded bg-background">
                      <span className="block text-muted-foreground text-xs">6 UN</span>
                      <span className="font-medium">
                        {formatCurrency(product?.price_6_units || 0)}
                      </span>
                    </div>
                    <div className="text-center p-2 rounded bg-background">
                      <span className="block text-muted-foreground text-xs">12 UN</span>
                      <span className="font-medium">
                        {formatCurrency(product?.price_12_units || 0)}
                      </span>
                    </div>
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
                    <div className="mt-2">
                      <span className="text-sm text-muted-foreground">Preview: </span>
                      <Badge variant="secondary">{highlightBadge}</Badge>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="display-order">Ordem de Exibição</Label>
                  <Input
                    id="display-order"
                    type="number"
                    min="0"
                    value={displayOrder}
                    onChange={(e) => setDisplayOrder(Number(e.target.value))}
                  />
                  <p className="text-xs text-muted-foreground">
                    Produtos com número menor aparecem primeiro
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
                    <p className="font-medium">Mostrar Kits/Quantidades</p>
                    <p className="text-sm text-muted-foreground">
                      Exibir opções de Kit 3, Kit 6, Kit 12
                    </p>
                  </div>
                  <Switch
                    checked={showKitUpsell}
                    onCheckedChange={setShowKitUpsell}
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <p className="font-medium">Mostrar Cross-Sell</p>
                    <p className="text-sm text-muted-foreground">
                      Exibir produtos relacionados
                    </p>
                  </div>
                  <Switch
                    checked={showCrosssell}
                    onCheckedChange={setShowCrosssell}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isPending}>
            {isPending ? 'Salvando...' : 'Salvar Alterações'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}