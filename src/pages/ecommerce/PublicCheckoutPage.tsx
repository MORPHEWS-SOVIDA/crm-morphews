import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Loader2, 
  Shield, 
  Lock, 
  CreditCard, 
  QrCode, 
  FileText,
  Clock,
  Star,
  CheckCircle,
  AlertCircle,
  Headphones,
} from 'lucide-react';
import { toast } from 'sonner';
import { usePublicCheckout, useCheckoutTestimonials, type CheckoutElements, type CheckoutTheme } from '@/hooks/ecommerce/useStandaloneCheckouts';
import { CreditCardForm, type CreditCardData } from '@/components/storefront/checkout/CreditCardForm';
import { supabase } from '@/integrations/supabase/client';
import { useUniversalTracking, extractTrackingParams } from '@/hooks/ecommerce/useUniversalTracking';

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

type PaymentMethod = 'pix' | 'credit_card' | 'boleto';

export default function PublicCheckoutPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: checkout, isLoading, error } = usePublicCheckout(slug);
  const { data: testimonials } = useCheckoutTestimonials(checkout?.id);

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pix');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [addOrderBump, setAddOrderBump] = useState(false);
  const [cardData, setCardData] = useState<CreditCardData | null>(null);
  const [totalWithInterest, setTotalWithInterest] = useState<number | null>(null);
  const [countdownTime, setCountdownTime] = useState<number | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    cpf: '',
    // Shipping address
    cep: '',
    street: '',
    number: '',
    complement: '',
    neighborhood: '',
    city: '',
    state: '',
  });
  const [isLoadingCep, setIsLoadingCep] = useState(false);

  // Universal tracking for server-side CAPI
  const trackingConfig = useMemo(() => ({
    organizationId: checkout?.organization_id || '',
    facebookPixelId: checkout?.facebook_pixel_id,
    googleAnalyticsId: checkout?.google_analytics_id,
    tiktokPixelId: checkout?.tiktok_pixel_id,
    source: 'standalone_checkout' as const,
    sourceId: checkout?.id,
    sourceName: checkout?.name,
  }), [checkout]);

  const { 
    trackViewContent,
    trackInitiateCheckout, 
    trackAddPaymentInfo,
    trackingParams,
  } = useUniversalTracking(trackingConfig);

  // Track ViewContent when checkout loads
  useEffect(() => {
    if (checkout) {
      trackViewContent(checkout.name, checkout.product?.price_1_unit || checkout.product?.base_price_cents);
    }
  }, [checkout, trackViewContent]);

  // Initialize countdown from elements
  useEffect(() => {
    if (checkout?.elements?.countdown?.enabled) {
      setCountdownTime(checkout.elements.countdown.duration_minutes * 60);
    }
  }, [checkout]);

  // Countdown timer
  useEffect(() => {
    if (countdownTime === null || countdownTime <= 0) return;
    
    const timer = setInterval(() => {
      setCountdownTime(prev => {
        if (prev === null || prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [countdownTime]);

  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Calculate prices - use custom price if set, otherwise fallback to product price
  const productPrice = checkout?.custom_price_cents ?? checkout?.product?.price_1_unit ?? checkout?.product?.base_price_cents ?? 0;
  const productQuantity = checkout?.quantity ?? 1;
  const displayProductName = checkout?.custom_product_name || checkout?.product?.name || 'Produto';
  const pixDiscount = checkout?.pix_discount_percent || 0;
  
  const orderBumpPrice = useMemo(() => {
    if (!checkout?.order_bump_enabled || !checkout?.order_bump_product) return 0;
    const originalPrice = checkout.order_bump_product.price_1_unit || checkout.order_bump_product.base_price_cents;
    const discount = checkout.order_bump_discount_percent || 0;
    return Math.round(originalPrice * (1 - discount / 100));
  }, [checkout]);

  const subtotal = productPrice + (addOrderBump ? orderBumpPrice : 0);
  const pixTotal = Math.round(subtotal * (1 - pixDiscount / 100));
  
  const total = paymentMethod === 'pix' ? pixTotal : subtotal;
  const totalToCharge = paymentMethod === 'credit_card' && totalWithInterest ? totalWithInterest : total;

  // Theme styles
  const theme: CheckoutTheme = checkout?.theme || {
    primary_color: '#8b5cf6',
    background_color: '#ffffff',
    text_color: '#1f2937',
    font_family: 'Inter',
    border_radius: '8px',
    button_style: 'solid',
  };

  const elements: CheckoutElements = checkout?.elements || {
    countdown: { enabled: false, duration_minutes: 15, text: '', end_action: 'hide' },
    top_banner: { enabled: false, text: '', background_color: '#10b981', text_color: '#ffffff' },
    testimonials: { enabled: false, items: [] },
    guarantee: { enabled: false, days: 7, text: '' },
    trust_badges: { enabled: true, show_secure_payment: true, show_money_back: true, show_support: true },
  };

  const handleTotalWithInterestChange = (newTotal: number, installments: number) => {
    setTotalWithInterest(installments > 1 ? newTotal : null);
  };

  // CEP lookup via ViaCEP API
  const handleCepBlur = async () => {
    const cleanCep = formData.cep.replace(/\D/g, '');
    if (cleanCep.length !== 8) return;
    
    setIsLoadingCep(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data = await response.json();
      
      if (!data.erro) {
        setFormData(prev => ({
          ...prev,
          street: data.logradouro || '',
          neighborhood: data.bairro || '',
          city: data.localidade || '',
          state: data.uf || '',
        }));
      } else {
        toast.error('CEP não encontrado');
      }
    } catch (error) {
      console.error('CEP lookup error:', error);
      toast.error('Erro ao buscar CEP');
    } finally {
      setIsLoadingCep(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!checkout) return;

    // Validate required fields
    if (!formData.name || !formData.email || !formData.phone) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    // Validate shipping address
    if (!formData.cep || !formData.street || !formData.number || !formData.city || !formData.state) {
      toast.error('Preencha o endereço de entrega completo');
      return;
    }

    if (paymentMethod === 'credit_card' && !cardData) {
      toast.error('Preencha os dados do cartão');
      return;
    }

    setIsSubmitting(true);

    // Server-side tracking - InitiateCheckout
    trackInitiateCheckout(
      {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        document: formData.cpf,
      },
      totalToCharge,
      { contentName: checkout.name }
    );

    try {
      // Build checkout request
      const items = [
        {
          product_id: checkout.product_id,
          quantity: 1,
          price_cents: productPrice,
        },
      ];

      if (addOrderBump && checkout.order_bump_product_id) {
        items.push({
          product_id: checkout.order_bump_product_id,
          quantity: 1,
          price_cents: orderBumpPrice,
        });
      }

      // Extract affiliate code from URL if present (e.g., ?ref=AFF8AE0DF)
      const urlParams = new URLSearchParams(window.location.search);
      const affiliateCode = urlParams.get('ref') || undefined;

      const checkoutRequest = {
        standalone_checkout_id: checkout.id,
        items,
        customer: {
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          document: formData.cpf || undefined,
        },
        shipping: {
          address: formData.street,
          number: formData.number,
          neighborhood: formData.neighborhood,
          city: formData.city,
          state: formData.state,
          zip: formData.cep,
          complement: formData.complement || undefined,
        },
        payment_method: paymentMethod,
        installments: cardData?.installments || 1,
        total_with_interest_cents: paymentMethod === 'credit_card' && totalWithInterest ? totalWithInterest : undefined,
        card_data: paymentMethod === 'credit_card' && cardData ? {
          number: cardData.card_number,
          holder_name: cardData.card_holder_name,
          exp_month: cardData.card_expiration_month,
          exp_year: cardData.card_expiration_year,
          cvv: cardData.card_cvv,
        } : undefined,
        affiliate_code: affiliateCode,
        utm: {
          ...trackingParams,
        },
        // Tracking IDs for CAPI
        fbclid: trackingParams.fbclid,
        gclid: trackingParams.gclid,
        ttclid: trackingParams.ttclid,
      };

      const { data, error: checkoutError } = await supabase.functions.invoke('ecommerce-checkout', {
        body: checkoutRequest,
      });

      if (checkoutError || !data?.success) {
        throw new Error(data?.error || checkoutError?.message || 'Erro ao processar pagamento');
      }

      // Handle payment response
      if (data.pix_code) {
        // Store PIX data and redirect
        localStorage.setItem('pix_payment_data', JSON.stringify({
          saleId: data.sale_id,
          pix_code: data.pix_code,
          pix_expiration: data.pix_expiration,
          total_cents: totalToCharge,
        }));
        window.location.href = `/pagamento-sucesso?sale=${data.sale_id}&method=pix`;
      } else if (data.boleto_url) {
        window.open(data.boleto_url, '_blank');
        toast.success('Boleto gerado! Aguardando pagamento.');
      } else if (data.payment_url) {
        window.location.href = data.payment_url;
      } else {
        toast.success('Pagamento processado!');
        window.location.href = `/pagamento-sucesso?sale=${data.sale_id}`;
      }
    } catch (err) {
      console.error('Checkout error:', err);
      toast.error(err instanceof Error ? err.message : 'Erro ao processar pagamento');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: theme.background_color }}>
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: theme.primary_color }} />
      </div>
    );
  }

  if (error || !checkout) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: theme.background_color }}>
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">Checkout não encontrado</h2>
            <p className="text-muted-foreground">Esta página não existe ou foi desativada.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const paymentMethods = checkout.payment_methods || ['pix', 'credit_card', 'boleto'];

  return (
    <>
      <Helmet>
        <title>{checkout.meta_title || checkout.name}</title>
        {checkout.meta_description && <meta name="description" content={checkout.meta_description} />}
        {checkout.facebook_pixel_id && (
          <script>{`
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '${checkout.facebook_pixel_id}');
            fbq('track', 'PageView');
          `}</script>
        )}
      </Helmet>

      <div 
        className="min-h-screen"
        style={{ 
          backgroundColor: theme.background_color,
          color: theme.text_color,
          fontFamily: theme.font_family,
        }}
      >
        {/* Top Banner */}
        {elements.top_banner.enabled && (
          <div 
            className="py-2 px-4 text-center text-sm font-medium"
            style={{ 
              backgroundColor: elements.top_banner.background_color,
              color: elements.top_banner.text_color,
            }}
          >
            {elements.top_banner.text}
          </div>
        )}

        {/* Countdown */}
        {elements.countdown.enabled && countdownTime !== null && countdownTime > 0 && (
          <div className="bg-destructive text-destructive-foreground py-3 px-4 text-center">
            <div className="flex items-center justify-center gap-2">
              <Clock className="h-5 w-5" />
              <span className="font-medium">{elements.countdown.text}</span>
              <span className="text-xl font-bold ml-2">{formatCountdown(countdownTime)}</span>
            </div>
          </div>
        )}

        <div className="container max-w-4xl mx-auto px-4 py-8">
          <div className="grid gap-8 lg:grid-cols-5">
            {/* Product Summary */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Resumo do Pedido</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Main Product */}
                  <div className="flex gap-3">
                    {(checkout.product?.ecommerce_images?.[0] || checkout.product?.image_url) && (
                      <img 
                        src={checkout.product.ecommerce_images?.[0] || checkout.product.image_url || ''} 
                        alt={checkout.product.name}
                        className="h-20 w-20 rounded-lg object-cover"
                      />
                    )}
                    <div className="flex-1">
                      <h3 className="font-medium">
                        {displayProductName}
                        {productQuantity > 1 && (
                          <span className="text-muted-foreground ml-1">x{productQuantity}</span>
                        )}
                      </h3>
                      <p className="text-lg font-semibold" style={{ color: theme.primary_color }}>
                        {formatCurrency(productPrice)}
                      </p>
                    </div>
                  </div>

                  {/* Order Bump */}
                  {checkout.order_bump_enabled && checkout.order_bump_product && (
                    <>
                      <Separator />
                      <div 
                        className="p-4 rounded-lg border-2 border-dashed cursor-pointer transition-colors"
                        style={{ 
                          borderColor: addOrderBump ? theme.primary_color : undefined,
                          backgroundColor: addOrderBump ? `${theme.primary_color}10` : undefined,
                        }}
                        onClick={() => setAddOrderBump(!addOrderBump)}
                      >
                        <div className="flex items-start gap-3">
                          <Checkbox 
                            checked={addOrderBump} 
                            onCheckedChange={(checked) => setAddOrderBump(!!checked)}
                          />
                          <div className="flex-1">
                            <Badge className="mb-1" style={{ backgroundColor: theme.primary_color }}>
                              Oferta Especial
                            </Badge>
                            <h4 className="font-medium">{checkout.order_bump_headline}</h4>
                            <p className="text-sm text-muted-foreground">{checkout.order_bump_product.name}</p>
                            <div className="flex items-center gap-2 mt-1">
                              {checkout.order_bump_discount_percent > 0 && (
                                <span className="text-sm line-through text-muted-foreground">
                                  {formatCurrency(checkout.order_bump_product.price_1_unit || checkout.order_bump_product.base_price_cents)}
                                </span>
                              )}
                              <span className="font-semibold" style={{ color: theme.primary_color }}>
                                {formatCurrency(orderBumpPrice)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Totals */}
                  <Separator />
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Subtotal</span>
                      <span>{formatCurrency(subtotal)}</span>
                    </div>
                    {paymentMethod === 'pix' && pixDiscount > 0 && (
                      <div className="flex justify-between text-sm text-green-600">
                        <span>Desconto PIX ({pixDiscount}%)</span>
                        <span>-{formatCurrency(subtotal - pixTotal)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold text-lg pt-2 border-t">
                      <span>Total</span>
                      <span style={{ color: theme.primary_color }}>{formatCurrency(totalToCharge)}</span>
                    </div>
                  </div>

                  {/* Guarantee */}
                  {elements.guarantee.enabled && (
                    <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                      <Shield className="h-8 w-8" style={{ color: theme.primary_color }} />
                      <div>
                        <p className="font-medium">Garantia de {elements.guarantee.days} dias</p>
                        <p className="text-xs text-muted-foreground">{elements.guarantee.text}</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Testimonials */}
              {elements.testimonials.enabled && testimonials && testimonials.length > 0 && (
                <Card className="mt-4">
                  <CardHeader>
                    <CardTitle className="text-lg">O que nossos clientes dizem</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {testimonials.slice(0, 3).map((testimonial) => (
                      <div key={testimonial.id} className="p-3 bg-muted rounded-lg">
                        <div className="flex gap-0.5 mb-2">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              className={`h-4 w-4 ${
                                star <= testimonial.rating
                                  ? 'fill-yellow-400 text-yellow-400'
                                  : 'text-gray-300'
                              }`}
                            />
                          ))}
                        </div>
                        <p className="text-sm mb-2">"{testimonial.content}"</p>
                        <p className="text-xs text-muted-foreground">
                          — {testimonial.author_name}
                          {testimonial.author_location && `, ${testimonial.author_location}`}
                        </p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Checkout Form */}
            <div className="lg:col-span-3">
              <Card>
                <CardHeader>
                  <CardTitle>Finalizar Compra</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Customer Info */}
                    <div className="space-y-4">
                      <h3 className="font-medium">Seus Dados</h3>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="sm:col-span-2 space-y-2">
                          <Label htmlFor="name">Nome Completo *</Label>
                          <Input
                            id="name"
                            value={formData.name}
                            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="email">E-mail *</Label>
                          <Input
                            id="email"
                            type="email"
                            value={formData.email}
                            onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="phone">WhatsApp *</Label>
                          <Input
                            id="phone"
                            type="tel"
                            value={formData.phone}
                            onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                            placeholder="(00) 00000-0000"
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="cpf">CPF</Label>
                          <Input
                            id="cpf"
                            value={formData.cpf}
                            onChange={(e) => setFormData(prev => ({ ...prev, cpf: e.target.value }))}
                            placeholder="000.000.000-00"
                          />
                        </div>
                      </div>
                    </div>

                    <Separator />

                    {/* Shipping Address */}
                    <div className="space-y-4">
                      <h3 className="font-medium">Endereço de Entrega</h3>
                      <div className="grid gap-4 sm:grid-cols-3">
                        <div className="space-y-2">
                          <Label htmlFor="cep">CEP *</Label>
                          <div className="relative">
                            <Input
                              id="cep"
                              maxLength={9}
                              placeholder="00000-000"
                              value={formData.cep}
                              onChange={(e) => setFormData(prev => ({ ...prev, cep: e.target.value.replace(/\D/g, '') }))}
                              onBlur={handleCepBlur}
                              required
                            />
                            {isLoadingCep && (
                              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="grid gap-4 sm:grid-cols-3">
                        <div className="sm:col-span-2 space-y-2">
                          <Label htmlFor="street">Rua *</Label>
                          <Input
                            id="street"
                            value={formData.street}
                            onChange={(e) => setFormData(prev => ({ ...prev, street: e.target.value }))}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="number">Número *</Label>
                          <Input
                            id="number"
                            value={formData.number}
                            onChange={(e) => setFormData(prev => ({ ...prev, number: e.target.value }))}
                            required
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
                            onChange={(e) => setFormData(prev => ({ ...prev, complement: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="neighborhood">Bairro *</Label>
                          <Input
                            id="neighborhood"
                            value={formData.neighborhood}
                            onChange={(e) => setFormData(prev => ({ ...prev, neighborhood: e.target.value }))}
                            required
                          />
                        </div>
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="city">Cidade *</Label>
                          <Input
                            id="city"
                            value={formData.city}
                            onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="state">Estado *</Label>
                          <Input
                            id="state"
                            maxLength={2}
                            placeholder="UF"
                            value={formData.state}
                            onChange={(e) => setFormData(prev => ({ ...prev, state: e.target.value.toUpperCase() }))}
                            required
                          />
                        </div>
                      </div>
                    </div>

                    <Separator />

                    {/* Payment Method */}
                    <div className="space-y-4">
                      <h3 className="font-medium">Forma de Pagamento</h3>
                      <RadioGroup value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}>
                        {paymentMethods.includes('pix') && (
                          <div className="flex items-center space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-muted">
                            <RadioGroupItem value="pix" id="pix" />
                            <Label htmlFor="pix" className="flex items-center gap-2 cursor-pointer flex-1">
                              <QrCode className="h-5 w-5" />
                              <div>
                                <span className="font-medium">PIX</span>
                                {pixDiscount > 0 && (
                                  <Badge variant="secondary" className="ml-2 text-xs">
                                    -{pixDiscount}%
                                  </Badge>
                                )}
                              </div>
                            </Label>
                            <span className="text-sm font-medium" style={{ color: theme.primary_color }}>
                              {formatCurrency(pixTotal)}
                            </span>
                          </div>
                        )}
                        {paymentMethods.includes('credit_card') && (
                          <div className="flex items-center space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-muted">
                            <RadioGroupItem value="credit_card" id="credit_card" />
                            <Label htmlFor="credit_card" className="flex items-center gap-2 cursor-pointer flex-1">
                              <CreditCard className="h-5 w-5" />
                              <span className="font-medium">Cartão de Crédito</span>
                            </Label>
                            <span className="text-sm">Até 12x</span>
                          </div>
                        )}
                        {paymentMethods.includes('boleto') && (
                          <div className="flex items-center space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-muted">
                            <RadioGroupItem value="boleto" id="boleto" />
                            <Label htmlFor="boleto" className="flex items-center gap-2 cursor-pointer flex-1">
                              <FileText className="h-5 w-5" />
                              <span className="font-medium">Boleto Bancário</span>
                            </Label>
                          </div>
                        )}
                      </RadioGroup>

                      {/* Credit Card Form */}
                      {paymentMethod === 'credit_card' && (
                        <CreditCardForm
                          onCardDataChange={setCardData}
                          totalCents={subtotal}
                          onTotalWithInterestChange={handleTotalWithInterestChange}
                        />
                      )}
                    </div>

                    {/* Trust Badges */}
                    {elements.trust_badges.enabled && (
                      <div className="flex flex-wrap gap-4 justify-center py-4">
                        {elements.trust_badges.show_secure_payment && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Lock className="h-4 w-4" />
                            <span>Pagamento Seguro</span>
                          </div>
                        )}
                        {elements.trust_badges.show_money_back && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <CheckCircle className="h-4 w-4" />
                            <span>Garantia de Devolução</span>
                          </div>
                        )}
                        {elements.trust_badges.show_support && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Headphones className="h-4 w-4" />
                            <span>Suporte 24/7</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Submit Button */}
                    <Button
                      type="submit"
                      className="w-full h-14 text-lg font-semibold"
                      disabled={isSubmitting}
                      style={{
                        backgroundColor: theme.button_style === 'outline' ? 'transparent' : theme.primary_color,
                        color: theme.button_style === 'outline' ? theme.primary_color : '#ffffff',
                        border: theme.button_style === 'outline' ? `2px solid ${theme.primary_color}` : 'none',
                        borderRadius: theme.border_radius,
                        background: theme.button_style === 'gradient'
                          ? `linear-gradient(135deg, ${theme.primary_color}, ${theme.primary_color}88)`
                          : undefined,
                      }}
                    >
                      {isSubmitting ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <>
                          <Lock className="h-5 w-5 mr-2" />
                          Finalizar Compra - {formatCurrency(totalToCharge)}
                        </>
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
