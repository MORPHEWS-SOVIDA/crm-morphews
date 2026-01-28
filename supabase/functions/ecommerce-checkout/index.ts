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
    const { customer, items, payment_method, affiliate_code, storefront_id, landing_page_id, standalone_checkout_id, offer_id, cart_id, utm } = body;

    // Validate CPF early for credit card payments (gateway requires a CPF with 11 digits)
    const cpfDigits = (customer?.document || '').replace(/\D/g, '');
    if (payment_method === 'credit_card' && cpfDigits.length !== 11) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'CPF inválido. Informe um CPF válido (11 dígitos) para pagar com cartão.',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1. Determine organization from storefront or landing page
    let organizationId: string | null = null;
    let productItems: { product_id: string; quantity: number; price_cents: number; product_name?: string; product_image_url?: string }[] = items || [];

    // 1a. If cart_id is provided and items are empty, fetch items from cart
    if (cart_id && productItems.length === 0) {
      const { data: cart } = await supabase
        .from('ecommerce_carts')
        .select('items, organization_id, storefront_id')
        .eq('id', cart_id)
        .single();
      
      if (cart?.items && Array.isArray(cart.items)) {
        productItems = cart.items as { product_id: string; quantity: number; price_cents: number }[];
        if (!organizationId) {
          organizationId = cart.organization_id;
        }
      }
    }

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
    } else if (standalone_checkout_id) {
      // Handle standalone checkouts (/pay/:slug)
      const { data: standaloneCheckout } = await supabase
        .from('standalone_checkouts')
        .select('organization_id, product_id')
        .eq('id', standalone_checkout_id)
        .single();
      
      if (standaloneCheckout) {
        organizationId = standaloneCheckout.organization_id;
        console.log(`[Checkout] Standalone checkout ${standalone_checkout_id}: org=${organizationId}`);
      }
    }

    // 1b. Enrich product items with names and images for order_items
    const productIds = productItems.map(i => i.product_id).filter(Boolean);
    const productMap: Record<string, { name: string; image_url?: string }> = {};
    if (productIds.length > 0) {
      const { data: products } = await supabase
        .from('lead_products')
        .select('id, name, image_url')
        .in('id', productIds);
      
      if (products) {
        for (const p of products) {
          productMap[p.id] = { name: p.name, image_url: p.image_url };
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
    const baseTotalCents = subtotalCents + shippingCents;
    
    // Use total with interest if provided (for credit card with installments)
    const totalWithInterest = Number.isFinite(Number(body.total_with_interest_cents)) 
      ? Number(body.total_with_interest_cents) 
      : null;
    const totalCents = totalWithInterest || baseTotalCents;

    // 4. Check affiliate via affiliate_network_members (new) OR partner_associations (legacy)
    let affiliatePartnerId: string | null = null;
    let affiliateVirtualAccountId: string | null = null;
    let affiliateCommissionType: string = 'percentage';
    let affiliateCommissionValue: number = 10;
    let affiliateLiableRefund: boolean = true;
    let affiliateLiableChargeback: boolean = true;
    let affiliateNetworkMemberId: string | null = null;
    
    if (affiliate_code) {
      // NEW: First try to find affiliate via organization_affiliates + affiliate_network_members
      const { data: orgAffiliate } = await supabase
        .from('organization_affiliates')
        .select('id, email, name, user_id, default_commission_type, default_commission_value')
        .eq('organization_id', organizationId)
        .eq('affiliate_code', affiliate_code)
        .eq('is_active', true)
        .maybeSingle();

      if (orgAffiliate) {
        // Check if this affiliate is part of a network that has this checkout
        const { data: networkMember } = await supabase
          .from('affiliate_network_members')
          .select(`
            id, 
            network_id, 
            commission_type, 
            commission_value,
            network:affiliate_networks!inner(id, organization_id, is_active)
          `)
          .eq('affiliate_id', orgAffiliate.id)
          .eq('is_active', true)
          .limit(1)
          .maybeSingle();

        if (networkMember) {
          // Use network member's commission settings
          affiliateNetworkMemberId = networkMember.id;
          affiliateCommissionType = networkMember.commission_type || 'percentage';
          affiliateCommissionValue = Number(networkMember.commission_value) || 10;
          
          // Create/get virtual account for this affiliate via user_id
          if (orgAffiliate.user_id) {
            const { data: vaByUser } = await supabase
              .from('virtual_accounts')
              .select('id')
              .eq('user_id', orgAffiliate.user_id)
              .maybeSingle();
            
            if (vaByUser) {
              affiliateVirtualAccountId = vaByUser.id;
            } else {
              // Create virtual account for this affiliate user
              const { data: newVA } = await supabase
                .from('virtual_accounts')
                .insert({
                  organization_id: organizationId,
                  user_id: orgAffiliate.user_id,
                  account_type: 'affiliate',
                  holder_name: orgAffiliate.name || orgAffiliate.email,
                  holder_email: orgAffiliate.email,
                })
                .select('id')
                .single();
              
              affiliateVirtualAccountId = newVA?.id || null;
            }
          }
          
          console.log(`[Checkout] Found network affiliate ${affiliate_code}: commission=${affiliateCommissionValue}${affiliateCommissionType === 'percentage' ? '%' : 'c'}`);
        }
      }

      // LEGACY: Fallback to partner_associations if not found via networks
      if (!affiliateNetworkMemberId) {
        // First try to find a partner linked to this specific storefront/landing
        const linkedColumn = storefront_id ? 'linked_storefront_id' : (landing_page_id ? 'linked_landing_id' : null);
        const linkedId = storefront_id || landing_page_id || null;
        
        let partnerQuery = supabase
          .from('partner_associations')
          .select('id, virtual_account_id, commission_type, commission_value, responsible_for_refunds, responsible_for_chargebacks, partner_type')
          .eq('organization_id', organizationId)
          .eq('affiliate_code', affiliate_code)
          .eq('is_active', true);
        
        // Prefer partner linked to this asset
        if (linkedColumn && linkedId) {
          partnerQuery = partnerQuery.eq(linkedColumn, linkedId);
        }
        
        const { data: linkedPartner } = await partnerQuery.maybeSingle();
        
        // If not found linked, try general partner (no links)
        let partner = linkedPartner;
        if (!partner && affiliate_code) {
          const { data: generalPartner } = await supabase
            .from('partner_associations')
            .select('id, virtual_account_id, commission_type, commission_value, responsible_for_refunds, responsible_for_chargebacks, partner_type')
            .eq('organization_id', organizationId)
            .eq('affiliate_code', affiliate_code)
            .eq('is_active', true)
            .is('linked_checkout_id', null)
            .is('linked_landing_id', null)
            .is('linked_storefront_id', null)
            .is('linked_quiz_id', null)
            .maybeSingle();
          partner = generalPartner;
        }
        
        if (partner) {
          affiliatePartnerId = partner.id;
          affiliateVirtualAccountId = partner.virtual_account_id;
          affiliateCommissionType = partner.commission_type || 'percentage';
          affiliateCommissionValue = Number(partner.commission_value) || 10;
          affiliateLiableRefund = partner.responsible_for_refunds ?? true;
          affiliateLiableChargeback = partner.responsible_for_chargebacks ?? true;
          console.log(`[Checkout] Found legacy partner ${affiliate_code}: type=${partner.partner_type}, commission=${affiliateCommissionValue}${affiliateCommissionType === 'percentage' ? '%' : 'c'}`);
        }
      }
    }

    // 5. Create lead address if shipping data exists
    let shippingAddressId: string | null = null;
    if (body.shipping?.address && body.shipping?.city) {
      const { data: leadAddress } = await supabase
        .from('lead_addresses')
        .insert({
          lead_id: lead.id,
          organization_id: organizationId,
          label: 'Entrega',
          is_primary: true,
          street: body.shipping.address,
          neighborhood: body.shipping.neighborhood || null,
          city: body.shipping.city,
          state: body.shipping.state,
          cep: body.shipping.zip,
          complement: body.shipping.complement || null,
        })
        .select('id')
        .single();
      
      if (leadAddress) {
        shippingAddressId = leadAddress.id;
        console.log(`[Checkout] Created lead_address ${shippingAddressId} for lead ${lead.id}`);
      }
    }

    // 6. Create sale in payment_pending status with UTM attribution
    const salePayload: Record<string, unknown> = {
      organization_id: organizationId,
      lead_id: lead.id,
      created_by: defaultUserId,
      status: 'payment_pending',
      payment_status: 'pending',
      subtotal_cents: subtotalCents,
      shipping_cost_cents: shippingCents,
      total_cents: totalCents,
      payment_method: payment_method,
      payment_notes: `Checkout via ${storefront_id ? 'loja' : landing_page_id ? 'landing page' : 'standalone checkout'}`,
      src: utm?.src || null,
      utm_source: utm?.utm_source || null,
      utm_medium: utm?.utm_medium || null,
      utm_campaign: utm?.utm_campaign || null,
      utm_term: utm?.utm_term || null,
      utm_content: utm?.utm_content || null,
      fbclid: utm?.fbclid || null,
      gclid: utm?.gclid || null,
      ttclid: utm?.ttclid || null,
    };

    // Add shipping address reference if we created one
    if (shippingAddressId) {
      salePayload.shipping_address_id = shippingAddressId;
    }

    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .insert(salePayload)
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
    // Store code_or_ref for the split engine to find the affiliate
    if ((affiliatePartnerId || affiliateNetworkMemberId) && affiliate_code) {
      const { error: attrError } = await supabase
        .from('affiliate_attributions')
        .insert({
          sale_id: sale.id,
          organization_id: organizationId,
          affiliate_id: null, // Deprecated
          attribution_type: affiliateNetworkMemberId ? 'network' : 'ref',
          code_or_ref: affiliate_code,
        });
      
      if (attrError) {
        console.error('Failed to create affiliate attribution:', attrError);
      }

      console.log(`[Checkout] Attribution created for ${affiliateNetworkMemberId ? 'network affiliate' : 'partner'} ${affiliate_code}`);
    }

    // 8. Create ecommerce_order record for the Vendas Online panel
    const orderNumber = `ORD-${Date.now().toString(36).toUpperCase()}`;
    const { data: orderData } = await supabase
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
        shipping_number: body.shipping?.number || null,
        shipping_neighborhood: body.shipping?.neighborhood || null,
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
        affiliate_id: affiliatePartnerId || null, // Now stores partner_association.id
        payment_method: payment_method,
      })
      .select('id')
      .single();

    // 8b. Create ecommerce_order_items for product visibility
    if (orderData?.id && productItems.length > 0) {
      for (const item of productItems) {
        const productInfo = productMap[item.product_id] || {};
        await supabase
          .from('ecommerce_order_items')
          .insert({
            order_id: orderData.id,
            product_id: item.product_id,
            product_name: productInfo.name || 'Produto',
            product_image_url: productInfo.image_url || null,
            quantity: item.quantity,
            unit_price_cents: item.price_cents,
            total_cents: item.price_cents * item.quantity,
          });
      }
    }

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
          number: body.shipping.number,
          neighborhood: body.shipping.neighborhood,
          city: body.shipping.city,
          state: body.shipping.state,
          zip_code: body.shipping.zip,
          complement: body.shipping.complement,
        } : undefined,
      },
      postback_url: `${supabaseUrl}/functions/v1/payment-webhook`,
      card_token: body.card_token,
      card_hash: body.card_hash,
      // Map frontend field names to backend CardData interface
      card_data: body.card_data ? {
        number: (body.card_data as unknown as { card_number?: string }).card_number || (body.card_data as CardData).number || '',
        holder_name: (body.card_data as unknown as { card_holder_name?: string }).card_holder_name || (body.card_data as CardData).holder_name || '',
        exp_month: (body.card_data as unknown as { card_expiration_month?: string }).card_expiration_month || (body.card_data as CardData).exp_month || '',
        exp_year: (body.card_data as unknown as { card_expiration_year?: string }).card_expiration_year || (body.card_data as CardData).exp_year || '',
        cvv: (body.card_data as unknown as { card_cvv?: string }).card_cvv || (body.card_data as CardData).cvv || '',
      } as CardData : undefined,
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
