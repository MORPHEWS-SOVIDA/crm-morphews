import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ============================================================================
// SUPER IA CONTEXT - Endpoint unificado para VPS obter contexto completo
// ============================================================================

interface LeadContext {
  lead: any;
  funnel_stage: any;
  preferences: any[];
  summaries: any[];
  recent_messages: any[];
  sales_history: any[];
  pending_followups: any[];
  products: any[];
  scheduled_messages: any[];
  followup_config: any;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action } = body;

    // ====================================================================
    // ACTION: get_full_context
    // VPS chama isso antes de responder para ter TUDO sobre o lead
    // ====================================================================
    if (action === "get_full_context") {
      const { organizationId, leadId, conversationId, limit = 30 } = body;

      if (!organizationId || !leadId) {
        return new Response(
          JSON.stringify({ error: "organizationId and leadId required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Todas as queries em paralelo
      const [
        leadRes,
        prefsRes,
        summariesRes,
        messagesRes,
        salesRes,
        followupsRes,
        productsRes,
        scheduledRes,
        orgRes,
        botRes,
      ] = await Promise.all([
        // Lead + etapa do funil
        supabase
          .from("leads")
          .select(`
            id, name, whatsapp, email, stars, notes, created_at,
            funnel_stage_id,
            organization_funnel_stages(id, name, position, color)
          `)
          .eq("id", leadId)
          .single(),

        // Preferências aprendidas pela IA
        supabase
          .from("lead_ai_preferences")
          .select("preference_type, preference_key, preference_value, confidence_score, last_observed_at")
          .eq("lead_id", leadId)
          .order("confidence_score", { ascending: false })
          .limit(15),

        // Resumos de conversas anteriores
        supabase
          .from("lead_conversation_summaries")
          .select("summary_text, key_topics, sentiment, action_items, next_steps, created_at")
          .eq("lead_id", leadId)
          .order("created_at", { ascending: false })
          .limit(5),

        // Últimas mensagens da conversa atual
        conversationId
          ? supabase
              .from("whatsapp_messages")
              .select("content, direction, message_type, created_at")
              .eq("conversation_id", conversationId)
              .order("created_at", { ascending: false })
              .limit(limit)
          : Promise.resolve({ data: [] }),

        // Histórico de compras
        supabase
          .from("sales")
          .select("id, total_value_cents, status, created_at, payment_method")
          .eq("lead_id", leadId)
          .order("created_at", { ascending: false })
          .limit(10),

        // Follow-ups pendentes
        supabase
          .from("lead_followups")
          .select("id, reason, scheduled_at, notes, source_type")
          .eq("lead_id", leadId)
          .is("completed_at", null)
          .order("scheduled_at", { ascending: true })
          .limit(5),

        // Produtos da organização (para sugestões)
        supabase
          .from("lead_products")
          .select("id, name, price_cents, description, is_active")
          .eq("organization_id", organizationId)
          .eq("is_active", true)
          .order("name")
          .limit(50),

        // Mensagens agendadas pendentes
        supabase
          .from("lead_scheduled_messages")
          .select("id, template_key, message_content, scheduled_for, status")
          .eq("lead_id", leadId)
          .eq("status", "pending")
          .order("scheduled_for")
          .limit(5),

        // Config de follow-up da organização
        supabase
          .from("organizations")
          .select("id, name, ai_followup_config")
          .eq("id", organizationId)
          .single(),

        // Bot ativo da organização (para injetar system_prompt no contexto)
        supabase
          .from("ai_bots")
          .select("id, name, system_prompt, personality_description, service_type")
          .eq("organization_id", organizationId)
          .eq("is_active", true)
          .limit(1)
          .maybeSingle(),
      ]);

      // Calcular métricas derivadas
      const lead = leadRes.data;
      const sales = salesRes.data || [];
      const completedSales = sales.filter(
        (s: any) => s.status === "completed" || s.status === "delivered"
      );
      const totalSpent = completedSales.reduce(
        (sum: number, s: any) => sum + (s.total_value_cents || 0),
        0
      );
      const daysSinceCreation = lead
        ? Math.floor(
            (Date.now() - new Date(lead.created_at).getTime()) /
              (1000 * 60 * 60 * 24)
          )
        : 0;

      // Montar mensagens em ordem cronológica
      const recentMessages = ((messagesRes as any).data || [])
        .reverse()
        .filter((m: any) => m.content)
        .map((m: any) => ({
          role: m.direction === "inbound" ? "customer" : "agent",
          content: m.content,
          type: m.message_type,
          at: m.created_at,
        }));

      // Último contato
      const lastMessage = recentMessages.length > 0
        ? recentMessages[recentMessages.length - 1]
        : null;
      const hoursSinceLastMessage = lastMessage
        ? (Date.now() - new Date(lastMessage.at).getTime()) / (1000 * 60 * 60)
        : null;

      const context: LeadContext = {
        lead: {
          ...lead,
          days_as_customer: daysSinceCreation,
          total_purchases: completedSales.length,
          total_spent_cents: totalSpent,
          hours_since_last_message: hoursSinceLastMessage
            ? Math.round(hoursSinceLastMessage * 10) / 10
            : null,
          last_message_direction: lastMessage?.role || null,
        },
        funnel_stage: lead?.organization_funnel_stages || null,
        preferences: prefsRes.data || [],
        summaries: summariesRes.data || [],
        recent_messages: recentMessages,
        sales_history: sales,
        pending_followups: followupsRes.data || [],
        products: productsRes.data || [],
        scheduled_messages: scheduledRes.data || [],
        followup_config: orgRes.data?.ai_followup_config || null,
        bot_prompt: botRes.data?.system_prompt || null,
        bot_personality: botRes.data?.personality_description || null,
      };

      console.log(
        `🧠 Super IA Context for lead ${leadId}: ${recentMessages.length} msgs, ${(prefsRes.data || []).length} prefs, ${sales.length} sales`
      );

      return new Response(JSON.stringify({ success: true, context }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ====================================================================
    // ACTION: get_inactive_leads
    // Cron da VPS chama para buscar leads que precisam de follow-up
    // ====================================================================
    if (action === "get_inactive_leads") {
      const { organizationId, inactiveHours = 4, maxResults = 20 } = body;

      if (!organizationId) {
        return new Response(
          JSON.stringify({ error: "organizationId required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Buscar config da org via RPC (bypassa RLS)
      const { data: org } = await supabase
        .from("organizations")
        .select("ai_followup_config")
        .eq("id", organizationId)
        .single();

      const config = (org as any)?.ai_followup_config;
      if (!config?.enabled) {
        return new Response(
          JSON.stringify({ success: true, leads: [], reason: "followup_disabled" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const hours = config.inactive_hours || inactiveHours;
      const maxPerLead = config.max_followups_per_lead || 3;
      const cooldownHours = config.cooldown_hours || 24;

      // Usar RPC com SECURITY DEFINER para bypasassar RLS
      console.log(`🔍 Calling get_inactive_leads_for_followup: org=${organizationId}, hours=${hours}, cooldown=${cooldownHours}, maxPerLead=${maxPerLead}`);
      
      const { data: eligibleLeads, error: rpcError } = await supabase.rpc(
        "get_inactive_leads_for_followup",
        {
          p_organization_id: organizationId,
          p_inactive_hours: hours,
          p_cooldown_hours: cooldownHours,
          p_max_per_lead: maxPerLead,
          p_max_results: maxResults,
        }
      );

      if (rpcError) {
        console.error(`❌ RPC error:`, JSON.stringify(rpcError));
        return new Response(
          JSON.stringify({ error: rpcError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const leads = eligibleLeads || [];
      console.log(`🔍 Found ${leads.length} eligible inactive leads for org ${organizationId}`);

      return new Response(
        JSON.stringify({ success: true, leads, config }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ====================================================================
    // ACTION: save_followup
    // VPS salva follow-up gerado na fila
    // ====================================================================
    if (action === "save_followup") {
      const {
        organizationId,
        leadId,
        conversationId,
        whatsappInstanceId,
        triggerType,
        generatedMessage,
        contextSnapshot,
        aiModelUsed,
        tokensUsed,
        scheduledFor,
      } = body;

      const { data, error } = await supabase
        .from("ai_followup_queue")
        .insert({
          organization_id: organizationId,
          lead_id: leadId,
          conversation_id: conversationId,
          whatsapp_instance_id: whatsappInstanceId,
          trigger_type: triggerType || "cron_inactive",
          generated_message: generatedMessage,
          context_snapshot: contextSnapshot || {},
          ai_model_used: aiModelUsed,
          tokens_used: tokensUsed,
          status: "ready",
          scheduled_for: scheduledFor || new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error("❌ Error saving followup:", error);
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, followup: data }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ====================================================================
    // ACTION: update_followup_status
    // VPS atualiza status após envio
    // ====================================================================
    if (action === "update_followup_status") {
      const { followupId, status, errorMessage } = body;

      const updateData: any = { status };
      if (status === "sent") updateData.sent_at = new Date().toISOString();
      if (errorMessage) updateData.error_message = errorMessage;

      const { error } = await supabase
        .from("ai_followup_queue")
        .update(updateData)
        .eq("id", followupId);

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ====================================================================
    // ACTION: get_dashboard_stats
    // Frontend /super-ia chama para pegar métricas
    // ====================================================================
    if (action === "get_dashboard_stats") {
      const { organizationId } = body;

      if (!organizationId) {
        return new Response(
          JSON.stringify({ error: "organizationId required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const now = new Date();
      const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const [
        queueRes,
        sent24hRes,
        sent7dRes,
        prefsCountRes,
        summariesCountRes,
      ] = await Promise.all([
        supabase
          .from("ai_followup_queue")
          .select("id, status, trigger_type", { count: "exact" })
          .eq("organization_id", organizationId)
          .in("status", ["pending", "ready"]),
        supabase
          .from("ai_followup_queue")
          .select("id", { count: "exact" })
          .eq("organization_id", organizationId)
          .eq("status", "sent")
          .gte("sent_at", last24h),
        supabase
          .from("ai_followup_queue")
          .select("id, trigger_type", { count: "exact" })
          .eq("organization_id", organizationId)
          .eq("status", "sent")
          .gte("sent_at", last7d),
        supabase
          .from("lead_ai_preferences")
          .select("id", { count: "exact" })
          .eq("organization_id", organizationId),
        supabase
          .from("lead_conversation_summaries")
          .select("id", { count: "exact" })
          .eq("organization_id", organizationId),
      ]);

      return new Response(
        JSON.stringify({
          success: true,
          stats: {
            queue_pending: queueRes.count || 0,
            sent_24h: sent24hRes.count || 0,
            sent_7d: sent7dRes.count || 0,
            total_preferences_learned: prefsCountRes.count || 0,
            total_summaries: summariesCountRes.count || 0,
            queue_items: queueRes.data || [],
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ====================================================================
    // ACTION: send_followup
    // Frontend aprova e envia follow-up da fila via Evolution API
    // ====================================================================
    if (action === "send_followup") {
      const { followupId, editedMessage } = body;

      if (!followupId) {
        return new Response(
          JSON.stringify({ error: "followupId required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Buscar follow-up
      const { data: followup, error: fErr } = await supabase
        .from("ai_followup_queue")
        .select("*, whatsapp_instance_id")
        .eq("id", followupId)
        .single();

      if (fErr || !followup) {
        return new Response(
          JSON.stringify({ error: "Follow-up not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const messageToSend = editedMessage || followup.generated_message;
      if (!messageToSend) {
        return new Response(
          JSON.stringify({ error: "No message to send" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Buscar conversa para pegar phone_number
      let phone = "";
      let instanceId = followup.whatsapp_instance_id;

      if (followup.conversation_id) {
        const { data: conv } = await supabase
          .from("whatsapp_conversations")
          .select("phone_number, instance_id")
          .eq("id", followup.conversation_id)
          .single();
        if (conv) {
          phone = conv.phone_number;
          if (!instanceId) instanceId = conv.instance_id;
        }
      }

      // Se não achou telefone pela conversa, buscar pelo lead
      if (!phone && followup.lead_id) {
        const { data: lead } = await supabase
          .from("leads")
          .select("whatsapp")
          .eq("id", followup.lead_id)
          .single();
        if (lead?.whatsapp) {
          phone = lead.whatsapp.replace(/\D/g, "");
        }
      }

      if (!phone || !instanceId) {
        await supabase.from("ai_followup_queue").update({
          status: "error",
          error_message: "Phone or instance not found",
        }).eq("id", followupId);
        return new Response(
          JSON.stringify({ error: "Phone or instance not found" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Buscar instância para pegar evolution_instance_id e token
      const { data: instance } = await supabase
        .from("whatsapp_instances")
        .select("evolution_instance_id, evolution_api_token")
        .eq("id", instanceId)
        .single();

      if (!instance?.evolution_instance_id) {
        await supabase.from("ai_followup_queue").update({
          status: "error",
          error_message: "Instance not configured",
        }).eq("id", followupId);
        return new Response(
          JSON.stringify({ error: "Instance not configured" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const EVOLUTION_API_URL = Deno.env.get("EVOLUTION_API_URL") || "https://evo.morphews.com.br";
      const EVOLUTION_API_KEY = instance.evolution_api_token || Deno.env.get("EVOLUTION_API_KEY") || "";

      // Enviar via Evolution API
      const normalizedPhone = phone.replace(/\D/g, "");
      const sendUrl = `${EVOLUTION_API_URL}/message/sendText/${instance.evolution_instance_id}`;

      console.log(`📤 Sending follow-up ${followupId} to ${normalizedPhone} via ${instance.evolution_instance_id}`);

      const sendResponse = await fetch(sendUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: EVOLUTION_API_KEY,
        },
        body: JSON.stringify({ number: normalizedPhone, text: messageToSend }),
      });

      if (!sendResponse.ok) {
        const errText = await sendResponse.text();
        console.error(`❌ Evolution API error: ${errText}`);
        await supabase.from("ai_followup_queue").update({
          status: "error",
          error_message: `Evolution API: ${sendResponse.status} - ${errText.slice(0, 200)}`,
        }).eq("id", followupId);
        return new Response(
          JSON.stringify({ error: "Failed to send message", details: errText }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Marcar como enviado + mover conversa para "assigned"
      const updatePromises: Promise<any>[] = [
        supabase.from("ai_followup_queue").update({
          status: "sent",
          sent_at: new Date().toISOString(),
          generated_message: messageToSend,
        }).eq("id", followupId),
      ];

      // Atualizar status da conversa para "assigned" após envio
      if (followup.conversation_id) {
        updatePromises.push(
          supabase.from("whatsapp_conversations").update({
            status: "assigned",
          }).eq("id", followup.conversation_id)
        );
      }

      await Promise.all(updatePromises);

      console.log(`✅ Follow-up ${followupId} sent successfully. Conversation ${followup.conversation_id || 'N/A'} → assigned`);

      return new Response(
        JSON.stringify({ success: true, message: "Follow-up sent" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ====================================================================
    // ACTION: reject_followup
    // Frontend rejeita follow-up da fila
    // ====================================================================
    if (action === "reject_followup") {
      const { followupId } = body;
      if (!followupId) {
        return new Response(
          JSON.stringify({ error: "followupId required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      await supabase.from("ai_followup_queue").update({
        status: "rejected",
      }).eq("id", followupId);

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ====================================================================
    // ACTION: get_pending_followups
    // Frontend busca follow-ups prontos para aprovação
    // ====================================================================
    if (action === "get_pending_followups") {
      const { organizationId } = body;
      if (!organizationId) {
        return new Response(
          JSON.stringify({ error: "organizationId required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: followups, error: fErr } = await supabase
        .from("ai_followup_queue")
        .select(`
          id, lead_id, conversation_id, trigger_type, 
          generated_message, status, scheduled_for, 
          created_at, whatsapp_instance_id, ai_model_used
        `)
        .eq("organization_id", organizationId)
        .in("status", ["ready", "pending", "generating"])
        .order("created_at", { ascending: false })
        .limit(50);

      if (fErr) {
        return new Response(
          JSON.stringify({ error: fErr.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Enriquecer com dados do lead (incluindo funnel_stage_id para filtro)
      const leadIds = [...new Set((followups || []).map((f: any) => f.lead_id).filter(Boolean))];
      let leadsMap: Record<string, any> = {};

      if (leadIds.length > 0) {
        const { data: leads, error: leadsErr } = await supabase
          .from("leads")
          .select("id, name, whatsapp, funnel_stage_id")
          .in("id", leadIds);
        if (leadsErr) console.error("❌ Error fetching leads:", JSON.stringify(leadsErr));
        for (const lead of leads || []) {
          leadsMap[lead.id] = lead;
        }
      }

      // Buscar config para excluded_stage_ids
      let excludedStageIds: string[] = [];
      const { data: orgData } = await supabase
        .from("organizations")
        .select("ai_followup_config")
        .eq("id", organizationId)
        .single();
      if (orgData?.ai_followup_config) {
        excludedStageIds = (orgData.ai_followup_config as any)?.excluded_stage_ids || [];
      }

      // Enriquecer com dados da conversa
      const convIds = [...new Set((followups || []).map((f: any) => f.conversation_id).filter(Boolean))];
      let convsMap: Record<string, any> = {};

      if (convIds.length > 0) {
        const { data: convs } = await supabase
          .from("whatsapp_conversations")
          .select("id, contact_name, contact_phone, instance_id")
          .in("id", convIds);
        for (const conv of convs || []) {
          convsMap[conv.id] = conv;
        }
      }

      const enriched = (followups || [])
        .filter((f: any) => {
          // Filter out leads in excluded funnel stages
          if (excludedStageIds.length > 0) {
            const lead = leadsMap[f.lead_id];
            if (lead?.funnel_stage_id && excludedStageIds.includes(lead.funnel_stage_id)) {
              return false;
            }
          }
          return true;
        })
        .map((f: any) => ({
          ...f,
          lead: leadsMap[f.lead_id] || null,
          conversation: convsMap[f.conversation_id] || null,
        }));

      return new Response(
        JSON.stringify({ success: true, followups: enriched }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ====================================================================
    // ACTION: generate_followup_message
    // VPS chama após gerar mensagem com Claude para atualizar item pendente
    // Recebe: followupId, generatedMessage, conversationId?, whatsappInstanceId?, aiModelUsed?, tokensUsed?
    // Muda status: pending → ready
    // ====================================================================
    if (action === "generate_followup_message") {
      const { followupId, generatedMessage, conversationId, whatsappInstanceId, aiModelUsed, tokensUsed } = body;

      if (!followupId || !generatedMessage) {
        return new Response(
          JSON.stringify({ error: "followupId and generatedMessage required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Buscar o item atual para validar
      const { data: existing, error: fetchErr } = await supabase
        .from("ai_followup_queue")
        .select("id, status, lead_id, organization_id")
        .eq("id", followupId)
        .single();

      if (fetchErr || !existing) {
        return new Response(
          JSON.stringify({ error: "Follow-up not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (existing.status !== "pending" && existing.status !== "generating") {
        return new Response(
          JSON.stringify({ error: `Cannot generate for status '${existing.status}', expected 'pending' or 'generating'` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Se não veio conversationId, tentar encontrar automaticamente pelo lead
      let finalConversationId = conversationId || null;
      let finalInstanceId = whatsappInstanceId || null;

      if (!finalConversationId && existing.lead_id) {
        const { data: lead } = await supabase
          .from("leads")
          .select("whatsapp")
          .eq("id", existing.lead_id)
          .single();

        if (lead?.whatsapp) {
          const phone = lead.whatsapp.replace(/\D/g, "");
          // Buscar conversa mais recente desse telefone na org
          const { data: conv } = await supabase
            .from("whatsapp_conversations")
            .select("id, instance_id")
            .eq("organization_id", existing.organization_id)
            .eq("phone_number", phone)
            .order("last_message_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (conv) {
            finalConversationId = conv.id;
            if (!finalInstanceId) finalInstanceId = conv.instance_id;
          }
        }
      }

      // Atualizar o item com mensagem gerada e status ready
      const updateData: any = {
        generated_message: generatedMessage,
        status: "ready",
        ai_model_used: aiModelUsed || null,
        tokens_used: tokensUsed || null,
      };
      if (finalConversationId) updateData.conversation_id = finalConversationId;
      if (finalInstanceId) updateData.whatsapp_instance_id = finalInstanceId;

      const { error: updateErr } = await supabase
        .from("ai_followup_queue")
        .update(updateData)
        .eq("id", followupId);

      if (updateErr) {
        console.error("❌ Error updating followup:", updateErr);
        return new Response(
          JSON.stringify({ error: updateErr.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`✅ Follow-up ${followupId} generated and ready. conv=${finalConversationId}, instance=${finalInstanceId}`);

      return new Response(
        JSON.stringify({ success: true, conversationId: finalConversationId, instanceId: finalInstanceId }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: `Unknown action: ${action}` }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("❌ Super IA Context error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
