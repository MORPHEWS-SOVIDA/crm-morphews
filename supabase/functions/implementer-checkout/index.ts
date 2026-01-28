import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@17.7.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Evolution API configuration for WhatsApp
const EVOLUTION_API_URL = Deno.env.get('EVOLUTION_API_URL');
const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY');
const EVOLUTION_INSTANCE_NAME = Deno.env.get('EVOLUTION_INSTANCE_NAME');

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

    const { checkoutLinkId, customerName, customerEmail, customerWhatsapp } = await req.json();

    console.log("Implementer checkout request:", { checkoutLinkId, customerEmail });

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

    console.log("Processing checkout for plan:", plan.name, "with implementation fee:", implementationFeeCents);

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

    // Create Stripe checkout session
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2023-10-16",
    });

    // Get or create Stripe customer
    const customers = await stripe.customers.list({ email: customerEmail, limit: 1 });
    let customerId: string;

    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    } else {
      const customer = await stripe.customers.create({
        email: customerEmail,
        name: customerName || undefined,
        metadata: { 
          whatsapp: customerWhatsapp || "",
          source: "implementer_checkout",
          implementer_code: implementer.referral_code,
          checkout_link_id: checkoutLinkId,
        },
      });
      customerId = customer.id;
    }

    // Get or create price for the plan
    let priceId = plan.stripe_price_id;

    if (!priceId) {
      console.log("Creating Stripe product and price for plan:", plan.name);
      
      const product = await stripe.products.create({
        name: `Morphews CRM - ${plan.name}`,
        metadata: { plan_id: plan.id },
      });

      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: plan.price_cents,
        currency: "brl",
        recurring: { interval: "month" },
      });

      priceId = price.id;

      await supabaseAdmin
        .from("subscription_plans")
        .update({ stripe_price_id: priceId })
        .eq("id", plan.id);
    }

    // Build line items
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
      { price: priceId, quantity: 1 },
    ];

    // Add implementation fee as one-time charge if present
    if (implementationFeeCents > 0) {
      const implementationProduct = await stripe.products.create({
        name: "Taxa de Implementação",
        metadata: { 
          type: "implementation_fee",
          implementer_id: implementer.id,
        },
      });

      const implementationPrice = await stripe.prices.create({
        product: implementationProduct.id,
        unit_amount: implementationFeeCents,
        currency: "brl",
      });

      lineItems.push({
        price: implementationPrice.id,
        quantity: 1,
      });
    }

    // Create checkout session
    const appOrigin = req.headers.get("origin") || "https://crm.morphews.com";
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: lineItems,
      mode: "subscription",
      success_url: `${appOrigin}/login?subscription=success&implementer=true`,
      cancel_url: `${appOrigin}/implementador/${checkoutLink.slug}`,
      metadata: {
        plan_id: plan.id,
        customer_email: customerEmail,
        customer_name: customerName || "",
        customer_whatsapp: customerWhatsapp || "",
        implementer_id: implementer.id,
        checkout_link_id: checkoutLinkId,
        implementation_fee_cents: implementationFeeCents.toString(),
        is_implementer_sale: "true",
      },
    });

    console.log("Checkout session created:", session.id);

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("Error creating implementer checkout:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
