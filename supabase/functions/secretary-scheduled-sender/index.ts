import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ============================================================================
// HELPERS
// ============================================================================

function normalizeWhatsApp(phone: string): string {
  let clean = (phone || "").replace(/\D/g, "");
  if (!clean) return "";
  if (!clean.startsWith("55")) clean = `55${clean}`;
  return clean;
}

function replaceVariables(
  content: string,
  data: { nome?: string; empresa?: string }
): string {
  const primeiroNome = data.nome?.split(" ")[0] || "";
  const diaSemana = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"][
    new Date().getDay()
  ];

  return content
    .replace(/\{\{nome\}\}/gi, data.nome || "")
    .replace(/\{\{primeiro_nome\}\}/gi, primeiroNome)
    .replace(/\{\{empresa\}\}/gi, data.empresa || "")
    .replace(/\{\{dia_semana\}\}/gi, diaSemana);
}

async function getAdminInstanceConfig(): Promise<{
  apiUrl: string;
  apiKey: string;
  instanceName: string;
} | null> {
  const { data } = await supabase
    .from("system_settings")
    .select("value")
    .eq("key", "admin_whatsapp_instance")
    .maybeSingle();

  if (!data?.value) return null;

  return {
    apiUrl: data.value.api_url || "",
    apiKey: data.value.api_key || "",
    instanceName: data.value.instance_name || "",
  };
}

async function sendWhatsAppMessage(
  phone: string,
  message: string
): Promise<{ ok: boolean; error?: string }> {
  const config = await getAdminInstanceConfig();
  if (!config || !config.apiUrl || !config.apiKey || !config.instanceName) {
    return { ok: false, error: "Admin WhatsApp instance not configured" };
  }

  const normalizedPhone = normalizeWhatsApp(phone);
  if (!normalizedPhone) return { ok: false, error: "Invalid phone" };

  const baseUrl = config.apiUrl.replace(/\/$/, "");
  const url = `${baseUrl}/message/sendText/${config.instanceName}`;

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: config.apiKey,
      },
      body: JSON.stringify({
        number: normalizedPhone,
        text: message,
      }),
    });

    if (!resp.ok) {
      const raw = await resp.json().catch(() => ({}));
      return { ok: false, error: raw?.message || `HTTP ${resp.status}` };
    }

    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0=Domingo, 1=Segunda...
    const currentTime = now.toTimeString().slice(0, 5); // HH:MM
    const today = now.toISOString().split("T")[0];

    console.log(`📅 Secretary Sender running at ${currentTime} on day ${dayOfWeek}`);

    // Check if forced via request body
    let force = false;
    try {
      const body = await req.json();
      force = body?.force === true;
    } catch {
      // No body, that's fine
    }

    // Get templates for today's day of week
    const { data: templates, error: templatesError } = await supabase
      .from("secretary_message_templates")
      .select("*")
      .eq("is_active", true)
      .eq("message_type", "scheduled")
      .eq("day_of_week", dayOfWeek);

    if (templatesError) {
      throw new Error(`Failed to fetch templates: ${templatesError.message}`);
    }

    if (!templates || templates.length === 0) {
      console.log("📭 No templates for today");
      return new Response(
        JSON.stringify({ ok: true, message: "No templates for today", sent: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Filter templates by time (only send at the right time, or if forced)
    const applicableTemplates = force
      ? templates
      : templates.filter((t) => {
          const templateTime = t.scheduled_time?.slice(0, 5);
          return templateTime === currentTime;
        });

    if (applicableTemplates.length === 0) {
      console.log("⏰ No templates for current time");
      return new Response(
        JSON.stringify({ ok: true, message: "No templates for current time", sent: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get all organizations with active subscriptions
    const { data: orgs } = await supabase
      .from("organizations")
      .select("id, name");

    if (!orgs || orgs.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, message: "No organizations", sent: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let totalSent = 0;
    const errors: string[] = [];

    for (const template of applicableTemplates) {
      // Get recipients based on type
      for (const org of orgs) {
        // Get users for this organization
        const { data: members } = await supabase
          .from("organization_members")
          .select(`
            user_id,
            role,
            profiles!inner(
              full_name,
              whatsapp
            )
          `)
          .eq("organization_id", org.id);

        if (!members) continue;

        // Filter by recipient type
        const recipients = members.filter((m) => {
          const profile = m.profiles as any;
          if (!profile?.whatsapp) return false;

          if (template.recipient_type === "owners") {
            return m.role === "owner" || m.role === "admin";
          } else {
            return m.role === "member" || m.role === "seller";
          }
        });

        for (const recipient of recipients) {
          const profile = recipient.profiles as any;
          const phone = normalizeWhatsApp(profile.whatsapp);

          if (!phone) continue;

          // Check if already sent today
          const { data: alreadySent } = await supabase
            .from("secretary_sent_messages")
            .select("id")
            .eq("template_id", template.id)
            .eq("recipient_phone", phone)
            .eq("sent_date", today)
            .maybeSingle();

          if (alreadySent) {
            console.log(`⏭️ Already sent to ${phone} today`);
            continue;
          }

          // Replace variables
          const message = replaceVariables(template.message_content, {
            nome: profile.full_name,
            empresa: org.name,
          });

          // Send message
          const result = await sendWhatsAppMessage(phone, message);

          // Log the send
          await supabase.from("secretary_sent_messages").insert({
            template_id: template.id,
            recipient_phone: phone,
            recipient_user_id: recipient.user_id,
            recipient_org_id: org.id,
            recipient_name: profile.full_name,
            message_content: message,
            status: result.ok ? "sent" : "failed",
            error_message: result.error || null,
            sent_date: today,
          });

          // Also log to conversation history
          if (result.ok) {
            await supabase.from("secretary_conversation_history").insert({
              phone,
              direction: "outbound",
              message_content: message,
              message_type: "text",
            });
          }

          if (result.ok) {
            totalSent++;
            console.log(`✅ Sent to ${profile.full_name} (${phone})`);
          } else {
            errors.push(`${phone}: ${result.error}`);
            console.error(`❌ Failed to send to ${phone}: ${result.error}`);
          }

          // Small delay between sends
          await new Promise((r) => setTimeout(r, 500));
        }
      }
    }

    console.log(`📤 Total sent: ${totalSent}`);

    return new Response(
      JSON.stringify({
        ok: true,
        sent: totalSent,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("❌ Secretary sender error:", msg);
    return new Response(
      JSON.stringify({ ok: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
