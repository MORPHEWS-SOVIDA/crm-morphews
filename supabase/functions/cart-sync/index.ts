import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Normalizes Brazilian phone numbers to always include country code 55
 * Input can be: 21987654321, 5521987654321, (21) 98765-4321, etc.
 * Output will always be: 5521987654321 (13 digits) or 5521876543210 (12 digits for landline)
 */
function normalizeBrazilianPhone(phone: string | null | undefined): string {
  if (!phone) return '';
  
  // Remove all non-digits
  const clean = phone.replace(/\D/g, '');
  
  // If already starts with 55 and has 12-13 digits, return as-is
  if (clean.startsWith('55') && (clean.length === 12 || clean.length === 13)) {
    return clean;
  }
  
  // If has 10-11 digits (local format), prepend 55
  if (clean.length === 10 || clean.length === 11) {
    return `55${clean}`;
  }
  
  // Return cleaned number for edge cases
  return clean;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CartSyncRequest {
  cart_id?: string;
  session_id?: string;
  storefront_id?: string;
  landing_page_id?: string;
  standalone_checkout_id?: string;
  offer_id?: string;
  items?: Array<{
    product_id: string;
    quantity: number;
    price_cents: number;
  }>;
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
  affiliate_code?: string; // ?ref= parameter for affiliate tracking
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

    // Generate session_id if not provided
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

    // 2. Calculate total
    const totalCents = items?.reduce((sum, item) => sum + (item.price_cents * item.quantity), 0) || 0;

    // 3. Prepare cart data
    const cartData: Record<string, any> = {
      organization_id: organizationId,
      session_id: effectiveSessionId,
      storefront_id: storefront_id || null,
      landing_page_id: landing_page_id || null,
      standalone_checkout_id: standalone_checkout_id || null,
      offer_id: offer_id || null,
      status: 'active',
      items: items ? JSON.stringify(items) : null,
      total_cents: totalCents,
      updated_at: new Date().toISOString(),
    };

    // Add affiliate code if provided (from ?ref= parameter)
    if (affiliate_code) {
      cartData.affiliate_code = affiliate_code;
    }
    if (customer?.name) cartData.customer_name = customer.name;
    if (customer?.email) cartData.customer_email = customer.email;
    if (customer?.phone) cartData.customer_phone = normalizeBrazilianPhone(customer.phone);
    if (customer?.cpf) cartData.customer_cpf = customer.cpf?.replace(/\D/g, '');

    // Add shipping data
    if (shipping?.cep) cartData.shipping_cep = shipping.cep;
    if (shipping?.street) cartData.shipping_address = shipping.street;
    if (shipping?.city) cartData.shipping_city = shipping.city;
    if (shipping?.state) cartData.shipping_state = shipping.state;

    // Add UTM data
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

    // 4. Create or update cart
    if (cart_id) {
      // Update existing cart
      const { error } = await supabase
        .from('ecommerce_carts')
        .update(cartData)
        .eq('id', cart_id);

      if (error) throw error;
    } else {
      // Create new cart
      cartData.created_at = new Date().toISOString();
      
      const { data: newCart, error } = await supabase
        .from('ecommerce_carts')
        .insert(cartData)
        .select('id')
        .single();

      if (error) throw error;
      resultCartId = newCart.id;
    }

    // 5. Try to link lead if we have contact info
    if (resultCartId && (customer?.email || customer?.phone)) {
      const normalizedPhone = normalizeBrazilianPhone(customer?.phone);
      
      // Find or create lead
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

      // If we found a lead, link it to the cart
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