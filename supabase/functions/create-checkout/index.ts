import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Generate temporary password
function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let password = '';
  for (let i = 0; i < 8; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

// Generate slug from name
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
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
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

    console.log("Plan found:", plan.name, "Price:", plan.price_cents);

    // Determine customer email
    let email = customerEmail;
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

    // ============= FREE PLAN HANDLING =============
    if (plan.price_cents === 0) {
      console.log("Processing FREE plan signup for:", email);

      // Check if user already exists
      const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
      const existingUser = existingUsers?.users?.find(u => u.email === email);
      
      if (existingUser) {
        throw new Error("Este e-mail já está cadastrado. Faça login ou use outro e-mail.");
      }

      // Generate temp password
      const tempPassword = generateTempPassword();
      
      // Create user
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          first_name: customerName?.split(' ')[0] || 'Usuário',
          last_name: customerName?.split(' ').slice(1).join(' ') || 'Novo',
        }
      });

      if (authError) {
        console.error("Error creating user:", authError);
        throw new Error("Erro ao criar usuário: " + authError.message);
      }

      const userId = authData.user.id;
      console.log("User created:", userId);

      // Create organization
      const orgName = customerName ? `${customerName.split(' ')[0]}'s Workspace` : 'Meu Workspace';
      const { data: org, error: orgError } = await supabaseAdmin
        .from('organizations')
        .insert({
          name: orgName,
          slug: generateSlug(orgName),
          owner_name: customerName || null,
          owner_email: email,
          phone: customerWhatsapp || null,
        })
        .select()
        .single();

      if (orgError) {
        console.error("Error creating organization:", orgError);
        throw new Error("Erro ao criar organização");
      }

      console.log("Organization created:", org.id);

      // Add user to organization
      await supabaseAdmin.from('organization_members').insert({
        organization_id: org.id,
        user_id: userId,
        role: 'owner',
      });

      // Update profile
      await supabaseAdmin.from('profiles').update({
        first_name: customerName?.split(' ')[0] || 'Usuário',
        last_name: customerName?.split(' ').slice(1).join(' ') || 'Novo',
        organization_id: org.id,
        email: email,
        whatsapp: customerWhatsapp?.replace(/\D/g, '') || null,
      }).eq('user_id', userId);

      // Create subscription
      await supabaseAdmin.from('subscriptions').insert({
        organization_id: org.id,
        plan_id: plan.id,
        status: 'active',
        current_period_start: new Date().toISOString(),
        current_period_end: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year
      });

      // Record temp password reset
      await supabaseAdmin.from('temp_password_resets').insert({
        user_id: userId,
        email: email,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });

      // Update interested lead if exists
      await supabaseAdmin
        .from('interested_leads')
        .update({ status: 'converted', converted_at: new Date().toISOString() })
        .eq('email', email);

      // Send welcome email
      const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
      if (RESEND_API_KEY) {
        try {
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${RESEND_API_KEY}`,
            },
            body: JSON.stringify({
              from: "Morphews CRM <noreply@morphews.com>",
              to: [email],
              subject: "🎉 Bem-vindo ao Morphews CRM - Plano Grátis!",
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <img src="https://morphews.lovable.app/images/logo-morphews-email.png" alt="Morphews" style="max-width: 150px; margin-bottom: 20px;">
                  <h1 style="color: #10b981;">Parabéns, ${customerName?.split(' ')[0] || 'você'}! 🚀</h1>
                  <p>Sua conta gratuita no Morphews CRM foi criada com sucesso!</p>
                  <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <p><strong>E-mail:</strong> ${email}</p>
                    <p><strong>Senha temporária:</strong> ${tempPassword}</p>
                  </div>
                  <p style="color: #ef4444;"><strong>⚠️ Por segurança, você deverá trocar sua senha no primeiro acesso.</strong></p>
                  <div style="margin: 30px 0;">
                    <a href="https://morphews.lovable.app/login" style="background: #10b981; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">
                      Acessar Morphews CRM
                    </a>
                  </div>
                  <p>Seu plano gratuito inclui:</p>
                  <ul>
                    <li>5 leads por mês</li>
                    <li>Secretária IA no WhatsApp</li>
                    <li>Dashboard completo</li>
                  </ul>
                  <p>Quando precisar de mais, é só fazer upgrade!</p>
                  <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
                  <p style="color: #6b7280; font-size: 12px;">Morphews CRM - Sua secretária comercial com IA</p>
                </div>
              `,
            }),
          });
          console.log("Welcome email sent to:", email);
        } catch (emailError) {
          console.error("Error sending email:", emailError);
        }
      }

      return new Response(JSON.stringify({ 
        success: true, 
        message: "Conta gratuita criada! Verifique seu e-mail.",
        redirect: "/login?signup=success"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // ============= PAID PLAN - STRIPE CHECKOUT =============
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2023-10-16",
    });

    console.log("Creating Stripe checkout for email:", email);

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
