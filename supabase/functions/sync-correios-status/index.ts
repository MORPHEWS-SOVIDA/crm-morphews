import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TrackingEvent {
  status: string;
  data: string;
  hora: string;
  local: string;
}

interface TrackingResult {
  tracking_code: string;
  current_status: string;
  delivered: boolean;
  last_update: string;
  location: string;
}

async function fetchCorreiosStatus(trackingCode: string): Promise<TrackingResult | null> {
  try {
    // Try multiple tracking APIs for redundancy
    
    // Option 1: Try Cainiao (often has international tracking)
    try {
      const response = await fetch(
        `https://global.cainiao.com/global/detail.json?mailNos=${trackingCode}&lang=en-US`,
        {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        if (data.module?.[0]?.detailList?.length > 0) {
          const latestEvent = data.module[0].detailList[0];
          const isDelivered = latestEvent.desc?.toLowerCase().includes('delivered') ||
                              latestEvent.desc?.toLowerCase().includes('entregue');
          return {
            tracking_code: trackingCode,
            current_status: latestEvent.desc || '',
            delivered: isDelivered,
            last_update: latestEvent.time || '',
            location: latestEvent.standerdDesc || '',
          };
        }
      }
    } catch (e) {
      console.log(`[sync-correios] Cainiao failed for ${trackingCode}:`, e);
    }

    // Option 2: Try 17Track API
    try {
      const response = await fetch(
        'https://api.17track.net/track/v2.2/gettrackinfo',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            '17token': 'YOUR_TOKEN', // Public demo
          },
          body: JSON.stringify([{ number: trackingCode }]),
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        const trackInfo = data.data?.accepted?.[0];
        if (trackInfo?.track?.z0?.z) {
          const latestEvent = trackInfo.track.z0.z;
          const isDelivered = trackInfo.track.e === 40; // 40 = delivered
          return {
            tracking_code: trackingCode,
            current_status: latestEvent || '',
            delivered: isDelivered,
            last_update: trackInfo.track.z0?.a || '',
            location: trackInfo.track.z0?.c || '',
          };
        }
      }
    } catch (e) {
      console.log(`[sync-correios] 17Track failed for ${trackingCode}:`, e);
    }

    // Fallback: Return null and let user check manually
    console.log(`[sync-correios] All APIs failed for ${trackingCode}, returning null`);
    return null;
    
  } catch (error) {
    console.error(`[sync-correios] Error fetching ${trackingCode}:`, error);
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { organization_id, dry_run = false } = await req.json().catch(() => ({}));

    console.log(`[sync-correios] Starting sync for org: ${organization_id || 'ALL'}, dry_run: ${dry_run}`);

    // Find all carrier sales with tracking codes that are not yet delivered
    let query = supabase
      .from('sales')
      .select('id, romaneio_number, tracking_code, carrier_tracking_status, status')
      .eq('delivery_type', 'carrier')
      .not('tracking_code', 'is', null)
      .not('status', 'in', '(delivered,cancelled,finalized,closed)');

    if (organization_id) {
      query = query.eq('organization_id', organization_id);
    }

    const { data: salesToCheck, error: fetchError } = await query;

    if (fetchError) {
      throw new Error(`Failed to fetch sales: ${fetchError.message}`);
    }

    console.log(`[sync-correios] Found ${salesToCheck?.length || 0} sales to check`);

    const results = {
      checked: 0,
      updated: 0,
      auto_closed: 0,
      errors: 0,
      details: [] as any[],
    };

    for (const sale of salesToCheck || []) {
      // Validate tracking code format (Brazilian Correios)
      const isValidCode = /^[A-Z]{2}[0-9]{9}[A-Z]{2}$/i.test(sale.tracking_code || '');
      if (!isValidCode) {
        console.log(`[sync-correios] Skipping invalid code: ${sale.tracking_code}`);
        continue;
      }

      results.checked++;

      try {
        // Add small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));

        const status = await fetchCorreiosStatus(sale.tracking_code);
        if (!status) {
          results.errors++;
          continue;
        }

        const detail: any = {
          romaneio: sale.romaneio_number,
          tracking_code: sale.tracking_code,
          correios_status: status.current_status,
          delivered: status.delivered,
          action: 'none',
        };

        // Determine what action to take
        if (status.delivered) {
          // Auto-close if Correios says delivered
          if (sale.status !== 'delivered' && sale.carrier_tracking_status !== 'delivered') {
            detail.action = 'auto_close';
            
            if (!dry_run) {
              // Update sale status and carrier tracking status
              const { error: updateError } = await supabase
                .from('sales')
                .update({ 
                  status: 'delivered',
                  carrier_tracking_status: 'delivered',
                  delivery_status: 'delivered',
                })
                .eq('id', sale.id);

              if (updateError) {
                console.error(`[sync-correios] Error updating sale ${sale.id}:`, updateError);
                results.errors++;
                detail.error = updateError.message;
              } else {
                results.auto_closed++;
                console.log(`[sync-correios] Auto-closed sale #${sale.romaneio_number}`);
              }
            } else {
              results.auto_closed++;
            }
          }
        } else if (status.current_status) {
          // Update carrier tracking status based on Correios status
          const newStatus = mapCorreiosStatus(status.current_status);
          if (newStatus && newStatus !== sale.carrier_tracking_status) {
            detail.action = `update_status_to_${newStatus}`;
            
            if (!dry_run) {
              await supabase
                .from('sales')
                .update({ carrier_tracking_status: newStatus })
                .eq('id', sale.id);
              results.updated++;
            } else {
              results.updated++;
            }
          }
        }

        results.details.push(detail);

      } catch (err) {
        console.error(`[sync-correios] Error processing ${sale.tracking_code}:`, err);
        results.errors++;
      }
    }

    console.log(`[sync-correios] Completed. Checked: ${results.checked}, Updated: ${results.updated}, Auto-closed: ${results.auto_closed}`);

    return new Response(
      JSON.stringify({
        success: true,
        dry_run,
        ...results,
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: unknown) {
    console.error('[sync-correios] Fatal error:', error);
    const errMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function mapCorreiosStatus(correiosStatus: string): string | null {
  const status = correiosStatus.toLowerCase();
  
  if (status.includes('entregue') || status.includes('delivered')) {
    return 'delivered';
  }
  if (status.includes('saiu para entrega') || status.includes('out for delivery')) {
    return 'in_destination_city';
  }
  if (status.includes('postado') || status.includes('posted') || status.includes('objeto postado')) {
    return 'posted';
  }
  if (status.includes('aguardando retirada') || status.includes('waiting')) {
    return 'waiting_pickup';
  }
  if (status.includes('devolvido') || status.includes('voltando') || status.includes('return')) {
    return 'returning_to_sender';
  }
  if (status.includes('tentativa') || status.includes('attempt') || status.includes('ausente')) {
    if (status.includes('1') || status.includes('primeira')) return 'attempt_1_failed';
    if (status.includes('2') || status.includes('segunda')) return 'attempt_2_failed';
    if (status.includes('3') || status.includes('terceira')) return 'attempt_3_failed';
    return 'attempt_1_failed';
  }
  if (status.includes('trânsito') || status.includes('encaminhado') || status.includes('transferência')) {
    return 'posted';
  }
  
  return null;
}
