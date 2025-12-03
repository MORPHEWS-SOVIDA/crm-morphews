import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const { planId, successUrl, cancelUrl, customerEmail, customerName, customerWhatsapp } = await req.json();

    console.log("Create checkout request:", { planId, customerEmail, customerName });

    // Get plan details
    const { data: plan, error: planError } = await supabaseClient
      .from("subscription_plans")
      .select("*")
      .eq("id", planId)
      .single();

    if (planError || !plan) {
      console.error("Plan not found:", planError);
      throw new Error("Plan not found");
    }

    console.log("Plan found:", plan.name);

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2023-10-16",
    });

    // Determine customer email - either from quiz form or from authenticated user
    let email = customerEmail;
    
    // Check if user is authenticated
    const authHeader = req.headers.get("Authorization");
    if (authHeader && !email) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabaseClient.auth.getUser(token);
      if (user?.email) {
        email = user.email;
      }
    }

    if (!email) {
      throw new Error("Email is required");
    }

    console.log("Creating checkout for email:", email);

    // Check if customer exists in Stripe
    const customers = await stripe.customers.list({ email, limit: 1 });
    let customerId: string;

    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      console.log("Existing Stripe customer found:", customerId);
    } else {
      const customer = await stripe.customers.create({
        email,
        name: customerName || undefined,
        metadata: { 
          whatsapp: customerWhatsapp || "",
          source: "quiz_checkout",
        },
      });
      customerId = customer.id;
      console.log("New Stripe customer created:", customerId);
    }

    // Create or get price in Stripe
    let priceId = plan.stripe_price_id;

    if (!priceId) {
      console.log("Creating Stripe product and price for plan:", plan.name);
      
      // Create product and price in Stripe
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
      console.log("Stripe price created:", priceId);

      // Update plan with stripe_price_id using service role
      const supabaseAdmin = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );

      await supabaseAdmin
        .from("subscription_plans")
        .update({ stripe_price_id: priceId })
        .eq("id", plan.id);
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      success_url: successUrl || `${req.headers.get("origin")}/?subscription=success`,
      cancel_url: cancelUrl || `${req.headers.get("origin")}/planos`,
      metadata: {
        plan_id: plan.id,
        customer_email: email,
        customer_name: customerName || "",
        customer_whatsapp: customerWhatsapp || "",
      },
    });

    console.log("Checkout session created:", session.id);

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("Error creating checkout:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
