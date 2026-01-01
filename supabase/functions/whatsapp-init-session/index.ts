import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. Logs Iniciais para Debug
    console.log("Iniciando whatsapp-init-session...")
    
    const { sessionName, phoneNumber, tenantId } = await req.json()
    console.log("Dados recebidos:", { sessionName, phoneNumber, tenantId })

    // 2. Validação do Token
    const adminToken = Deno.env.get('WASENDERAPI_TOKEN')
    if (!adminToken) {
      console.error("ERRO: WASENDERAPI_TOKEN não encontrado nos Secrets.")
      throw new Error('Configuração incompleta: WASENDERAPI_TOKEN ausente.')
    }

    // 3. Validação dos Dados
    if (!sessionName || !tenantId) {
       throw new Error('Nome da sessão e ID da organização são obrigatórios.')
    }

    // 4. Criação no Banco V2 (Status: QRCODE)
    const { data: newInstance, error: dbError } = await supabase
      .from('whatsapp_v2_instances')
      .insert({
        name: sessionName,
        tenant_id: tenantId,
        api_url: 'https://api.wasenderapi.com',
        api_key: 'pending', 
        status: 'QRCODE'
      })
      .select()
      .single()

    if (dbError) {
      console.error("Erro Banco de Dados:", dbError)
      throw new Error(`Erro ao salvar no banco: ${dbError.message}`)
    }

    // 5. Preparação do Payload para WaSender
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const projectRef = supabaseUrl.match(/https:\/\/(.+)\.supabase\.co/)?.[1]
    const webhookUrl = `https://${projectRef}.supabase.co/functions/v1/whatsapp-webhook?instance_id=${newInstance.id}`
    
    const waBody = {
      name: `${sessionName}-${newInstance.id.slice(0,4)}`, // Nome único
      webhookUrl: webhookUrl,
      waitQrCode: true,
      number: phoneNumber || undefined
    }

    console.log("Enviando para WaSender:", waBody)

    // 6. Chamada à API WaSender
    const waResponse = await fetch('https://api.wasenderapi.com/api/sessions/start', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify(waBody)
    })

    // 7. Tratamento Robusto de Erro da API Externa
    if (!waResponse.ok) {
      const errorText = await waResponse.text()
      console.error("Erro WaSender Raw:", errorText)
      
      // Tenta fazer parse se for JSON, senão usa o texto puro
      let errorMessage = errorText
      try {
        const errorJson = JSON.parse(errorText)
        errorMessage = errorJson.message || errorJson.error || errorText
      } catch (e) {}

      // Deleta a instância falha do banco
      await supabase.from('whatsapp_v2_instances').delete().eq('id', newInstance.id)

      throw new Error(`WaSender recusou: ${errorMessage}`)
    }

    // 8. Sucesso
    const waData = await waResponse.json()
    
    // Atualiza com a chave retornada
    const sessionKey = waData.key || waData.session?.key || waData.token
    if (sessionKey) {
        await supabase
          .from('whatsapp_v2_instances')
          .update({ api_key: sessionKey })
          .eq('id', newInstance.id)
    }

    return new Response(JSON.stringify({ 
      qrCode: waData.qrcode || waData.qr || waData.base64, 
      instanceId: newInstance.id 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    })

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido'
    console.error("Catch Final:", errorMessage)
    // Retorna 400 com a mensagem de erro no corpo para o Frontend exibir
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400
    })
  }
})
