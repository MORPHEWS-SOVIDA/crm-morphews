// Universal Checkout - handles cart restoration and redirect (v3 - rich items)
import { useEffect, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, ShoppingBag, AlertCircle, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CartProvider } from '@/components/storefront/cart/CartContext';

interface CartItemRich {
  product_id: string;
  storefront_product_id?: string;
  name?: string;
  image_url?: string;
  quantity: number;
  kit_size?: number;
  unit_price_cents?: number;
  total_price_cents?: number;
  price_cents?: number; // Legacy
  sku?: string;
}

interface CartData {
  id: string;
  organization_id: string;
  storefront_id: string | null;
  landing_page_id: string | null;
  offer_id: string | null;
  lead_id: string | null;
  session_id: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  customer_cpf: string | null;
  shipping_cep: string | null;
  shipping_address: string | null;
  shipping_city: string | null;
  shipping_state: string | null;
  items: CartItemRich[] | string;
  total_cents: number;
  status: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  fbclid: string | null;
  gclid: string | null;
  storefront?: {
    id: string;
    slug: string;
    name: string;
    organization_id: string;
  };
  landing_page?: {
    id: string;
    slug: string;
    name: string;
    organization_id: string;
  } | null;
}

export default function UniversalCheckout() {
  const { cartId } = useParams<{ cartId: string }>();
  const [searchParams] = useSearchParams();
  const [cart, setCart] = useState<CartData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadCart() {
      if (!cartId) {
        setError('Carrinho não encontrado');
        setLoading(false);
        return;
      }

      try {
        const { data, error: fetchError } = await supabase
          .from('ecommerce_carts')
          .select(`
            id,
            organization_id,
            storefront_id,
            landing_page_id,
            offer_id,
            lead_id,
            session_id,
            customer_name,
            customer_email,
            customer_phone,
            customer_cpf,
            shipping_cep,
            shipping_address,
            shipping_city,
            shipping_state,
            items,
            total_cents,
            status,
            expires_at,
            utm_source,
            utm_medium,
            utm_campaign,
            fbclid,
            gclid,
            storefront:tenant_storefronts(id, slug, name, organization_id),
            landing_page:landing_pages(id, slug, name, organization_id)
          `)
          .eq('id', cartId)
          .single();

        if (fetchError || !data) {
          console.error('Cart fetch error:', fetchError);
          setError('Carrinho não encontrado ou expirado');
          setLoading(false);
          return;
        }

        if (data.status === 'converted') {
          setError('Este carrinho já foi finalizado');
          setLoading(false);
          return;
        }

        if (data.expires_at && new Date(data.expires_at as string) < new Date()) {
          setError('Este carrinho expirou');
          setLoading(false);
          return;
        }

        // Merge UTM params from URL if present
        const urlUtmSource = searchParams.get('utm_source');
        const urlFbclid = searchParams.get('fbclid');
        const urlGclid = searchParams.get('gclid');

        if (urlUtmSource || urlFbclid || urlGclid) {
          const updateData: Record<string, string> = {};
          if (urlUtmSource) updateData.utm_source = urlUtmSource;
          const urlUtmMedium = searchParams.get('utm_medium');
          const urlUtmCampaign = searchParams.get('utm_campaign');
          if (urlUtmMedium) updateData.utm_medium = urlUtmMedium;
          if (urlUtmCampaign) updateData.utm_campaign = urlUtmCampaign;
          if (urlFbclid) updateData.fbclid = urlFbclid;
          if (urlGclid) updateData.gclid = urlGclid;

          await supabase
            .from('ecommerce_carts')
            .update(updateData)
            .eq('id', cartId);
        }

        setCart(data as unknown as CartData);
      } catch (err) {
        console.error('Error loading cart:', err);
        setError('Erro ao carregar carrinho');
      } finally {
        setLoading(false);
      }
    }

    loadCart();
  }, [cartId, searchParams]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="mt-4 text-muted-foreground">Carregando seu carrinho...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <CardTitle>{error}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-center text-muted-foreground">
              O link pode ter expirado ou o pedido já foi finalizado.
            </p>
            <div className="flex flex-col gap-2">
              <Button asChild>
                <Link to="/">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Voltar ao início
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!cart) return null;

  const isStorefrontCart = !!cart.storefront_id && !!cart.storefront;
  const isLandingCart = !!cart.landing_page_id && !!cart.landing_page;

  if (isStorefrontCart && cart.storefront) {
    return (
      <CartProvider>
        <UniversalStorefrontCheckout cart={cart} />
      </CartProvider>
    );
  }

  if (isLandingCart && cart.landing_page) {
    return <UniversalLandingCheckout cart={cart} />;
  }

  // Fallback
  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ShoppingBag className="h-6 w-6 text-primary" />
              <CardTitle>Seu Carrinho</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Itens no carrinho: {Array.isArray(cart.items) ? cart.items.length : 0}
            </p>
            <p className="text-lg font-semibold">
              Total: R$ {((cart.total_cents || 0) / 100).toFixed(2).replace('.', ',')}
            </p>
            <Button className="w-full" disabled>
              <AlertCircle className="h-4 w-4 mr-2" />
              Checkout não disponível para este tipo de carrinho
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Component for storefront cart checkout restoration
function UniversalStorefrontCheckout({ cart }: { cart: CartData }) {
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    if (cart.storefront && cart.items) {
      // Parse items from DB
      const rawItems: CartItemRich[] = typeof cart.items === 'string' 
        ? JSON.parse(cart.items) 
        : (Array.isArray(cart.items) ? cart.items : []);

      // Convert rich DB items to CartContext format
      const cartContextItems = rawItems.map(item => {
        const kitSize = item.kit_size || 1;
        const unitPrice = item.unit_price_cents || item.price_cents || 0;
        const quantity = item.quantity || 1;
        const totalPrice = item.total_price_cents || (unitPrice * quantity * kitSize);

        return {
          productId: item.product_id,
          storefrontProductId: item.storefront_product_id || item.product_id,
          name: item.name || 'Produto',
          imageUrl: item.image_url || null,
          quantity: quantity,
          kitSize: kitSize,
          unitPrice: unitPrice,
          totalPrice: totalPrice,
        };
      });

      const cartData = {
        items: cartContextItems,
        storefrontSlug: cart.storefront.slug,
        storefrontId: cart.storefront.id,
        cartId: cart.id,
        timestamp: Date.now(),
      };
      
      console.log('[UniversalCheckout] Restoring cart with rich items:', cartData);
      localStorage.setItem('cart', JSON.stringify(cartData));
      
      // Store customer data if available
      if (cart.customer_name || cart.customer_email || cart.customer_phone) {
        localStorage.setItem('checkout_customer', JSON.stringify({
          name: cart.customer_name || '',
          email: cart.customer_email || '',
          phone: cart.customer_phone || '',
          cpf: cart.customer_cpf || '',
        }));
      }

      // Store shipping data if available
      if (cart.shipping_cep) {
        localStorage.setItem('checkout_shipping', JSON.stringify({
          cep: cart.shipping_cep || '',
          address: cart.shipping_address || '',
          city: cart.shipping_city || '',
          state: cart.shipping_state || '',
        }));
      }

      setRestored(true);
    }
  }, [cart]);

  if (!restored) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // Redirect to storefront checkout
  window.location.href = `/loja/${cart.storefront!.slug}/checkout`;
  
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto" />
        <p className="mt-4">Redirecionando para o checkout...</p>
      </div>
    </div>
  );
}

// Component for landing page cart checkout
function UniversalLandingCheckout({ cart }: { cart: CartData }) {
  useEffect(() => {
    if (cart.landing_page && cart.offer_id) {
      const url = new URL(`/lp/${cart.landing_page.slug}`, window.location.origin);
      url.searchParams.set('offer', cart.offer_id);
      url.searchParams.set('cart', cart.id);
      if (cart.utm_source) url.searchParams.set('utm_source', cart.utm_source);
      if (cart.utm_medium) url.searchParams.set('utm_medium', cart.utm_medium);
      if (cart.utm_campaign) url.searchParams.set('utm_campaign', cart.utm_campaign);
      window.location.href = url.toString();
    }
  }, [cart]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto" />
        <p className="mt-4">Redirecionando para finalizar sua compra...</p>
      </div>
    </div>
  );
}
