import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { sessionName, tenantId } = await req.json()
    
    // Usa o token master do WaSender configurado nos secrets
    const adminToken = Deno.env.get('WASENDERAPI_TOKEN')
    
    if (!adminToken) {
      throw new Error('Token do WaSender não configurado. Configure WASENDERAPI_TOKEN nos secrets.')
    }

    if (!sessionName || !tenantId) {
      throw new Error('sessionName e tenantId são obrigatórios')
    }

    console.log('Iniciando sessão WhatsApp:', { sessionName, tenantId })

    const baseUrl = 'https://api.wasenderapi.com'
    const supabaseProjectId = Deno.env.get('SUPABASE_URL')?.match(/https:\/\/([^.]+)/)?.[1] || 'hwbxvrewiapyhjceabvw'

    // 1. Cria a instância na tabela V2 primeiro (status: QRCODE)
    const { data: newInstance, error: dbError } = await supabase
      .from('whatsapp_v2_instances')
      .insert({
        name: sessionName,
        tenant_id: tenantId,
        api_url: baseUrl,
        api_key: 'pending',
        status: 'qrcode'
      })
      .select()
      .single()

    if (dbError) {
      console.error('Erro ao criar instância no banco:', dbError)
      throw new Error('Erro ao criar instância no banco de dados')
    }

    console.log('Instância criada no banco:', newInstance.id)

    // 2. Pede ao WaSender para iniciar sessão
    const webhookUrl = `https://${supabaseProjectId}.supabase.co/functions/v1/whatsapp-webhook?instance_id=${newInstance.id}`
    
    console.log('Webhook URL:', webhookUrl)

    const waResponse = await fetch(`${baseUrl}/api/sessions/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        name: `${sessionName.replace(/\s+/g, '_')}_${newInstance.id.slice(0, 8)}`,
        webhookUrl: webhookUrl,
        waitQrCode: true
      })
    })

    const waData = await waResponse.json()
    
    console.log('Resposta WaSender:', { status: waResponse.status, data: waData })

    if (!waResponse.ok) {
      // Limpa a instância criada se falhou no WaSender
      await supabase.from('whatsapp_v2_instances').delete().eq('id', newInstance.id)
      throw new Error(waData.message || waData.error || 'Erro ao criar sessão no WaSender')
    }

    // 3. Atualiza a instância com a key retornada (se houver)
    const sessionKey = waData.key || waData.session?.key || waData.apiKey || waData.token
    
    if (sessionKey) {
      await supabase
        .from('whatsapp_v2_instances')
        .update({
          api_key: sessionKey,
          qr_code: waData.qrcode || waData.qr || waData.qrCode || null
        })
        .eq('id', newInstance.id)
    }

    // 4. Retorna o QR Code para o Front-end
    const qrCode = waData.qrcode || waData.qr || waData.qrCode || waData.base64 || waData.image

    return new Response(JSON.stringify({ 
      qrCode: qrCode,
      instanceId: newInstance.id,
      sessionKey: sessionKey,
      message: 'Sessão criada. Escaneie o QR Code para conectar.'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    })

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido'
    console.error('Init Session error:', errorMessage)
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    })
  }
})
