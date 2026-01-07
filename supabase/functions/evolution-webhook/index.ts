import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function normalizeWhatsApp(phone: string): string {
  let clean = (phone || "").replace(/\D/g, "");
  if (!clean) return "";
  if (!clean.startsWith("55")) clean = `55${clean}`;
  if (clean.length === 12 && clean.startsWith("55")) {
    clean = clean.slice(0, 4) + "9" + clean.slice(4);
  }
  return clean;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));

    // Evolution envia o nome da instância no payload
    const instanceName = body?.instance || body?.instanceName || "";
    const event = body?.event || "";

    console.log("Evolution Webhook received:", {
      event,
      instanceName,
      topLevelKeys: Object.keys(body || {}).slice(0, 10),
    });

    // =====================
    // CONNECTION UPDATE
    // =====================
    if (event === "connection.update" || event === "CONNECTION_UPDATE") {
      const state = body?.data?.state || body?.state || "";
      const isConnected = state === "open";

      console.log("Connection update:", { instanceName, state, isConnected });

      if (instanceName) {
        // Buscar instância pelo evolution_instance_id
        const { data: instance } = await supabase
          .from("whatsapp_instances")
          .select("id, organization_id")
          .eq("evolution_instance_id", instanceName)
          .single();

        if (instance) {
          await supabase
            .from("whatsapp_instances")
            .update({
              is_connected: isConnected,
              status: isConnected ? "connected" : state,
              updated_at: new Date().toISOString(),
            })
            .eq("id", instance.id);

          console.log("Instance status updated:", { instanceId: instance.id, isConnected });
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // =====================
    // QR CODE UPDATED
    // =====================
    if (event === "qrcode.updated" || event === "QRCODE_UPDATED") {
      const qrBase64 = body?.data?.qrcode?.base64 || body?.qrcode?.base64 || "";

      console.log("QR Code update:", { instanceName, hasQr: !!qrBase64 });

      if (instanceName && qrBase64) {
        await supabase
          .from("whatsapp_instances")
          .update({
            qr_code_base64: qrBase64,
            status: "waiting_qr",
            updated_at: new Date().toISOString(),
          })
          .eq("evolution_instance_id", instanceName);
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // =====================
    // MESSAGES UPSERT
    // =====================
    if (event === "messages.upsert" || event === "MESSAGES_UPSERT") {
      const data = body?.data || body;
      const key = data?.key || {};
      const message = data?.message || {};
      const pushName = data?.pushName || "";

      // Extrair telefone do remetente
      const remoteJid = key?.remoteJid || "";
      const isFromMe = key?.fromMe === true;
      const isGroup = remoteJid.includes("@g.us");

      // Ignorar mensagens próprias e de grupos
      if (isFromMe || isGroup) {
        return new Response(JSON.stringify({ success: true, ignored: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const fromPhoneRaw = remoteJid.split("@")[0] || "";
      const fromPhone = normalizeWhatsApp(fromPhoneRaw);

      // Extrair texto da mensagem
      const text = message?.conversation || 
                   message?.extendedTextMessage?.text || 
                   message?.text || 
                   "";

      console.log("Message received:", {
        instanceName,
        fromPhone,
        pushName,
        textPreview: String(text).substring(0, 100),
      });

      // Buscar a instância para saber a organização
      const { data: instance } = await supabase
        .from("whatsapp_instances")
        .select("id, organization_id, phone_number")
        .eq("evolution_instance_id", instanceName)
        .single();

      if (!instance) {
        console.log("Instance not found:", instanceName);
        return new Response(JSON.stringify({ success: true, ignored: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Atualizar phone_number da instância se ainda não tiver
      if (!instance.phone_number && body?.data?.owner) {
        const ownerPhone = normalizeWhatsApp(body.data.owner.split("@")[0]);
        if (ownerPhone) {
          await supabase
            .from("whatsapp_instances")
            .update({ phone_number: ownerPhone })
            .eq("id", instance.id);
        }
      }

      const organizationId = instance.organization_id;

      // Buscar ou criar conversa
      let { data: conversation } = await supabase
        .from("whatsapp_conversations")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("instance_id", instance.id)
        .eq("phone_number", fromPhone)
        .single();

      if (!conversation) {
        const { data: newConvo, error: convoError } = await supabase
          .from("whatsapp_conversations")
          .insert({
            organization_id: organizationId,
            instance_id: instance.id,
            phone_number: fromPhone,
            sendable_phone: fromPhone,
            customer_phone_e164: fromPhone,
            contact_name: pushName || `+${fromPhone}`,
            last_message_at: new Date().toISOString(),
            unread_count: 1,
          })
          .select()
          .single();

        if (convoError) {
          console.error("Error creating conversation:", convoError);
        } else {
          conversation = newConvo;
        }
      } else {
        // Atualizar conversa existente
        await supabase
          .from("whatsapp_conversations")
          .update({
            last_message_at: new Date().toISOString(),
            unread_count: supabase.rpc("increment", { x: 1 }),
          })
          .eq("id", conversation.id);
      }

      // Salvar mensagem
      if (conversation && text) {
        const messageId = key?.id || crypto.randomUUID();

        await supabase
          .from("whatsapp_messages")
          .upsert({
            id: messageId,
            organization_id: organizationId,
            instance_id: instance.id,
            conversation_id: conversation.id,
            sender_phone: fromPhone,
            sender_name: pushName || null,
            message_type: "text",
            content: text,
            is_from_me: false,
            status: "received",
            timestamp: new Date().toISOString(),
            raw_payload: body,
          }, {
            onConflict: "id",
          });

        console.log("Message saved:", { messageId, conversationId: conversation.id });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Evento não tratado
    console.log("Unhandled event:", event);
    return new Response(JSON.stringify({ success: true, unhandled: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("evolution-webhook error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
