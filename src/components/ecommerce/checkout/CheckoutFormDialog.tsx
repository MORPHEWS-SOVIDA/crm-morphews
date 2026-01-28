import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2, Truck, Package, Ban } from 'lucide-react';
import { useProducts } from '@/hooks/useProducts';
import {
  useCreateStandaloneCheckout,
  useUpdateStandaloneCheckout,
  type StandaloneCheckout,
  type CreateCheckoutInput,
} from '@/hooks/ecommerce/useStandaloneCheckouts';

interface CheckoutFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  checkout?: StandaloneCheckout | null;
}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

const CHECKOUT_TYPES = [
  { value: 'one_step', label: '1 Etapa (Tudo na mesma tela)', description: 'Dados e pagamento juntos' },
  { value: 'two_step', label: '2 Etapas (Lead → Pagamento)', description: 'Primeiro captura dados, depois pagamento' },
  { value: 'three_step', label: '3 Etapas (Dados → Frete → Pagamento)', description: 'Fluxo completo com cálculo de frete' },
];

const PAYMENT_METHODS = [
  { id: 'pix', label: 'PIX' },
  { id: 'credit_card', label: 'Cartão de Crédito' },
  { id: 'boleto', label: 'Boleto' },
];

export function CheckoutFormDialog({ open, onOpenChange, checkout }: CheckoutFormDialogProps) {
  const { data: products, isLoading: loadingProducts } = useProducts();
  const createCheckout = useCreateStandaloneCheckout();
  const updateCheckout = useUpdateStandaloneCheckout();

  const isEditing = !!checkout;

  const [formData, setFormData] = useState<CreateCheckoutInput>({
    name: '',
    slug: '',
    product_id: '',
    checkout_type: 'one_step',
    payment_methods: ['pix', 'credit_card'],
    pix_discount_percent: 0,
    order_bump_enabled: false,
    order_bump_product_id: undefined,
    order_bump_discount_percent: 10,
    order_bump_headline: 'Aproveite essa oferta exclusiva!',
    order_bump_description: '',
    meta_title: '',
    meta_description: '',
    facebook_pixel_id: '',
    google_analytics_id: '',
    tiktok_pixel_id: '',
    // Custom pricing
    custom_price_cents: null,
    quantity: 1,
    custom_product_name: '',
    // Shipping
    shipping_mode: 'none',
  });

  useEffect(() => {
    if (checkout) {
      setFormData({
        name: checkout.name,
        slug: checkout.slug,
        product_id: checkout.product_id,
        checkout_type: checkout.checkout_type,
        payment_methods: checkout.payment_methods,
        pix_discount_percent: checkout.pix_discount_percent,
        order_bump_enabled: checkout.order_bump_enabled,
        order_bump_product_id: checkout.order_bump_product_id || undefined,
        order_bump_discount_percent: checkout.order_bump_discount_percent,
        order_bump_headline: checkout.order_bump_headline,
        order_bump_description: checkout.order_bump_description || '',
        meta_title: checkout.meta_title || '',
        meta_description: checkout.meta_description || '',
        facebook_pixel_id: checkout.facebook_pixel_id || '',
        google_analytics_id: checkout.google_analytics_id || '',
        tiktok_pixel_id: checkout.tiktok_pixel_id || '',
        // Custom pricing
        custom_price_cents: checkout.custom_price_cents,
        quantity: checkout.quantity || 1,
        custom_product_name: checkout.custom_product_name || '',
        // Shipping
        shipping_mode: checkout.shipping_mode || 'none',
      });
    } else {
      setFormData({
        name: '',
        slug: '',
        product_id: '',
        checkout_type: 'one_step',
        payment_methods: ['pix', 'credit_card'],
        pix_discount_percent: 0,
        order_bump_enabled: false,
        order_bump_product_id: undefined,
        order_bump_discount_percent: 10,
        order_bump_headline: 'Aproveite essa oferta exclusiva!',
        order_bump_description: '',
        meta_title: '',
        meta_description: '',
        facebook_pixel_id: '',
        google_analytics_id: '',
        tiktok_pixel_id: '',
        // Custom pricing
        custom_price_cents: null,
        quantity: 1,
        custom_product_name: '',
        // Shipping
        shipping_mode: 'none',
      });
    }
  }, [checkout, open]);

  const handleNameChange = (name: string) => {
    setFormData(prev => ({
      ...prev,
      name,
      slug: isEditing ? prev.slug : generateSlug(name),
    }));
  };

  const togglePaymentMethod = (methodId: string) => {
    setFormData(prev => {
      const methods = prev.payment_methods || [];
      if (methods.includes(methodId)) {
        if (methods.length > 1) {
          return { ...prev, payment_methods: methods.filter(m => m !== methodId) };
        }
        return prev; // Keep at least one method
      }
      return { ...prev, payment_methods: [...methods, methodId] };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.slug || !formData.product_id) {
      return;
    }

    try {
      if (isEditing && checkout) {
        await updateCheckout.mutateAsync({ id: checkout.id, ...formData });
      } else {
        await createCheckout.mutateAsync(formData);
      }
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving checkout:', error);
    }
  };

  const isSubmitting = createCheckout.isPending || updateCheckout.isPending;

  // Filter products for order bump (exclude main product)
  const orderBumpProducts = products?.filter(p => p.id !== formData.product_id) || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Editar Checkout' : 'Novo Checkout'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="basic">Básico</TabsTrigger>
              <TabsTrigger value="payment">Pagamento</TabsTrigger>
              <TabsTrigger value="orderbump">Order Bump</TabsTrigger>
              <TabsTrigger value="tracking">Tracking</TabsTrigger>
            </TabsList>

            {/* Basic Tab */}
            <TabsContent value="basic" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome do Checkout *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder="Ex: Checkout Produto X"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="slug">Slug (URL) *</Label>
                  <div className="flex items-center gap-1">
                    <span className="text-sm text-muted-foreground">/pay/</span>
                    <Input
                      id="slug"
                      value={formData.slug}
                      onChange={(e) => setFormData(prev => ({ ...prev, slug: generateSlug(e.target.value) }))}
                      placeholder="meu-produto"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Produto *</Label>
                {loadingProducts ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Carregando produtos...
                  </div>
                ) : (
                  <Select
                    value={formData.product_id}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, product_id: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o produto" />
                    </SelectTrigger>
                    <SelectContent>
                      {products?.map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Custom Pricing Section */}
              {formData.product_id && (
                <div className="space-y-4 pt-4 border-t border-border/50">
                  <div className="flex items-center gap-2">
                    <Label className="text-sm font-medium">Preço Personalizado</Label>
                    <span className="text-xs text-muted-foreground">
                      (deixe vazio para usar o preço do produto)
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="custom_price">Preço (R$)</Label>
                      <Input
                        id="custom_price"
                        type="number"
                        min="0"
                        step="0.01"
                        value={formData.custom_price_cents ? (formData.custom_price_cents / 100).toFixed(2) : ''}
                        onChange={(e) => {
                          const value = e.target.value;
                          setFormData(prev => ({
                            ...prev,
                            custom_price_cents: value ? Math.round(parseFloat(value) * 100) : null,
                          }));
                        }}
                        placeholder="Ex: 197,00"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="quantity">Quantidade</Label>
                      <Input
                        id="quantity"
                        type="number"
                        min="1"
                        max="10"
                        value={formData.quantity || 1}
                        onChange={(e) => setFormData(prev => ({ 
                          ...prev, 
                          quantity: parseInt(e.target.value) || 1 
                        }))}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="custom_name">Nome no Checkout</Label>
                      <Input
                        id="custom_name"
                        value={formData.custom_product_name || ''}
                        onChange={(e) => setFormData(prev => ({ 
                          ...prev, 
                          custom_product_name: e.target.value 
                        }))}
                        placeholder="Ex: Kit 3 Potes"
                      />
                    </div>
                  </div>
                  
                  {formData.custom_price_cents && (
                    <p className="text-xs text-green-600 dark:text-green-400">
                      ✓ Este checkout usará o preço de R$ {(formData.custom_price_cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <Label>Tipo de Checkout</Label>
                <Select
                  value={formData.checkout_type}
                  onValueChange={(value: 'one_step' | 'two_step' | 'three_step') => 
                    setFormData(prev => ({ ...prev, checkout_type: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CHECKOUT_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        <div>
                          <div className="font-medium">{type.label}</div>
                          <div className="text-xs text-muted-foreground">{type.description}</div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>

            {/* Payment Tab */}
            <TabsContent value="payment" className="space-y-6 mt-4">
              <div className="space-y-3">
                <Label>Métodos de Pagamento</Label>
                <div className="space-y-2">
                  {PAYMENT_METHODS.map((method) => (
                    <div key={method.id} className="flex items-center gap-2">
                      <Checkbox
                        id={method.id}
                        checked={formData.payment_methods?.includes(method.id)}
                        onCheckedChange={() => togglePaymentMethod(method.id)}
                      />
                      <Label htmlFor={method.id} className="cursor-pointer">
                        {method.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="pix_discount">Desconto no PIX (%)</Label>
                <Input
                  id="pix_discount"
                  type="number"
                  min="0"
                  max="30"
                  step="0.5"
                  value={formData.pix_discount_percent}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    pix_discount_percent: parseFloat(e.target.value) || 0 
                  }))}
                />
                <p className="text-xs text-muted-foreground">
                  Incentive pagamentos à vista com desconto no PIX
                </p>
              </div>

              {/* Shipping Configuration */}
              <div className="space-y-3 pt-4 border-t border-border/50">
                <Label className="text-base font-medium">Configuração de Frete</Label>
                <p className="text-xs text-muted-foreground">
                  ⚠️ Parceiros (Indústria, Fábrica, Co-produtor, Afiliado) <strong>não recebem comissão</strong> sobre o valor do frete.
                </p>
                
                <RadioGroup
                  value={formData.shipping_mode || 'none'}
                  onValueChange={(value: 'none' | 'free' | 'calculated') => 
                    setFormData(prev => ({ ...prev, shipping_mode: value }))
                  }
                  className="space-y-3"
                >
                  <div className="flex items-start gap-3 p-3 border rounded-lg hover:bg-accent/50 transition-colors">
                    <RadioGroupItem value="none" id="shipping_none" className="mt-1" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Ban className="h-4 w-4 text-muted-foreground" />
                        <Label htmlFor="shipping_none" className="font-medium cursor-pointer">
                          Sem Frete
                        </Label>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Produto digital ou retirada no local
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3 p-3 border rounded-lg hover:bg-accent/50 transition-colors">
                    <RadioGroupItem value="free" id="shipping_free" className="mt-1" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-green-600" />
                        <Label htmlFor="shipping_free" className="font-medium cursor-pointer">
                          Frete Grátis
                        </Label>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Você assume o custo do frete
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3 p-3 border rounded-lg hover:bg-accent/50 transition-colors">
                    <RadioGroupItem value="calculated" id="shipping_calculated" className="mt-1" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Truck className="h-4 w-4 text-primary" />
                        <Label htmlFor="shipping_calculated" className="font-medium cursor-pointer">
                          Calcular Frete (Correios)
                        </Label>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        PAC e SEDEX calculados automaticamente (+R$ 7,00 picking e +2 dias postagem)
                      </p>
                    </div>
                  </div>
                </RadioGroup>
              </div>
            </TabsContent>

            {/* Order Bump Tab */}
            <TabsContent value="orderbump" className="space-y-4 mt-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Ativar Order Bump</Label>
                  <p className="text-xs text-muted-foreground">
                    Ofereça um produto adicional com desconto exclusivo
                  </p>
                </div>
                <Switch
                  checked={formData.order_bump_enabled}
                  onCheckedChange={(checked) => setFormData(prev => ({ 
                    ...prev, 
                    order_bump_enabled: checked 
                  }))}
                />
              </div>

              {formData.order_bump_enabled && (
                <>
                  <div className="space-y-2">
                    <Label>Produto do Order Bump</Label>
                    <Select
                      value={formData.order_bump_product_id || ''}
                      onValueChange={(value) => setFormData(prev => ({ 
                        ...prev, 
                        order_bump_product_id: value || undefined 
                      }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o produto" />
                      </SelectTrigger>
                      <SelectContent>
                        {orderBumpProducts.map((product) => (
                          <SelectItem key={product.id} value={product.id}>
                            {product.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="bump_discount">Desconto (%)</Label>
                    <Input
                      id="bump_discount"
                      type="number"
                      min="0"
                      max="50"
                      value={formData.order_bump_discount_percent}
                      onChange={(e) => setFormData(prev => ({ 
                        ...prev, 
                        order_bump_discount_percent: parseFloat(e.target.value) || 0 
                      }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="bump_headline">Título da Oferta</Label>
                    <Input
                      id="bump_headline"
                      value={formData.order_bump_headline}
                      onChange={(e) => setFormData(prev => ({ 
                        ...prev, 
                        order_bump_headline: e.target.value 
                      }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="bump_description">Descrição (opcional)</Label>
                    <Textarea
                      id="bump_description"
                      value={formData.order_bump_description}
                      onChange={(e) => setFormData(prev => ({ 
                        ...prev, 
                        order_bump_description: e.target.value 
                      }))}
                      rows={2}
                    />
                  </div>
                </>
              )}
            </TabsContent>

            {/* Tracking Tab */}
            <TabsContent value="tracking" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="meta_title">Meta Title (SEO)</Label>
                <Input
                  id="meta_title"
                  value={formData.meta_title}
                  onChange={(e) => setFormData(prev => ({ ...prev, meta_title: e.target.value }))}
                  placeholder="Título para mecanismos de busca"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="meta_description">Meta Description (SEO)</Label>
                <Textarea
                  id="meta_description"
                  value={formData.meta_description}
                  onChange={(e) => setFormData(prev => ({ ...prev, meta_description: e.target.value }))}
                  rows={2}
                  placeholder="Descrição para mecanismos de busca"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fb_pixel">Facebook Pixel ID</Label>
                  <Input
                    id="fb_pixel"
                    value={formData.facebook_pixel_id}
                    onChange={(e) => setFormData(prev => ({ ...prev, facebook_pixel_id: e.target.value }))}
                    placeholder="000000000000"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ga_id">Google Analytics ID</Label>
                  <Input
                    id="ga_id"
                    value={formData.google_analytics_id}
                    onChange={(e) => setFormData(prev => ({ ...prev, google_analytics_id: e.target.value }))}
                    placeholder="G-XXXXXXXXXX"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tiktok_pixel">TikTok Pixel ID</Label>
                  <Input
                    id="tiktok_pixel"
                    value={formData.tiktok_pixel_id}
                    onChange={(e) => setFormData(prev => ({ ...prev, tiktok_pixel_id: e.target.value }))}
                    placeholder="XXXXXXXXX"
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isEditing ? 'Salvar' : 'Criar Checkout'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
