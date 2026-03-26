import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Authorization required");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) throw new Error("Invalid token");

    const { data: membership } = await supabase
      .from("organization_members")
      .select("organization_id, role")
      .eq("user_id", user.id)
      .single();

    if (!membership) throw new Error("No organization");

    const orgId = membership.organization_id;
    const { dateFrom, dateTo, instanceId, conversationId, status, assignedUserId } = await req.json();

    if (!dateFrom || !dateTo) throw new Error("dateFrom and dateTo required");

    // Use São Paulo timezone (UTC-3) for date boundaries
    // dateFrom "2026-03-25" should mean 2026-03-25T00:00:00 in São Paulo = 2026-03-25T03:00:00Z
    // dateTo "2026-03-25" should mean 2026-03-25T23:59:59 in São Paulo = 2026-03-26T02:59:59Z
    const startISO = `${dateFrom}T03:00:00.000Z`; // midnight São Paulo in UTC
    const endISO = new Date(new Date(`${dateTo}T03:00:00.000Z`).getTime() + 24 * 60 * 60 * 1000 - 1).toISOString();

    // Build query for conversations
    let convQuery = supabase
      .from("whatsapp_conversations")
      .select("id, phone_number, contact_name, instance_id, display_name, status, assigned_user_id")
      .eq("organization_id", orgId);

    if (instanceId) {
      convQuery = convQuery.eq("instance_id", instanceId);
    }
    if (conversationId) {
      convQuery = convQuery.eq("id", conversationId);
    }
    if (status && status !== "all") {
      convQuery = convQuery.eq("status", status);
    }
    if (assignedUserId && assignedUserId !== "all") {
      convQuery = convQuery.eq("assigned_user_id", assignedUserId);
    }

    const { data: conversations, error: convError } = await convQuery;
    if (convError) throw convError;
    if (!conversations?.length) {
      return new Response(
        JSON.stringify({ error: "Nenhuma conversa encontrada com os filtros selecionados" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const convIds = conversations.map(c => c.id);

    // Get instance names
    const instanceIds = [...new Set(conversations.map(c => c.instance_id).filter(Boolean))];
    const { data: instances } = instanceIds.length > 0
      ? await supabase.from("whatsapp_instances").select("id, name, display_name_for_team").in("id", instanceIds)
      : { data: [] };
    const instanceMap: Record<string, string> = {};
    instances?.forEach(i => {
      instanceMap[i.id] = i.display_name_for_team || i.name || "Instância";
    });

    // Get profiles for sent_by_user_id and assigned_user_id mapping
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, first_name, last_name")
      .eq("organization_id", orgId);
    const profileMap: Record<string, string> = {};
    profiles?.forEach(p => {
      profileMap[p.user_id] = [p.first_name, p.last_name].filter(Boolean).join(" ") || "Atendente";
    });

    // Fetch messages in date range - batch by conversation IDs
    let allMessages: any[] = [];
    const batchSize = 50;
    for (let i = 0; i < convIds.length; i += batchSize) {
      const batch = convIds.slice(i, i + batchSize);
      let offset = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data: msgs, error: msgError } = await supabase
          .from("whatsapp_messages")
          .select("id, conversation_id, direction, content, message_type, media_url, media_caption, created_at, sent_by_user_id, is_from_bot")
          .in("conversation_id", batch)
          .gte("created_at", startISO)
          .lte("created_at", endISO)
          .order("created_at", { ascending: true })
          .range(offset, offset + pageSize - 1);

        if (msgError) throw msgError;
        allMessages = allMessages.concat(msgs || []);
        hasMore = (msgs?.length || 0) === pageSize;
        offset += pageSize;
      }
    }

    // Build conversation map
    const convMap: Record<string, any> = {};
    conversations.forEach(c => { convMap[c.id] = c; });

    // Group messages by conversation
    const msgsByConv: Record<string, any[]> = {};
    allMessages.forEach(m => {
      if (!msgsByConv[m.conversation_id]) msgsByConv[m.conversation_id] = [];
      msgsByConv[m.conversation_id].push(m);
    });

    // Build export text
    const lines: string[] = [];
    lines.push(`=== Exportação de Conversas WhatsApp ===`);
    lines.push(`Período: ${dateFrom} a ${dateTo}`);
    lines.push(`Exportado em: ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`);
    lines.push(`Total de conversas com mensagens: ${Object.keys(msgsByConv).length}`);
    lines.push(`Total de mensagens: ${allMessages.length}`);
    if (status && status !== "all") lines.push(`Filtro de status: ${status}`);
    if (assignedUserId && assignedUserId !== "all") lines.push(`Filtro de atendente: ${profileMap[assignedUserId] || assignedUserId}`);
    lines.push("");

    // Sort conversations by first message time
    const sortedConvIds = Object.keys(msgsByConv).sort((a, b) => {
      const aFirst = msgsByConv[a]?.[0]?.created_at || "";
      const bFirst = msgsByConv[b]?.[0]?.created_at || "";
      return aFirst.localeCompare(bFirst);
    });

    for (const convId of sortedConvIds) {
      const conv = convMap[convId];
      if (!conv) continue;
      const msgs = msgsByConv[convId];
      if (!msgs?.length) continue;

      const contactName = conv.display_name || conv.contact_name || conv.phone_number || "Desconhecido";
      const instanceName = instanceMap[conv.instance_id] || "Instância";
      const assignedName = conv.assigned_user_id ? (profileMap[conv.assigned_user_id] || "Não atribuído") : "Não atribuído";

      lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      lines.push(`📱 Conversa com: ${contactName}`);
      lines.push(`📞 Número: ${conv.phone_number || "N/A"}`);
      lines.push(`🔌 Instância: ${instanceName}`);
      lines.push(`👤 Atendente: ${assignedName}`);
      lines.push(`📊 Status: ${conv.status || "N/A"}`);
      lines.push(`💬 Mensagens no período: ${msgs.length}`);
      lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      lines.push("");

      for (const msg of msgs) {
        const date = new Date(msg.created_at);
        const dateStr = date.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
        const timeStr = date.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo" });

        let senderName: string;
        if (msg.direction === "inbound") {
          senderName = contactName;
        } else if (msg.is_from_bot) {
          senderName = "🤖 Bot";
        } else if (msg.sent_by_user_id && profileMap[msg.sent_by_user_id]) {
          senderName = profileMap[msg.sent_by_user_id];
        } else {
          senderName = instanceName;
        }

        let content = msg.content || "";
        if (msg.message_type && msg.message_type !== "text" && msg.message_type !== "chat") {
          const typeLabels: Record<string, string> = {
            image: "📷 imagem",
            video: "🎥 vídeo",
            audio: "🎤 áudio",
            document: "📄 documento",
            sticker: "🏷️ figurinha",
            location: "📍 localização",
          };
          const typeLabel = typeLabels[msg.message_type] || msg.message_type;
          if (content) {
            content = `[${typeLabel}] ${content}`;
          } else if (msg.media_caption) {
            content = `[${typeLabel}] ${msg.media_caption}`;
          } else {
            content = `[${typeLabel}]`;
          }
        }

        if (!content) content = "[mensagem sem conteúdo]";

        lines.push(`[${dateStr}, ${timeStr}] ${senderName}: ${content}`);
      }

      lines.push("");
    }

    if (sortedConvIds.length === 0) {
      lines.push("Nenhuma mensagem encontrada no período selecionado.");
    }

    const exportText = lines.join("\n");
    const fileName = `conversas-whatsapp-${dateFrom}-a-${dateTo}.txt`;

    return new Response(exportText, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error: any) {
    console.error("Export error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
