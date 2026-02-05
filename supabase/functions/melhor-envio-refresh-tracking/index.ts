import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { order_id, label_id } = await req.json();

    if (!order_id) {
      throw new Error('order_id é obrigatório');
    }

    // Get the label to find organization_id
    const { data: label, error: labelError } = await supabase
      .from('melhor_envio_labels')
      .select('organization_id, sale_id, tracking_code, posted_at')
      .eq('id', label_id)
      .single();

    if (labelError || !label) {
      throw new Error('Etiqueta não encontrada');
    }

    // Get org config for token
    const { data: config, error: configError } = await supabase
      .from('melhor_envio_config')
      .select('*')
      .eq('organization_id', label.organization_id)
      .single();

    if (configError || !config) {
      throw new Error('Configuração do Melhor Envio não encontrada');
    }

    // Get token
    let token: string | undefined;
    if (config.token_encrypted) {
      token = config.token_encrypted;
    } else if (config.ambiente === 'sandbox') {
      token = Deno.env.get('MELHOR_ENVIO_TOKEN_SANDBOX') || Deno.env.get('MELHOR_ENVIO_TOKEN');
    } else {
      token = Deno.env.get('MELHOR_ENVIO_TOKEN_PRODUCTION') || Deno.env.get('MELHOR_ENVIO_TOKEN');
    }

    if (!token) {
      throw new Error('Token do Melhor Envio não configurado');
    }

    const baseUrl = config.ambiente === 'sandbox' 
      ? 'https://sandbox.melhorenvio.com.br/api/v2'
      : 'https://melhorenvio.com.br/api/v2';

    // Fetch order info from Melhor Envio
    const orderResponse = await fetch(`${baseUrl}/me/orders/${order_id}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'Morphews CRM (thiago@sonatura.com.br)',
      },
    });

    if (!orderResponse.ok) {
      console.error('[ME Refresh] Order fetch failed:', orderResponse.status);
      throw new Error('Não foi possível consultar o pedido no Melhor Envio');
    }

    const orderData = await orderResponse.json();
    console.log('[ME Refresh] Order data:', JSON.stringify(orderData).substring(0, 500));

    // Get tracking code from response
    const newTrackingCode = orderData.tracking || orderData.self_tracking || null;
    const isPosted = orderData.status === 'posted' || orderData.status === 'delivered' || !!orderData.posted_at;

    // Check if we have a real tracking code (not UUID)
    const isRealCode = newTrackingCode && 
      !newTrackingCode.includes('-') && 
      newTrackingCode !== order_id;

    if (isRealCode) {
      // Update label with new tracking code
      const updateData: any = {
        tracking_code: newTrackingCode,
        updated_at: new Date().toISOString(),
      };

      if (isPosted && !label.posted_at) {
        updateData.posted_at = orderData.posted_at || new Date().toISOString();
        updateData.status = 'posted';
      }

      await supabase
        .from('melhor_envio_labels')
        .update(updateData)
        .eq('id', label_id);

      // Also update sale tracking_code
      if (label.sale_id) {
        await supabase
          .from('sales')
          .update({ tracking_code: newTrackingCode })
          .eq('id', label.sale_id);
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          tracking_code: newTrackingCode,
          is_posted: isPosted,
          message: 'Código de rastreio atualizado!'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // No real tracking code yet
    return new Response(
      JSON.stringify({ 
        success: true, 
        tracking_code: null,
        is_posted: isPosted,
        message: 'Código de rastreio ainda não disponível'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('[ME Refresh] Error:', error);
    const errMessage = error instanceof Error ? error.message : 'Erro ao atualizar rastreio';
    return new Response(
      JSON.stringify({ success: false, error: errMessage }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
