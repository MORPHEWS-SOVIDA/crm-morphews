// Edge function for checkout processing - v2
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "npm:stripe@14.21.0";
import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
// Evolution API configuration for WhatsApp
const EVOLUTION_API_URL = Deno.env.get('EVOLUTION_API_URL');
const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY');
const EVOLUTION_INSTANCE_NAME = Deno.env.get('EVOLUTION_INSTANCE_NAME');

function normalizeWhatsApp(phone: string | null | undefined): string | null {
  if (!phone) return null;

  let clean = phone.replace(/\D/g, '');
  if (!clean) return null;
  if (!clean.startsWith('55')) clean = `55${clean}`;

  if (clean.length === 12 && clean.startsWith('55')) {
    clean = clean.slice(0, 4) + '9' + clean.slice(4);
  }

  return clean;
}

async function getAdminWhatsAppConfig() {
  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data, error } = await supabaseAdmin
      .from('system_settings')
      .select('value')
      .eq('key', 'admin_whatsapp_instance')
      .maybeSingle();

    if (error || !data?.value) return null;

    const config = data.value as {
      api_url?: string;
      api_key?: string;
      instance_name?: string;
    };

    if (!config.api_url || !config.api_key || !config.instance_name) return null;

    return {
      api_url: String(config.api_url).replace(/\/$/, ''),
      api_key: String(config.api_key),
      instance_name: String(config.instance_name),
    };
  } catch (error) {
    console.error('Error fetching admin WhatsApp config:', error);
    return null;
  }
}

// Generate temporary password
function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let password = '';
  for (let i = 0; i < 8; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

// Send WhatsApp welcome message via Evolution API
async function sendWhatsAppWelcome(phone: string, customerName: string, tempPassword: string) {
  const normalizedPhone = normalizeWhatsApp(phone);
  if (!normalizedPhone) {
    console.log('Invalid WhatsApp number, skipping WhatsApp message');
    return;
  }

  const adminConfig = await getAdminWhatsAppConfig();
  const apiUrl = (adminConfig?.api_url || EVOLUTION_API_URL || '').replace(/\/$/, '');
  const apiKey = adminConfig?.api_key || EVOLUTION_API_KEY || '';
  const instanceName = adminConfig?.instance_name || EVOLUTION_INSTANCE_NAME || '';

  if (!apiUrl || !apiKey || !instanceName) {
    console.log('Evolution API not configured, skipping WhatsApp message');
    return;
  }

  const url = `${apiUrl}/message/sendText/${encodeURIComponent(instanceName)}`;

  const welcomeMessage = `🎉 *Bem-vindo ao Atomic Sales, ${customerName}!*

Sua conta foi criada com sucesso! 🚀

📧 *Suas credenciais de acesso:*
Senha temporária: *${tempPassword}*

⚠️ Por segurança, você deverá trocar sua senha no primeiro acesso.

🔗 *Acesse agora:*
https://atomic.ia.br/login

━━━━━━━━━━━━━━━━━━━━━

📱 *COMO USAR O WHATSAPP:*

Você pode gerenciar seus leads por aqui! É só me mandar:

✍️ *Texto:* "Acabei de falar com Maria, nutricionista, muito interessada"

🎤 *Áudio:* Grave falando sobre o lead

📸 *Print:* Mande uma foto de conversa

Eu vou cadastrar tudo automaticamente! 🤖

━━━━━━━━━━━━━━━━━━━━━

🌟 *Dica:* Me mande agora o nome do seu primeiro lead para testar!

Qualquer dúvida, estou por aqui! 💚`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: apiKey,
      },
      body: JSON.stringify({
        number: normalizedPhone,
        text: welcomeMessage,
      }),
    });

    const result = await response.text();

    if (!response.ok) {
      console.error('WhatsApp welcome failed via Evolution:', {
        status: response.status,
        instanceName,
        result,
      });
      return;
    }

    console.log('WhatsApp welcome sent via Evolution:', {
      status: response.status,
      instanceName,
      result,
    });
  } catch (error) {
    console.error('Error sending WhatsApp welcome:', error);
  }
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
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders, status: 200 });
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

    const { planId, successUrl, cancelUrl, customerEmail, customerName, customerWhatsapp, implementerRef } = await req.json();

    console.log("Create checkout request:", { planId, customerEmail, customerName, implementerRef });

    // Look up implementer if referral code provided
    let implementerId: string | null = null;
    if (implementerRef) {
      const { data: implementer } = await supabaseAdmin
        .from("implementers")
        .select("id, is_active")
        .eq("referral_code", implementerRef)
        .eq("is_active", true)
        .maybeSingle();
      
      if (implementer) {
        // Check if implementer has active subscription
        const { data: implSub } = await supabaseAdmin
          .from("subscriptions")
          .select("status")
          .eq("organization_id", (await supabaseAdmin
            .from("implementers")
            .select("organization_id")
            .eq("id", implementer.id)
            .single()).data?.organization_id)
          .eq("status", "active")
          .maybeSingle();
        
        if (implSub) {
          implementerId = implementer.id;
          console.log("Valid implementer found:", implementerId);
        } else {
          console.log("Implementer subscription not active, ignoring referral");
        }
      } else {
        console.log("Implementer not found or inactive:", implementerRef);
      }
    }

    // Get plan details (use admin client to bypass RLS since this is public checkout)
    const { data: plan, error: planError } = await supabaseAdmin
      .from("subscription_plans")
      .select("*")
      .eq("id", planId)
      .eq("is_active", true)
      .single();

    if (planError || !plan) {
      console.error("Plan not found:", planError);
      throw new Error("Plano não encontrado ou inativo");
    }

    console.log("Plan found:", plan.name, "Price:", plan.price_cents, "Trial:", plan.trial_days, "RequiresCard:", plan.trial_requires_card);

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

      // Check if user already exists (use createUser and handle duplicate error)
      // Note: listUsers() is paginated and unreliable for existence checks

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
        if (authError.message?.includes("already been registered") || authError.message?.includes("already exists")) {
          throw new Error("Este e-mail já está cadastrado. Faça login ou use outro e-mail.");
        }
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

      // Normalize WhatsApp - always store with country code 55
      let normalizedWhatsapp = customerWhatsapp?.replace(/\D/g, '') || null;
      if (normalizedWhatsapp) {
        // Add country code if not present
        if (!normalizedWhatsapp.startsWith('55')) {
          normalizedWhatsapp = '55' + normalizedWhatsapp;
        }
        // Add 9th digit if needed (11 digits after 55 should become 13 total)
        if (normalizedWhatsapp.length === 12 && normalizedWhatsapp.startsWith('55')) {
          normalizedWhatsapp = normalizedWhatsapp.slice(0, 4) + '9' + normalizedWhatsapp.slice(4);
        }
      }

      // Update profile
      await supabaseAdmin.from('profiles').update({
        first_name: customerName?.split(' ')[0] || 'Usuário',
        last_name: customerName?.split(' ').slice(1).join(' ') || 'Novo',
        organization_id: org.id,
        email: email,
        whatsapp: normalizedWhatsapp,
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
               from: "Atomic Sales <noreply@updates.atomic.ia.br>",
              to: [email],
              subject: "🎉 Bem-vindo ao Atomic Sales - Plano Grátis!",
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <h1 style="color: #10b981;">Parabéns, ${customerName?.split(' ')[0] || 'você'}! 🚀</h1>
                  <p>Sua conta gratuita no Atomic Sales foi criada com sucesso!</p>
                  <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <p><strong>E-mail:</strong> ${email}</p>
                    <p><strong>Senha temporária:</strong> ${tempPassword}</p>
                  </div>
                  <p style="color: #ef4444;"><strong>⚠️ Por segurança, você deverá trocar sua senha no primeiro acesso.</strong></p>
                  <div style="margin: 30px 0;">
                    <a href="https://atomic.ia.br/login" style="background: #10b981; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">
                      Acessar Atomic Sales
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
                  <p style="color: #6b7280; font-size: 12px;">Atomic Sales - Sua secretária comercial com IA</p>
                </div>
              `,
            }),
          });
          console.log("Welcome email sent to:", email);
        } catch (emailError) {
          console.error("Error sending email:", emailError);
        }
      }

      // Send WhatsApp welcome message
      if (normalizedWhatsapp) {
        await sendWhatsAppWelcome(
          normalizedWhatsapp, 
          customerName?.split(' ')[0] || 'você',
          tempPassword
        );
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

    // ============= TRIAL WITHOUT CARD (NO-CARD TRIAL) =============
    // If plan has trial AND doesn't require card, create account immediately in "trialing" status
    const hasTrial = plan.trial_days && plan.trial_days > 0;
    const isNoCardTrial = hasTrial && plan.trial_requires_card === false;

    if (isNoCardTrial) {
      console.log("Processing NO-CARD TRIAL signup for:", email, "Trial days:", plan.trial_days);

      // Check if user already exists (use createUser and handle duplicate error)
      // Note: listUsers() is paginated and unreliable for existence checks

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
        if (authError.message?.includes("already been registered") || authError.message?.includes("already exists")) {
          throw new Error("Este e-mail já está cadastrado. Faça login ou use outro e-mail.");
        }
        throw new Error("Erro ao criar usuário: " + authError.message);
      }

      const userId = authData.user.id;
      console.log("Trial user created:", userId);

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

      // Normalize WhatsApp
      let normalizedWhatsapp = customerWhatsapp?.replace(/\D/g, '') || null;
      if (normalizedWhatsapp) {
        if (!normalizedWhatsapp.startsWith('55')) {
          normalizedWhatsapp = '55' + normalizedWhatsapp;
        }
        if (normalizedWhatsapp.length === 12 && normalizedWhatsapp.startsWith('55')) {
          normalizedWhatsapp = normalizedWhatsapp.slice(0, 4) + '9' + normalizedWhatsapp.slice(4);
        }
      }

      // Update profile
      await supabaseAdmin.from('profiles').update({
        first_name: customerName?.split(' ')[0] || 'Usuário',
        last_name: customerName?.split(' ').slice(1).join(' ') || 'Novo',
        organization_id: org.id,
        email: email,
        whatsapp: normalizedWhatsapp,
      }).eq('user_id', userId);

      // Calculate trial end date
      const trialStartedAt = new Date();
      const trialEndsAt = new Date(trialStartedAt.getTime() + (plan.trial_days * 24 * 60 * 60 * 1000));

      // Create subscription in TRIALING status
      await supabaseAdmin.from('subscriptions').insert({
        organization_id: org.id,
        plan_id: plan.id,
        status: 'trialing',
        current_period_start: trialStartedAt.toISOString(),
        current_period_end: trialEndsAt.toISOString(),
        trial_started_at: trialStartedAt.toISOString(),
        trial_ends_at: trialEndsAt.toISOString(),
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

      // Send trial welcome email
      const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
      if (RESEND_API_KEY) {
        try {
          const emailRes = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${RESEND_API_KEY}`,
            },
            body: JSON.stringify({
              from: "Atomic Sales <noreply@updates.atomic.ia.br>",
              to: [email],
              subject: `🎁 Seu trial de ${plan.trial_days} dias começou - ${plan.name}!`,
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                   <h1 style="color: #8b5cf6;">Seu período de teste começou! 🚀</h1>
                  <p>Olá ${customerName?.split(' ')[0] || 'você'},</p>
                  <p>Você tem <strong>${plan.trial_days} dias grátis</strong> para experimentar o plano <strong>${plan.name}</strong>!</p>
                  <div style="background: linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%); color: white; padding: 20px; border-radius: 12px; margin: 20px 0;">
                    <p style="margin: 0; font-size: 18px;">⏰ Seu trial termina em:</p>
                    <p style="margin: 8px 0 0 0; font-size: 24px; font-weight: bold;">${trialEndsAt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                  </div>
                  <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <p><strong>E-mail:</strong> ${email}</p>
                    <p><strong>Senha temporária:</strong> ${tempPassword}</p>
                  </div>
                  <p style="color: #ef4444;"><strong>⚠️ Por segurança, você deverá trocar sua senha no primeiro acesso.</strong></p>
                  <div style="margin: 30px 0;">
                     <a href="https://atomic.ia.br/login" style="background: #8b5cf6; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">
                      Começar a Usar
                    </a>
                  </div>
                  <p style="color: #6b7280;">Após o período de teste, você precisará assinar para continuar usando todas as funcionalidades.</p>
                  <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
                  <p style="color: #6b7280; font-size: 12px;">Atomic Sales - Sua secretária comercial com IA</p>
                </div>
              `,
            }),
          });
          const emailResData = await emailRes.json();
          if (!emailRes.ok) {
            console.error("Resend API error for trial email:", emailRes.status, JSON.stringify(emailResData));
          } else {
            console.log("Trial welcome email sent successfully to:", email, "Resend ID:", emailResData.id);
          }
        } catch (emailError) {
          console.error("Error sending trial email:", emailError);
        }
      }

      // Send WhatsApp welcome
      if (normalizedWhatsapp) {
        await sendWhatsAppWelcome(
          normalizedWhatsapp, 
          customerName?.split(' ')[0] || 'você',
          tempPassword
        );
      }

      return new Response(JSON.stringify({ 
        success: true, 
        message: `Trial de ${plan.trial_days} dias ativado! Verifique seu e-mail.`,
        redirect: "/login?signup=trial"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // ============= PAID PLAN WITH OR WITHOUT TRIAL (STRIPE CHECKOUT) =============
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
        name: `Atomic Sales - ${plan.name}`,
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

    // Build subscription_data with trial if applicable
    const subscriptionData: Stripe.Checkout.SessionCreateParams['subscription_data'] = {
      metadata: {
        plan_id: plan.id,
        customer_email: email,
        customer_name: customerName || "",
        customer_whatsapp: customerWhatsapp || "",
        ...(implementerId && {
          is_implementer_sale: "true",
          implementer_id: implementerId,
          implementation_fee_cents: "0",
        }),
      },
    };

    // Add trial period if plan has trial with card required
    if (hasTrial && plan.trial_requires_card === true) {
      subscriptionData.trial_period_days = plan.trial_days;
      console.log("Adding Stripe trial period:", plan.trial_days, "days");
    }

    // Create checkout session
    const appOrigin = req.headers.get("origin") || "https://atomic.ia.br";
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      success_url: successUrl || `${appOrigin}/?subscription=success`,
      cancel_url: cancelUrl || `${appOrigin}/planos`,
      subscription_data: subscriptionData,
      // Always collect payment method for card-required trials
      payment_method_collection: hasTrial && plan.trial_requires_card ? 'always' : 'always',
      metadata: {
        plan_id: plan.id,
        customer_email: email,
        customer_name: customerName || "",
        customer_whatsapp: customerWhatsapp || "",
        has_trial: hasTrial ? "true" : "false",
        trial_days: plan.trial_days?.toString() || "0",
        ...(implementerId && {
          is_implementer_sale: "true",
          implementer_id: implementerId,
          implementation_fee_cents: "0",
        }),
      },
    });

    console.log("Checkout session created:", session.id, "Trial:", hasTrial ? `${plan.trial_days} days` : "none");

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("Error creating checkout:", error);
    // Return 200 with error field so the client can read the actual error message
    // (non-2xx causes supabase SDK to return generic "Edge Function returned a non-2xx status")
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  }
});
