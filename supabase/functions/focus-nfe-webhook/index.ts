import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    console.log('Focus NFe webhook received:', JSON.stringify(body, null, 2));

    const { ref, status, numero, serie, chave_nfe, protocolo, caminho_xml_nota_fiscal, caminho_danfe, mensagem, codigo_verificacao } = body;

    if (!ref) {
      console.error('No ref in webhook payload');
      return new Response(JSON.stringify({ error: 'ref is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Find the invoice by focus_nfe_ref
    const { data: invoice, error: findError } = await supabase
      .from('fiscal_invoices')
      .select('id, status')
      .eq('focus_nfe_ref', ref)
      .single();

    if (findError || !invoice) {
      console.error('Invoice not found for ref:', ref, findError);
      return new Response(JSON.stringify({ error: 'Invoice not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Map Focus status to our status
    let newStatus = invoice.status;
    const updateData: any = {
      focus_nfe_response: body,
    };

    switch (status) {
      case 'autorizado':
        newStatus = 'authorized';
        updateData.invoice_number = numero;
        updateData.invoice_series = serie;
        updateData.access_key = chave_nfe;
        updateData.verification_code = codigo_verificacao;
        updateData.protocol_number = protocolo;
        updateData.xml_url = caminho_xml_nota_fiscal;
        updateData.pdf_url = caminho_danfe;
        updateData.authorized_at = new Date().toISOString();
        break;

      case 'cancelado':
        newStatus = 'cancelled';
        updateData.cancelled_at = new Date().toISOString();
        break;

      case 'erro_autorizacao':
      case 'erro_validacao':
        newStatus = 'rejected';
        updateData.error_message = mensagem || body.erros?.join(', ') || 'Erro na autorização';
        break;

      case 'processando_autorizacao':
        newStatus = 'processing';
        break;
    }

    updateData.status = newStatus;

    // Update invoice
    const { error: updateError } = await supabase
      .from('fiscal_invoices')
      .update(updateData)
      .eq('id', invoice.id);

    if (updateError) {
      console.error('Error updating invoice:', updateError);
      return new Response(JSON.stringify({ error: 'Failed to update invoice' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create event
    await supabase.from('fiscal_invoice_events').insert({
      fiscal_invoice_id: invoice.id,
      event_type: newStatus,
      event_data: body,
    });

    console.log(`Invoice ${invoice.id} updated to status: ${newStatus}`);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error in focus-nfe-webhook:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
