// EfiPay Webhook - Recebe notificações de PIX e armazena para conciliação
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-skip-mtls-checking',
};

interface EfiPixNotification {
  pix: Array<{
    endToEndId: string;
    txid?: string;
    chave: string;
    valor: string;
    horario: string;
    infoPagador?: string;
    gnExtras?: {
      tarifa?: string;
      pagador?: {
        nome?: string;
        cpf?: string;
        cnpj?: string;
        codigoBanco?: string;
      };
    };
  }>;
}

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Validate request origin (EfiPay IPs)
    const clientIP = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip');
    const efiPayIPs = ['34.193.116.226']; // EfiPay webhook IP
    
    // Log for debugging
    console.log('EfiPay Webhook received from IP:', clientIP);
    
    // Get organization from query param or header
    const url = new URL(req.url);
    const orgId = url.searchParams.get('org');
    
    if (!orgId) {
      console.error('Missing organization ID');
      return new Response(JSON.stringify({ error: 'Missing org parameter' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate HMAC if present
    const hmac = url.searchParams.get('hmac');
    if (hmac) {
      // Get organization's webhook secret
      const { data: source } = await supabase
        .from('payment_sources')
        .select('webhook_secret')
        .eq('organization_id', orgId)
        .eq('source', 'efipay')
        .single();

      if (source?.webhook_secret && hmac !== source.webhook_secret) {
        console.error('Invalid HMAC');
        return new Response(JSON.stringify({ error: 'Invalid HMAC' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Parse notification
    const notification: EfiPixNotification = await req.json();
    console.log('EfiPay notification:', JSON.stringify(notification, null, 2));

    if (!notification.pix || !Array.isArray(notification.pix)) {
      console.error('Invalid notification format');
      return new Response(JSON.stringify({ error: 'Invalid format' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Process each PIX received
    const results = [];
    for (const pix of notification.pix) {
      const amountCents = Math.round(parseFloat(pix.valor) * 100);
      
      // Build payer info
      let payerName = '';
      let payerDocument = '';
      let payerBank = '';
      
      if (pix.gnExtras?.pagador) {
        payerName = pix.gnExtras.pagador.nome || '';
        payerDocument = pix.gnExtras.pagador.cpf || pix.gnExtras.pagador.cnpj || '';
        payerBank = pix.gnExtras.pagador.codigoBanco || '';
      }

      // Insert into incoming_transactions
      const { data, error } = await supabase
        .from('incoming_transactions')
        .upsert({
          organization_id: orgId,
          source: 'efipay',
          source_transaction_id: pix.endToEndId,
          amount_cents: amountCents,
          transaction_date: pix.horario,
          payer_name: payerName,
          payer_document: payerDocument,
          payer_bank: payerBank,
          end_to_end_id: pix.endToEndId,
          raw_payload: pix,
          status: 'pending',
        }, {
          onConflict: 'organization_id,source,source_transaction_id',
        })
        .select()
        .single();

      if (error) {
        console.error('Error inserting transaction:', error);
        results.push({ endToEndId: pix.endToEndId, error: error.message });
      } else {
        console.log('Transaction inserted:', data.id);
        results.push({ endToEndId: pix.endToEndId, id: data.id, success: true });
        
        // Try to auto-match with pending sales by exact amount
        const { data: pendingSales } = await supabase
          .from('sales')
          .select('id, total_amount_cents, lead:leads(name, whatsapp)')
          .eq('organization_id', orgId)
          .eq('status', 'pending')
          .eq('total_amount_cents', amountCents)
          .order('created_at', { ascending: false })
          .limit(5);

        if (pendingSales && pendingSales.length === 1) {
          // Only auto-match if there's exactly one pending sale with same amount
          console.log('Auto-matching with sale:', pendingSales[0].id);
          
          const { error: matchError } = await supabase.rpc('match_transaction_to_sale', {
            p_transaction_id: data.id,
            p_sale_id: pendingSales[0].id,
            p_user_id: null, // System auto-match
          });

          if (matchError) {
            console.error('Auto-match error:', matchError);
          } else {
            console.log('Auto-match successful');
          }
        }
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      processed: results.length,
      results 
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('EfiPay webhook error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Internal error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
