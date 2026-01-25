import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2, CreditCard, QrCode, Barcode, Shield, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { trackEvent } from './TrackingPixels';
import { useUtmTracker } from '@/hooks/useUtmTracker';
import { useUniversalTracking } from '@/hooks/ecommerce/useUniversalTracking';

// Generate or retrieve session ID for cart tracking
function getOrCreateSessionId(): string {
  const storageKey = 'lp_cart_session_id';
  let sessionId = localStorage.getItem(storageKey);
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    localStorage.setItem(storageKey, sessionId);
  }
  return sessionId;
}

interface LandingOffer {
  id: string;
  quantity: number;
  label: string;
  price_cents: number;
}

interface LandingCheckoutModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  landingPage: {
    id: string;
    name: string;
    primary_color: string;
    facebook_pixel_id?: string | null;
    google_analytics_id?: string | null;
    settings?: {
      tiktok_pixel_id?: string;
    };
  };
  offer: LandingOffer;
}

type PaymentMethod = 'pix' | 'credit_card' | 'boleto';

function formatCurrency(cents: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

export function LandingCheckoutModal({ 
  open, 
  onOpenChange, 
  landingPage, 
  offer 
}: LandingCheckoutModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pix');
  const { getUtmForCheckout } = useUtmTracker();
  const [cartId, setCartId] = useState<string | null>(null);
  const [sessionId] = useState(() => getOrCreateSessionId());
  const syncTimeoutRef = useRef<NodeJS.Timeout>();
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    cpf: '',
  });

  // Universal tracking hook for server-side CAPI
  const trackingConfig = useMemo(() => ({
    organizationId: '', // Will be fetched from landing page org
    facebookPixelId: landingPage.facebook_pixel_id,
    googleAnalyticsId: landingPage.google_analytics_id,
    tiktokPixelId: landingPage.settings?.tiktok_pixel_id,
    source: 'landing_page' as const,
    sourceId: landingPage.id,
    sourceName: landingPage.name,
  }), [landingPage]);

  const { 
    trackInitiateCheckout, 
    trackAddPaymentInfo,
    getTrackingParams,
  } = useUniversalTracking(trackingConfig);

  // Sync cart to backend for abandoned cart recovery
  const syncCartToBackend = useCallback(async (customerData: typeof formData) => {
    try {
      const utmData = getUtmForCheckout();
      
      const payload = {
        cart_id: cartId || undefined,
        session_id: sessionId,
        landing_page_id: landingPage.id,
        offer_id: offer.id,
        source: 'landing_page' as const,
        items: [{
          product_id: offer.id,
          quantity: offer.quantity,
          price_cents: offer.price_cents,
        }],
        customer: {
          name: customerData.name || undefined,
          email: customerData.email || undefined,
          phone: customerData.phone || undefined,
          cpf: customerData.cpf || undefined,
        },
        utm: utmData && Object.keys(utmData).length > 0 ? utmData : undefined,
      };

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cart-sync`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify(payload),
        }
      );

      const result = await response.json();
      
      if (result.success && result.cart_id && !cartId) {
        setCartId(result.cart_id);
      }
    } catch (error) {
      console.error('Cart sync error:', error);
    }
  }, [cartId, sessionId, landingPage.id, offer, getUtmForCheckout]);

  // Debounced sync on field blur
  const handleFieldBlur = useCallback((field: keyof typeof formData) => {
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }
    syncTimeoutRef.current = setTimeout(() => {
      if (formData[field]) {
        syncCartToBackend(formData);
      }
    }, 500);
  }, [formData, syncCartToBackend]);

  // Sync when modal opens with offer
  useEffect(() => {
    if (open) {
      syncCartToBackend(formData);
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim() || !formData.email.trim() || !formData.phone.trim()) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    setIsSubmitting(true);

    try {
      // Track InitiateCheckout event (client + server-side CAPI)
      trackEvent.facebook.initiateCheckout({
        value: offer.price_cents / 100,
        currency: 'BRL',
        num_items: offer.quantity,
      });
      trackEvent.google.beginCheckout({
        value: offer.price_cents / 100,
        currency: 'BRL',
      });
      trackEvent.tiktok.initiateCheckout({
        value: offer.price_cents / 100,
        currency: 'BRL',
      });

      // Server-side CAPI tracking
      trackInitiateCheckout(
        {
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          document: formData.cpf,
        },
        offer.price_cents,
        { contentName: offer.label }
      );

      // Get UTM data for attribution
      const utmData = getUtmForCheckout();

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ecommerce-checkout`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            landing_page_id: landingPage.id,
            offer_id: offer.id,
            cart_id: cartId || undefined,
            customer: {
              name: formData.name.trim(),
              email: formData.email.trim(),
              phone: formData.phone.replace(/\D/g, ''),
              document: formData.cpf.replace(/\D/g, '') || undefined,
            },
            payment_method: paymentMethod,
            // Attribution data
            utm: utmData,
          }),
        }
      );

      const result = await response.json();
      console.log('Checkout response:', result);

      if (!response.ok || result.success === false) {
        const errorMsg = result.error || 'Erro ao processar pagamento';
        console.error('Checkout failed:', errorMsg, result);
        throw new Error(errorMsg);
      }

      // Handle response based on payment method
      if (paymentMethod === 'pix' && result.pix_code) {
        // Store PIX data and redirect
        localStorage.setItem('pix_checkout_result', JSON.stringify({
          ...result,
          landingName: landingPage.name,
          offerLabel: offer.label,
          amount: offer.price_cents,
        }));
        window.location.href = `/pix-pagamento?sale=${result.sale_id}`;
      } else if (paymentMethod === 'boleto' && result.boleto_url) {
        window.open(result.boleto_url, '_blank');
        toast.success('Boleto gerado! Abra a nova aba para visualizar.');
        onOpenChange(false);
      } else if (result.payment_url) {
        window.location.href = result.payment_url;
      } else {
        toast.success('Pedido realizado com sucesso!');
        onOpenChange(false);
      }
    } catch (error: any) {
      console.error('Checkout error:', error);
      toast.error(error.message || 'Erro ao processar pagamento');
    } finally {
      setIsSubmitting(false);
    }
  };

  const primaryColor = landingPage.primary_color || '#000000';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" style={{ color: primaryColor }} />
            Finalizar Compra
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Order Summary */}
          <div 
            className="p-4 rounded-lg"
            style={{ backgroundColor: primaryColor + '10' }}
          >
            <div className="flex justify-between items-center">
              <span className="font-medium">{offer.label}</span>
              <span className="text-xl font-bold" style={{ color: primaryColor }}>
                {formatCurrency(offer.price_cents)}
              </span>
            </div>
          </div>

          {/* Customer Info */}
          <div className="space-y-3">
            <div>
              <Label htmlFor="name">Nome completo *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                onBlur={() => handleFieldBlur('name')}
                placeholder="Seu nome"
                required
              />
            </div>

            <div>
              <Label htmlFor="email">E-mail *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                onBlur={() => handleFieldBlur('email')}
                placeholder="seu@email.com"
                required
              />
            </div>

            <div>
              <Label htmlFor="phone">WhatsApp *</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                onBlur={() => handleFieldBlur('phone')}
                placeholder="(11) 99999-9999"
                required
              />
            </div>

            <div>
              <Label htmlFor="cpf">CPF (opcional)</Label>
              <Input
                id="cpf"
                value={formData.cpf}
                onChange={(e) => setFormData(prev => ({ ...prev, cpf: e.target.value }))}
                onBlur={() => handleFieldBlur('cpf')}
                placeholder="000.000.000-00"
              />
            </div>
          </div>

          {/* Payment Method */}
          <div className="space-y-2">
            <Label>Forma de pagamento</Label>
            <RadioGroup
              value={paymentMethod}
              onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}
              className="grid grid-cols-3 gap-2"
            >
              <Label
                htmlFor="pix"
                className={`flex flex-col items-center gap-1 p-3 border rounded-lg cursor-pointer transition-all ${
                  paymentMethod === 'pix' ? 'border-2' : ''
                }`}
                style={paymentMethod === 'pix' ? { borderColor: primaryColor } : undefined}
              >
                <RadioGroupItem value="pix" id="pix" className="sr-only" />
                <QrCode className="h-6 w-6" />
                <span className="text-xs font-medium">PIX</span>
              </Label>

              <Label
                htmlFor="credit_card"
                className={`flex flex-col items-center gap-1 p-3 border rounded-lg cursor-pointer transition-all ${
                  paymentMethod === 'credit_card' ? 'border-2' : ''
                }`}
                style={paymentMethod === 'credit_card' ? { borderColor: primaryColor } : undefined}
              >
                <RadioGroupItem value="credit_card" id="credit_card" className="sr-only" />
                <CreditCard className="h-6 w-6" />
                <span className="text-xs font-medium">Cartão</span>
              </Label>

              <Label
                htmlFor="boleto"
                className={`flex flex-col items-center gap-1 p-3 border rounded-lg cursor-pointer transition-all ${
                  paymentMethod === 'boleto' ? 'border-2' : ''
                }`}
                style={paymentMethod === 'boleto' ? { borderColor: primaryColor } : undefined}
              >
                <RadioGroupItem value="boleto" id="boleto" className="sr-only" />
                <Barcode className="h-6 w-6" />
                <span className="text-xs font-medium">Boleto</span>
              </Label>
            </RadioGroup>
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            className="w-full"
            size="lg"
            style={{ backgroundColor: primaryColor }}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processando...
              </>
            ) : (
              `Pagar ${formatCurrency(offer.price_cents)}`
            )}
          </Button>

          {/* Trust Badge */}
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Shield className="h-4 w-4" />
            <span>Seus dados estão protegidos</span>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
