import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper to normalize WhatsApp numbers
function normalizeWhatsApp(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length >= 10) {
    return digits.startsWith("55") ? digits : `55${digits}`;
  }
  return null;
}

// Generate a temporary password
function generateTempPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let password = "";
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

// Generate URL-friendly slug
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .substring(0, 50);
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Allow HEAD/GET for webhook validation
  if (req.method === "HEAD" || req.method === "GET") {
    console.log("AtomicPay webhook validation request received");
    return new Response("OK", { 
      status: 200, 
      headers: { ...corsHeaders, "Content-Type": "text/plain" } 
    });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const payload = await req.json();
    console.log("AtomicPay webhook received:", JSON.stringify(payload, null, 2));

    // AtomicPay event types:
    // - purchase_approved / compra_aprovada
    // - purchase_completed / compra_concluida
    // - purchase_refused / compra_recusada
    // - trial_started / trial_iniciado
    // - pix_generated / pix_gerado
    // - cart_abandoned / carrinho_abandonado
    // - refund_requested / reembolso_solicitado
    // - refund_completed / reembolso_concluido
    // - chargeback_initiated / chargeback_iniciado
    // - chargeback_completed / chargeback_concluido
    // - subscription_canceled / assinatura_cancelada
    // - subscription_renewed / assinatura_renovada
    // - subscription_overdue / assinatura_atrasada

    const event = payload.event || payload.evento || payload.type;
    const customer = payload.customer || payload.cliente || payload.buyer || {};
    const product = payload.product || payload.produto || {};
    const subscription = payload.subscription || payload.assinatura || {};
    const transaction = payload.transaction || payload.transacao || {};

    const email = customer.email?.toLowerCase()?.trim();
    const name = customer.name || customer.nome || customer.full_name || "";
    const phone = customer.phone || customer.telefone || customer.whatsapp || "";
    const productName = product.name || product.nome || "";
    const planId = product.external_id || product.id_externo || product.metadata?.plan_id;

    console.log(`Processing AtomicPay event: ${event} for email: ${email}`);

    // Approved purchase events
    const approvedEvents = [
      "purchase_approved", 
      "compra_aprovada", 
      "purchase_completed", 
      "compra_concluida",
      "subscription_renewed",
      "assinatura_renovada"
    ];

    if (approvedEvents.includes(event)) {
      if (!email) {
        console.error("No email found in webhook payload");
        return new Response(JSON.stringify({ error: "Missing email" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Try to find existing user
      const { data: existingProfiles } = await supabaseAdmin
        .from("profiles")
        .select("id, organization_id")
        .eq("email", email)
        .limit(1);

      if (existingProfiles && existingProfiles.length > 0) {
        // User exists - update/renew subscription
        const profile = existingProfiles[0];
        console.log(`Existing user found: ${profile.id}, updating subscription`);

        if (planId && profile.organization_id) {
          const { data: plan } = await supabaseAdmin
            .from("subscription_plans")
            .select("*")
            .eq("id", planId)
            .single();

          if (plan) {
            // Calculate period end based on billing cycle
            const isAnnual = productName.toLowerCase().includes("anual") || 
                            subscription.billing_cycle === "yearly" ||
                            subscription.ciclo === "anual";
            
            const periodEnd = new Date();
            if (isAnnual) {
              periodEnd.setFullYear(periodEnd.getFullYear() + 1);
            } else {
              periodEnd.setMonth(periodEnd.getMonth() + 1);
            }

            await supabaseAdmin
              .from("subscriptions")
              .upsert({
                organization_id: profile.organization_id,
                plan_id: planId,
                status: "active",
                current_period_start: new Date().toISOString(),
                current_period_end: periodEnd.toISOString(),
                payment_provider: "atomicpay",
                external_subscription_id: transaction.id || subscription.id || null,
              }, { onConflict: "organization_id" });

            console.log(`Subscription updated for org: ${profile.organization_id}`);
          }
        }

        return new Response(JSON.stringify({ success: true, action: "subscription_updated" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // New user - create everything
      console.log(`Creating new user for email: ${email}`);

      const tempPassword = generateTempPassword();

      // Create auth user
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          full_name: name,
          source: "atomicpay",
        },
      });

      if (authError) {
        console.error("Error creating user:", authError);
        return new Response(JSON.stringify({ error: authError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const userId = authData.user.id;
      const normalizedPhone = normalizeWhatsApp(phone);
      const orgSlug = generateSlug(name || email.split("@")[0]);

      // Create organization
      const { data: org, error: orgError } = await supabaseAdmin
        .from("organizations")
        .insert({
          name: name || email.split("@")[0],
          slug: orgSlug,
          owner_email: email,
          owner_name: name,
        })
        .select()
        .single();

      if (orgError) {
        console.error("Error creating organization:", orgError);
        throw orgError;
      }

      // Add user as owner
      await supabaseAdmin.from("organization_members").insert({
        organization_id: org.id,
        user_id: userId,
        role: "owner",
      });

      // Update profile
      await supabaseAdmin
        .from("profiles")
        .update({
          full_name: name,
          whatsapp: normalizedPhone,
          organization_id: org.id,
          force_password_change: true,
        })
        .eq("id", userId);

      // Create subscription
      if (planId) {
        const { data: plan } = await supabaseAdmin
          .from("subscription_plans")
          .select("*")
          .eq("id", planId)
          .single();

        if (plan) {
          const isAnnual = productName.toLowerCase().includes("anual") || 
                          subscription.billing_cycle === "yearly" ||
                          subscription.ciclo === "anual";
          
          const periodEnd = new Date();
          if (isAnnual) {
            periodEnd.setFullYear(periodEnd.getFullYear() + 1);
          } else {
            periodEnd.setMonth(periodEnd.getMonth() + 1);
          }

          await supabaseAdmin.from("subscriptions").insert({
            organization_id: org.id,
            plan_id: planId,
            status: "active",
            current_period_start: new Date().toISOString(),
            current_period_end: periodEnd.toISOString(),
            payment_provider: "atomicpay",
            external_subscription_id: transaction.id || subscription.id || null,
          });

          // Set org energy
          await supabaseAdmin
            .from("organizations")
            .update({ monthly_energy: plan.monthly_energy || 1000 })
            .eq("id", org.id);
        }
      }

      // Send welcome email
      try {
        const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
        if (RESEND_API_KEY) {
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${RESEND_API_KEY}`,
            },
            body: JSON.stringify({
               from: "Atomic Sales <noreply@atomic.ia.br>",
              to: [email],
              subject: "🎉 Bem-vindo ao Atomic Sales!",
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <h1>Bem-vindo ao Atomic Sales!</h1>
                  <p>Olá ${name || ""},</p>
                  <p>Sua conta foi criada com sucesso! Aqui estão seus dados de acesso:</p>
                  <div style="background: #f4f4f4; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <p><strong>Email:</strong> ${email}</p>
                    <p><strong>Senha temporária:</strong> ${tempPassword}</p>
                  </div>
                  <p>Acesse agora: <a href="https://atomic.ia.br/login">https://atomic.ia.br/login</a></p>
                  <p>Você será solicitado a alterar sua senha no primeiro acesso.</p>
                  <p>Atenciosamente,<br>Equipe Atomic Sales</p>
                </div>
              `,
            }),
          });
          console.log("Welcome email sent");
        }
      } catch (emailError) {
        console.error("Error sending welcome email:", emailError);
      }

      return new Response(JSON.stringify({ 
        success: true, 
        action: "user_created",
        userId,
        organizationId: org.id,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Subscription canceled events
    const canceledEvents = [
      "subscription_canceled",
      "assinatura_cancelada",
      "refund_completed",
      "reembolso_concluido",
    ];

    if (canceledEvents.includes(event)) {
      if (email) {
        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("organization_id")
          .eq("email", email)
          .single();

        if (profile?.organization_id) {
          await supabaseAdmin
            .from("subscriptions")
            .update({ status: "canceled" })
            .eq("organization_id", profile.organization_id);

          console.log(`Subscription canceled for org: ${profile.organization_id}`);
        }
      }

      return new Response(JSON.stringify({ success: true, action: "subscription_canceled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Subscription overdue events
    const overdueEvents = [
      "subscription_overdue",
      "assinatura_atrasada",
      "invoice_payment_failed",
    ];

    if (overdueEvents.includes(event)) {
      if (email) {
        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("organization_id")
          .eq("email", email)
          .single();

        if (profile?.organization_id) {
          await supabaseAdmin
            .from("subscriptions")
            .update({ status: "past_due" })
            .eq("organization_id", profile.organization_id);

          console.log(`Subscription marked as past_due for org: ${profile.organization_id}`);
        }
      }

      return new Response(JSON.stringify({ success: true, action: "subscription_overdue" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Log other events but don't fail
    console.log(`Unhandled AtomicPay event: ${event}`);
    return new Response(JSON.stringify({ success: true, action: "event_logged", event }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("AtomicPay webhook error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
