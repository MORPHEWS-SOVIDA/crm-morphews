import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

interface NotificationPayload {
  organizationId: string;
  demandId: string;
  notificationType: "assignment" | "status_change" | "sla_warning" | "comment" | "update";
  targetUserIds?: string[];
  extraData?: Record<string, any>;
  creatorName?: string; // Nome de quem criou/alterou a demanda
}

interface AdminConfig {
  api_url: string;
  api_key: string;
  instance_name: string;
}

// Get admin WhatsApp config from database
async function getAdminWhatsAppConfig(supabaseAdmin: any): Promise<AdminConfig | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from("system_settings")
      .select("value")
      .eq("key", "admin_whatsapp_instance")
      .maybeSingle();

    if (error || !data?.value) {
      return null;
    }

    const config = data.value;
    if (!config.api_url || !config.api_key || !config.instance_name) {
      return null;
    }

    return {
      api_url: config.api_url,
      api_key: config.api_key,
      instance_name: config.instance_name,
    };
  } catch (err) {
    console.error("Error fetching admin WhatsApp config:", err);
    return null;
  }
}

async function sendEvolutionText(apiUrl: string, apiKey: string, instanceName: string, to: string, text: string) {
  const number = to.replace(/\D/g, "");
  const response = await fetch(`${apiUrl}/message/sendText/${instanceName}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": apiKey,
    },
    body: JSON.stringify({ number, text }),
  });
  return response.ok;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID().split('-')[0];
  console.log(`\n========== [${requestId}] DEMAND NOTIFICATION ==========`);

  try {
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body: NotificationPayload = await req.json();
    const { organizationId, demandId, notificationType, targetUserIds, extraData, creatorName } = body;

    console.log(`[${requestId}] Notification:`, { organizationId, demandId, notificationType, creatorName });

    if (!organizationId || !demandId || !notificationType) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required params" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get demand details
    const { data: demand, error: demandErr } = await supabaseAdmin
      .from("demands")
      .select(`
        *,
        board:demand_boards(name),
        column:demand_columns(name),
        lead:leads(name, whatsapp)
      `)
      .eq("id", demandId)
      .single();

    if (demandErr || !demand) {
      console.error(`[${requestId}] Demand not found:`, demandErr);
      return new Response(
        JSON.stringify({ success: false, error: "Demand not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // SEMPRE usar WhatsApp Admin para notificações de demanda
    // Isso garante que usamos o número oficial do sistema
    const adminConfig = await getAdminWhatsAppConfig(supabaseAdmin);
    
    if (!adminConfig) {
      console.log(`[${requestId}] No admin WhatsApp config available`);
      return new Response(
        JSON.stringify({ success: false, error: "WhatsApp Admin não configurado" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiUrl = adminConfig.api_url;
    const apiKey = adminConfig.api_key;
    const evolutionInstanceName = adminConfig.instance_name;

    console.log(`[${requestId}] Using Admin WhatsApp instance: ${evolutionInstanceName}`);

    // Get target users
    let userIds = targetUserIds || [];
    if (!userIds.length) {
      const { data: assignees } = await supabaseAdmin
        .from("demand_assignees")
        .select("user_id")
        .eq("demand_id", demandId);
      
      userIds = assignees?.map(a => a.user_id) || [];
    }

    if (!userIds.length) {
      console.log(`[${requestId}] No target users`);
      return new Response(
        JSON.stringify({ success: true, message: "No target users" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: users } = await supabaseAdmin
      .from("profiles")
      .select("id, first_name, whatsapp")
      .in("id", userIds);

    if (!users?.length) {
      console.log(`[${requestId}] No user profiles found`);
      return new Response(
        JSON.stringify({ success: true, message: "No user profiles" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const urgencyLabels: Record<string, string> = {
      low: "🟢 Baixa",
      medium: "🟡 Média", 
      high: "🔴 Alta",
    };

    // Link exclusivo para a demanda
    const demandLink = `https://crm-morphews.lovable.app/demandas?demand=${demandId}`;
    const creatorInfo = creatorName ? `*Criado por:* ${creatorName}\n` : "";
    const updaterInfo = creatorName ? `*Alterado por:* ${creatorName}\n` : "";

    let messageTemplate = "";
    switch (notificationType) {
      case "assignment":
        messageTemplate = `📋 *Nova Demanda Atribuída*\n\n*Título:* ${demand.title}\n*Quadro:* ${demand.board?.name || "N/A"}\n*Coluna:* ${demand.column?.name || "N/A"}\n*Urgência:* ${urgencyLabels[demand.urgency] || demand.urgency}\n${creatorInfo}${demand.sla_deadline ? `*Prazo SLA:* ${new Date(demand.sla_deadline).toLocaleString("pt-BR")}\n` : ""}${demand.lead?.name ? `*Cliente:* ${demand.lead.name}\n` : ""}\n🔗 *Acesse aqui:* ${demandLink}`;
        break;
      case "status_change":
        const newColumn = extraData?.newColumn || demand.column?.name;
        messageTemplate = `🔄 *Demanda Movida*\n\n*Título:* ${demand.title}\n*Nova Coluna:* ${newColumn}\n${demand.sla_deadline ? `*Prazo SLA:* ${new Date(demand.sla_deadline).toLocaleString("pt-BR")}\n` : ""}\n🔗 *Acesse aqui:* ${demandLink}`;
        break;
      case "sla_warning":
        const hoursLeft = extraData?.hoursLeft || 0;
        messageTemplate = `⚠️ *Alerta de SLA*\n\n*Título:* ${demand.title}\n*Tempo Restante:* ${hoursLeft} horas\n*Prazo:* ${demand.sla_deadline ? new Date(demand.sla_deadline).toLocaleString("pt-BR") : "N/A"}\n\n_Esta demanda está próxima do prazo!_\n\n🔗 *Acesse aqui:* ${demandLink}`;
        break;
      case "comment":
        const commenterName = extraData?.commenterName || "Alguém";
        messageTemplate = `💬 *Novo Comentário*\n\n*Demanda:* ${demand.title}\n*Por:* ${commenterName}\n\n🔗 *Acesse aqui:* ${demandLink}`;
        break;
      case "update":
        const changes = extraData?.changes || "Informações";
        messageTemplate = `✏️ *Demanda Atualizada*\n\n*Título:* ${demand.title}\n${updaterInfo}*Alterações:* ${changes}\n*Urgência:* ${urgencyLabels[demand.urgency] || demand.urgency}\n${demand.sla_deadline ? `*Prazo SLA:* ${new Date(demand.sla_deadline).toLocaleString("pt-BR")}\n` : ""}\n🔗 *Acesse aqui:* ${demandLink}`;
        break;
    }

    let sentCount = 0;
    for (const user of users) {
      if (!user.whatsapp) continue;
      
      const personalMessage = messageTemplate.replace("{userName}", user.first_name || "");
      
      try {
        const sent = await sendEvolutionText(
          apiUrl,
          apiKey,
          evolutionInstanceName,
          user.whatsapp,
          personalMessage
        );
        if (sent) sentCount++;
        console.log(`[${requestId}] Sent to ${user.first_name}: ${sent}`);
      } catch (err) {
        console.error(`[${requestId}] Failed to send to ${user.first_name}:`, err);
      }
    }

    // Log notification in demand_history
    await supabaseAdmin
      .from("demand_history")
      .insert({
        demand_id: demandId,
        organization_id: organizationId,
        action: `notification_${notificationType}`,
        new_value: { sent_count: sentCount, target_users: userIds.length },
      });

    console.log(`[${requestId}] ✅ Sent ${sentCount}/${users.length} notifications`);

    return new Response(
      JSON.stringify({ success: true, sent: sentCount }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[${requestId}] ❌ Error:`, error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
