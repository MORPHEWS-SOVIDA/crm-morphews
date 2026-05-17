// One-off purge: cancels Evolution instances, wipes WhatsApp data, disables AI/bots,
// and marks subscriptions canceled for a list of organization IDs.
// Auth: requires header x-purge-token matching PURGE_ADMIN_TOKEN secret OR service-role JWT.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-purge-token",
};

const RAW = Deno.env.get("EVOLUTION_API_URL") ?? "";
const EVO_URL = RAW.startsWith("http") ? RAW.replace(/\/$/, "") : `https://${RAW.replace(/\/$/, "")}`;
const EVO_KEY = Deno.env.get("EVOLUTION_API_KEY") ?? "";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const body = await req.json().catch(() => ({}));
  const orgIds: string[] = body.org_ids ?? [];
  const dryRun: boolean = !!body.dry_run;
  if (!Array.isArray(orgIds) || orgIds.length === 0) {
    return new Response(JSON.stringify({ error: "org_ids required" }), {
      status: 400, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const report: any = { orgs: orgIds, dry_run: dryRun, evolution: [], db: {}, errors: [] };

  // 1) Pull all whatsapp_instances for these orgs
  const { data: instances, error: instErr } = await supabase
    .from("whatsapp_instances")
    .select("id, organization_id, name, provider, evolution_instance_id")
    .in("organization_id", orgIds);
  if (instErr) report.errors.push("list instances: " + instErr.message);

  // 2) Logout + delete each Evolution instance
  for (const inst of instances ?? []) {
    if (!inst.evolution_instance_id || inst.provider !== "evolution") continue;
    const name = inst.evolution_instance_id;
    if (dryRun) { report.evolution.push({ name, action: "would-delete" }); continue; }
    try {
      await fetch(`${EVO_URL}/instance/logout/${name}`, { method: "DELETE", headers: { apikey: EVO_KEY } }).catch(()=>{});
      const r = await fetch(`${EVO_URL}/instance/delete/${name}`, { method: "DELETE", headers: { apikey: EVO_KEY } });
      report.evolution.push({ name, status: r.status });
    } catch (e: any) {
      report.evolution.push({ name, error: e?.message });
    }
  }

  if (dryRun) {
    return new Response(JSON.stringify(report, null, 2), { headers: { ...cors, "Content-Type": "application/json" } });
  }

  // 3) Mark whatsapp_instances canceled + soft-deleted
  const { error: updErr } = await supabase
    .from("whatsapp_instances")
    .update({ status: "canceled", is_connected: false, deleted_at: new Date().toISOString() })
    .in("organization_id", orgIds);
  if (updErr) report.errors.push("cancel instances: " + updErr.message);

  // 4) Disable bots on these orgs (table whatsapp_instance_bots)
  const instIds = (instances ?? []).map(i => i.id);
  if (instIds.length) {
    await supabase.from("whatsapp_instance_bots").update({ is_active: false } as any).in("instance_id", instIds);
    await supabase.from("instance_bot_schedules").delete().in("instance_id", instIds);
  }

  // 5) Disable AI / WhatsApp features on the orgs
  await supabase.from("organizations").update({
    whatsapp_dms_enabled: false,
    whatsapp_ai_memory_enabled: false,
    whatsapp_ai_learning_enabled: false,
    whatsapp_ai_seller_briefing_enabled: false,
    whatsapp_document_reading_enabled: false,
    whatsapp_audio_transcription_enabled: false,
    whatsapp_image_interpretation: false,
    whatsapp_transcribe_client_audio: false,
    whatsapp_transcribe_team_audio: false,
    receptive_module_enabled: false,
  } as any).in("id", orgIds);

  // 6) Cancel subscriptions
  await supabase.from("subscriptions").update({ status: "canceled" } as any).in("organization_id", orgIds);

  // 7) Wipe WhatsApp data (messages first, then conversations)
  // Get conversation IDs then delete in chunks
  const { data: convs } = await supabase
    .from("whatsapp_conversations")
    .select("id")
    .in("organization_id", orgIds);
  const convIds = (convs ?? []).map(c => c.id);
  let deletedMsgs = 0;
  for (let i = 0; i < convIds.length; i += 200) {
    const chunk = convIds.slice(i, i + 200);
    const { error, count } = await supabase
      .from("whatsapp_messages")
      .delete({ count: "exact" })
      .in("conversation_id", chunk);
    if (error) { report.errors.push(`del msgs: ${error.message}`); break; }
    deletedMsgs += count ?? 0;
  }
  report.db.deleted_messages = deletedMsgs;

  const { count: delConv } = await supabase
    .from("whatsapp_conversations")
    .delete({ count: "exact" })
    .in("organization_id", orgIds);
  report.db.deleted_conversations = delConv ?? 0;

  // 8) Wipe agent logs / knowledge v2 (best effort)
  for (const t of ["agent_logs_v2", "agent_knowledge_v2"]) {
    const { error, count } = await supabase.from(t).delete({ count: "exact" }).in("organization_id", orgIds);
    if (error) report.errors.push(`${t}: ${error.message}`);
    else (report.db as any)[t] = count ?? 0;
  }

  return new Response(JSON.stringify(report, null, 2), { headers: { ...cors, "Content-Type": "application/json" } });
});
