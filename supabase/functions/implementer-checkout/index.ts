import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { 
  createPagarmeSubscription,
  getOrCreatePagarmePlan,
  SubscriptionRequest 
} from "../_shared/pagarme-subscription.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CheckoutPayload {
  checkoutLinkId: string;
  customerName: string;
  customerEmail: string;
  customerWhatsapp: string;
  customerDocument: string;
  cardData?: {
    number: string;
    holder_name: string;
    exp_month: string;
    exp_year: string;
    cvv: string;
  };
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
    const { checkoutLinkId, customerName, customerEmail, customerWhatsapp, customerDocument, cardData } = payload;

    console.log("[ImplementerCheckout] Request:", { checkoutLinkId, customerEmail });

    // Validate required fields
    if (!customerDocument || customerDocument.replace(/\D/g, '').length < 11) {
      throw new Error("CPF/CNPJ é obrigatório");
    }

    if (!cardData?.number) {
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

    console.log("[ImplementerCheckout] Plan:", plan.name, "Implementation fee:", implementationFeeCents);

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

    // Get or create Pagar.me plan
    let pagarmePlanId = plan.pagarme_plan_id;

    if (!pagarmePlanId) {
      console.log("[ImplementerCheckout] Creating Pagar.me plan for:", plan.name);

      const { planId, error: planError } = await getOrCreatePagarmePlan(
        pagarmeSecretKey,
        `Morphews CRM - ${plan.name}`,
        plan.price_cents,
        'month'
      );

      if (!planId) {
        console.error("[ImplementerCheckout] Failed to create plan:", planError);
        throw new Error(planError || "Erro ao criar plano no gateway");
      }

      pagarmePlanId = planId;

      // Save plan ID for future use
      await supabaseAdmin
        .from("subscription_plans")
        .update({ pagarme_plan_id: pagarmePlanId })
        .eq("id", plan.id);

      console.log("[ImplementerCheckout] Created plan:", pagarmePlanId);
    }

    // Create subscription with Pagar.me
    const subscriptionRequest: SubscriptionRequest = {
      plan_id: pagarmePlanId,
      customer: {
        name: customerName,
        email: customerEmail,
        phone: customerWhatsapp,
        document: customerDocument,
      },
      payment_method: 'credit_card',
      card_data: cardData,
      setup_fee_cents: implementationFeeCents,
      metadata: {
        implementer_id: implementer.id,
        implementer_code: implementer.referral_code,
        checkout_link_id: checkoutLinkId,
        plan_id: plan.id,
        is_implementer_sale: 'true',
      },
    };

    console.log("[ImplementerCheckout] Creating subscription...");

    const subscriptionResult = await createPagarmeSubscription(
      pagarmeSecretKey,
      subscriptionRequest
    );

    if (!subscriptionResult.success) {
      console.error("[ImplementerCheckout] Subscription failed:", subscriptionResult);
      throw new Error(subscriptionResult.error_message || "Erro ao processar pagamento");
    }

    console.log("[ImplementerCheckout] Subscription created:", subscriptionResult.subscription_id);

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
    const { data: newSubscription, error: subError } = await supabaseAdmin
      .from("subscriptions")
      .insert({
        organization_id: newOrg.id,
        plan_id: plan.id,
        status: 'active',
        payment_provider: 'pagarme',
        payment_provider_subscription_id: subscriptionResult.subscription_id,
        payment_provider_customer_id: subscriptionResult.customer_id,
        current_period_end: subscriptionResult.current_period_end,
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
        subscription_id: newSubscription?.id,
        checkout_link_id: checkoutLinkId,
        implementation_fee_cents: implementationFeeCents,
        monthly_value_cents: plan.price_cents,
        status: 'active',
        gateway_subscription_id: subscriptionResult.subscription_id,
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
          sale_id: null, // Not a regular sale
          commission_type: 'implementation',
          gross_amount_cents: implementationFeeCents,
          net_amount_cents: implementerImplShare,
          platform_share_cents: implementationFeeCents - implementerImplShare,
          status: 'pending',
        });
    }

    // First month commission: 40% of subscription
    const firstMonthCommission = Math.round(plan.price_cents * 0.40);
    await supabaseAdmin
      .from("implementer_commissions")
      .insert({
        implementer_id: implementer.id,
        sale_id: null,
        commission_type: 'first_month',
        gross_amount_cents: plan.price_cents,
        net_amount_cents: firstMonthCommission,
        platform_share_cents: plan.price_cents - firstMonthCommission,
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
      subscription_id: subscriptionResult.subscription_id,
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
