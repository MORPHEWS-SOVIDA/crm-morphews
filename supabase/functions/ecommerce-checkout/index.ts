import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CheckoutRequest {
  cart_id?: string;
  storefront_id?: string;
  landing_page_id?: string;
  offer_id?: string;
  items?: { product_id: string; quantity: number; price_cents: number }[];
  customer: {
    name: string;
    email: string;
    phone: string;
    document?: string;
  };
  shipping?: {
    address: string;
    city: string;
    state: string;
    zip: string;
    complement?: string;
  };
  payment_method: 'pix' | 'credit_card' | 'boleto';
  installments?: number;
  gateway: 'pagarme' | 'appmax' | 'stripe';
  affiliate_code?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: CheckoutRequest = await req.json();
    const { customer, items, payment_method, gateway, affiliate_code, storefront_id, landing_page_id, offer_id, cart_id } = body;

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

      // If offer_id is provided, get offer details
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

    // 5. Get gateway credentials
    const { data: gatewayConfig } = await supabase
      .from('payment_gateways')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('gateway_type', gateway)
      .eq('is_active', true)
      .maybeSingle();

    if (!gatewayConfig) {
      throw new Error(`Gateway ${gateway} não configurado para esta organização`);
    }

    // 6. Create sale in pending status
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
        notes: `Checkout via ${gateway} - ${payment_method}`,
      })
      .select('id')
      .single();

    if (saleError) throw saleError;

    // 7. Create sale items
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

    // 8. Store affiliate reference if exists
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

    // 10. Generate payment based on gateway
    let paymentUrl = '';
    let paymentData: Record<string, unknown> = {};

    if (gateway === 'pagarme') {
      paymentData = await createPagarmeTransaction(gatewayConfig, {
        amount: totalCents,
        customer,
        payment_method,
        installments: body.installments || 1,
        sale_id: sale.id,
        postback_url: `${supabaseUrl}/functions/v1/pagarme-webhook`,
      });
      paymentUrl = (paymentData as any).payment_url || '';
    } else if (gateway === 'appmax') {
      paymentData = await createAppmaxTransaction(gatewayConfig, {
        amount: totalCents,
        customer,
        payment_method,
        installments: body.installments || 1,
        sale_id: sale.id,
        postback_url: `${supabaseUrl}/functions/v1/appmax-webhook`,
      });
      paymentUrl = (paymentData as any).payment_url || '';
    }

    // 11. Update sale with payment reference
    await supabase
      .from('sales')
      .update({
        notes: `${gateway.toUpperCase()} ID: ${(paymentData as any).transaction_id || 'pending'}`,
      })
      .eq('id', sale.id);

    return new Response(
      JSON.stringify({
        success: true,
        sale_id: sale.id,
        payment_url: paymentUrl,
        payment_data: paymentData,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error('Checkout error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Pagarme transaction creator
async function createPagarmeTransaction(
  config: { api_key_encrypted: string; is_sandbox: boolean },
  data: {
    amount: number;
    customer: { name: string; email: string; phone: string; document?: string };
    payment_method: string;
    installments: number;
    sale_id: string;
    postback_url: string;
  }
) {
  const apiKey = config.api_key_encrypted; // TODO: Decrypt
  const baseUrl = config.is_sandbox
    ? 'https://api.pagar.me/1'
    : 'https://api.pagar.me/1';

  // For PIX, create PIX transaction
  if (data.payment_method === 'pix') {
    const response = await fetch(`${baseUrl}/transactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: apiKey,
        amount: data.amount,
        payment_method: 'pix',
        pix_expiration_date: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 min
        customer: {
          external_id: data.sale_id,
          name: data.customer.name,
          email: data.customer.email,
          type: 'individual',
          country: 'br',
          phone_numbers: [`+55${data.customer.phone}`],
          documents: data.customer.document ? [{
            type: 'cpf',
            number: data.customer.document.replace(/\D/g, ''),
          }] : undefined,
        },
        postback_url: data.postback_url,
        metadata: {
          sale_id: data.sale_id,
        },
      }),
    });

    const result = await response.json();
    
    return {
      transaction_id: result.id,
      payment_url: result.pix_qr_code,
      pix_code: result.pix_qr_code,
      pix_expiration: result.pix_expiration_date,
      status: result.status,
    };
  }

  // For credit card, create checkout link
  if (data.payment_method === 'credit_card') {
    // Pagarme checkout
    const response = await fetch(`${baseUrl}/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        amount: data.amount,
        payment_method: 'credit_card',
        installments: data.installments,
        customer: {
          external_id: data.sale_id,
          name: data.customer.name,
          email: data.customer.email,
          type: 'individual',
          country: 'br',
          phone_numbers: [`+55${data.customer.phone}`],
        },
        postback_url: data.postback_url,
        metadata: { sale_id: data.sale_id },
      }),
    });

    const result = await response.json();
    return {
      transaction_id: result.id,
      payment_url: result.checkout_url || '',
      status: result.status,
    };
  }

  // For boleto
  if (data.payment_method === 'boleto') {
    const response = await fetch(`${baseUrl}/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        amount: data.amount,
        payment_method: 'boleto',
        boleto_expiration_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days
        customer: {
          external_id: data.sale_id,
          name: data.customer.name,
          email: data.customer.email,
          type: 'individual',
          country: 'br',
          phone_numbers: [`+55${data.customer.phone}`],
        },
        postback_url: data.postback_url,
        metadata: { sale_id: data.sale_id },
      }),
    });

    const result = await response.json();
    return {
      transaction_id: result.id,
      payment_url: result.boleto_url,
      boleto_barcode: result.boleto_barcode,
      boleto_expiration: result.boleto_expiration_date,
      status: result.status,
    };
  }

  throw new Error('Método de pagamento não suportado');
}

// Appmax transaction creator
async function createAppmaxTransaction(
  config: { api_key_encrypted: string; api_secret_encrypted: string; is_sandbox: boolean },
  data: {
    amount: number;
    customer: { name: string; email: string; phone: string; document?: string };
    payment_method: string;
    installments: number;
    sale_id: string;
    postback_url: string;
  }
) {
  const apiKey = config.api_key_encrypted; // TODO: Decrypt
  const baseUrl = config.is_sandbox
    ? 'https://sandbox.appmax.com.br/api/v3'
    : 'https://admin.appmax.com.br/api/v3';

  // Create order first
  const orderResponse = await fetch(`${baseUrl}/order`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      external_id: data.sale_id,
      customer: {
        firstname: data.customer.name.split(' ')[0],
        lastname: data.customer.name.split(' ').slice(1).join(' ') || '-',
        email: data.customer.email,
        telephone: data.customer.phone,
        cpf: data.customer.document?.replace(/\D/g, '') || '',
      },
      products: [{
        sku: 'CHECKOUT',
        name: 'Compra Online',
        qty: 1,
        price: data.amount / 100,
      }],
      postback_url: data.postback_url,
    }),
  });

  const orderResult = await orderResponse.json();

  if (!orderResult.data?.id) {
    throw new Error('Erro ao criar pedido na Appmax');
  }

  // Generate payment based on method
  let paymentEndpoint = '';
  let paymentBody: Record<string, unknown> = {
    order_id: orderResult.data.id,
  };

  if (data.payment_method === 'pix') {
    paymentEndpoint = '/pix';
  } else if (data.payment_method === 'credit_card') {
    paymentEndpoint = '/payment';
    paymentBody.installments = data.installments;
  } else if (data.payment_method === 'boleto') {
    paymentEndpoint = '/boleto';
  }

  const paymentResponse = await fetch(`${baseUrl}${paymentEndpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(paymentBody),
  });

  const paymentResult = await paymentResponse.json();

  return {
    transaction_id: orderResult.data.id,
    payment_url: paymentResult.data?.payment_url || paymentResult.data?.pix_qrcode || '',
    pix_code: paymentResult.data?.pix_code,
    boleto_url: paymentResult.data?.boleto_url,
    status: paymentResult.data?.status || 'pending',
  };
}
