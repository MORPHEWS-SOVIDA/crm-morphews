import { useState } from 'react';
import { useOutletContext, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, ShieldCheck, CreditCard, QrCode, FileText, Loader2, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { useCart } from './cart/CartContext';
import type { StorefrontData } from '@/hooks/ecommerce/usePublicStorefront';

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

export function StorefrontCheckout() {
  const navigate = useNavigate();
  const { storefront } = useOutletContext<{ storefront: StorefrontData }>();
  const { items, subtotal, clearCart } = useCart();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'credit_card' | 'boleto'>('pix');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    cpf: '',
    // Address
    cep: '',
    street: '',
    number: '',
    complement: '',
    neighborhood: '',
    city: '',
    state: '',
  });

  const shippingCents = 0; // TODO: Calculate shipping
  const total = subtotal + shippingCents;

  const checkoutConfig = storefront.checkout_config as {
    collectCpf?: boolean;
    collectAddress?: boolean;
    requirePhone?: boolean;
    termsUrl?: string;
  } || {};

  if (items.length === 0) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <Package className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
        <h1 className="text-2xl font-bold mb-2">Carrinho vazio</h1>
        <p className="text-muted-foreground mb-6">
          Adicione produtos ao carrinho para continuar.
        </p>
        <Button asChild>
          <Link to={`/loja/${storefront.slug}`}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Continuar Comprando
          </Link>
        </Button>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!acceptedTerms) return;
    
    setIsSubmitting(true);
    
    try {
      // TODO: Integrate with checkout edge function
      console.log('Checkout data:', {
        storefront_id: storefront.id,
        items,
        customer: formData,
        payment_method: paymentMethod,
        subtotal,
        shipping: shippingCents,
        total,
      });
      
      // Simulate success
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      clearCart();
      navigate(`/loja/${storefront.slug}/pedido-confirmado`);
    } catch (error) {
      console.error('Checkout error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCepBlur = async () => {
    if (formData.cep.length !== 8) return;
    
    try {
      const response = await fetch(`https://viacep.com.br/ws/${formData.cep}/json/`);
      const data = await response.json();
      
      if (!data.erro) {
        setFormData(prev => ({
          ...prev,
          street: data.logradouro || '',
          neighborhood: data.bairro || '',
          city: data.localidade || '',
          state: data.uf || '',
        }));
      }
    } catch (error) {
      console.error('CEP lookup error:', error);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Back link */}
      <Link 
        to={`/loja/${storefront.slug}/carrinho`}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar ao carrinho
      </Link>

      <h1 className="text-3xl font-bold mb-8">Finalizar Compra</h1>

      <form onSubmit={handleSubmit} className="grid gap-8 lg:grid-cols-3">
        {/* Customer & Shipping Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Customer Info */}
          <Card>
            <CardHeader>
              <CardTitle>Dados Pessoais</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome Completo *</Label>
                  <Input 
                    id="name"
                    required
                    value={formData.name}
                    onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail *</Label>
                  <Input 
                    id="email"
                    type="email"
                    required
                    value={formData.email}
                    onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="phone">
                    WhatsApp {checkoutConfig.requirePhone !== false && '*'}
                  </Label>
                  <Input 
                    id="phone"
                    type="tel"
                    required={checkoutConfig.requirePhone !== false}
                    placeholder="(00) 00000-0000"
                    value={formData.phone}
                    onChange={e => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  />
                </div>
                {checkoutConfig.collectCpf !== false && (
                  <div className="space-y-2">
                    <Label htmlFor="cpf">CPF *</Label>
                    <Input 
                      id="cpf"
                      required
                      placeholder="000.000.000-00"
                      value={formData.cpf}
                      onChange={e => setFormData(prev => ({ ...prev, cpf: e.target.value }))}
                    />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Address */}
          {checkoutConfig.collectAddress !== false && (
            <Card>
              <CardHeader>
                <CardTitle>Endereço de Entrega</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="cep">CEP *</Label>
                    <Input 
                      id="cep"
                      required
                      maxLength={8}
                      placeholder="00000000"
                      value={formData.cep}
                      onChange={e => setFormData(prev => ({ ...prev, cep: e.target.value.replace(/\D/g, '') }))}
                      onBlur={handleCepBlur}
                    />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="sm:col-span-2 space-y-2">
                    <Label htmlFor="street">Rua *</Label>
                    <Input 
                      id="street"
                      required
                      value={formData.street}
                      onChange={e => setFormData(prev => ({ ...prev, street: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="number">Número *</Label>
                    <Input 
                      id="number"
                      required
                      value={formData.number}
                      onChange={e => setFormData(prev => ({ ...prev, number: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="complement">Complemento</Label>
                    <Input 
                      id="complement"
                      placeholder="Apto, Bloco, etc."
                      value={formData.complement}
                      onChange={e => setFormData(prev => ({ ...prev, complement: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="neighborhood">Bairro *</Label>
                    <Input 
                      id="neighborhood"
                      required
                      value={formData.neighborhood}
                      onChange={e => setFormData(prev => ({ ...prev, neighborhood: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="city">Cidade *</Label>
                    <Input 
                      id="city"
                      required
                      value={formData.city}
                      onChange={e => setFormData(prev => ({ ...prev, city: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="state">Estado *</Label>
                    <Input 
                      id="state"
                      required
                      maxLength={2}
                      placeholder="UF"
                      value={formData.state}
                      onChange={e => setFormData(prev => ({ ...prev, state: e.target.value.toUpperCase() }))}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Payment Method */}
          <Card>
            <CardHeader>
              <CardTitle>Forma de Pagamento</CardTitle>
            </CardHeader>
            <CardContent>
              <RadioGroup 
                value={paymentMethod} 
                onValueChange={(v) => setPaymentMethod(v as any)}
                className="space-y-3"
              >
                <div className="flex items-center space-x-3 p-4 border rounded-lg cursor-pointer hover:bg-muted/50">
                  <RadioGroupItem value="pix" id="pix" />
                  <Label htmlFor="pix" className="flex items-center gap-3 cursor-pointer flex-1">
                    <QrCode className="h-5 w-5 text-green-600" />
                    <div>
                      <span className="font-medium">PIX</span>
                      <p className="text-sm text-muted-foreground">Aprovação imediata</p>
                    </div>
                  </Label>
                </div>
                <div className="flex items-center space-x-3 p-4 border rounded-lg cursor-pointer hover:bg-muted/50">
                  <RadioGroupItem value="credit_card" id="credit_card" />
                  <Label htmlFor="credit_card" className="flex items-center gap-3 cursor-pointer flex-1">
                    <CreditCard className="h-5 w-5 text-blue-600" />
                    <div>
                      <span className="font-medium">Cartão de Crédito</span>
                      <p className="text-sm text-muted-foreground">Parcele em até 12x</p>
                    </div>
                  </Label>
                </div>
                <div className="flex items-center space-x-3 p-4 border rounded-lg cursor-pointer hover:bg-muted/50">
                  <RadioGroupItem value="boleto" id="boleto" />
                  <Label htmlFor="boleto" className="flex items-center gap-3 cursor-pointer flex-1">
                    <FileText className="h-5 w-5 text-orange-600" />
                    <div>
                      <span className="font-medium">Boleto Bancário</span>
                      <p className="text-sm text-muted-foreground">Vencimento em 3 dias</p>
                    </div>
                  </Label>
                </div>
              </RadioGroup>
            </CardContent>
          </Card>
        </div>

        {/* Order Summary */}
        <div className="lg:col-span-1">
          <Card className="sticky top-24">
            <CardHeader>
              <CardTitle>Resumo do Pedido</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Items */}
              <div className="space-y-3">
                {items.map(item => (
                  <div key={`${item.productId}-${item.kitSize}`} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      {item.quantity}x {item.name} ({item.kitSize} un)
                    </span>
                    <span>{formatCurrency(item.totalPrice)}</span>
                  </div>
                ))}
              </div>

              <hr />

              {/* Totals */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Frete</span>
                  <span>{shippingCents > 0 ? formatCurrency(shippingCents) : 'Grátis'}</span>
                </div>
                <div className="flex justify-between font-bold text-lg pt-2 border-t">
                  <span>Total</span>
                  <span style={{ color: storefront.primary_color }}>{formatCurrency(total)}</span>
                </div>
              </div>

              {/* Terms */}
              <div className="flex items-start gap-2 pt-4">
                <Checkbox 
                  id="terms" 
                  checked={acceptedTerms}
                  onCheckedChange={(checked) => setAcceptedTerms(checked === true)}
                />
                <Label htmlFor="terms" className="text-xs text-muted-foreground leading-tight cursor-pointer">
                  Li e aceito os{' '}
                  <Link 
                    to={checkoutConfig.termsUrl || `/loja/${storefront.slug}/pagina/termos`}
                    className="underline"
                    target="_blank"
                  >
                    termos de uso
                  </Link>
                  {' '}e{' '}
                  <Link 
                    to={`/loja/${storefront.slug}/pagina/privacidade`}
                    className="underline"
                    target="_blank"
                  >
                    política de privacidade
                  </Link>
                </Label>
              </div>

              {/* Submit */}
              <Button 
                type="submit"
                size="lg"
                className="w-full"
                disabled={isSubmitting || !acceptedTerms}
                style={{ backgroundColor: storefront.primary_color }}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="h-4 w-4 mr-2" />
                    Finalizar Pedido
                  </>
                )}
              </Button>

              {/* Security */}
              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground pt-2">
                <ShieldCheck className="h-4 w-4" />
                Compra 100% Segura
              </div>
            </CardContent>
          </Card>
        </div>
      </form>
    </div>
  );
}
