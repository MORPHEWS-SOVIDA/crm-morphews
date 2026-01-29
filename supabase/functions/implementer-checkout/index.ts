import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CardData {
  card_number: string;
  card_holder_name: string;
  card_expiration_month: string;
  card_expiration_year: string;
  card_cvv: string;
  installments: number;
  total_with_interest?: number;
}

interface CheckoutPayload {
  checkoutLinkId: string;
  customerName: string;
  customerEmail: string;
  customerWhatsapp?: string;
  customerDocument: string;
  paymentMethod: 'credit_card' | 'pix' | 'boleto';
  cardData?: CardData;
}

function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let password = '';
  for (let i = 0; i < 8; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

function generateSlug(name: string): string {
  const base = name.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .substring(0, 30);
  const random = Math.random().toString(36).substring(2, 6);
  return `${base}-${random}`;
}

async function createPagarmeOrder(
  apiKey: string,
  amount: number,
  customer: {
    name: string;
    email: string;
    document: string;
    phone?: string;
  },
  paymentMethod: 'credit_card' | 'pix' | 'boleto',
  cardData?: CardData,
  metadata?: Record<string, string>
) {
  const cleanDocument = customer.document.replace(/\D/g, '');
  const documentType = cleanDocument.length > 11 ? 'CNPJ' : 'CPF';
  
  // Build payment object based on method
  let payment: any;
  
  if (paymentMethod === 'credit_card' && cardData) {
    payment = {
      payment_method: 'credit_card',
      credit_card: {
        installments: cardData.installments || 1,
        statement_descriptor: 'MORPHEWS CRM',
        card: {
          number: cardData.card_number.replace(/\D/g, ''),
          holder_name: cardData.card_holder_name,
          exp_month: parseInt(cardData.card_expiration_month),
          exp_year: parseInt(cardData.card_expiration_year),
          cvv: cardData.card_cvv,
          billing_address: {
            line_1: 'N/A, 0, N/A',
            zip_code: '01310100',
            city: 'Sao Paulo',
            state: 'SP',
            country: 'BR',
          },
        },
      },
    };
  } else if (paymentMethod === 'pix') {
    payment = {
      payment_method: 'pix',
      pix: {
        expires_in: 3600, // 1 hour
      },
    };
  } else if (paymentMethod === 'boleto') {
    payment = {
      payment_method: 'boleto',
      boleto: {
        instructions: 'Pagar até o vencimento',
        due_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days
      },
    };
  }

  const orderPayload = {
    customer: {
      name: customer.name,
      email: customer.email,
      document: cleanDocument,
      type: documentType === 'CPF' ? 'individual' : 'company',
      document_type: documentType,
      phones: customer.phone ? {
        mobile_phone: {
          country_code: '55',
          area_code: customer.phone.replace(/\D/g, '').substring(0, 2),
          number: customer.phone.replace(/\D/g, '').substring(2),
        },
      } : undefined,
    },
    items: [
      {
        amount,
        description: 'Assinatura Morphews CRM + Implementação',
        quantity: 1,
        code: 'implementer-checkout',
      },
    ],
    payments: [payment],
    metadata,
    closed: true,
  };

  console.log('[PagarmeOrder] Creating order:', JSON.stringify(orderPayload, null, 2));

  const response = await fetch('https://api.pagar.me/core/v5/orders', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${btoa(apiKey + ':')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(orderPayload),
  });

  const result = await response.json();

  if (!response.ok) {
    console.error('[PagarmeOrder] Error:', result);
    return {
      success: false,
      error: result.message || result.errors?.[0]?.message || 'Erro no gateway de pagamento',
    };
  }

  console.log('[PagarmeOrder] Success:', result.id, result.status);

  // Extract payment-specific data
  const charge = result.charges?.[0];
  const lastTransaction = charge?.last_transaction;

  return {
    success: true,
    order_id: result.id,
    status: result.status,
    charge_id: charge?.id,
    pix: paymentMethod === 'pix' && lastTransaction ? {
      qr_code: lastTransaction.qr_code,
      qr_code_url: lastTransaction.qr_code_url,
      expires_at: lastTransaction.expires_at,
    } : undefined,
    boleto: paymentMethod === 'boleto' && lastTransaction ? {
      url: lastTransaction.url,
      barcode: lastTransaction.barcode,
      due_at: lastTransaction.due_at,
    } : undefined,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const payload: CheckoutPayload = await req.json();
    const { 
      checkoutLinkId, 
      customerName, 
      customerEmail, 
      customerWhatsapp, 
      customerDocument, 
      paymentMethod,
      cardData 
    } = payload;

    console.log("[ImplementerCheckout] Request:", { checkoutLinkId, customerEmail, paymentMethod });

    // Validate required fields
    const cleanDocument = customerDocument?.replace(/\D/g, '') || '';
    if (cleanDocument.length < 11) {
      throw new Error("CPF/CNPJ é obrigatório");
    }

    if (paymentMethod === 'credit_card' && !cardData?.card_number) {
      throw new Error("Dados do cartão são obrigatórios");
    }

    // Fetch checkout link with implementer and plan data
    const { data: checkoutLink, error: linkError } = await supabaseAdmin
      .from("implementer_checkout_links")
      .select(`
        *,
        implementer:implementers!implementer_id(*),
        plan:subscription_plans!plan_id(*)
      `)
      .eq("id", checkoutLinkId)
      .eq("is_active", true)
      .single();

    if (linkError || !checkoutLink) {
      console.error("Checkout link not found:", linkError);
      throw new Error("Link de checkout inválido ou inativo");
    }

    const plan = checkoutLink.plan;
    const implementer = checkoutLink.implementer;
    const implementationFeeCents = checkoutLink.implementation_fee_cents || 0;
    const totalAmount = plan.price_cents + implementationFeeCents;

    console.log("[ImplementerCheckout] Plan:", plan.name, "Total:", totalAmount);

    // Check if implementer has active subscription
    const { data: implementerSub } = await supabaseAdmin
      .from("subscriptions")
      .select("status")
      .eq("organization_id", implementer.organization_id)
      .eq("status", "active")
      .maybeSingle();

    if (!implementerSub) {
      throw new Error("Implementador sem assinatura ativa. Contate o implementador.");
    }

    // Check if email already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email === customerEmail);
    
    if (existingUser) {
      throw new Error("Este e-mail já está cadastrado. Faça login ou use outro e-mail.");
    }

    // Get Pagar.me API key from platform gateway config
    const { data: gatewayConfig } = await supabaseAdmin
      .from("platform_gateway_config")
      .select("api_key_encrypted")
      .eq("gateway_type", "pagarme")
      .eq("is_active", true)
      .maybeSingle();

    if (!gatewayConfig?.api_key_encrypted) {
      console.error("Pagar.me gateway not configured");
      throw new Error("Gateway de pagamento não configurado");
    }

    const pagarmeSecretKey = gatewayConfig.api_key_encrypted;

    // Calculate final amount (with interest if applicable)
    let finalAmount = totalAmount;
    if (paymentMethod === 'credit_card' && cardData?.total_with_interest) {
      finalAmount = cardData.total_with_interest;
    }

    // Create order with Pagar.me
    const orderResult = await createPagarmeOrder(
      pagarmeSecretKey,
      finalAmount,
      {
        name: customerName,
        email: customerEmail,
        document: cleanDocument,
        phone: customerWhatsapp,
      },
      paymentMethod,
      cardData,
      {
        implementer_id: implementer.id,
        implementer_code: implementer.referral_code,
        checkout_link_id: checkoutLinkId,
        plan_id: plan.id,
        is_implementer_sale: 'true',
        implementation_fee_cents: String(implementationFeeCents),
        plan_price_cents: String(plan.price_cents),
      }
    );

    if (!orderResult.success) {
      throw new Error(orderResult.error || "Erro ao processar pagamento");
    }

    console.log("[ImplementerCheckout] Order created:", orderResult.order_id, orderResult.status);

    // For PIX and Boleto, store pending order and return payment info
    if (paymentMethod === 'pix' || paymentMethod === 'boleto') {
      // Store pending checkout for webhook processing
      await supabaseAdmin
        .from("implementer_pending_checkouts")
        .upsert({
          id: orderResult.order_id,
          checkout_link_id: checkoutLinkId,
          customer_name: customerName,
          customer_email: customerEmail,
          customer_whatsapp: customerWhatsapp || null,
          customer_document: cleanDocument,
          payment_method: paymentMethod,
          total_amount_cents: finalAmount,
          status: 'pending',
          created_at: new Date().toISOString(),
        });

      return new Response(JSON.stringify({
        success: false, // Not complete yet
        order_id: orderResult.order_id,
        pix: orderResult.pix,
        boleto: orderResult.boleto,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // For credit card, check if payment was approved
    if (orderResult.status !== 'paid') {
      throw new Error("Pagamento não aprovado. Verifique os dados do cartão.");
    }

    // =========================================================
    // PAYMENT SUCCESS - Create user, organization, subscription
    // =========================================================

    const tempPassword = generateTempPassword();
    const orgName = `Empresa de ${customerName.split(' ')[0]}`;
    const orgSlug = generateSlug(orgName);

    // 1. Create auth user
    const { data: newUser, error: userError } = await supabaseAdmin.auth.admin.createUser({
      email: customerEmail,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        full_name: customerName,
        phone: customerWhatsapp,
        source: 'implementer_checkout',
      },
    });

    if (userError || !newUser.user) {
      console.error("[ImplementerCheckout] User creation failed:", userError);
      throw new Error("Erro ao criar usuário: " + (userError?.message || "Erro desconhecido"));
    }

    console.log("[ImplementerCheckout] User created:", newUser.user.id);

    // 2. Create organization
    const { data: newOrg, error: orgError } = await supabaseAdmin
      .from("organizations")
      .insert({
        name: orgName,
        slug: orgSlug,
        owner_id: newUser.user.id,
        settings: { created_via: 'implementer_checkout' },
      })
      .select()
      .single();

    if (orgError || !newOrg) {
      console.error("[ImplementerCheckout] Organization creation failed:", orgError);
      throw new Error("Erro ao criar organização");
    }

    console.log("[ImplementerCheckout] Organization created:", newOrg.id);

    // 3. Create profile
    await supabaseAdmin
      .from("profiles")
      .insert({
        user_id: newUser.user.id,
        email: customerEmail,
        full_name: customerName,
        organization_id: newOrg.id,
        role: 'admin',
        phone: customerWhatsapp,
      });

    // 4. Create subscription record
    const currentPeriodEnd = new Date();
    currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1);

    const { data: newSubscription, error: subError } = await supabaseAdmin
      .from("subscriptions")
      .insert({
        organization_id: newOrg.id,
        plan_id: plan.id,
        status: 'active',
        payment_provider: 'pagarme',
        payment_provider_subscription_id: orderResult.order_id,
        payment_provider_customer_id: orderResult.order_id,
        current_period_end: currentPeriodEnd.toISOString(),
      })
      .select()
      .single();

    if (subError) {
      console.error("[ImplementerCheckout] Subscription record failed:", subError);
    }

    // 5. Link to implementer (implementer_sales)
    const { error: saleError } = await supabaseAdmin
      .from("implementer_sales")
      .insert({
        implementer_id: implementer.id,
        client_organization_id: newOrg.id,
        plan_id: plan.id,
        client_subscription_id: newSubscription?.id,
        implementation_fee_cents: implementationFeeCents,
        first_payment_cents: finalAmount,
        status: 'active',
      });

    if (saleError) {
      console.error("[ImplementerCheckout] Implementer sale record failed:", saleError);
    }

    // 6. Calculate and create commissions
    // Implementation fee: 88% to implementer, 12% to platform
    if (implementationFeeCents > 0) {
      const implementerImplShare = Math.round(implementationFeeCents * 0.88);
      
      await supabaseAdmin
        .from("implementer_commissions")
        .insert({
          implementer_id: implementer.id,
          implementer_sale_id: null,
          commission_type: 'implementation_fee',
          gross_amount_cents: implementationFeeCents,
          net_amount_cents: implementerImplShare,
          platform_fee_cents: implementationFeeCents - implementerImplShare,
          status: 'pending',
        });
    }

    // First month commission: 40% of subscription
    const firstMonthCommission = Math.round(plan.price_cents * 0.40);
    await supabaseAdmin
      .from("implementer_commissions")
      .insert({
        implementer_id: implementer.id,
        implementer_sale_id: null,
        commission_type: 'first_month',
        gross_amount_cents: plan.price_cents,
        net_amount_cents: firstMonthCommission,
        platform_fee_cents: plan.price_cents - firstMonthCommission,
        status: 'pending',
      });

    // Update implementer totals
    await supabaseAdmin.rpc('increment_implementer_totals', {
      p_implementer_id: implementer.id,
      p_earnings_cents: (implementationFeeCents > 0 ? Math.round(implementationFeeCents * 0.88) : 0) + firstMonthCommission,
      p_clients_count: 1,
    });

    // 7. Send welcome notification (WhatsApp)
    try {
      const EVOLUTION_API_URL = Deno.env.get('EVOLUTION_API_URL');
      const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY');
      const EVOLUTION_INSTANCE_NAME = Deno.env.get('EVOLUTION_INSTANCE_NAME');

      if (EVOLUTION_API_URL && EVOLUTION_API_KEY && EVOLUTION_INSTANCE_NAME && customerWhatsapp) {
        const whatsappNumber = customerWhatsapp.replace(/\D/g, '');
        const message = `🎉 *Bem-vindo ao Morphews CRM!*\n\nSua conta foi criada com sucesso!\n\n📧 E-mail: ${customerEmail}\n🔑 Senha temporária: ${tempPassword}\n\nAcesse: https://crm.morphews.com\n\nSe precisar de ajuda, entre em contato com seu implementador ${implementer.referral_code}.`;

        await fetch(`${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE_NAME}`, {
          method: 'POST',
          headers: {
            'apikey': EVOLUTION_API_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            number: whatsappNumber,
            text: message,
          }),
        });

        console.log("[ImplementerCheckout] WhatsApp welcome sent");
      }
    } catch (whatsappError) {
      console.error("[ImplementerCheckout] WhatsApp send failed:", whatsappError);
    }

    console.log("[ImplementerCheckout] Complete! User:", customerEmail, "Org:", newOrg.id);

    return new Response(JSON.stringify({ 
      success: true,
      order_id: orderResult.order_id,
      organization_id: newOrg.id,
      redirect_url: '/login?subscription=success&implementer=true',
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("[ImplementerCheckout] Error:", errorMessage);
    
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
