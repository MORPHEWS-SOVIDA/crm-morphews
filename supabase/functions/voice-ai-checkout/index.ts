import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import Stripe from "https://esm.sh/stripe@14.21.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface CheckoutRequest {
  packageId: string;
  organizationId: string;
  successUrl?: string;
  cancelUrl?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");

    if (!stripeSecretKey) {
      return new Response(
        JSON.stringify({ error: "Stripe não configurado" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const stripe = new Stripe(stripeSecretKey, { apiVersion: "2023-10-16" });

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { packageId, organizationId, successUrl, cancelUrl }: CheckoutRequest = await req.json();

    if (!packageId || !organizationId) {
      return new Response(
        JSON.stringify({ error: "packageId e organizationId são obrigatórios" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Fetch package details from database (server-side validation)
    const { data: voicePackage, error: packageError } = await supabase
      .from("voice_minutes_packages")
      .select("id, name, minutes, price_cents, description, is_active")
      .eq("id", packageId)
      .eq("is_active", true)
      .single();

    if (packageError || !voicePackage) {
      console.error("Package error:", packageError);
      return new Response(
        JSON.stringify({ error: "Pacote não encontrado ou inativo" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Verify user has access to organization
    const { data: membership } = await supabase
      .from("organization_members")
      .select("id")
      .eq("user_id", user.id)
      .eq("organization_id", organizationId)
      .single();

    if (!membership) {
      return new Response(
        JSON.stringify({ error: "Acesso negado à organização" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get organization name for metadata
    const { data: org } = await supabase
      .from("organizations")
      .select("name")
      .eq("id", organizationId)
      .single();

    // Create Stripe checkout session with server-validated price
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "brl",
            product_data: {
              name: `Voice AI - ${voicePackage.name}`,
              description: `${voicePackage.minutes} minutos de ligações com IA`,
            },
            unit_amount: voicePackage.price_cents, // Server-side price
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: successUrl || `${req.headers.get("origin")}/voice-ai?success=true`,
      cancel_url: cancelUrl || `${req.headers.get("origin")}/voice-ai?canceled=true`,
      metadata: {
        type: "voice_minutes",
        package_id: voicePackage.id,
        minutes: voicePackage.minutes.toString(),
        price_cents: voicePackage.price_cents.toString(),
        organization_id: organizationId,
        organization_name: org?.name || "",
        user_id: user.id,
      },
      customer_email: user.email,
    });

    console.log("Voice AI checkout session created:", {
      sessionId: session.id,
      packageId: voicePackage.id,
      minutes: voicePackage.minutes,
      priceCents: voicePackage.price_cents,
      organizationId,
    });

    return new Response(
      JSON.stringify({ url: session.url, sessionId: session.id }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Voice AI checkout error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
