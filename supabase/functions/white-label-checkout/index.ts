import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const INTERNAL_AUTH_SECRET = Deno.env.get("INTERNAL_AUTH_SECRET");

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function generatePassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let password = "";
  for (let i = 0; i < 10; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

function normalizeWhatsApp(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let clean = phone.replace(/\D/g, '');
  if (!clean) return null;
  if (!clean.startsWith('55')) {
    clean = '55' + clean;
  }
  if (clean.length === 12 && clean.startsWith('55')) {
    clean = clean.slice(0, 4) + '9' + clean.slice(4);
  }
  return clean;
}

// Platform cost constants
const PLATFORM_COSTS = {
  SETUP_FEE_PERCENTAGE: 12,
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      whiteLabelConfigId,
      planId,
      customerName,
      customerEmail,
      customerWhatsapp,
      customerDocument,
      cardData,
      refCode,
    } = await req.json();

    console.log("White Label Checkout:", { 
      whiteLabelConfigId, 
      planId, 
      customerEmail,
      customerName 
    });

    if (!whiteLabelConfigId || !planId || !customerEmail || !customerName || !cardData) {
      return new Response(JSON.stringify({ 
        error: "Dados incompletos" 
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get white label config with implementer info
    const { data: wlConfig, error: wlError } = await supabaseAdmin
      .from("white_label_configs")
      .select(`
        id,
        implementer_id,
        brand_name,
        logo_url,
        primary_color,
        email_from_name,
        support_whatsapp,
        resend_api_key,
        welcome_whatsapp_instance_id,
        send_welcome_via_whatsapp,
        send_welcome_via_email,
        implementer:implementers!implementer_id(
          id,
          user_id,
          organization_id,
          referral_code
        )
      `)
      .eq("id", whiteLabelConfigId)
      .eq("is_active", true)
      .single();

    if (wlError || !wlConfig) {
      console.error("Config error:", wlError);
      return new Response(JSON.stringify({ error: "Configuração não encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get plan
    const { data: plan, error: planError } = await supabaseAdmin
      .from("white_label_plans")
      .select("*")
      .eq("id", planId)
      .eq("white_label_config_id", whiteLabelConfigId)
      .eq("is_active", true)
      .single();

    if (planError || !plan) {
      return new Response(JSON.stringify({ error: "Plano não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Calculate totals
    const monthlyCents = plan.price_cents;
    const setupFeeCents = plan.setup_fee_cents || 0;
    const totalFirstPaymentCents = monthlyCents + setupFeeCents;
    
    // Calculate platform share of setup fee (12%)
    const platformSetupFee = Math.round(setupFeeCents * (PLATFORM_COSTS.SETUP_FEE_PERCENTAGE / 100));
    const partnerSetupFee = setupFeeCents - platformSetupFee;

    console.log("Payment breakdown:", {
      monthly: monthlyCents,
      setup: setupFeeCents,
      platformSetup: platformSetupFee,
      partnerSetup: partnerSetupFee,
      total: totalFirstPaymentCents,
    });

    // Process payment via Pagar.me (similar to implementer-checkout)
    const PAGARME_API_KEY = Deno.env.get("PAGARME_SECRET_KEY");
    if (!PAGARME_API_KEY) {
      throw new Error("PAGARME_SECRET_KEY não configurada");
    }

    // Prepare card data for Pagar.me
    const [expMonth, expYear] = cardData.expiryDate.split("/");
    const fullYear = expYear.length === 2 ? `20${expYear}` : expYear;

    // Create charge via Pagar.me
    const pagarmePayload = {
      customer: {
        name: customerName,
        email: customerEmail,
        document: customerDocument,
        document_type: customerDocument.length <= 11 ? "cpf" : "cnpj",
        type: customerDocument.length <= 11 ? "individual" : "company",
        phones: customerWhatsapp ? {
          mobile_phone: {
            country_code: "55",
            area_code: customerWhatsapp.slice(2, 4),
            number: customerWhatsapp.slice(4),
          }
        } : undefined,
      },
      items: [
        {
          amount: monthlyCents,
          description: `${plan.name} - Mensalidade`,
          quantity: 1,
          code: `wl-plan-${plan.id}`,
        },
        ...(setupFeeCents > 0 ? [{
          amount: setupFeeCents,
          description: "Taxa de Implementação",
          quantity: 1,
          code: "setup-fee",
        }] : []),
      ],
      payments: [{
        payment_method: "credit_card",
        credit_card: {
          installments: cardData.installments || 1,
          statement_descriptor: wlConfig.brand_name.slice(0, 13).toUpperCase(),
          card: {
            number: cardData.number.replace(/\s/g, ""),
            holder_name: cardData.holderName,
            exp_month: parseInt(expMonth),
            exp_year: parseInt(fullYear),
            cvv: cardData.cvv,
            billing_address: {
              line_1: "Endereço",
              zip_code: "00000000",
              city: "Cidade",
              state: "SP",
              country: "BR",
            }
          },
        },
      }],
    };

    const pagarmeResponse = await fetch("https://api.pagar.me/core/v5/orders", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${btoa(PAGARME_API_KEY + ":")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(pagarmePayload),
    });

    const pagarmeResult = await pagarmeResponse.json();

    if (!pagarmeResponse.ok || pagarmeResult.status === "failed") {
      console.error("Pagar.me error:", pagarmeResult);
      const errorMsg = pagarmeResult.charges?.[0]?.last_transaction?.gateway_response?.errors?.[0]?.message
        || pagarmeResult.message
        || "Pagamento não aprovado";
      return new Response(JSON.stringify({ error: errorMsg }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Payment approved:", pagarmeResult.id);

    // Create user account
    const tempPassword = generatePassword();
    
    // Check if user exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email === customerEmail);

    let userId: string;
    let isNewUser = false;

    if (existingUser) {
      userId = existingUser.id;
      console.log("User already exists:", userId);
    } else {
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: customerEmail,
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          first_name: customerName?.split(" ")[0] || "Usuário",
          last_name: customerName?.split(" ").slice(1).join(" ") || "",
        },
      });

      if (createError) {
        console.error("Error creating user:", createError);
        throw createError;
      }

      userId = newUser.user.id;
      isNewUser = true;
      console.log("New user created:", userId);

      // Create profile
      const firstName = customerName?.split(" ")[0] || "Usuário";
      const lastName = customerName?.split(" ").slice(1).join(" ") || "";

      await supabaseAdmin.from("profiles").upsert({
        user_id: userId,
        first_name: firstName,
        last_name: lastName,
        whatsapp: normalizeWhatsApp(customerWhatsapp),
        email: customerEmail,
      }, { onConflict: "user_id" });

      // Record temp password reset
      await supabaseAdmin.from("temp_password_resets").insert({
        user_id: userId,
        email: customerEmail,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      });

      // Assign user role
      await supabaseAdmin.from("user_roles").upsert({
        user_id: userId,
        role: "user",
      }, { onConflict: "user_id" });
    }

    // Create organization for customer
    const orgName = customerName;
    const orgSlug = customerName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") || `org-${userId.slice(0, 8)}`;

    const { data: newOrg, error: orgError } = await supabaseAdmin
      .from("organizations")
      .insert({
        name: orgName,
        slug: orgSlug,
        owner_name: customerName,
        owner_email: customerEmail,
        phone: customerWhatsapp || null,
      })
      .select()
      .single();

    if (orgError) {
      console.error("Error creating organization:", orgError);
      throw orgError;
    }

    const organizationId = newOrg.id;
    console.log("Organization created:", organizationId);

    // Update profile with organization_id
    await supabaseAdmin
      .from("profiles")
      .update({ organization_id: organizationId })
      .eq("user_id", userId);

    // Add user to organization members
    await supabaseAdmin.from("organization_members").insert({
      organization_id: organizationId,
      user_id: userId,
      role: "owner",
    });

    // Create white label customer record
    await supabaseAdmin.from("white_label_customers").insert({
      white_label_config_id: whiteLabelConfigId,
      organization_id: organizationId,
      white_label_plan_id: planId,
      contracted_price_cents: monthlyCents,
      setup_fee_paid_cents: setupFeeCents,
      status: "active",
      activated_at: new Date().toISOString(),
    });

    // Create subscription from white label plan data
    // Find or create a matching subscription plan
    const { data: subPlan } = await supabaseAdmin
      .from("subscription_plans")
      .select("id")
      .eq("name", `WL: ${plan.name}`)
      .maybeSingle();

    let subscriptionPlanId = subPlan?.id;

    if (!subscriptionPlanId) {
      // Create a subscription plan entry for tracking
      const { data: newSubPlan } = await supabaseAdmin
        .from("subscription_plans")
        .insert({
          name: `WL: ${plan.name}`,
          price_cents: monthlyCents,
          max_users: plan.max_users,
          max_leads: plan.max_leads,
          included_whatsapp_instances: plan.max_whatsapp_instances,
          monthly_energy: plan.max_energy_per_month,
          feature_whatsapp: plan.has_whatsapp,
          feature_ai_bots: plan.has_ai_bots,
          feature_ecommerce: plan.has_ecommerce,
          feature_erp: plan.has_erp,
          feature_nfe: plan.has_nfe,
          feature_tracking: plan.has_tracking,
          is_active: false, // Hidden from public
        })
        .select()
        .single();
      
      subscriptionPlanId = newSubPlan?.id;
    }

    if (subscriptionPlanId) {
      await supabaseAdmin.from("subscriptions").insert({
        organization_id: organizationId,
        plan_id: subscriptionPlanId,
        status: "active",
        current_period_start: new Date().toISOString(),
        current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      });
    }

    // Record implementer sale/commission
    const implementer = wlConfig.implementer as any;
    if (implementer?.id) {
      await supabaseAdmin.from("implementer_sales").insert({
        implementer_id: implementer.id,
        organization_id: organizationId,
        plan_id: subscriptionPlanId,
        monthly_price_cents: monthlyCents,
        setup_fee_cents: setupFeeCents,
        status: "active",
        white_label_config_id: whiteLabelConfigId,
        ref_code: refCode || null,
      });

      // Update implementer stats
      await supabaseAdmin.rpc("increment_implementer_client_count", {
        _implementer_id: implementer.id,
      });
    }

    // Enqueue onboarding emails
    try {
      await supabaseAdmin.rpc("enqueue_onboarding_emails", {
        _organization_id: organizationId,
        _user_id: userId,
        _email: customerEmail,
        _name: customerName,
      });
    } catch (e) {
      console.error("Error enqueueing onboarding emails:", e);
    }

    // Send welcome email if new user
    if (isNewUser && wlConfig.send_welcome_via_email !== false) {
      try {
        // Prepare white label branding for welcome email
        const whiteLabelBranding = {
          brand_name: wlConfig.brand_name,
          logo_url: wlConfig.logo_url,
          primary_color: wlConfig.primary_color || "#667eea",
          email_from_name: wlConfig.email_from_name,
          support_email: null,
          support_whatsapp: wlConfig.support_whatsapp,
        };

        await fetch(`${SUPABASE_URL}/functions/v1/send-welcome-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
            "x-internal-secret": INTERNAL_AUTH_SECRET || "",
          },
          body: JSON.stringify({
            email: customerEmail,
            name: customerName,
            password: tempPassword,
            planName: plan.name,
            whiteLabelBranding,
          }),
        });
        console.log("Welcome email sent with white label branding");
      } catch (emailError) {
        console.error("Error sending welcome email:", emailError);
      }
    }

    // Send WhatsApp welcome if configured
    if (isNewUser && wlConfig.send_welcome_via_whatsapp && wlConfig.welcome_whatsapp_instance_id && customerWhatsapp) {
      try {
        await fetch(`${SUPABASE_URL}/functions/v1/send-whatsapp-message`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
            "x-internal-secret": INTERNAL_AUTH_SECRET || "",
          },
          body: JSON.stringify({
            instanceId: wlConfig.welcome_whatsapp_instance_id,
            to: normalizeWhatsApp(customerWhatsapp),
            message: `🎉 Olá ${customerName.split(" ")[0]}!\n\nSua conta no ${wlConfig.brand_name} foi criada com sucesso!\n\n📧 Login: ${customerEmail}\n🔑 Senha: ${tempPassword}\n\nAcesse: https://crm.morphews.com/login\n\n⚠️ Por segurança, altere sua senha após o primeiro acesso.`,
          }),
        });
        console.log("WhatsApp welcome sent");
      } catch (whatsappError) {
        console.error("Error sending WhatsApp welcome:", whatsappError);
      }
    }

    console.log("White Label checkout completed successfully");

    return new Response(JSON.stringify({
      success: true,
      userId,
      organizationId,
      orderId: pagarmeResult.id,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("White Label Checkout Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
