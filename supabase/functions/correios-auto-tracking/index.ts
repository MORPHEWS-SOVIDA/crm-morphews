import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

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
    return 'attempt_1_failed';
  }
  if (lower.includes('postado') || lower.includes('objeto postado')) {
    return 'posted';
  }
  if (lower.includes('na cidade do destinatário') || lower.includes('unidade de distribuição')) {
    return 'in_destination_city';
  }
  if (lower.includes('em trânsito') || lower.includes('transferência') || lower.includes('encaminhado')) {
    return 'posted';
  }
  
  return null;
}

// ===== Official Correios API token cache =====
let cachedCorreiosToken: { token: string; expiresAt: number } | null = null;

async function getCorreiosOfficialToken(): Promise<string | null> {
  const user = Deno.env.get('CORREIOS_USER');
  const apiToken = Deno.env.get('CORREIOS_API_TOKEN');
  const postingCard = Deno.env.get('CORREIOS_POSTING_CARD');

  if (!user || !apiToken || !postingCard) {
    console.log('[auto-tracking] Correios official credentials not configured, skipping official API');
    return null;
  }

  // Reuse cached token if still valid (with 60s safety margin)
  if (cachedCorreiosToken && cachedCorreiosToken.expiresAt > Date.now() + 60_000) {
    return cachedCorreiosToken.token;
  }

  const contract = Deno.env.get('CORREIOS_CONTRACT');
  const basic = btoa(`${user}:${apiToken}`);

  // Try in order: contrato → cartaopostagem → autentica (genérico)
  const attempts: Array<{ url: string; body?: Record<string, unknown> | null; label: string }> = [];
  if (contract) {
    attempts.push({
      url: 'https://api.correios.com.br/token/v1/autentica/contrato',
      body: { numero: contract },
      label: 'contrato',
    });
  }
  attempts.push({
    url: 'https://api.correios.com.br/token/v1/autentica/cartaopostagem',
    body: { numero: postingCard },
    label: 'cartaopostagem',
  });
  attempts.push({
    url: 'https://api.correios.com.br/token/v1/autentica',
    body: null,
    label: 'autentica',
  });

  for (const attempt of attempts) {
    try {
      const resp = await fetch(attempt.url, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${basic}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: attempt.body ? JSON.stringify(attempt.body) : undefined,
      });

      if (!resp.ok) {
        const txt = await resp.text();
        console.log(`[auto-tracking] Correios auth (${attempt.label}) failed [${resp.status}]: ${txt.substring(0, 250)}`);
        continue;
      }

      const data = await resp.json();
      const token = data.token as string | undefined;
      const expiraEm = data.expiraEm as string | undefined;

      if (!token) {
        console.log(`[auto-tracking] Correios auth (${attempt.label}): no token in response`);
        continue;
      }

      const expiresAt = expiraEm ? new Date(expiraEm).getTime() : (Date.now() + 23 * 60 * 60 * 1000);
      cachedCorreiosToken = { token, expiresAt };
      console.log(`[auto-tracking] Correios official token acquired via ${attempt.label}, expires at ${new Date(expiresAt).toISOString()}`);
      return token;
    } catch (e) {
      console.log(`[auto-tracking] Correios auth (${attempt.label}) exception:`, e instanceof Error ? e.message : e);
    }
  }

  return null;
}

// Try multiple tracking APIs with fallback (official → proxyapp → LinkeTrack)
async function fetchTracking(trackingCode: string): Promise<{ status: string; location: string; deliveryEstimate: string | null; events: any[] } | null> {
  // Try 1: Official Correios SRO Rastro API (with contract token)
  try {
    const token = await getCorreiosOfficialToken();
    if (token) {
      const response = await fetch(
        `https://api.correios.com.br/srorastro/v1/objetos/${trackingCode}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        const obj = data.objetos?.[0];
        if (obj && obj.eventos && obj.eventos.length > 0) {
          const latest = obj.eventos[0];
          const statusText = latest.descricao || latest.tipo || '';
          const location = latest.unidade?.nome
            || (latest.unidade?.endereco
              ? `${latest.unidade.endereco.cidade || ''}${latest.unidade.endereco.uf ? '/' + latest.unidade.endereco.uf : ''}`
              : '');

          let deliveryEstimate: string | null = null;
          if (obj.dtPrevista) {
            deliveryEstimate = String(obj.dtPrevista).substring(0, 10);
          }

          return { status: statusText, location, deliveryEstimate, events: obj.eventos };
        } else {
          console.log(`[auto-tracking] Official API returned no events for ${trackingCode}`);
        }
      } else {
        const txt = await response.text();
        console.log(`[auto-tracking] Official API failed [${response.status}] for ${trackingCode}: ${txt.substring(0, 200)}`);
        // If 401, invalidate token cache so next attempt re-authenticates
        if (response.status === 401) cachedCorreiosToken = null;
      }
    }
  } catch (e) {
    console.log(`[auto-tracking] Official Correios API error for ${trackingCode}:`, e instanceof Error ? e.message : e);
  }

  // Try 2: Correios proxyapp (public, often blocked)
  try {
    const response = await fetch(
      `https://proxyapp.correios.com.br/v1/sro-rastro/${trackingCode}`,
      {
        method: 'GET',
        headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' },
      }
    );

    if (response.ok) {
      const data = await response.json();
      if (data.objetos && data.objetos[0] && data.objetos[0].eventos) {
        const obj = data.objetos[0];
        const latest = obj.eventos[0];
        const statusText = latest.descricao || latest.tipo || '';
        const location = latest.unidade?.nome || latest.unidade?.endereco?.cidade || '';

        let deliveryEstimate: string | null = null;
        if (obj.dtPrevista) {
          deliveryEstimate = obj.dtPrevista.substring(0, 10);
        }

        return { status: statusText, location, deliveryEstimate, events: obj.eventos };
      }
    }
  } catch (e) {
    console.log(`[auto-tracking] Correios proxyapp failed for ${trackingCode}:`, e instanceof Error ? e.message : e);
  }

  // Try 3: LinkeTrack API
  try {
    const response = await fetch(
      `https://api.linketrack.com/track/json?user=teste&token=1abcd00b2731640e886fb41a8a9671ad1434c599dbaa0a0de9a5aa619f29a83f&codigo=${trackingCode}`,
      { method: 'GET', headers: { 'Accept': 'application/json' } }
    );

    if (response.ok) {
      const data = await response.json();
      if (data.eventos && data.eventos.length > 0) {
        const latest = data.eventos[0];

        let deliveryEstimate: string | null = null;
        for (const evento of data.eventos) {
          if (evento.subStatus) {
            for (const sub of evento.subStatus) {
              const match = sub.match(/Previsão de Entrega:\s*(\d{2}\/\d{2}\/\d{4})/i);
              if (match) {
                const [dd, mm, yyyy] = match[1].split('/');
                deliveryEstimate = `${yyyy}-${mm}-${dd}`;
                break;
              }
            }
          }
          if (deliveryEstimate) break;
        }

        return { status: latest.status || '', location: latest.local || '', deliveryEstimate, events: data.eventos };
      }
    }
  } catch (e) {
    console.log(`[auto-tracking] LinkeTrack failed for ${trackingCode}:`, e instanceof Error ? e.message : e);
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
    // Fetch all sales with Correios tracking codes that are not yet delivered and not cancelled
    const correiosRegex = '^[A-Z]{2}[0-9]{9}[A-Z]{2}$';
    
    const { data: sales, error: salesError } = await supabase
      .from('sales')
      .select('id, tracking_code, carrier_tracking_status, organization_id, lead_id, seller_user_id, status, delivered_at')
      .not('tracking_code', 'is', null)
      .neq('tracking_code', '')
      .not('status', 'in', '(cancelled,delivered,finalized,closed)')
      .is('delivered_at', null)
      .not('carrier_tracking_status', 'eq', 'delivered')
      .order('created_at', { ascending: false })
      .limit(500);

    if (salesError) throw salesError;

    // Filter valid Correios codes in JS
    const correiosCodeRegex = /^[A-Z]{2}[0-9]{9}[A-Z]{2}$/i;
    const validSales = (sales || []).filter(s => 
      s.tracking_code && correiosCodeRegex.test(s.tracking_code)
    );

    if (validSales.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'Nenhuma venda para atualizar', updated: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[auto-tracking] Processing ${validSales.length} sales with valid Correios codes`);

    let updated = 0;
    let errors = 0;

    // Process in batches of 3 with delay
    for (let i = 0; i < validSales.length; i += 3) {
      const batch = validSales.slice(i, i + 3);
      
      const promises = batch.map(async (sale) => {
        try {
          const trackingCode = sale.tracking_code!.toUpperCase();
          const result = await fetchTracking(trackingCode);

          if (!result) {
            errors++;
            return;
          }

          const mappedStatus = mapCorreiosStatus(result.status);

          // Update sale with tracking info
          const updateData: Record<string, unknown> = {
            last_tracking_update: new Date().toISOString(),
            last_tracking_status: `${result.status}${result.location ? ' - ' + result.location : ''}`,
          };

          if (result.deliveryEstimate) {
            updateData.delivery_estimate = result.deliveryEstimate;
          }

          // If we mapped a new status different from current
          if (mappedStatus && mappedStatus !== sale.carrier_tracking_status) {
            updateData.carrier_tracking_status = mappedStatus;

            // Insert tracking history entry
            await supabase
              .from('sale_carrier_tracking')
              .insert({
                sale_id: sale.id,
                organization_id: sale.organization_id,
                status: mappedStatus,
                changed_by: null,
                notes: `[Automático] ${result.status}${result.location ? ' - ' + result.location : ''}`,
              });

            // If delivered, send WhatsApp notification if configured
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
          console.log(`[auto-tracking] Updated ${trackingCode}: ${result.status}`);

        } catch (err) {
          errors++;
          console.error(`[auto-tracking] Error for ${sale.tracking_code}:`, err instanceof Error ? err.message : err);
        }
      });

      await Promise.all(promises);

      // Delay between batches to avoid rate limiting
      if (i + 3 < validSales.length) {
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    console.log(`[auto-tracking] Done: ${updated} updated, ${errors} errors out of ${validSales.length} total`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        total: validSales.length,
        updated,
        errors,
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
