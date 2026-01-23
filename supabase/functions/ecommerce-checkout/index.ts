import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { CheckoutRequest, PaymentMethod } from "./types.ts";
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
    const { customer, items, payment_method, affiliate_code, storefront_id, landing_page_id, offer_id, cart_id } = body;

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

    // 2. Create or update lead
    const normalizedPhone = customer.phone.replace(/\D/g, '');
    
    let { data: lead } = await supabase
      .from('leads')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('whatsapp', normalizedPhone)
      .maybeSingle();

    if (!lead) {
      const { data: newLead, error: leadError } = await supabase
        .from('leads')
        .insert({
          organization_id: organizationId,
          name: customer.name,
          email: customer.email,
          whatsapp: normalizedPhone,
          source: storefront_id ? 'ecommerce' : 'landing_page',
        })
        .select('id')
        .single();
      
      if (leadError) throw leadError;
      lead = newLead;
    }

    // 3. Calculate totals
    const subtotalCents = productItems.reduce((acc, item) => acc + (item.price_cents * item.quantity), 0);
    const shippingCents = 0; // TODO: Calculate shipping
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

    // 5. Create sale in pending status
    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .insert({
        organization_id: organizationId,
        lead_id: lead.id,
        status: 'pending',
        payment_status: 'pending',
        subtotal_cents: subtotalCents,
        shipping_cents: shippingCents,
        total_cents: totalCents,
        source: storefront_id ? 'ecommerce' : 'landing_page',
        notes: `Checkout - ${payment_method}`,
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

    // 7. Store affiliate reference if exists
    if (affiliateId) {
      await supabase
        .from('sale_splits')
        .insert({
          sale_id: sale.id,
          virtual_account_id: affiliateId,
          split_type: 'affiliate',
          gross_amount_cents: Math.round(totalCents * (affiliateCommissionPercentage / 100)),
          fee_cents: 0,
          net_amount_cents: Math.round(totalCents * (affiliateCommissionPercentage / 100)),
          percentage: affiliateCommissionPercentage,
        });
    }

    // 8. Convert cart if exists
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

    // 9. Initialize Fallback Engine and process payment
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
      },
      postback_url: `${supabaseUrl}/functions/v1/payment-webhook`,
      card_token: body.card_token,
      card_hash: body.card_hash,
      save_card: body.save_card,
    });

    // 10. Update sale with payment info
    const paymentStatus = paymentResult.response.success ? 'processing' : 'failed';
    await supabase
      .from('sales')
      .update({
        payment_status: paymentStatus,
        notes: `${paymentResult.usedGateway.toUpperCase()} ID: ${paymentResult.response.transaction_id || 'N/A'}`,
      })
      .eq('id', sale.id);

    // 11. Save card if requested and successful
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
        payment_url: paymentResult.response.payment_url,
        pix_code: paymentResult.response.pix_code,
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
