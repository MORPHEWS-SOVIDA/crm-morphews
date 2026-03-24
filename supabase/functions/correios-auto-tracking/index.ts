import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface LinkeTrackEvent {
  data: string;
  hora: string;
  local: string;
  status: string;
  subStatus?: string[];
}

interface LinkeTrackResponse {
  codigo: string;
  eventos: LinkeTrackEvent[];
  quantidade?: number;
  ultimo?: string;
}

// Map Correios status text to our carrier_tracking_status enum
function mapCorreiosStatus(statusText: string): string | null {
  const lower = statusText.toLowerCase();
  
  if (lower.includes('entregue ao destinatário') || lower.includes('objeto entregue')) {
    return 'delivered';
  }
  if (lower.includes('saiu para entrega')) {
    return 'in_destination_city';
  }
  if (lower.includes('aguardando retirada')) {
    return 'waiting_pickup';
  }
  if (lower.includes('voltando') || lower.includes('devolvido') || lower.includes('retorno')) {
    return 'returning_to_sender';
  }
  if (lower.includes('tentativa de entrega') || lower.includes('não atendido') || lower.includes('ausente')) {
    // We can't easily tell which attempt, so return generic
    return 'attempt_1_failed';
  }
  if (lower.includes('postado') || lower.includes('objeto postado')) {
    return 'posted';
  }
  if (lower.includes('na cidade do destinatário') || lower.includes('unidade de distribuição')) {
    return 'in_destination_city';
  }
  // In transit statuses - keep as 'posted' (already dispatched)
  if (lower.includes('em trânsito') || lower.includes('transferência') || lower.includes('encaminhado')) {
    return 'posted';
  }
  
  return null;
}

// Extract delivery estimate from events
function extractDeliveryEstimate(events: LinkeTrackEvent[]): string | null {
  for (const event of events) {
    // LinkeTrack sometimes includes delivery estimate in subStatus
    if (event.subStatus) {
      for (const sub of event.subStatus) {
        const match = sub.match(/Previsão de Entrega:\s*(\d{2}\/\d{2}\/\d{4})/i);
        if (match) {
          // Convert DD/MM/YYYY to YYYY-MM-DD
          const [dd, mm, yyyy] = match[1].split('/');
          return `${yyyy}-${mm}-${dd}`;
        }
      }
    }
    // Also check main status text
    const match = event.status?.match(/Previsão de Entrega:\s*(\d{2}\/\d{2}\/\d{4})/i);
    if (match) {
      const [dd, mm, yyyy] = match[1].split('/');
      return `${yyyy}-${mm}-${dd}`;
    }
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Fetch all sales with tracking codes that are not yet delivered and not cancelled
    const { data: sales, error: salesError } = await supabase
      .from('sales')
      .select('id, tracking_code, carrier_tracking_status, organization_id, lead_id, seller_user_id')
      .not('tracking_code', 'is', null)
      .neq('tracking_code', '')
      .neq('status', 'cancelled')
      .not('carrier_tracking_status', 'eq', 'delivered')
      .order('created_at', { ascending: false })
      .limit(200);

    if (salesError) throw salesError;

    if (!sales || sales.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'Nenhuma venda para atualizar', updated: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Filter to only valid Correios tracking codes
    const correiosRegex = /^[A-Z]{2}[0-9]{9}[A-Z]{2}$/;
    const validSales = sales.filter(s => 
      s.tracking_code && correiosRegex.test(s.tracking_code.toUpperCase())
    );

    console.log(`[auto-tracking] Found ${validSales.length} sales with valid Correios codes out of ${sales.length} total`);

    let updated = 0;
    let errors = 0;
    const results: Array<{ sale_id: string; tracking_code: string; status: string; error?: string }> = [];

    // Process in batches of 5 with delay to avoid rate limiting
    for (let i = 0; i < validSales.length; i += 5) {
      const batch = validSales.slice(i, i + 5);
      
      const promises = batch.map(async (sale) => {
        try {
          const trackingCode = sale.tracking_code!.toUpperCase();
          
          const response = await fetch(
            `https://api.linketrack.com/track/json?user=teste&token=1abcd00b2731640e886fb41a8a9671ad1434c599dbaa0a0de9a5aa619f29a83f&codigo=${trackingCode}`,
            {
              method: 'GET',
              headers: { 'Accept': 'application/json' },
            }
          );

          if (!response.ok) {
            throw new Error(`LinkeTrack API returned ${response.status}`);
          }

          const data: LinkeTrackResponse = await response.json();

          if (!data.eventos || data.eventos.length === 0) {
            results.push({ sale_id: sale.id, tracking_code: trackingCode, status: 'no_events' });
            return;
          }

          const latestEvent = data.eventos[0];
          const mappedStatus = mapCorreiosStatus(latestEvent.status);
          const deliveryEstimate = extractDeliveryEstimate(data.eventos);
          const currentStatusText = latestEvent.status;
          const location = latestEvent.local || '';

          // Update sale with tracking info
          const updateData: Record<string, unknown> = {
            last_tracking_update: new Date().toISOString(),
            last_tracking_status: `${currentStatusText}${location ? ' - ' + location : ''}`,
          };

          if (deliveryEstimate) {
            updateData.delivery_estimate = deliveryEstimate;
          }

          // If we mapped a status and it's different from current
          if (mappedStatus && mappedStatus !== sale.carrier_tracking_status) {
            updateData.carrier_tracking_status = mappedStatus;

            // Insert tracking history entry
            await supabase
              .from('sale_carrier_tracking')
              .insert({
                sale_id: sale.id,
                organization_id: sale.organization_id,
                status: mappedStatus,
                changed_by: null, // System automated
                notes: `[Automático] ${currentStatusText}${location ? ' - ' + location : ''}`,
              });

            // If delivered, also check for WhatsApp message config
            if (mappedStatus === 'delivered' && sale.organization_id && sale.lead_id) {
              const { data: statusConfig } = await supabase
                .from('carrier_tracking_statuses')
                .select('whatsapp_instance_id, message_template, media_type, media_url, media_filename')
                .eq('organization_id', sale.organization_id)
                .eq('status_key', 'delivered')
                .single();

              if (statusConfig?.message_template && statusConfig?.whatsapp_instance_id) {
                const { data: lead } = await supabase
                  .from('leads')
                  .select('name, lead_products(name)')
                  .eq('id', sale.lead_id)
                  .single() as any;

                let sellerName = '';
                if (sale.seller_user_id) {
                  const { data: seller } = await supabase
                    .from('profiles')
                    .select('first_name, last_name')
                    .eq('user_id', sale.seller_user_id)
                    .single();
                  if (seller) sellerName = `${seller.first_name || ''} ${seller.last_name || ''}`.trim();
                }

                let finalMessage = statusConfig.message_template;
                const leadName = lead?.name || '';
                const firstName = leadName.split(' ')[0] || '';
                const productName = (lead?.lead_products as any)?.name || '';

                finalMessage = finalMessage
                  .replace(/\{\{nome\}\}/g, leadName)
                  .replace(/\{\{primeiro_nome\}\}/g, firstName)
                  .replace(/\{\{vendedor\}\}/g, sellerName)
                  .replace(/\{\{produto\}\}/g, productName);

                await supabase
                  .from('lead_scheduled_messages')
                  .insert({
                    lead_id: sale.lead_id,
                    organization_id: sale.organization_id,
                    created_by: null,
                    whatsapp_instance_id: statusConfig.whatsapp_instance_id,
                    final_message: finalMessage,
                    scheduled_at: new Date().toISOString(),
                    status: 'pending',
                    media_type: statusConfig.media_type || null,
                    media_url: statusConfig.media_url || null,
                    media_filename: statusConfig.media_filename || null,
                  });
              }
            }
          }

          await supabase
            .from('sales')
            .update(updateData)
            .eq('id', sale.id);

          updated++;
          results.push({ 
            sale_id: sale.id, 
            tracking_code: trackingCode, 
            status: mappedStatus || 'unchanged',
          });

        } catch (err) {
          errors++;
          const errMsg = err instanceof Error ? err.message : 'Unknown error';
          console.error(`[auto-tracking] Error for ${sale.tracking_code}:`, errMsg);
          results.push({ 
            sale_id: sale.id, 
            tracking_code: sale.tracking_code || '', 
            status: 'error',
            error: errMsg,
          });
        }
      });

      await Promise.all(promises);

      // Small delay between batches to avoid rate limiting
      if (i + 5 < validSales.length) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    console.log(`[auto-tracking] Done: ${updated} updated, ${errors} errors out of ${validSales.length} total`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        total: validSales.length,
        updated,
        errors,
        results: results.slice(0, 20), // Limit response size
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('[auto-tracking] Fatal error:', error);
    const errMessage = error instanceof Error ? error.message : 'Erro ao atualizar rastreios';
    return new Response(
      JSON.stringify({ success: false, error: errMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
