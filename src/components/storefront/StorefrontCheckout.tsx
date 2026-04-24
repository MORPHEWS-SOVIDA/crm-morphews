import { useState, useCallback, useEffect, useMemo } from 'react';
import { useOutletContext, useNavigate, Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ShieldCheck, CreditCard, QrCode, FileText, Loader2, Package, Save, Truck, AlertCircle } from 'lucide-react';
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
import { logCheckoutEvent } from '@/hooks/ecommerce/useCheckoutEvents';
import { coercePositiveInt, normalizeCurrencyCents } from '@/lib/ecommerce/cartMath';

function formatCurrency(cents: number): string {
  const safeCents = Number.isFinite(cents) ? cents : 0;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(safeCents / 100);
}

function translateCheckoutError(msg: string): string {
  const lower = msg.toLowerCase();
  const translations: [RegExp | string, string][] = [
    [/cep.*inv[aá]lid|invalid.*zip|zip.*invalid|cep.*n[ãa]o encontrado/i, 'CEP inválido ou não encontrado. Verifique o CEP informado.'],
    [/cpf.*inv[aá]lid|invalid.*document|document.*invalid/i, 'CPF/CNPJ inválido. Verifique o documento informado.'],
    [/card.*declined|cart[ãa]o.*recusad|transaction.*refused|pagamento.*recusad/i, 'Pagamento recusado pela operadora do cartão. Tente outro cartão ou forma de pagamento.'],
    [/insufficient.*funds|saldo.*insuficiente/i, 'Saldo insuficiente no cartão. Tente outro cartão.'],
    [/expired.*card|cart[ãa]o.*vencid|cart[ãa]o.*expirad/i, 'Cartão vencido. Use um cartão válido.'],
    [/invalid.*card|cart[ãa]o.*inv[aá]lid|n[uú]mero.*cart[ãa]o/i, 'Dados do cartão inválidos. Verifique número, validade e CVV.'],
    [/cvv|security.*code|c[oó]digo.*seguran/i, 'Código de segurança (CVV) incorreto.'],
    [/timeout|tempo.*esgot|time.*out/i, 'A operação demorou muito. Tente novamente.'],
    [/network|conex[ãa]o|internet/i, 'Erro de conexão. Verifique sua internet e tente novamente.'],
    [/address.*required|endere[cç]o.*obrigat/i, 'Endereço de entrega é obrigatório. Preencha todos os campos.'],
    [/phone.*required|telefone.*obrigat/i, 'Telefone é obrigatório.'],
    [/email.*required|email.*obrigat|e-mail.*inv[aá]lid/i, 'E-mail inválido ou não informado.'],
    [/antifraud|anti.?fraud|fraude/i, 'Pagamento bloqueado pelo sistema antifraude. Tente outro cartão.'],
  ];
  for (const [pattern, translation] of translations) {
    if (typeof pattern === 'string' ? lower.includes(pattern) : pattern.test(msg)) {
      return translation;
    }
  }
  return msg;
}

// Saved cards - will be fetched from saved_payment_methods once lead is identified
// For now, empty array until we implement real lookup
const SAVED_CARDS: { id: string; card_brand: string; card_last_digits: string; is_default: boolean; gateway_type: string }[] = [];

export function StorefrontCheckout() {
  const navigate = useNavigate();
  const { cartId: urlCartId } = useParams<{ cartId?: string }>();
  const [searchParams] = useSearchParams();
  const { storefront } = useOutletContext<{ storefront: StorefrontData }>();
  const { items, subtotal, clearCart, cartId, updateCustomerData, updateShippingData, addItem } = useCart();
  const { getUtmForCheckout } = useUtmTracker();
  const [restoringCart, setRestoringCart] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
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
  
  const [formData, setFormData] = useState(() => {
    // Try to restore customer/shipping data from UniversalCheckout restoration
    let initial = {
      name: '',
      email: '',
      phone: '',
      cpf: '',
      cep: '',
      street: '',
      number: '',
      complement: '',
      neighborhood: '',
      city: '',
      state: '',
    };
    
    try {
      const savedCustomer = localStorage.getItem('checkout_customer');
      if (savedCustomer) {
        const parsed = JSON.parse(savedCustomer);
        if (parsed.name) initial.name = parsed.name;
        if (parsed.email) initial.email = parsed.email;
        if (parsed.phone) initial.phone = parsed.phone;
        if (parsed.cpf) initial.cpf = parsed.cpf;
        localStorage.removeItem('checkout_customer'); // consume once
      }
      const savedShipping = localStorage.getItem('checkout_shipping');
      if (savedShipping) {
        const parsed = JSON.parse(savedShipping);
        if (parsed.cep) initial.cep = parsed.cep;
        if (parsed.address) initial.street = parsed.address;
        if (parsed.city) initial.city = parsed.city;
        if (parsed.state) initial.state = parsed.state;
        localStorage.removeItem('checkout_shipping'); // consume once
      }
    } catch (e) {
      // ignore parse errors
    }
    
    return initial;
  });

  // Restore cart from base64 query param (?cart=<base64>), simple query params, or from database (/checkout/:cartId)
  useEffect(() => {
    if (items.length > 0 || restoringCart) return;

    // Read simple customer query params (from external sites)
    const qpName = searchParams.get('name');
    const qpEmail = searchParams.get('email');
    const qpPhone = searchParams.get('phone') || searchParams.get('whatsapp');
    const qpCpf = searchParams.get('cpf');

    // Pre-fill customer data from simple query params
    if (qpName || qpEmail || qpPhone) {
      setFormData(prev => ({
        ...prev,
        name: qpName || prev.name,
        email: qpEmail || prev.email,
        phone: qpPhone || prev.phone,
        cpf: qpCpf || prev.cpf,
      }));

      // Clean customer params from URL
      const newUrl = new URL(window.location.href);
      ['name', 'email', 'phone', 'whatsapp', 'cpf'].forEach(p => newUrl.searchParams.delete(p));
      window.history.replaceState({}, '', newUrl.toString());
    }

    // Method 1: Base64 encoded cart data in query param (from external sites like shapefy.shop)
    const cartParam = searchParams.get('cart');
    if (cartParam) {
      try {
        setRestoringCart(true);
        const decoded = JSON.parse(decodeURIComponent(atob(cartParam)));
        // Log cart_loaded event from checkout page
        logCheckoutEvent({
          organizationId: storefront.organization_id,
          sessionId: localStorage.getItem('cart_session_id') || undefined,
          eventType: 'cart_loaded',
          eventData: {
            items_count: decoded.items?.length || 0,
            source: 'checkout_direct',
          },
          customerName: decoded.customer?.name || qpName || undefined,
          customerEmail: decoded.customer?.email || qpEmail || undefined,
          customerPhone: decoded.customer?.phone || qpPhone || undefined,
          sourceUrl: window.location.href,
          sourceType: 'storefront',
          sourceId: storefront.id,
        });

        // Restore customer data (query params take priority, already set above)
        if (decoded.customer) {
          setFormData(prev => ({
            ...prev,
            name: prev.name || decoded.customer.name || '',
            email: prev.email || decoded.customer.email || '',
            phone: prev.phone || decoded.customer.whatsapp || decoded.customer.phone || '',
            cpf: prev.cpf || decoded.customer.cpf || '',
          }));
        }

        // Restore cart items - resolve prices from DB when missing
        const cartItems = decoded.items || [];
        const resolveAndAdd = async () => {
          for (const item of cartItems) {
            const productId = item.product_id || item.pid;
            const quantity = coercePositiveInt(item.quantity || item.q, 0);
            if (productId && quantity > 0) {
              let unitPrice = normalizeCurrencyCents(item.unit_price_cents || item.upc || item.price_cents);
              let itemName = item.name || item.n || '';
              let imageUrl = item.image_url || item.img || null;
              let isCombo = false;

              // Resolve from DB if price/name missing
              if (!unitPrice || !itemName || itemName === 'Produto') {
                try {
                  // Try as regular product first
                  let resolved = false;
                  const { data } = await supabase
                    .from('storefront_products')
                    .select(`custom_price_cents, product:lead_products(name, ecommerce_title, image_url, ecommerce_images, price_1_unit, price_3_units, price_6_units, base_price_cents)`)
                    .eq('storefront_id', storefront.id)
                    .eq('product_id', productId)
                    .eq('is_visible', true)
                    .single();
                  if (data?.product) {
                    const p = data.product as any;
                    let price = data.custom_price_cents || p.price_1_unit || p.base_price_cents || 0;
                    // Tiered pricing
                    if (quantity >= 5 && p.price_6_units) {
                      price = Math.round(p.price_6_units / quantity);
                    } else if (quantity >= 3 && p.price_3_units) {
                      price = Math.round(p.price_3_units / quantity);
                    }
                    unitPrice = unitPrice || price;
                    itemName = (!itemName || itemName === 'Produto') ? (p.ecommerce_title || p.name) : itemName;
                    imageUrl = imageUrl || p.ecommerce_images?.[0] || p.image_url || null;
                    resolved = true;
                  }
                  
                  // Try as combo if not found as product
                  if (!resolved) {
                    const { data: comboData } = await supabase
                      .from('storefront_products')
                      .select(`custom_price_cents, combo:product_combos(name, image_url)`)
                      .eq('storefront_id', storefront.id)
                      .eq('combo_id', productId)
                      .eq('is_visible', true)
                      .single();
                    if (comboData?.combo) {
                      const c = comboData.combo as any;
                      let price = comboData.custom_price_cents || 0;
                      if (!price) {
                        const { data: comboPrice } = await supabase
                          .from('product_combo_prices')
                          .select('regular_price_cents')
                          .eq('combo_id', productId)
                          .eq('multiplier', quantity || 1)
                          .single();
                        price = comboPrice?.regular_price_cents || 0;
                      }
                      unitPrice = unitPrice || price;
                      itemName = (!itemName || itemName === 'Produto') ? c.name : itemName;
                      imageUrl = imageUrl || c.image_url || null;
                      isCombo = true;
                    }
                  }
                } catch {}
              }

              addItem({
                productId,
                storefrontProductId: item.storefront_product_id || item.spid || productId,
                name: itemName || 'Produto',
                imageUrl,
                quantity,
                kitSize: coercePositiveInt(item.kit_size || item.ks, 1),
                unitPrice,
                isCombo,
              }, storefront.slug, storefront.id);
            }
          }
        };
        resolveAndAdd();

        // Clean URL without reloading (remove ?cart param)
        const cleanUrl = new URL(window.location.href);
        cleanUrl.searchParams.delete('cart');
        window.history.replaceState({}, '', cleanUrl.pathname);
        
        setRestoringCart(false);
        return;
      } catch (err) {
        console.error('[Checkout] Error decoding cart param:', err);
        setRestoringCart(false);
      }
    }

    // Method 2: Cart ID in URL path (/checkout/:cartId) - fetch from database
    if (!urlCartId) return;
    
    const restoreCart = async () => {
      setRestoringCart(true);
      try {
        const { data: cart, error } = await supabase
          .from('ecommerce_carts')
          .select('items, customer_name, customer_email, customer_phone, customer_cpf, shipping_cep, shipping_address, shipping_city, shipping_state')
          .eq('id', urlCartId)
          .single();
        
        if (error || !cart) {
          console.warn('[Checkout] Cart not found:', urlCartId);
          setRestoringCart(false);
          return;
        }

        // Restore customer data into form
        if (cart.customer_name || cart.customer_email) {
          setFormData(prev => ({
            ...prev,
            name: cart.customer_name || prev.name,
            email: cart.customer_email || prev.email,
            phone: cart.customer_phone || prev.phone,
            cpf: cart.customer_cpf || prev.cpf,
            cep: cart.shipping_cep || prev.cep,
            street: cart.shipping_address || prev.street,
            city: cart.shipping_city || prev.city,
            state: cart.shipping_state || prev.state,
          }));
        }

        // Restore cart items
        const cartItems = (cart.items as any[]) || [];
        for (const item of cartItems) {
          const quantity = coercePositiveInt(item.quantity, 0);
          const unitPrice = normalizeCurrencyCents(item.unit_price_cents || item.price_cents);

          if (item.product_id && quantity > 0 && unitPrice > 0) {
            addItem({
              productId: item.product_id,
              storefrontProductId: item.storefront_product_id || item.product_id,
              name: item.name || 'Produto',
              imageUrl: item.image_url || null,
              quantity,
              kitSize: coercePositiveInt(item.kit_size, 1),
              unitPrice,
            }, storefront.slug, storefront.id);
          }
        }
      } catch (err) {
        console.error('[Checkout] Error restoring cart:', err);
      }
      setRestoringCart(false);
    };

    restoreCart();
  }, [urlCartId, searchParams, items.length, restoringCart, storefront.slug, storefront.id, addItem]);

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
  // Free shipping: only when subtotal meets the configured threshold (default R$250 = 25000 cents)
  const freeShippingThreshold = cartConfig.freeShippingThreshold || 25000;
  const hasFreeShipping = subtotal >= freeShippingThreshold;
  
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

  // Form validation - check if all required fields are filled
  const isFormValid = useMemo(() => {
    // Basic required fields
    const hasBasicFields = !!(
      formData.name.trim() &&
      formData.email.trim() &&
      formData.phone.trim() &&
      formData.cpf.trim()
    );

    // Address fields (when required)
    const needsAddress = checkoutConfig.collectAddress !== false;
    const hasAddressFields = !needsAddress || !!(
      formData.cep.trim() &&
      formData.street.trim() &&
      formData.number.trim() &&
      formData.neighborhood.trim() &&
      formData.city.trim() &&
      formData.state.trim()
    );

    // Credit card validation (only when credit card is selected and not one-click)
    const needsCardData = paymentMethod === 'credit_card' && !isOneClickCheckout;
    const hasCardData = !needsCardData || !!cardData;

    return hasBasicFields && hasAddressFields && hasCardData && acceptedTerms;
  }, [formData, paymentMethod, isOneClickCheckout, cardData, acceptedTerms, checkoutConfig.collectAddress]);

  const handleCepBlurEarly = useCallback(async (cep: string) => {
    if (cep.length !== 8) return;
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
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
  }, []);

  const handleCepChange = useCallback((value: string) => {
    const cleanCep = value.replace(/\D/g, '');
    setFormData(prev => ({ ...prev, cep: cleanCep }));
    if (cleanCep.length === 8) {
      fetch(`https://viacep.com.br/ws/${cleanCep}/json/`)
        .then(r => r.json())
        .then(data => {
          if (!data.erro) {
            setFormData(prev => ({
              ...prev,
              street: prev.street || data.logradouro || '',
              neighborhood: prev.neighborhood || data.bairro || '',
              city: prev.city || data.localidade || '',
              state: prev.state || data.uf || '',
            }));
          }
        })
        .catch(() => {});
    }
  }, []);

  if (restoringCart) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto" />
        <p className="mt-4 text-muted-foreground">Carregando carrinho...</p>
      </div>
    );
  }

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
    setCheckoutError(null);
    
    try {
      // Log checkout_started event
      logCheckoutEvent({
        organizationId: storefront.organization_id,
        cartId: cartId,
        sessionId: localStorage.getItem('cart_session_id') || undefined,
        eventType: 'checkout_started',
        eventData: {
          payment_method: paymentMethod,
          items_count: items.length,
          total_cents: totalToCharge,
          shipping_cents: shippingCents,
          installments: paymentMethod === 'credit_card' ? selectedInstallments : undefined,
        },
        customerName: formData.name,
        customerEmail: formData.email,
        customerPhone: formData.phone,
        sourceType: 'storefront',
        sourceId: storefront.id,
      });

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
          product_name: item.name || undefined,
        })),
        customer: {
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          document: formData.cpf,
        },
        // IMPORTANT: backend needs shipping cost to charge correct total (PIX/BOLETO/CARD)
        shipping_cost_cents: shippingCents,
        shipping_method_name: selectedShipping?.service_name || (hasFreeShipping ? 'Frete Grátis' : undefined),
        shipping: checkoutConfig.collectAddress !== false ? {
          address: formData.street,
          number: formData.number,
          neighborhood: formData.neighborhood,
          city: formData.city,
          state: formData.state,
          zip: formData.cep,
          complement: formData.complement,
        } : undefined,
        payment_method: paymentMethod,
        // CRITICAL: send installments at root so backend forwards to gateway.
        // Without this, the gateway charges the full amount upfront (à vista) even when
        // total_with_interest_cents is sent, because installments defaults to 1 in the backend.
        installments: paymentMethod === 'credit_card' ? (selectedInstallments || 1) : 1,
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
        // Log payment error
        logCheckoutEvent({
          organizationId: storefront.organization_id,
          cartId: cartId,
          eventType: 'payment_failed',
          eventData: { response_status: response.status, result },
          customerName: formData.name,
          customerEmail: formData.email,
          customerPhone: formData.phone,
          errorMessage: result.error || 'Erro ao processar pagamento',
          sourceType: 'storefront',
          sourceId: storefront.id,
        });
        throw new Error(result.error || 'Erro ao processar pagamento');
      }

      // Log payment success
      logCheckoutEvent({
        organizationId: storefront.organization_id,
        cartId: cartId,
        eventType: 'payment_success',
        eventData: {
          sale_id: result.sale_id,
          payment_method: paymentMethod,
          total_cents: totalToCharge,
        },
        customerName: formData.name,
        customerEmail: formData.email,
        customerPhone: formData.phone,
        sourceType: 'storefront',
        sourceId: storefront.id,
      });

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
      const rawMsg = error instanceof Error ? error.message : 'Erro ao processar pagamento';
      const friendlyMsg = translateCheckoutError(rawMsg);
      setCheckoutError(friendlyMsg);
      // Log payment_error (technical)
      logCheckoutEvent({
        organizationId: storefront.organization_id,
        cartId: cartId,
        eventType: 'payment_error',
        customerName: formData.name,
        customerEmail: formData.email,
        customerPhone: formData.phone,
        errorMessage: rawMsg,
        sourceType: 'storefront',
        sourceId: storefront.id,
      });
      toast.error(friendlyMsg);
    } finally {
      setIsSubmitting(false);
    }
  };


  return (
    <div data-store={storefront.slug} className="storefront-checkout-themed container mx-auto px-4 py-8">
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
                      maxLength={9}
                      placeholder="00000-000"
                      value={formData.cep}
                      onChange={e => handleCepChange(e.target.value)}
                      onBlur={() => handleCepBlurEarly(formData.cep)}
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
                  hasFreeShipping={hasFreeShipping}
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

              {/* Checkout error banner */}
              {checkoutError && (
                <div className="flex items-start gap-3 p-4 rounded-lg border border-destructive/50 bg-destructive/10 text-destructive text-sm">
                  <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">Não foi possível concluir o pedido</p>
                    <p className="mt-1 opacity-90">{checkoutError}</p>
                  </div>
                </div>
              )}

              {/* Submit */}
              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={isSubmitting || !isFormValid}
                style={{ backgroundColor: isFormValid ? storefront.primary_color : undefined }}
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
