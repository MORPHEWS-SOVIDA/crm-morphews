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
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { instanceId, couponId, discountCents, successUrl, cancelUrl } = await req.json();

    // Get auth user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Unauthorized");
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );
    
    const token = authHeader.replace("Bearer ", "");
    const { data: { user } } = await supabaseClient.auth.getUser(token);
    
    if (!user) {
      throw new Error("Unauthorized");
    }

    // Get instance details
    const { data: instance, error: instanceError } = await supabaseAdmin
      .from("whatsapp_instances")
      .select("*, organizations(owner_email, owner_name)")
      .eq("id", instanceId)
      .single();

    if (instanceError || !instance) {
      throw new Error("Instance not found");
    }

    const basePriceCents = 19700; // R$ 197
    const finalPriceCents = Math.max(0, basePriceCents - (discountCents || 0));

    // If free (coupon covers everything), activate directly
    if (finalPriceCents === 0) {
      await supabaseAdmin
        .from("whatsapp_instances")
        .update({
          status: "active",
          payment_source: "admin_grant",
        })
        .eq("id", instanceId);

      // Update coupon usage
      if (couponId) {
        await supabaseAdmin.rpc("increment_coupon_usage", { coupon_id: couponId });
      }

      return new Response(JSON.stringify({ 
        success: true, 
        message: "Instância ativada gratuitamente!",
        redirect: "/whatsapp-dms"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create Stripe checkout
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2023-10-16",
    });

    const customerEmail = instance.organizations?.owner_email || user.email;

    // Get or create Stripe customer
    const customers = await stripe.customers.list({ email: customerEmail, limit: 1 });
    let customerId: string;

    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    } else {
      const customer = await stripe.customers.create({
        email: customerEmail,
        name: instance.organizations?.owner_name || undefined,
        metadata: { 
          organization_id: instance.organization_id,
          source: "whatsapp_instance",
        },
      });
      customerId = customer.id;
    }

    // Create product for WhatsApp instance
    const product = await stripe.products.create({
      name: `WhatsApp Instance - ${instance.name}`,
      metadata: { 
        instance_id: instanceId,
        organization_id: instance.organization_id,
      },
    });

    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: finalPriceCents,
      currency: "brl",
      recurring: { interval: "month" },
    });

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [{ price: price.id, quantity: 1 }],
      mode: "subscription",
      success_url: successUrl || `${req.headers.get("origin")}/whatsapp-dms?success=true`,
      cancel_url: cancelUrl || `${req.headers.get("origin")}/whatsapp-dms`,
      metadata: {
        instance_id: instanceId,
        coupon_id: couponId || "",
        discount_cents: String(discountCents || 0),
        type: "whatsapp_instance",
      },
    });

    console.log("WhatsApp instance checkout created:", session.id);

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error creating WhatsApp checkout:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
