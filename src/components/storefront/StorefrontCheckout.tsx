import { useState, useCallback, useEffect, useMemo } from 'react';
import { useOutletContext, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, ShieldCheck, CreditCard, QrCode, FileText, Loader2, Package, Save, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { useCart } from './cart/CartContext';
import { SavedCardsSelector } from './checkout/SavedCardsSelector';
import { ShippingSelector } from './checkout/ShippingSelector';
import { CreditCardForm, type CreditCardData, type InstallmentConfig } from './checkout/CreditCardForm';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useUtmTracker } from '@/hooks/useUtmTracker';
import { useQuery } from '@tanstack/react-query';
import { useUniversalTracking } from '@/hooks/ecommerce/useUniversalTracking';
import type { StorefrontData } from '@/hooks/ecommerce/usePublicStorefront';

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

// Saved cards - will be fetched from saved_payment_methods once lead is identified
// For now, empty array until we implement real lookup
const SAVED_CARDS: { id: string; card_brand: string; card_last_digits: string; is_default: boolean; gateway_type: string }[] = [];

export function StorefrontCheckout() {
  const navigate = useNavigate();
  const { storefront } = useOutletContext<{ storefront: StorefrontData }>();
  const { items, subtotal, clearCart, cartId, updateCustomerData, updateShippingData } = useCart();
  const { getUtmForCheckout } = useUtmTracker();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'credit_card' | 'boleto'>('credit_card');
  const [acceptedTerms, setAcceptedTerms] = useState(true); // Pre-accepted for smoother checkout
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [saveCard, setSaveCard] = useState(false);
  const [cardData, setCardData] = useState<CreditCardData | null>(null);
  const [totalWithInterest, setTotalWithInterest] = useState<number | null>(null);
  const [selectedInstallments, setSelectedInstallments] = useState<number>(12); // Default to 12x
  const [selectedShipping, setSelectedShipping] = useState<{
    service_code: string;
    service_name: string;
    price_cents: number;
    delivery_days: number;
  } | null>(null);
  
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

  // Universal tracking for server-side CAPI
  const trackingConfig = useMemo(() => ({
    organizationId: storefront.organization_id,
    facebookPixelId: null, // Storefront uses org-level tracking config
    googleAnalyticsId: null,
    tiktokPixelId: null,
    source: 'storefront' as const,
    sourceId: storefront.id,
    sourceName: storefront.name,
  }), [storefront]);

  const { 
    trackInitiateCheckout, 
    trackAddPaymentInfo,
    trackingParams,
  } = useUniversalTracking(trackingConfig);

  // Fetch tenant payment fees for installment interest
  const { data: paymentFees } = useQuery({
    queryKey: ['tenant-payment-fees', storefront.organization_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenant_payment_fees')
        .select('installment_fees, installment_fee_passed_to_buyer, max_installments')
        .eq('organization_id', storefront.organization_id)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!storefront.organization_id,
  });

  // Build installment config for CreditCardForm
  const installmentConfig: InstallmentConfig = {
    installment_fees: paymentFees?.installment_fees as Record<string, number> || undefined,
    installment_fee_passed_to_buyer: paymentFees?.installment_fee_passed_to_buyer ?? true,
    max_installments: paymentFees?.max_installments || 12,
  };

  // Handle total with interest change from card form
  const handleTotalWithInterestChange = useCallback((newTotal: number, installments: number) => {
    setTotalWithInterest(installments > 1 ? newTotal : null);
    setSelectedInstallments(installments);
  }, []);

  // Cart config for free shipping threshold
  const cartConfig = storefront.cart_config as { 
    freeShippingThreshold?: number;
    minOrderValue?: number;
  } || {};
  const freeShippingThreshold = cartConfig.freeShippingThreshold || 0;
  const hasFreeShipping = freeShippingThreshold > 0 && subtotal >= freeShippingThreshold;
  
  // Apply free shipping if subtotal meets threshold
  const shippingCents = hasFreeShipping ? 0 : (selectedShipping?.price_cents || 0);
  const total = subtotal + shippingCents;
  
  // Total to charge (with interest if credit card with >1 installment)
  const totalToCharge = paymentMethod === 'credit_card' && totalWithInterest 
    ? totalWithInterest 
    : total;

  // Progressive capture - sync customer data on blur
  const handleCustomerFieldBlur = useCallback((field: 'name' | 'email' | 'phone' | 'cpf') => {
    if (formData[field]) {
      updateCustomerData({ [field]: formData[field] });
    }
  }, [formData, updateCustomerData]);

  // Progressive capture - sync shipping data on blur
  const handleShippingFieldBlur = useCallback((field: keyof typeof formData) => {
    const shippingFields = ['cep', 'street', 'number', 'complement', 'neighborhood', 'city', 'state'];
    if (shippingFields.includes(field) && formData[field]) {
      updateShippingData({ [field]: formData[field] });
    }
  }, [formData, updateShippingData]);

  const handleShippingSelect = useCallback((option: typeof selectedShipping) => {
    setSelectedShipping(option);
  }, []);

  const checkoutConfig = storefront.checkout_config as {
    collectCpf?: boolean;
    collectAddress?: boolean;
    requirePhone?: boolean;
    termsUrl?: string;
    allowSaveCard?: boolean;
  } || {};


  // Show saved cards only for credit card payment (when cards exist)
  const showSavedCards = paymentMethod === 'credit_card' && SAVED_CARDS.length > 0;
  const isOneClickCheckout = selectedCardId !== null && paymentMethod === 'credit_card';

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
    
    // Validate credit card data when credit_card is selected and no saved card
    if (paymentMethod === 'credit_card' && !isOneClickCheckout && !cardData) {
      toast.error('Preencha os dados do cartão de crédito');
      return;
    }

    // Validate shipping address when address collection is required
    if (checkoutConfig.collectAddress !== false) {
      if (!formData.cep || !formData.street || !formData.city || !formData.state) {
        toast.error('Preencha o endereço de entrega completo');
        return;
      }
    }
    
    setIsSubmitting(true);
    
    try {
      // Get UTM data for attribution
      const utmData = getUtmForCheckout();

      // Server-side tracking - InitiateCheckout
      trackInitiateCheckout(
        {
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          document: formData.cpf,
        },
        totalToCharge,
        { contentName: `${storefront.name} - Checkout` }
      );
      
      const checkoutPayload = {
        storefront_id: storefront.id,
        cart_id: cartId || undefined,
        items: items.map(item => ({
          product_id: item.productId,
          quantity: item.quantity * item.kitSize,
          price_cents: item.unitPrice,
        })),
        customer: {
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          document: formData.cpf,
        },
        // IMPORTANT: backend needs shipping cost to charge correct total (PIX/BOLETO/CARD)
        shipping_cost_cents: shippingCents,
        shipping: checkoutConfig.collectAddress !== false ? {
          address: formData.street,
          city: formData.city,
          state: formData.state,
          zip: formData.cep,
          complement: formData.complement,
        } : undefined,
        payment_method: paymentMethod,
        card_token: isOneClickCheckout ? selectedCardId : undefined,
        card_data: paymentMethod === 'credit_card' && !isOneClickCheckout ? cardData : undefined,
        save_card: !isOneClickCheckout && saveCard,
        // Send total with interest for credit card payments
        // Use totalWithInterest state which tracks the full total including interest
        // This ensures we always send the correct total even if cardData hasn't updated yet
        total_with_interest_cents: paymentMethod === 'credit_card' && totalWithInterest 
          ? totalWithInterest 
          : undefined,
        // Attribution data
        utm: utmData,
        // Tracking IDs for CAPI
        fbclid: trackingParams.fbclid,
        gclid: trackingParams.gclid,
        ttclid: trackingParams.ttclid,
      };

      console.log('Sending checkout:', checkoutPayload);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ecommerce-checkout`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify(checkoutPayload),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Erro ao processar pagamento');
      }

      // Handle different payment methods
      if (paymentMethod === 'pix' && result.pix_code) {
        // Redirect to PIX payment page with QR code
        clearCart();
        navigate(`/loja/${storefront.slug}/pix-pagamento`, {
          state: { 
            saleId: result.sale_id, 
            pix_code: result.pix_code,
            pix_expiration: result.pix_expiration,
            // Prefer backend total to avoid any mismatch (e.g., shipping)
            total_cents: typeof result.total_cents === 'number' ? result.total_cents : total,
            paymentMethod 
          },
        });
        return;
      } else if (paymentMethod === 'boleto' && result.payment_url) {
        // Open boleto URL and go to confirmation
        window.open(result.payment_url, '_blank');
        clearCart();
        navigate(`/loja/${storefront.slug}/pedido-confirmado`, {
          state: { saleId: result.sale_id, paymentMethod, ...result },
        });
        return;
      } else if (paymentMethod === 'credit_card') {
        // Credit card - go to confirmation (payment already processed)
        clearCart();
        navigate(`/loja/${storefront.slug}/pedido-confirmado`, {
          state: { saleId: result.sale_id, paymentMethod, ...result },
        });
        return;
      }

      // Fallback
      clearCart();
      navigate(`/loja/${storefront.slug}/pedido-confirmado`, {
        state: { saleId: result.sale_id, paymentMethod, ...result },
      });
    } catch (error) {
      console.error('Checkout error:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao processar pagamento');
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
                    onBlur={() => handleCustomerFieldBlur('name')}
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
                    onBlur={() => handleCustomerFieldBlur('email')}
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
                    onBlur={() => handleCustomerFieldBlur('phone')}
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
                      onBlur={() => handleCustomerFieldBlur('cpf')}
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

          {/* Shipping Options */}
          {checkoutConfig.collectAddress !== false && formData.cep.length === 8 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Truck className="h-5 w-5" />
                  Opções de Entrega
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ShippingSelector
                  cep={formData.cep}
                  organizationId={storefront.organization_id}
                  onSelect={handleShippingSelect}
                  primaryColor={storefront.primary_color}
                />
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader>
              <CardTitle>Forma de Pagamento</CardTitle>
            </CardHeader>
            <CardContent>
              <RadioGroup 
                value={paymentMethod} 
                onValueChange={(v) => {
                  setPaymentMethod(v as any);
                  if (v !== 'credit_card') {
                    setSelectedCardId(null);
                    setSaveCard(false);
                  } else {
                    setSelectedCardId(SAVED_CARDS[0]?.id || null);
                  }
                }}
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

              {/* Saved Cards */}
              {showSavedCards && (
                <SavedCardsSelector
                  cards={SAVED_CARDS}
                  selectedCardId={selectedCardId}
                  onSelectCard={setSelectedCardId}
                  primaryColor={storefront.primary_color}
                />
              )}

              {/* Credit Card Form - Show when credit_card selected and no saved card */}
              {paymentMethod === 'credit_card' && selectedCardId === null && (
                <CreditCardForm
                  onCardDataChange={setCardData}
                  totalCents={total}
                  installmentConfig={installmentConfig}
                  onTotalWithInterestChange={handleTotalWithInterestChange}
                />
              )}

              {/* Save Card Option */}
              {paymentMethod === 'credit_card' && selectedCardId === null && checkoutConfig.allowSaveCard !== false && (
                <div className="flex items-center gap-2 mt-4 pt-4 border-t">
                  <Checkbox
                    id="save-card"
                    checked={saveCard}
                    onCheckedChange={(checked) => setSaveCard(checked === true)}
                  />
                  <Label htmlFor="save-card" className="text-sm cursor-pointer flex items-center gap-2">
                    <Save className="h-4 w-4" />
                    Salvar cartão para compras futuras
                  </Label>
                </div>
              )}
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

              {/* Totals - Show installments only when credit card selected for cleaner UX */}
              <div className="space-y-2">
                {paymentMethod === 'credit_card' ? (
                  <div className="flex justify-between font-bold text-lg">
                    <span>{selectedInstallments}x de</span>
                    <span style={{ color: storefront.primary_color }}>
                      {formatCurrency(Math.round((totalWithInterest || total) / selectedInstallments))}
                    </span>
                  </div>
                ) : (
                  <div className="flex justify-between font-bold text-lg">
                    <span>Total</span>
                    <span style={{ color: storefront.primary_color }}>
                      {formatCurrency(total)}
                    </span>
                  </div>
                )}
              </div>

              {/* One-Click Badge */}
              {isOneClickCheckout && (
                <div 
                  className="flex items-center gap-2 p-3 rounded-lg text-sm"
                  style={{ backgroundColor: `${storefront.primary_color}15`, color: storefront.primary_color }}
                >
                  <CreditCard className="h-4 w-4" />
                  <span className="font-medium">Compra com 1-Clique ativada</span>
                </div>
              )}

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
                ) : isOneClickCheckout ? (
                  <>
                    <CreditCard className="h-4 w-4 mr-2" />
                    Pagar com 1-Clique
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
