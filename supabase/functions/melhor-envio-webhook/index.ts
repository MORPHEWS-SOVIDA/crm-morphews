import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Map Melhor Envio statuses to our internal status keys
const statusMapping: Record<string, string> = {
  'posted': 'posted',
  'in_transit': 'posted',
  'out_for_delivery': 'in_destination_city',
  'delivered': 'delivered',
  'returning_to_sender': 'returning_to_sender',
  'failed_delivery_attempt': 'attempt_1_failed',
  // Add more mappings as needed
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // For webhook validation (GET request from Melhor Envio)
    if (req.method === 'GET') {
      console.log('[melhor-envio-webhook] Validation request received');
      return new Response(
        JSON.stringify({ status: 'ok', message: 'Webhook endpoint active' }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Process POST webhook
    const payload = await req.json();
    console.log('[melhor-envio-webhook] Received payload:', JSON.stringify(payload));

    const { event, data } = payload;

    if (!event || !data) {
      console.log('[melhor-envio-webhook] Missing event or data');
      return new Response(
        JSON.stringify({ success: true, message: 'Acknowledged' }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Handle different event types
    switch (event) {
      case 'label.created':
      case 'label.updated':
      case 'shipment.tracking':
        await handleTrackingUpdate(supabase, data, event);
        break;
      
      case 'shipment.delivered':
        await handleDelivered(supabase, data);
        break;

      case 'shipment.posted':
        await handlePosted(supabase, data);
        break;

      default:
        console.log(`[melhor-envio-webhook] Unhandled event type: ${event}`);
    }

    return new Response(
      JSON.stringify({ success: true, event }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[melhor-envio-webhook] Error:', errorMessage);
    // Always return 200 to prevent retry loops
    return new Response(
      JSON.stringify({ success: true, error: errorMessage }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

async function handleTrackingUpdate(supabase: any, data: any, event: string) {
  const { tracking_code, status, description } = data;
  
  if (!tracking_code) {
    console.log('[melhor-envio-webhook] No tracking code in data');
    return;
  }

  console.log(`[melhor-envio-webhook] Updating tracking for ${tracking_code}: ${status}`);

  // Get label info including sale_id and organization_id
  const { data: label, error: labelError } = await supabase
    .from('melhor_envio_labels')
    .select('id, sale_id, organization_id')
    .eq('tracking_code', tracking_code)
    .single();

  if (labelError || !label) {
    console.log('[melhor-envio-webhook] Label not found:', labelError);
    return;
  }

  // Update label status
  const { error } = await supabase
    .from('melhor_envio_labels')
    .update({
      status: status || 'tracking_updated',
      updated_at: new Date().toISOString(),
    })
    .eq('tracking_code', tracking_code);

  if (error) {
    console.error('[melhor-envio-webhook] Error updating label:', error);
  }

  // Map to internal status and trigger notification
  const internalStatus = statusMapping[status] || status;
  if (label.sale_id && label.organization_id) {
    await triggerTrackingNotification(supabase, label.organization_id, label.sale_id, internalStatus);
  }
}

async function handlePosted(supabase: any, data: any) {
  const { tracking_code } = data;
  
  if (!tracking_code) return;

  console.log(`[melhor-envio-webhook] Marking as posted: ${tracking_code}`);

  // Get label info
  const { data: label, error: labelError } = await supabase
    .from('melhor_envio_labels')
    .select('id, sale_id, organization_id, price_cents')
    .eq('tracking_code', tracking_code)
    .single();

  if (labelError || !label) {
    console.log('[melhor-envio-webhook] Label not found:', labelError);
    return;
  }

  // Update label as posted
  const { error } = await supabase
    .from('melhor_envio_labels')
    .update({
      status: 'posted',
      posted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('tracking_code', tracking_code);

  if (error) {
    console.error('[melhor-envio-webhook] Error updating posted status:', error);
  }

  // Update sale shipping status
  if (label.sale_id) {
    await supabase
      .from('sales')
      .update({
        shipping_status: 'shipped',
        carrier_tracking_status: 'posted',
        updated_at: new Date().toISOString(),
      })
      .eq('id', label.sale_id);
  }

  // Trigger notification for 'posted' status
  if (label.sale_id && label.organization_id) {
    await triggerTrackingNotification(supabase, label.organization_id, label.sale_id, 'posted');
  }
}

async function handleDelivered(supabase: any, data: any) {
  const { tracking_code } = data;
  
  if (!tracking_code) return;

  console.log(`[melhor-envio-webhook] Marking as delivered: ${tracking_code}`);

  // Update label as delivered
  const { data: label, error } = await supabase
    .from('melhor_envio_labels')
    .update({
      status: 'delivered',
      updated_at: new Date().toISOString(),
    })
    .eq('tracking_code', tracking_code)
    .select('sale_id, organization_id')
    .single();

  if (error) {
    console.error('[melhor-envio-webhook] Error updating delivered status:', error);
    return;
  }

  // If linked to a sale, update sale status
  if (label?.sale_id) {
    await supabase
      .from('sales')
      .update({
        shipping_status: 'delivered',
        carrier_tracking_status: 'delivered',
        updated_at: new Date().toISOString(),
      })
      .eq('id', label.sale_id);

    // Trigger notification for 'delivered' status
    if (label.organization_id) {
      await triggerTrackingNotification(supabase, label.organization_id, label.sale_id, 'delivered');
    }
  }
}

async function triggerTrackingNotification(
  supabase: any, 
  organizationId: string, 
  saleId: string, 
  statusKey: string
) {
  try {
    console.log(`[melhor-envio-webhook] Triggering notification for status: ${statusKey}`);

    // Get the tracking status configuration for this org and status
    const { data: statusConfig, error: configError } = await supabase
      .from('carrier_tracking_statuses')
      .select('whatsapp_instance_id, message_template, media_type, media_url, media_filename, is_active')
      .eq('organization_id', organizationId)
      .eq('status_key', statusKey)
      .single();

    if (configError || !statusConfig) {
      console.log(`[melhor-envio-webhook] No status config found for ${statusKey}`);
      return;
    }

    if (!statusConfig.is_active || !statusConfig.message_template || !statusConfig.whatsapp_instance_id) {
      console.log(`[melhor-envio-webhook] Status ${statusKey} is not configured for notifications`);
      return;
    }

    // Get sale info with lead data
    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .select(`
        id,
        lead_id,
        seller_user_id,
        leads!inner(id, name, whatsapp, lead_products(name))
      `)
      .eq('id', saleId)
      .single();

    if (saleError || !sale || !sale.leads) {
      console.log(`[melhor-envio-webhook] Sale or lead not found: ${saleError?.message}`);
      return;
    }

    const lead = sale.leads;
    if (!lead.whatsapp) {
      console.log(`[melhor-envio-webhook] Lead has no WhatsApp number`);
      return;
    }

    // Get seller name if available
    let sellerName = '';
    if (sale.seller_user_id) {
      const { data: seller } = await supabase
        .from('profiles')
        .select('first_name, last_name')
        .eq('user_id', sale.seller_user_id)
        .single();
      
      if (seller) {
        sellerName = `${seller.first_name || ''} ${seller.last_name || ''}`.trim();
      }
    }

    // Replace variables in message template
    const leadName = lead.name || '';
    const firstName = leadName.split(' ')[0] || '';
    const productName = (lead.lead_products as any)?.name || '';

    let finalMessage = statusConfig.message_template
      .replace(/\{\{nome\}\}/g, leadName)
      .replace(/\{\{primeiro_nome\}\}/g, firstName)
      .replace(/\{\{vendedor\}\}/g, sellerName)
      .replace(/\{\{produto\}\}/g, productName);

    console.log(`[melhor-envio-webhook] Scheduling message for lead ${lead.id}`);

    // Insert scheduled message
    const { error: insertError } = await supabase
      .from('lead_scheduled_messages')
      .insert({
        lead_id: lead.id,
        organization_id: organizationId,
        whatsapp_instance_id: statusConfig.whatsapp_instance_id,
        final_message: finalMessage,
        scheduled_at: new Date().toISOString(),
        status: 'pending',
        media_type: statusConfig.media_type || null,
        media_url: statusConfig.media_url || null,
        media_filename: statusConfig.media_filename || null,
      });

    if (insertError) {
      console.error(`[melhor-envio-webhook] Error scheduling message:`, insertError);
    } else {
      console.log(`[melhor-envio-webhook] Message scheduled successfully for ${statusKey}`);
    }

  } catch (err) {
    console.error(`[melhor-envio-webhook] Error in triggerTrackingNotification:`, err);
  }
}
