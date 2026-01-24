import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { CheckoutRequest, PaymentMethod, CardData } from "./types.ts";
import { FallbackEngine } from "./fallback-engine.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: CheckoutRequest = await req.json();
    const { customer, items, payment_method, affiliate_code, storefront_id, landing_page_id, offer_id, cart_id, utm } = body;

    // 1. Determine organization from storefront or landing page
    let organizationId: string | null = null;
    let productItems: { product_id: string; quantity: number; price_cents: number }[] = items || [];

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
        .select('organization_id, product_id')
        .eq('id', landing_page_id)
        .single();
      organizationId = landing?.organization_id;

      if (offer_id) {
        const { data: offer } = await supabase
          .from('landing_offers')
          .select('quantity, price_cents')
          .eq('id', offer_id)
          .single();
        
        if (offer && landing) {
          productItems = [{
            product_id: landing.product_id,
            quantity: offer.quantity,
            price_cents: offer.price_cents,
          }];
        }
      }
    }

    if (!organizationId) {
      throw new Error('Organização não identificada');
    }

    // 2. Create or update lead with UTM data
    const normalizedPhone = customer.phone.replace(/\D/g, '');
    
    let { data: lead } = await supabase
      .from('leads')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('whatsapp', normalizedPhone)
      .maybeSingle();

    // Get a default user from the organization for assignment (required for lead and sale)
    let defaultUserId: string | null = null;
    
    const { data: orgMembers } = await supabase
      .from('user_organizations')
      .select('user_id')
      .eq('organization_id', organizationId)
      .limit(1);
    
    defaultUserId = orgMembers?.[0]?.user_id || null;
    
    if (!defaultUserId) {
      // Fallback: get organization owner from profiles
      const { data: orgOwner } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('organization_id', organizationId)
        .limit(1);
      
      defaultUserId = orgOwner?.[0]?.user_id || null;
    }
    
    if (!defaultUserId) {
      throw new Error('Organização sem usuários cadastrados para atribuição');
    }

    if (!lead) {
      
      const { data: newLead, error: leadError } = await supabase
        .from('leads')
        .insert({
          organization_id: organizationId,
          name: customer.name,
          email: customer.email,
          whatsapp: normalizedPhone,
          lead_source: storefront_id ? 'ecommerce' : 'landing_page',
          assigned_to: defaultUserId,
          // Attribution UTM data
          src: utm?.src || null,
          utm_source: utm?.utm_source || null,
          utm_medium: utm?.utm_medium || null,
          utm_campaign: utm?.utm_campaign || null,
          utm_term: utm?.utm_term || null,
          utm_content: utm?.utm_content || null,
          fbclid: utm?.fbclid || null,
          gclid: utm?.gclid || null,
          ttclid: utm?.ttclid || null,
          first_touch_url: utm?.first_touch_url || null,
          first_touch_referrer: utm?.first_touch_referrer || null,
          first_touch_at: utm?.first_touch_at || null,
        })
        .select('id')
        .single();
      
      if (leadError) throw leadError;
      lead = newLead;
    } else if (utm && Object.keys(utm).length > 0) {
      // Update existing lead with UTM data if it doesn't have it yet
      await supabase
        .from('leads')
        .update({
          src: utm.src || null,
          utm_source: utm.utm_source || null,
          utm_medium: utm.utm_medium || null,
          utm_campaign: utm.utm_campaign || null,
          utm_term: utm.utm_term || null,
          utm_content: utm.utm_content || null,
          fbclid: utm.fbclid || null,
          gclid: utm.gclid || null,
          ttclid: utm.ttclid || null,
          first_touch_url: utm.first_touch_url || null,
          first_touch_referrer: utm.first_touch_referrer || null,
          first_touch_at: utm.first_touch_at || null,
        })
        .eq('id', lead.id)
        .is('utm_source', null); // Only update if no UTM was set before
    }

    // 3. Calculate totals
    const subtotalCents = productItems.reduce((acc, item) => acc + (item.price_cents * item.quantity), 0);
    // NOTE: shipping is currently calculated on frontend (ShippingSelector). We must receive it here.
    const shippingCents = Number.isFinite(Number(body.shipping_cost_cents)) ? Number(body.shipping_cost_cents) : 0;
    const totalCents = subtotalCents + shippingCents;

    // 4. Check affiliate
    let affiliateId: string | null = null;
    let affiliateCommissionPercentage = 0;
    
    if (affiliate_code) {
      const { data: affiliate } = await supabase
        .from('affiliates')
        .select('id, virtual_account_id, commission_percentage')
        .eq('organization_id', organizationId)
        .eq('affiliate_code', affiliate_code)
        .eq('is_active', true)
        .maybeSingle();
      
      if (affiliate) {
        affiliateId = affiliate.id;
        affiliateCommissionPercentage = Number(affiliate.commission_percentage) || 10;
      }
    }

    // 5. Create sale in payment_pending status with UTM attribution
    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .insert({
        organization_id: organizationId,
        lead_id: lead.id,
        created_by: defaultUserId, // Required field
        status: 'payment_pending', // Valid sale_status enum value
        payment_status: 'pending',
        subtotal_cents: subtotalCents,
        shipping_cost_cents: shippingCents,
        total_cents: totalCents,
        payment_method: payment_method,
        payment_notes: `Checkout via ${storefront_id ? 'loja' : 'landing page'}`,
        // Attribution UTM data on sale
        src: utm?.src || null,
        utm_source: utm?.utm_source || null,
        utm_medium: utm?.utm_medium || null,
        utm_campaign: utm?.utm_campaign || null,
        utm_term: utm?.utm_term || null,
        utm_content: utm?.utm_content || null,
        fbclid: utm?.fbclid || null,
        gclid: utm?.gclid || null,
        ttclid: utm?.ttclid || null,
      })
      .select('id')
      .single();

    if (saleError) throw saleError;

    // 6. Create sale items
    for (const item of productItems) {
      await supabase
        .from('sale_items')
        .insert({
          sale_id: sale.id,
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price_cents: item.price_cents,
          total_cents: item.price_cents * item.quantity,
        });
    }

    // 7. Store affiliate attribution if exists (splits are created by payment-webhook on payment confirmation)
    if (affiliateId && affiliate_code) {
      const { error: attrError } = await supabase
        .from('affiliate_attributions')
        .insert({
          sale_id: sale.id,
          organization_id: organizationId,
          affiliate_id: affiliateId,
          attribution_type: 'coupon',
          code_or_ref: affiliate_code,
        });
      
      if (attrError) {
        console.error('Failed to create affiliate attribution:', attrError);
        // Non-blocking - continue with checkout even if attribution fails
      }
    }

    // 8. Create ecommerce_order record for the Vendas Online panel
    const orderNumber = `ORD-${Date.now().toString(36).toUpperCase()}`;
    await supabase
      .from('ecommerce_orders')
      .insert({
        organization_id: organizationId,
        cart_id: cart_id || null,
        sale_id: sale.id,
        lead_id: lead.id,
        order_number: orderNumber,
        customer_name: customer.name,
        customer_email: customer.email || null,
        customer_phone: normalizedPhone,
        customer_cpf: customer.document || null,
        shipping_cep: body.shipping?.zip || null,
        shipping_street: body.shipping?.address || null,
        shipping_city: body.shipping?.city || null,
        shipping_state: body.shipping?.state || null,
        shipping_complement: body.shipping?.complement || null,
        subtotal_cents: subtotalCents,
        shipping_cents: shippingCents,
        discount_cents: 0,
        total_cents: totalCents,
        status: 'awaiting_payment',
        source: storefront_id ? 'storefront' : 'landing_page',
        storefront_id: storefront_id || null,
        landing_page_id: landing_page_id || null,
        utm_source: utm?.utm_source || null,
        utm_medium: utm?.utm_medium || null,
        utm_campaign: utm?.utm_campaign || null,
        utm_term: utm?.utm_term || null,
        utm_content: utm?.utm_content || null,
        fbclid: utm?.fbclid || null,
        gclid: utm?.gclid || null,
        ttclid: utm?.ttclid || null,
        affiliate_id: affiliateId || null,
        payment_method: payment_method,
      });

    // 9. Convert cart if exists
    if (cart_id) {
      await supabase
        .from('ecommerce_carts')
        .update({
          status: 'converted',
          converted_sale_id: sale.id,
          lead_id: lead.id,
        })
        .eq('id', cart_id);
    }

    // 10. Initialize Fallback Engine and process payment
    const fallbackEngine = new FallbackEngine(supabaseUrl, supabaseServiceKey);
    await fallbackEngine.initialize(payment_method);

    const paymentResult = await fallbackEngine.processWithFallback({
      sale_id: sale.id,
      organization_id: organizationId,
      amount_cents: totalCents,
      payment_method: payment_method as PaymentMethod,
      installments: body.installments || 1,
      customer: {
        name: customer.name,
        email: customer.email,
        phone: normalizedPhone,
        document: customer.document,
        address: body.shipping ? {
          street: body.shipping.address,
          city: body.shipping.city,
          state: body.shipping.state,
          zip_code: body.shipping.zip,
          complement: body.shipping.complement,
        } : undefined,
      },
      postback_url: `${supabaseUrl}/functions/v1/payment-webhook`,
      card_token: body.card_token,
      card_hash: body.card_hash,
      card_data: body.card_data,
      save_card: body.save_card,
    });

    // 11. Update sale with payment info
    const paymentStatus = paymentResult.response.success ? 'processing' : 'failed';
    await supabase
      .from('sales')
      .update({
        payment_status: paymentStatus,
        gateway_transaction_id: paymentResult.response.transaction_id || null,
      })
      .eq('id', sale.id);

    // 12. Save card if requested and successful
    if (body.save_card && paymentResult.response.success && paymentResult.response.card_id) {
      await supabase
        .from('saved_payment_methods')
        .insert({
          lead_id: lead.id,
          organization_id: organizationId,
          gateway_type: paymentResult.usedGateway,
          card_token: paymentResult.response.card_id,
          card_last_digits: paymentResult.response.card_last_digits,
          card_brand: paymentResult.response.card_brand,
          is_default: true,
        });
    }

    return new Response(
      JSON.stringify({
        success: paymentResult.response.success,
        sale_id: sale.id,
        subtotal_cents: subtotalCents,
        shipping_cost_cents: shippingCents,
        total_cents: totalCents,
        payment_url: paymentResult.response.payment_url,
        pix_code: paymentResult.response.pix_code,
        pix_expiration: paymentResult.response.pix_expiration,
        boleto_barcode: paymentResult.response.boleto_barcode,
        gateway_used: paymentResult.usedGateway,
        attempts_count: paymentResult.attempts.length,
        client_secret: paymentResult.response.client_secret,
        error: paymentResult.response.error_message,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error('Checkout error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
