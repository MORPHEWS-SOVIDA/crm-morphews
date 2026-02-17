import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Normalizes Brazilian phone numbers to always include country code 55
 */
function normalizeBrazilianPhone(phone: string | null | undefined): string {
  if (!phone) return '';
  const clean = phone.replace(/\D/g, '');
  if (clean.startsWith('55') && (clean.length === 12 || clean.length === 13)) {
    return clean;
  }
  if (clean.length === 10 || clean.length === 11) {
    return `55${clean}`;
  }
  return clean;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface CartItemRich {
  product_id: string;
  storefront_product_id?: string;
  name?: string;
  image_url?: string;
  quantity: number;
  kit_size?: number;
  unit_price_cents?: number;
  total_price_cents?: number;
  price_cents?: number; // Legacy format support
  sku?: string;
}

interface CartSyncRequest {
  cart_id?: string;
  session_id?: string;
  storefront_id?: string;
  landing_page_id?: string;
  standalone_checkout_id?: string;
  offer_id?: string;
  items?: CartItemRich[];
  customer?: {
    name?: string;
    email?: string;
    phone?: string;
    cpf?: string;
  };
  shipping?: {
    cep?: string;
    street?: string;
    number?: string;
    complement?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
  };
  utm?: Record<string, string>;
  affiliate_code?: string;
  source: 'storefront' | 'landing_page' | 'standalone_checkout';
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: CartSyncRequest = await req.json();
    const { cart_id, session_id, storefront_id, landing_page_id, standalone_checkout_id, offer_id, items, customer, shipping, utm, affiliate_code, source } = body;

    const effectiveSessionId = session_id || crypto.randomUUID();

    // 1. Determine organization
    let organizationId: string | null = null;
    
    if (storefront_id) {
      const { data: storefront } = await supabase
        .from('tenant_storefronts')
        .select('organization_id')
        .eq('id', storefront_id)
        .single();
      organizationId = storefront?.organization_id;
    } else if (landing_page_id) {
      const { data: landing } = await supabase
        .from('landing_pages')
        .select('organization_id')
        .eq('id', landing_page_id)
        .single();
      organizationId = landing?.organization_id;
    } else if (standalone_checkout_id) {
      const { data: checkout } = await supabase
        .from('standalone_checkouts')
        .select('organization_id')
        .eq('id', standalone_checkout_id)
        .single();
      organizationId = checkout?.organization_id;
    }

    if (!organizationId) {
      throw new Error('Organização não identificada');
    }

    // 2. Normalize items - support both rich and legacy formats
    const normalizedItems = items?.map(item => {
      const kitSize = item.kit_size || 1;
      const unitPrice = item.unit_price_cents || item.price_cents || 0;
      const totalPrice = item.total_price_cents || (unitPrice * item.quantity * kitSize);
      
      return {
        product_id: item.product_id,
        storefront_product_id: item.storefront_product_id || null,
        name: item.name || null,
        image_url: item.image_url || null,
        quantity: item.quantity,
        kit_size: kitSize,
        unit_price_cents: unitPrice,
        total_price_cents: totalPrice,
        sku: item.sku || null,
      };
    }) || [];

    // 3. Calculate total from rich items
    const totalCents = normalizedItems.reduce((sum, item) => sum + item.total_price_cents, 0);

    // 4. If items don't have names, try to enrich from product catalog
    if (storefront_id && normalizedItems.some(item => !item.name)) {
      const productIds = normalizedItems.filter(i => !i.name).map(i => i.product_id);
      
      if (productIds.length > 0) {
        const { data: products } = await supabase
          .from('storefront_products')
          .select('id, product:lead_products(id, name, image_url)')
          .eq('storefront_id', storefront_id)
          .in('product_id', productIds);

        if (products) {
          const productMap = new Map<string, any>();
          for (const sp of products) {
            const prod = sp.product as any;
            if (prod) {
              productMap.set(prod.id, { 
                name: prod.name, 
                image_url: prod.image_url,
                storefront_product_id: sp.id 
              });
            }
          }
          
          for (const item of normalizedItems) {
            if (!item.name) {
              const info = productMap.get(item.product_id);
              if (info) {
                item.name = info.name;
                item.image_url = item.image_url || info.image_url;
                item.storefront_product_id = item.storefront_product_id || info.storefront_product_id;
              }
            }
          }
        }
      }
    }

    // 5. Prepare cart data
    const cartData: Record<string, any> = {
      organization_id: organizationId,
      session_id: effectiveSessionId,
      storefront_id: storefront_id || null,
      landing_page_id: landing_page_id || null,
      standalone_checkout_id: standalone_checkout_id || null,
      offer_id: offer_id || null,
      status: 'active',
      items: JSON.stringify(normalizedItems),
      total_cents: totalCents,
      updated_at: new Date().toISOString(),
    };

    if (affiliate_code) {
      cartData.affiliate_code = affiliate_code;
    }
    if (customer?.name) cartData.customer_name = customer.name;
    if (customer?.email) cartData.customer_email = customer.email;
    if (customer?.phone) cartData.customer_phone = normalizeBrazilianPhone(customer.phone);
    if (customer?.cpf) cartData.customer_cpf = customer.cpf?.replace(/\D/g, '');

    if (shipping?.cep) cartData.shipping_cep = shipping.cep;
    if (shipping?.street) cartData.shipping_address = shipping.street;
    if (shipping?.city) cartData.shipping_city = shipping.city;
    if (shipping?.state) cartData.shipping_state = shipping.state;

    if (utm) {
      if (utm.utm_source) cartData.utm_source = utm.utm_source;
      if (utm.utm_medium) cartData.utm_medium = utm.utm_medium;
      if (utm.utm_campaign) cartData.utm_campaign = utm.utm_campaign;
      if (utm.utm_term) cartData.utm_term = utm.utm_term;
      if (utm.utm_content) cartData.utm_content = utm.utm_content;
      if (utm.src) cartData.src = utm.src;
      if (utm.fbclid) cartData.fbclid = utm.fbclid;
      if (utm.gclid) cartData.gclid = utm.gclid;
      if (utm.ttclid) cartData.ttclid = utm.ttclid;
    }

    let resultCartId = cart_id;

    // 6. Create or update cart
    if (cart_id) {
      const { error } = await supabase
        .from('ecommerce_carts')
        .update(cartData)
        .eq('id', cart_id);
      if (error) throw error;
    } else {
      cartData.created_at = new Date().toISOString();
      const { data: newCart, error } = await supabase
        .from('ecommerce_carts')
        .insert(cartData)
        .select('id')
        .single();
      if (error) throw error;
      resultCartId = newCart.id;
    }

    // 7. Try to link lead if we have contact info
    if (resultCartId && (customer?.email || customer?.phone)) {
      const normalizedPhone = normalizeBrazilianPhone(customer?.phone);
      let leadId: string | null = null;
      
      if (normalizedPhone) {
        const { data: existingLead } = await supabase
          .from('leads')
          .select('id')
          .eq('organization_id', organizationId)
          .eq('whatsapp', normalizedPhone)
          .maybeSingle();
        leadId = existingLead?.id || null;
      }
      
      if (!leadId && customer?.email) {
        const { data: existingLead } = await supabase
          .from('leads')
          .select('id')
          .eq('organization_id', organizationId)
          .eq('email', customer.email)
          .maybeSingle();
        leadId = existingLead?.id || null;
      }

      if (leadId) {
        await supabase
          .from('ecommerce_carts')
          .update({ lead_id: leadId })
          .eq('id', resultCartId);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        cart_id: resultCartId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error('Cart sync error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
