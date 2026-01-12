import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const EVOLUTION_API_URL = Deno.env.get("EVOLUTION_API_URL") ?? "";
const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY") ?? "";

interface NotificationPayload {
  organizationId: string;
  demandId: string;
  notificationType: "assignment" | "status_change" | "sla_warning" | "comment";
  targetUserIds?: string[];
  extraData?: Record<string, any>;
}

async function sendEvolutionText(instanceName: string, to: string, text: string) {
  const number = to.replace(/\D/g, "");
  const response = await fetch(`${EVOLUTION_API_URL}/message/sendText/${instanceName}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": EVOLUTION_API_KEY,
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
    const { organizationId, demandId, notificationType, targetUserIds, extraData } = body;

    console.log(`[${requestId}] Notification:`, { organizationId, demandId, notificationType });

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

    // Get organization settings for notifications
    const { data: orgSettings } = await supabaseAdmin
      .from("organization_settings")
      .select("demand_notifications_enabled, demand_notification_instance_id")
      .eq("organization_id", organizationId)
      .single();

    if (!orgSettings?.demand_notifications_enabled) {
      console.log(`[${requestId}] Notifications disabled for org`);
      return new Response(
        JSON.stringify({ success: true, message: "Notifications disabled" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get instance for sending
    let instanceId = orgSettings.demand_notification_instance_id;
    if (!instanceId) {
      // Get first active instance
      const { data: instances } = await supabaseAdmin
        .from("whatsapp_instances")
        .select("id, evolution_instance_id")
        .eq("organization_id", organizationId)
        .eq("status", "connected")
        .limit(1);
      
      if (instances?.length) {
        instanceId = instances[0].id;
      }
    }

    if (!instanceId) {
      console.log(`[${requestId}] No WhatsApp instance available`);
      return new Response(
        JSON.stringify({ success: true, message: "No instance available" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get instance details
    const { data: instance } = await supabaseAdmin
      .from("whatsapp_instances")
      .select("evolution_instance_id")
      .eq("id", instanceId)
      .single();

    if (!instance?.evolution_instance_id) {
      console.log(`[${requestId}] Instance not configured`);
      return new Response(
        JSON.stringify({ success: true, message: "Instance not configured" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get target users
    let userIds = targetUserIds || [];
    if (!userIds.length) {
      // Get all assignees
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

    // Get user phones
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

    // Build message based on type
    const urgencyLabels: Record<string, string> = {
      low: "🟢 Baixa",
      medium: "🟡 Média", 
      high: "🔴 Alta",
    };

    let messageTemplate = "";
    switch (notificationType) {
      case "assignment":
        messageTemplate = `📋 *Nova Demanda Atribuída*\n\n*Título:* ${demand.title}\n*Quadro:* ${demand.board?.name || "N/A"}\n*Coluna:* ${demand.column?.name || "N/A"}\n*Urgência:* ${urgencyLabels[demand.urgency] || demand.urgency}\n${demand.sla_deadline ? `*Prazo SLA:* ${new Date(demand.sla_deadline).toLocaleString("pt-BR")}\n` : ""}${demand.lead?.name ? `*Cliente:* ${demand.lead.name}\n` : ""}\n_Acesse o sistema para mais detalhes._`;
        break;
      
      case "status_change":
        const newColumn = extraData?.newColumn || demand.column?.name;
        messageTemplate = `🔄 *Demanda Movida*\n\n*Título:* ${demand.title}\n*Nova Coluna:* ${newColumn}\n${demand.sla_deadline ? `*Prazo SLA:* ${new Date(demand.sla_deadline).toLocaleString("pt-BR")}\n` : ""}\n_Acesse o sistema para mais detalhes._`;
        break;
      
      case "sla_warning":
        const hoursLeft = extraData?.hoursLeft || 0;
        messageTemplate = `⚠️ *Alerta de SLA*\n\n*Título:* ${demand.title}\n*Tempo Restante:* ${hoursLeft} horas\n*Prazo:* ${demand.sla_deadline ? new Date(demand.sla_deadline).toLocaleString("pt-BR") : "N/A"}\n\n_Esta demanda está próxima do prazo!_`;
        break;
      
      case "comment":
        const commenterName = extraData?.commenterName || "Alguém";
        messageTemplate = `💬 *Novo Comentário*\n\n*Demanda:* ${demand.title}\n*Por:* ${commenterName}\n\n_Acesse o sistema para ver o comentário._`;
        break;
    }

    // Send to each user
    let sentCount = 0;
    for (const user of users) {
      if (!user.whatsapp) continue;
      
      const personalMessage = messageTemplate.replace("{userName}", user.first_name || "");
      
      try {
        const sent = await sendEvolutionText(
          instance.evolution_instance_id,
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
