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
  const { tracking_code, status, description, order_id } = data;
  
  if (!tracking_code) {
    console.log('[melhor-envio-webhook] No tracking code in data');
    return;
  }

  console.log(`[melhor-envio-webhook] Updating tracking for ${tracking_code}: ${status} (order_id: ${order_id})`);

  // Try to find label by tracking_code first, then by melhor_envio_order_id (UUID)
  let label: any = null;
  let labelError: any = null;
  
  // First try: exact tracking_code match
  const result1 = await supabase
    .from('melhor_envio_labels')
    .select('id, sale_id, organization_id, tracking_code, melhor_envio_order_id')
    .eq('tracking_code', tracking_code)
    .single();
  
  if (result1.data) {
    label = result1.data;
  } else if (order_id) {
    // Second try: find by melhor_envio_order_id (the UUID we saved when tracking wasn't available)
    const result2 = await supabase
      .from('melhor_envio_labels')
      .select('id, sale_id, organization_id, tracking_code, melhor_envio_order_id')
      .eq('melhor_envio_order_id', order_id)
      .single();
    
    if (result2.data) {
      label = result2.data;
      console.log(`[melhor-envio-webhook] Found label by order_id: ${order_id}`);
    } else {
      labelError = result2.error;
    }
  } else {
    // Third try: the tracking_code we received might be in melhor_envio_order_id field
    const result3 = await supabase
      .from('melhor_envio_labels')
      .select('id, sale_id, organization_id, tracking_code, melhor_envio_order_id')
      .eq('melhor_envio_order_id', tracking_code)
      .single();
    
    if (result3.data) {
      label = result3.data;
      console.log(`[melhor-envio-webhook] Found label by tracking_code as order_id`);
    } else {
      labelError = result3.error;
    }
  }

  if (!label) {
    console.log('[melhor-envio-webhook] Label not found:', labelError);
    return;
  }

  // Check if we need to update the tracking_code (it was saved as UUID but now we have the real one)
  const needsTrackingUpdate = label.tracking_code !== tracking_code && 
    label.tracking_code === label.melhor_envio_order_id;

  // Update label status and optionally the tracking code
  const updateData: any = {
    status: status || 'tracking_updated',
    updated_at: new Date().toISOString(),
  };
  
  if (needsTrackingUpdate) {
    updateData.tracking_code = tracking_code;
    console.log(`[melhor-envio-webhook] Updating tracking_code from ${label.tracking_code} to ${tracking_code}`);
  }

  const { error } = await supabase
    .from('melhor_envio_labels')
    .update(updateData)
    .eq('id', label.id);

  if (error) {
    console.error('[melhor-envio-webhook] Error updating label:', error);
  }

  // Also update the sale's tracking_code if needed
  if (needsTrackingUpdate && label.sale_id) {
    await supabase
      .from('sales')
      .update({ tracking_code: tracking_code })
      .eq('id', label.sale_id);
    console.log(`[melhor-envio-webhook] Updated sale ${label.sale_id} tracking_code to ${tracking_code}`);
  }

  // Map to internal status and trigger notification
  const internalStatus = statusMapping[status] || status;
  if (label.sale_id && label.organization_id) {
    await triggerTrackingNotification(supabase, label.organization_id, label.sale_id, internalStatus);
  }
}

async function handlePosted(supabase: any, data: any) {
  const { tracking_code, order_id } = data;
  
  if (!tracking_code) return;

  console.log(`[melhor-envio-webhook] Marking as posted: ${tracking_code} (order_id: ${order_id})`);

  // Try to find label by tracking_code or by melhor_envio_order_id
  let label: any = null;
  
  const result1 = await supabase
    .from('melhor_envio_labels')
    .select('id, sale_id, organization_id, price_cents, tracking_code, melhor_envio_order_id')
    .eq('tracking_code', tracking_code)
    .single();
  
  if (result1.data) {
    label = result1.data;
  } else if (order_id) {
    const result2 = await supabase
      .from('melhor_envio_labels')
      .select('id, sale_id, organization_id, price_cents, tracking_code, melhor_envio_order_id')
      .eq('melhor_envio_order_id', order_id)
      .single();
    if (result2.data) label = result2.data;
  } else {
    // Try tracking_code as order_id
    const result3 = await supabase
      .from('melhor_envio_labels')
      .select('id, sale_id, organization_id, price_cents, tracking_code, melhor_envio_order_id')
      .eq('melhor_envio_order_id', tracking_code)
      .single();
    if (result3.data) label = result3.data;
  }

  if (!label) {
    console.log('[melhor-envio-webhook] Label not found for posted event');
    return;
  }

  // Check if we need to update the tracking_code
  const needsTrackingUpdate = label.tracking_code !== tracking_code && 
    label.tracking_code === label.melhor_envio_order_id;

  const updateData: any = {
    status: 'posted',
    posted_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  
  if (needsTrackingUpdate) {
    updateData.tracking_code = tracking_code;
    console.log(`[melhor-envio-webhook] Posted: Updating tracking_code to ${tracking_code}`);
  }

  const { error } = await supabase
    .from('melhor_envio_labels')
    .update(updateData)
    .eq('id', label.id);

  if (error) {
    console.error('[melhor-envio-webhook] Error updating posted status:', error);
  }

  // Update sale shipping status and tracking_code if needed
  if (label.sale_id) {
    const saleUpdate: any = {
      shipping_status: 'shipped',
      carrier_tracking_status: 'posted',
      updated_at: new Date().toISOString(),
    };
    if (needsTrackingUpdate) {
      saleUpdate.tracking_code = tracking_code;
    }
    await supabase
      .from('sales')
      .update(saleUpdate)
      .eq('id', label.sale_id);
  }

  // Trigger notification for 'posted' status
  if (label.sale_id && label.organization_id) {
    await triggerTrackingNotification(supabase, label.organization_id, label.sale_id, 'posted');
  }
}

async function handleDelivered(supabase: any, data: any) {
  const { tracking_code, order_id } = data;
  
  if (!tracking_code) return;

  console.log(`[melhor-envio-webhook] Marking as delivered: ${tracking_code}`);

  // Try to find label by tracking_code or by melhor_envio_order_id
  let label: any = null;
  
  const result1 = await supabase
    .from('melhor_envio_labels')
    .select('id, sale_id, organization_id, tracking_code, melhor_envio_order_id')
    .eq('tracking_code', tracking_code)
    .single();
  
  if (result1.data) {
    label = result1.data;
  } else if (order_id) {
    const result2 = await supabase
      .from('melhor_envio_labels')
      .select('id, sale_id, organization_id, tracking_code, melhor_envio_order_id')
      .eq('melhor_envio_order_id', order_id)
      .single();
    if (result2.data) label = result2.data;
  } else {
    const result3 = await supabase
      .from('melhor_envio_labels')
      .select('id, sale_id, organization_id, tracking_code, melhor_envio_order_id')
      .eq('melhor_envio_order_id', tracking_code)
      .single();
    if (result3.data) label = result3.data;
  }

  if (!label) {
    console.log('[melhor-envio-webhook] Label not found for delivered event');
    return;
  }

  // Check if we need to update the tracking_code
  const needsTrackingUpdate = label.tracking_code !== tracking_code && 
    label.tracking_code === label.melhor_envio_order_id;

  const updateData: any = {
    status: 'delivered',
    updated_at: new Date().toISOString(),
  };
  
  if (needsTrackingUpdate) {
    updateData.tracking_code = tracking_code;
  }

  const { error } = await supabase
    .from('melhor_envio_labels')
    .update(updateData)
    .eq('id', label.id);

  if (error) {
    console.error('[melhor-envio-webhook] Error updating delivered status:', error);
    return;
  }

  // If linked to a sale, update sale status
  if (label.sale_id) {
    const saleUpdate: any = {
      shipping_status: 'delivered',
      carrier_tracking_status: 'delivered',
      updated_at: new Date().toISOString(),
    };
    if (needsTrackingUpdate) {
      saleUpdate.tracking_code = tracking_code;
    }
    await supabase
      .from('sales')
      .update(saleUpdate)
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

    // Get sale info with lead data, items and label info
    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .select(`
        id,
        romaneio_number,
        total_cents,
        tracking_code,
        lead_id,
        seller_user_id,
        leads!inner(id, name, whatsapp, lead_products(name, brand)),
        sale_items(product_name),
        melhor_envio_labels(tracking_code, company_name, service_name, melhor_envio_order_id)
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

    // Prepare all variables for replacement
    const leadName = lead.name || '';
    const firstName = leadName.split(' ')[0] || '';
    const productName = (lead.lead_products as any)?.name || (sale.sale_items as any)?.[0]?.product_name || '';
    const brandName = (lead.lead_products as any)?.brand || '';
    
    // Get tracking info from melhor_envio_labels or sale
    const melhorEnvioLabel = (sale.melhor_envio_labels as any)?.[0];
    const trackingCode = sale.tracking_code || melhorEnvioLabel?.tracking_code || '';
    const carrierName = melhorEnvioLabel?.company_name || 'Correios';
    const orderId = melhorEnvioLabel?.melhor_envio_order_id || '';
    
    // Build tracking link - use the real tracking code if available, not the UUID
    // Real tracking codes from Correios don't have dashes and look like "AB123456789BR"
    const isRealTrackingCode = trackingCode && !trackingCode.includes('-');
    let trackingLink = '';
    if (isRealTrackingCode && trackingCode) {
      // Use Melhor Rastreio for easy tracking
      const carrierType = carrierName.toLowerCase().includes('correios') ? 'correios' : 'rastreio';
      trackingLink = `https://www.melhorrastreio.com.br/app/${carrierType}/${trackingCode}`;
    } else if (orderId) {
      // If no real tracking code yet, link to melhor envio order (limited usefulness for customer)
      trackingLink = `https://www.melhorrastreio.com.br/rastreio/${orderId}`;
    }
    
    // Format value
    const totalValue = sale.total_cents ? `R$ ${(sale.total_cents / 100).toFixed(2).replace('.', ',')}` : '';
    const saleNumber = sale.romaneio_number ? String(sale.romaneio_number) : sale.id.slice(0, 8);

    let finalMessage = statusConfig.message_template
      .replace(/\{\{nome\}\}/g, leadName)
      .replace(/\{\{primeiro_nome\}\}/g, firstName)
      .replace(/\{\{vendedor\}\}/g, sellerName)
      .replace(/\{\{produto\}\}/g, productName)
      .replace(/\{\{marca\}\}/g, brandName)
      .replace(/\{\{link_rastreio\}\}/g, trackingLink)
      .replace(/\{\{codigo_rastreio\}\}/g, isRealTrackingCode ? trackingCode : '')
      .replace(/\{\{transportadora\}\}/g, carrierName)
      .replace(/\{\{numero_venda\}\}/g, saleNumber)
      .replace(/\{\{valor\}\}/g, totalValue);

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
