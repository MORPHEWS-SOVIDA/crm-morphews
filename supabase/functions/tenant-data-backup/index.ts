import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Authorization header required");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from token
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error("Invalid user token");
    }

    // Get user's organization
    const { data: membership, error: memberError } = await supabase
      .from("organization_members")
      .select("organization_id, role")
      .eq("user_id", user.id)
      .single();

    if (memberError || !membership) {
      throw new Error("User is not a member of any organization");
    }

    // Only admins/owners can export data
    if (!["owner", "admin"].includes(membership.role)) {
      throw new Error("Only admins and owners can export data");
    }

    const orgId = membership.organization_id;

    // Collect all data for this organization
    const backupData: Record<string, any> = {
      exported_at: new Date().toISOString(),
      organization_id: orgId,
      exported_by: user.email,
    };

    // Organization info
    const { data: org } = await supabase
      .from("organizations")
      .select("*")
      .eq("id", orgId)
      .single();
    backupData.organization = org;

    // Leads
    const { data: leads } = await supabase
      .from("leads")
      .select("*")
      .eq("organization_id", orgId);
    backupData.leads = leads || [];

    // Lead addresses
    const { data: leadAddresses } = await supabase
      .from("lead_addresses")
      .select("*")
      .eq("organization_id", orgId);
    backupData.lead_addresses = leadAddresses || [];

    // Sales
    const { data: sales } = await supabase
      .from("sales")
      .select("*")
      .eq("organization_id", orgId);
    backupData.sales = sales || [];

    // Sale items
    const { data: saleItems } = await supabase
      .from("sale_items")
      .select("*")
      .eq("organization_id", orgId);
    backupData.sale_items = saleItems || [];

    // Sale payments
    const { data: salePayments } = await supabase
      .from("sale_payments")
      .select("*")
      .eq("organization_id", orgId);
    backupData.sale_payments = salePayments || [];

    // Products
    const { data: products } = await supabase
      .from("lead_products")
      .select("*")
      .eq("organization_id", orgId);
    backupData.products = products || [];

    // Profiles (team members)
    const { data: members } = await supabase
      .from("organization_members")
      .select(`
        *,
        profiles:user_id (
          first_name,
          last_name,
          email,
          whatsapp
        )
      `)
      .eq("organization_id", orgId);
    backupData.team_members = members || [];

    // WhatsApp conversations
    const { data: conversations } = await supabase
      .from("whatsapp_conversations")
      .select("*")
      .eq("organization_id", orgId);
    backupData.whatsapp_conversations = conversations || [];

    // WhatsApp messages (limited to last 10000 for performance)
    const { data: messages } = await supabase
      .from("whatsapp_messages")
      .select("*")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .limit(10000);
    backupData.whatsapp_messages = messages || [];

    // Post-sale surveys
    const { data: surveys } = await supabase
      .from("post_sale_surveys")
      .select("*")
      .eq("organization_id", orgId);
    backupData.post_sale_surveys = surveys || [];

    // SAC tickets
    const { data: sacTickets } = await supabase
      .from("sac_tickets")
      .select("*")
      .eq("organization_id", orgId);
    backupData.sac_tickets = sacTickets || [];

    // Lead followups
    const { data: followups } = await supabase
      .from("lead_followups")
      .select("*")
      .eq("organization_id", orgId);
    backupData.lead_followups = followups || [];

    // Lead stage history
    const { data: stageHistory } = await supabase
      .from("lead_stage_history")
      .select("*")
      .eq("organization_id", orgId);
    backupData.lead_stage_history = stageHistory || [];

    // Scheduled messages
    const { data: scheduledMessages } = await supabase
      .from("lead_scheduled_messages")
      .select("*")
      .eq("organization_id", orgId);
    backupData.scheduled_messages = scheduledMessages || [];

    // Contacts
    const { data: contacts } = await supabase
      .from("contacts")
      .select("*")
      .eq("organization_id", orgId);
    backupData.contacts = contacts || [];

    // Partner associations (affiliates, coproducers, industries, factories)
    const { data: partners } = await supabase
      .from("partner_associations")
      .select(`
        *,
        virtual_account:virtual_accounts(id, holder_name, holder_email, holder_document, balance_cents, pending_balance_cents)
      `)
      .eq("organization_id", orgId);
    backupData.partners = partners || [];

    // Virtual accounts
    const { data: virtualAccounts } = await supabase
      .from("virtual_accounts")
      .select("*")
      .eq("organization_id", orgId);
    backupData.virtual_accounts = virtualAccounts || [];

    // Combos
    const { data: combos } = await supabase
      .from("product_combos")
      .select("*, items:product_combo_items(*)")
      .eq("organization_id", orgId);
    backupData.combos = combos || [];

    // Summary stats
    backupData.summary = {
      total_leads: backupData.leads.length,
      total_sales: backupData.sales.length,
      total_products: backupData.products.length,
      total_team_members: backupData.team_members.length,
      total_conversations: backupData.whatsapp_conversations.length,
      total_messages: backupData.whatsapp_messages.length,
      total_contacts: backupData.contacts.length,
      total_partners: backupData.partners.length,
      total_combos: backupData.combos.length,
    };

    return new Response(JSON.stringify(backupData, null, 2), {
      headers: { 
        ...corsHeaders, 
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="backup-${orgId}-${new Date().toISOString().split('T')[0]}.json"`,
      },
    });

  } catch (error: any) {
    console.error("Backup error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
