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

      // Buscar config da org
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

      // Buscar conversas com última mensagem inbound (cliente) sem resposta
      // ou última mensagem outbound (agente) sem resposta do cliente
      const cutoffTime = new Date(
        Date.now() - hours * 60 * 60 * 1000
      ).toISOString();
      const cooldownTime = new Date(
        Date.now() - cooldownHours * 60 * 60 * 1000
      ).toISOString();

      // Conversas ativas com mensagem recente do lead
      const { data: conversations } = await supabase
        .from("whatsapp_conversations")
        .select(`
          id, lead_id, contact_name, contact_phone, instance_id,
          last_message_at, status
        `)
        .eq("organization_id", organizationId)
        .in("status", ["open", "with_bot"])
        .lt("last_message_at", cutoffTime)
        .order("last_message_at", { ascending: true })
        .limit(maxResults * 2);

      if (!conversations || conversations.length === 0) {
        return new Response(
          JSON.stringify({ success: true, leads: [] }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Filtrar leads que já receberam follow-up recente
      const leadIds = conversations
        .map((c: any) => c.lead_id)
        .filter(Boolean);

      const { data: recentFollowups } = await supabase
        .from("ai_followup_queue")
        .select("lead_id, created_at")
        .in("lead_id", leadIds)
        .in("status", ["sent", "sending", "ready", "pending"])
        .gte("created_at", cooldownTime);

      const recentFollowupLeads = new Set(
        (recentFollowups || []).map((f: any) => f.lead_id)
      );

      // Contar follow-ups totais por lead
      const { data: followupCounts } = await supabase
        .from("ai_followup_queue")
        .select("lead_id")
        .in("lead_id", leadIds)
        .eq("status", "sent");

      const countMap: Record<string, number> = {};
      for (const f of followupCounts || []) {
        countMap[f.lead_id] = (countMap[f.lead_id] || 0) + 1;
      }

      // Filtrar e retornar leads elegíveis
      const eligibleLeads = conversations
        .filter((c: any) => {
          if (!c.lead_id) return false;
          if (recentFollowupLeads.has(c.lead_id)) return false;
          if ((countMap[c.lead_id] || 0) >= maxPerLead) return false;
          return true;
        })
        .slice(0, maxResults);

      console.log(
        `🔍 Found ${eligibleLeads.length} inactive leads (of ${conversations.length} candidates) for org ${organizationId}`
      );

      return new Response(
        JSON.stringify({ success: true, leads: eligibleLeads, config }),
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
