import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EVOLUTION_API_URL = Deno.env.get("EVOLUTION_API_URL") || "";
const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY") || "";

/**
 * Abandoned Cart Recovery - Cron Job
 * 
 * Runs every hour to find carts abandoned for 30+ minutes
 * and schedules WhatsApp recovery messages.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("🛒 Starting abandoned cart recovery...");

    // Find carts abandoned for 30+ minutes, not yet recovered
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: abandonedCarts, error: cartsError } = await supabase
      .from('ecommerce_carts')
      .select(`
        id,
        organization_id,
        lead_id,
        storefront_id,
        items,
        total_cents,
        customer_email,
        customer_phone,
        created_at
      `)
      .eq('status', 'active')
      .lt('updated_at', thirtyMinutesAgo)
      .gt('created_at', oneDayAgo)
      .is('recovery_sent_at', null);

    if (cartsError) {
      console.error("Error fetching carts:", cartsError);
      throw cartsError;
    }

    console.log(`Found ${abandonedCarts?.length || 0} abandoned carts`);

    let recoveredCount = 0;
    let errorCount = 0;

    for (const cart of abandonedCarts || []) {
      try {
        // Get storefront info
        const { data: storefront } = await supabase
          .from('tenant_storefronts')
          .select('name, slug, organization_id')
          .eq('id', cart.storefront_id)
          .single();

        if (!storefront) continue;

        // Get organization WhatsApp instance
        const { data: org } = await supabase
          .from('organizations')
          .select('whatsapp_notification_instance_id')
          .eq('id', cart.organization_id)
          .single();

        if (!org?.whatsapp_notification_instance_id) continue;

        const { data: instance } = await supabase
          .from('whatsapp_instances')
          .select('instance_name')
          .eq('id', org.whatsapp_notification_instance_id)
          .single();

        if (!instance?.instance_name) continue;

        // Prepare recovery message
        const items = cart.items as { name?: string; quantity?: number }[] || [];
        const productNames = items.slice(0, 3).map(i => i.name || 'Produto').join(', ');
        const cartLink = `${supabaseUrl.replace('.supabase.co', '.lovable.app')}/loja/${storefront.slug}/carrinho`;

        // Get lead name if available
        let customerName = 'Cliente';
        if (cart.lead_id) {
          const { data: lead } = await supabase
            .from('leads')
            .select('name')
            .eq('id', cart.lead_id)
            .single();
          customerName = lead?.name?.split(' ')[0] || 'Cliente';
        }

        const message = `🛒 *Seu carrinho está te esperando!*\n\nOlá ${customerName}! Você deixou alguns itens no carrinho:\n\n📦 ${productNames}\n\nFinalize sua compra com desconto especial:\n${cartLink}\n\n_${storefront.name}_`;

        // Send WhatsApp if phone available
        const phone = cart.customer_phone?.replace(/\D/g, '');
        if (phone && EVOLUTION_API_URL && EVOLUTION_API_KEY) {
          const normalizedPhone = phone.startsWith('55') ? phone : `55${phone}`;

          await fetch(`${EVOLUTION_API_URL}/message/sendText/${instance.instance_name}`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: EVOLUTION_API_KEY,
            },
            body: JSON.stringify({
              number: normalizedPhone,
              text: message,
            }),
          });

          console.log(`✅ Recovery sent for cart ${cart.id}`);
        }

        // Trigger abandoned cart email sequence
        if (cart.customer_email) {
          try {
            const triggerUrl = `${supabaseUrl}/functions/v1/trigger-email-sequence`;
            await fetch(triggerUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseServiceKey}`,
              },
              body: JSON.stringify({
                trigger_type: 'abandoned_cart',
                organization_id: cart.organization_id,
                lead_id: cart.lead_id,
                email: cart.customer_email,
                triggered_by: cart.id,
              }),
            });
            console.log(`📧 Abandoned cart email sequence triggered for ${cart.customer_email}`);
          } catch (emailError) {
            console.error(`Failed to trigger email sequence for cart ${cart.id}:`, emailError);
          }
        }

        // Mark cart as recovery sent
        await supabase
          .from('ecommerce_carts')
          .update({
            status: 'abandoned',
            recovery_sent_at: new Date().toISOString(),
          })
          .eq('id', cart.id);

        // Schedule follow-up in lead_scheduled_messages if lead exists
        if (cart.lead_id) {
          const scheduledFor = new Date(Date.now() + 24 * 60 * 60 * 1000); // +24h

          await supabase
            .from('lead_scheduled_messages')
            .insert({
              organization_id: cart.organization_id,
              lead_id: cart.lead_id,
              instance_id: org.whatsapp_notification_instance_id,
              message_type: 'text',
              content: `🎁 *Última chance!*\n\nOlá ${customerName}, seu carrinho ainda está reservado!\n\nFinalize agora: ${cartLink}`,
              scheduled_for: scheduledFor.toISOString(),
              source: 'abandoned_cart',
            });
        }

        recoveredCount++;
      } catch (e) {
        console.error(`Error processing cart ${cart.id}:`, e);
        errorCount++;
      }
    }

    console.log(`🎯 Recovery complete: ${recoveredCount} sent, ${errorCount} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: abandonedCarts?.length || 0,
        recovered: recoveredCount,
        errors: errorCount,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Recovery error:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
