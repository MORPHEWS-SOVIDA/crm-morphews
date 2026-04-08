import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-secret",
};

function generateTempPassword(): string {
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
  if (!clean.startsWith('55')) clean = '55' + clean;
  if (clean.length === 12 && clean.startsWith('55')) {
    clean = clean.slice(0, 4) + '9' + clean.slice(4);
  }
  return clean;
}

async function getAdminWhatsAppConfig(supabaseAdmin: any) {
  try {
    const { data, error } = await supabaseAdmin
      .from("system_settings")
      .select("value")
      .eq("key", "admin_whatsapp_instance")
      .maybeSingle();
    if (error || !data?.value) return null;
    const config = data.value;
    if (!config.api_url || !config.api_key || !config.instance_name) return null;
    return config;
  } catch { return null; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Auth: internal secret OR master admin JWT
    const internalSecret = req.headers.get("x-internal-secret");
    const INTERNAL_AUTH_SECRET = Deno.env.get("INTERNAL_AUTH_SECRET");
    const authHeader = req.headers.get("authorization");
    let isAuthorized = false;
    if (INTERNAL_AUTH_SECRET && internalSecret === INTERNAL_AUTH_SECRET) {
      isAuthorized = true;
      console.log("Auth: internal secret matched");
    } else if (authHeader?.startsWith("Bearer ")) {
      // Try service role key first
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (serviceKey && authHeader === `Bearer ${serviceKey}`) {
        isAuthorized = true;
        console.log("Auth: service role key matched");
      } else {
        console.log("Auth: trying JWT validation...");
        const token = authHeader.replace("Bearer ", "");
        const supabaseAnon = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
          global: { headers: { Authorization: authHeader } },
        });

        let userId: string | null = null;
        const authAny = supabaseAnon.auth as any;

        // Newer SDKs
        if (typeof authAny.getClaims === "function") {
          const { data: claimsData, error: claimsErr } = await authAny.getClaims(token);
          console.log("Auth getClaims result:", claimsData?.claims?.sub, "error:", claimsErr?.message);
          if (!claimsErr && claimsData?.claims?.sub) {
            userId = claimsData.claims.sub;
          }
        }

        // Older SDK fallback (v2.45 in this function runtime)
        if (!userId) {
          const { data: userData, error: userErr } = await supabaseAnon.auth.getUser(token);
          console.log("Auth getUser fallback:", userData?.user?.id, "error:", userErr?.message);
          if (!userErr && userData?.user?.id) {
            userId = userData.user.id;
          }
        }

        if (userId) {
          const { data: isMasterAdmin, error: rpcErr } = await supabaseAdmin.rpc("is_master_admin", {
            _user_id: userId,
          });
          console.log("Auth is_master_admin:", isMasterAdmin, "rpcErr:", rpcErr?.message);
          if (isMasterAdmin) isAuthorized = true;
        }
      }
    } else {
      console.log("Auth: no auth header found");
    }

    if (!isAuthorized) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { userId, sendEmail, sendWhatsapp } = await req.json();
    if (!userId) {
      return new Response(JSON.stringify({ error: "userId is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user profile
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("first_name, last_name, email, whatsapp, organization_id")
      .eq("user_id", userId)
      .single();

    if (!profile?.email) {
      return new Response(JSON.stringify({ error: "User profile not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get plan name
    let planName = "Atomic Sales";
    if (profile.organization_id) {
      const { data: sub } = await supabaseAdmin
        .from("subscriptions")
        .select("plan_id, subscription_plans(name)")
        .eq("organization_id", profile.organization_id)
        .maybeSingle();
      if (sub?.subscription_plans?.name) planName = sub.subscription_plans.name;
    }

    // Generate new temp password
    const tempPassword = generateTempPassword();

    // Update user password
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: tempPassword,
    });
    if (updateError) throw updateError;

    // Record temp password reset
    await supabaseAdmin.from("temp_password_resets").upsert({
      user_id: userId,
      email: profile.email,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    }, { onConflict: "user_id" });

    const firstName = profile.first_name || "Usuário";
    const results: any = { passwordReset: true };

    // Send email
    if (sendEmail !== false) {
      const resendApiKey = Deno.env.get("RESEND_API_KEY");
      if (resendApiKey) {
        const loginUrl = "https://atomic.ia.br/login";
        const emailHtml = `
          <!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 28px;">🎉 Bem-vindo ao Atomic Sales!</h1>
              <p style="color: rgba(255,255,255,0.9); margin-top: 10px;">Olá ${firstName}, sua conta no plano ${planName} está pronta!</p>
            </div>
            <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 12px 12px;">
              <h2 style="color: #333; margin-top: 0;">Suas credenciais de acesso:</h2>
              <div style="background: white; border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <p style="margin: 5px 0;"><strong>📧 E-mail:</strong> ${profile.email}</p>
                <p style="margin: 5px 0;"><strong>🔑 Senha provisória:</strong> <code style="background: #f0f0f0; padding: 4px 8px; border-radius: 4px; font-size: 16px;">${tempPassword}</code></p>
              </div>
              <div style="background: #fff3cd; border: 1px solid #ffc107; border-radius: 8px; padding: 15px; margin: 20px 0;">
                <p style="margin: 0; color: #856404;">⚠️ <strong>Importante:</strong> No primeiro login, você deverá criar uma nova senha.</p>
              </div>
              <div style="text-align: center; margin-top: 30px;">
                <a href="${loginUrl}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Acessar o Sistema</a>
              </div>
              <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
              <p style="color: #666; font-size: 14px; text-align: center; margin: 0;">
                <strong>Atomic Sales</strong> - Transforme seus leads em clientes
              </p>
            </div>
          </body></html>`;

        const emailRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendApiKey}` },
          body: JSON.stringify({
            from: "Atomic Sales <contato@updates.atomic.ia.br>",
            to: [profile.email],
            subject: `🎉 Bem-vindo ao Atomic Sales - Suas credenciais de acesso`,
            html: emailHtml,
          }),
        });
        const emailData = await emailRes.json();
        results.emailSent = emailRes.ok;
        if (!emailRes.ok) console.error("Email error:", emailData);
        else console.log("Email sent:", emailData);
      } else {
        results.emailSent = false;
        results.emailError = "RESEND_API_KEY not configured";
      }
    }

    // Send WhatsApp
    if (sendWhatsapp !== false && profile.whatsapp) {
      const config = await getAdminWhatsAppConfig(supabaseAdmin);
      if (config) {
        const normalizedPhone = normalizeWhatsApp(profile.whatsapp);
        if (normalizedPhone) {
          const message = `🎉 *Bem-vindo ao Atomic Sales, ${firstName}!*

Sua conta no plano *${planName}* está pronta!

📧 *E-mail:* ${profile.email}
🔑 *Senha provisória:* ${tempPassword}

⚠️ No primeiro login, você deverá criar uma nova senha.

🌐 Acesse: atomic.ia.br

💡 *Dica:* Este número é seu assistente virtual! Você pode atualizar seus leads via conversa aqui pelo WhatsApp.

Qualquer dúvida, estamos por aqui! 🚀`;

          try {
            const whatsappRes = await fetch(
              `${config.api_url}/message/sendText/${config.instance_name}`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json", apikey: config.api_key },
                body: JSON.stringify({ number: normalizedPhone, text: message }),
              }
            );
            results.whatsappSent = whatsappRes.ok;
            if (!whatsappRes.ok) {
              const errData = await whatsappRes.text();
              console.error("WhatsApp error:", errData);
            } else {
              console.log("WhatsApp sent to:", normalizedPhone);
            }
          } catch (e) {
            console.error("WhatsApp send error:", e);
            results.whatsappSent = false;
          }
        }
      } else {
        results.whatsappSent = false;
        results.whatsappError = "Admin WhatsApp not configured";
      }
    }

    return new Response(JSON.stringify({ success: true, tempPassword, ...results }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
