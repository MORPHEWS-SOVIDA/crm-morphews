import { useState, useEffect } from 'react';
import { Save, ShoppingCart, CreditCard, Globe, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useUpdateStorefront, type Storefront } from '@/hooks/ecommerce';

interface StorefrontSettingsTabProps {
  storefront: Storefront;
}

interface HeaderConfig {
  showSearch: boolean;
  showCart: boolean;
  showCategories: boolean;
  menuStyle: 'horizontal' | 'dropdown';
  stickyHeader: boolean;
}

interface CartConfig {
  showCrosssell: boolean;
  minOrderValue: number;
  freeShippingThreshold: number;
}

interface CheckoutConfig {
  style: 'page' | 'modal';
  showOrderBump: boolean;
  showKitUpsell: boolean;
  requirePhone: boolean;
  requireCpf: boolean;
}

export function StorefrontSettingsTab({ storefront }: StorefrontSettingsTabProps) {
  const updateStorefront = useUpdateStorefront();

  const [headerConfig, setHeaderConfig] = useState<HeaderConfig>({
    showSearch: true,
    showCart: true,
    showCategories: true,
    menuStyle: 'horizontal',
    stickyHeader: true,
  });

  const [cartConfig, setCartConfig] = useState<CartConfig>({
    showCrosssell: true,
    minOrderValue: 0,
    freeShippingThreshold: 0,
  });

  const [checkoutConfig, setCheckoutConfig] = useState<CheckoutConfig>({
    style: 'page',
    showOrderBump: true,
    showKitUpsell: true,
    requirePhone: true,
    requireCpf: true,
  });

  const [paymentMethods, setPaymentMethods] = useState<string[]>(['pix', 'credit_card', 'boleto']);

  useEffect(() => {
    if (storefront.header_config) {
      setHeaderConfig(prev => ({ ...prev, ...(storefront.header_config as HeaderConfig) }));
    }
    if (storefront.cart_config) {
      setCartConfig(prev => ({ ...prev, ...(storefront.cart_config as CartConfig) }));
    }
    if (storefront.checkout_config) {
      setCheckoutConfig(prev => ({ ...prev, ...(storefront.checkout_config as CheckoutConfig) }));
    }
    if (storefront.payment_methods_display) {
      setPaymentMethods(storefront.payment_methods_display);
    }
  }, [storefront]);

  const handleSave = () => {
    updateStorefront.mutate({
      id: storefront.id,
      header_config: headerConfig,
      cart_config: cartConfig,
      checkout_config: checkoutConfig,
      payment_methods_display: paymentMethods,
    });
  };

  const togglePaymentMethod = (method: string) => {
    setPaymentMethods(prev => 
      prev.includes(method)
        ? prev.filter(m => m !== method)
        : [...prev, method]
    );
  };

  return (
    <div className="space-y-6">
      {/* Header Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Configurações do Header
          </CardTitle>
          <CardDescription>
            Personalize a barra de navegação da sua loja
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="showSearch">Exibir barra de busca</Label>
              <Switch
                id="showSearch"
                checked={headerConfig.showSearch}
                onCheckedChange={(checked) => setHeaderConfig(prev => ({ ...prev, showSearch: checked }))}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="showCart">Exibir ícone do carrinho</Label>
              <Switch
                id="showCart"
                checked={headerConfig.showCart}
                onCheckedChange={(checked) => setHeaderConfig(prev => ({ ...prev, showCart: checked }))}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="showCategories">Exibir categorias</Label>
              <Switch
                id="showCategories"
                checked={headerConfig.showCategories}
                onCheckedChange={(checked) => setHeaderConfig(prev => ({ ...prev, showCategories: checked }))}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="stickyHeader">Header fixo (sticky)</Label>
              <Switch
                id="stickyHeader"
                checked={headerConfig.stickyHeader}
                onCheckedChange={(checked) => setHeaderConfig(prev => ({ ...prev, stickyHeader: checked }))}
              />
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>Estilo do menu</Label>
            <Select
              value={headerConfig.menuStyle}
              onValueChange={(value: 'horizontal' | 'dropdown') => 
                setHeaderConfig(prev => ({ ...prev, menuStyle: value }))
              }
            >
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="horizontal">Horizontal</SelectItem>
                <SelectItem value="dropdown">Dropdown</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Cart Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Configurações do Carrinho
          </CardTitle>
          <CardDescription>
            Configure o comportamento do carrinho de compras
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="showCrosssell">Exibir cross-sell</Label>
              <p className="text-sm text-muted-foreground">
                Sugerir produtos complementares no carrinho
              </p>
            </div>
            <Switch
              id="showCrosssell"
              checked={cartConfig.showCrosssell}
              onCheckedChange={(checked) => setCartConfig(prev => ({ ...prev, showCrosssell: checked }))}
            />
          </div>

          <Separator />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="minOrderValue">Pedido mínimo (R$)</Label>
              <Input
                id="minOrderValue"
                type="number"
                min="0"
                step="0.01"
                value={cartConfig.minOrderValue / 100}
                onChange={(e) => setCartConfig(prev => ({ 
                  ...prev, 
                  minOrderValue: Math.round(parseFloat(e.target.value || '0') * 100)
                }))}
              />
              <p className="text-xs text-muted-foreground">
                0 = sem mínimo
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="freeShippingThreshold">Frete grátis a partir de (R$)</Label>
              <Input
                id="freeShippingThreshold"
                type="number"
                min="0"
                step="0.01"
                value={cartConfig.freeShippingThreshold / 100}
                onChange={(e) => setCartConfig(prev => ({ 
                  ...prev, 
                  freeShippingThreshold: Math.round(parseFloat(e.target.value || '0') * 100)
                }))}
              />
              <p className="text-xs text-muted-foreground">
                0 = desabilitado
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Checkout Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Configurações do Checkout
          </CardTitle>
          <CardDescription>
            Configure o fluxo de finalização de compra
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Estilo do checkout</Label>
            <Select
              value={checkoutConfig.style}
              onValueChange={(value: 'page' | 'modal') => 
                setCheckoutConfig(prev => ({ ...prev, style: value }))
              }
            >
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="page">Página separada</SelectItem>
                <SelectItem value="modal">Modal (popup)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="showOrderBump">Order Bump</Label>
                <p className="text-sm text-muted-foreground">
                  Ofertas adicionais no checkout
                </p>
              </div>
              <Switch
                id="showOrderBump"
                checked={checkoutConfig.showOrderBump}
                onCheckedChange={(checked) => setCheckoutConfig(prev => ({ ...prev, showOrderBump: checked }))}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="showKitUpsell">Upsell de Kits</Label>
                <p className="text-sm text-muted-foreground">
                  Sugerir kits maiores
                </p>
              </div>
              <Switch
                id="showKitUpsell"
                checked={checkoutConfig.showKitUpsell}
                onCheckedChange={(checked) => setCheckoutConfig(prev => ({ ...prev, showKitUpsell: checked }))}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="requirePhone">Telefone obrigatório</Label>
              <Switch
                id="requirePhone"
                checked={checkoutConfig.requirePhone}
                onCheckedChange={(checked) => setCheckoutConfig(prev => ({ ...prev, requirePhone: checked }))}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="requireCpf">CPF obrigatório</Label>
              <Switch
                id="requireCpf"
                checked={checkoutConfig.requireCpf}
                onCheckedChange={(checked) => setCheckoutConfig(prev => ({ ...prev, requireCpf: checked }))}
              />
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>Formas de pagamento exibidas</Label>
            <div className="flex flex-wrap gap-2">
              {[
                { value: 'pix', label: 'PIX' },
                { value: 'credit_card', label: 'Cartão de Crédito' },
                { value: 'boleto', label: 'Boleto' },
                { value: 'debit_card', label: 'Cartão de Débito' },
              ].map((method) => (
                <Button
                  key={method.value}
                  variant={paymentMethods.includes(method.value) ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => togglePaymentMethod(method.value)}
                >
                  {method.label}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button 
          onClick={handleSave} 
          disabled={updateStorefront.isPending}
          className="gap-2"
        >
          <Save className="h-4 w-4" />
          Salvar Configurações
        </Button>
      </div>
    </div>
  );
}
