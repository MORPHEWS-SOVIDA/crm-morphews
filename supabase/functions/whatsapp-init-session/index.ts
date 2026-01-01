import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Recebe os dados do front-end
    const { sessionName, phoneNumber, tenantId } = await req.json()
    
    // 1. Validação e Segurança
    const adminToken = Deno.env.get('WASENDERAPI_TOKEN')
    if (!adminToken) throw new Error('Token Mestre (WASENDERAPI_TOKEN) não configurado.')
    if (!sessionName) throw new Error('Nome da instância é obrigatório.')

    // 2. Prepara a instância no Banco V2
    // Status inicial QRCODE. O número será atualizado quando conectar de fato.
    const { data: newInstance, error: dbError } = await supabase
      .from('whatsapp_v2_instances')
      .insert({
        name: sessionName,
        tenant_id: tenantId,
        api_url: 'https://api.wasenderapi.com', // URL Padrão
        api_key: 'pending', 
        status: 'QRCODE'
      })
      .select()
      .single()

    if (dbError) throw dbError

    // 3. Monta a URL do Webhook Automaticamente
    // O WaSender receberá esta URL e passará a enviar as mensagens para cá
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const projectRef = supabaseUrl.match(/https:\/\/(.+)\.supabase\.co/)?.[1]
    const webhookUrl = `https://${projectRef}.supabase.co/functions/v1/whatsapp-webhook?instance_id=${newInstance.id}`

    console.log(`Automação: Criando sessão '${sessionName}' com webhook: ${webhookUrl}`)

    // 4. Chama a API do WaSender para criar a sessão e pegar o QR
    const waResponse = await fetch('https://api.wasenderapi.com/api/sessions/start', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        name: `${sessionName}-${newInstance.id.slice(0,4)}`, // Garante nome único
        webhookUrl: webhookUrl, // A MÁGICA: Configura o webhook automaticamente
        waitQrCode: true,
        number: phoneNumber // Envia o número se o usuário informou (opcional na API, mas bom para registro)
      })
    })

    const waData = await waResponse.json()

    if (!waResponse.ok) {
      // Limpeza: Se falhou na API, remove do banco para não ficar lixo
      await supabase.from('whatsapp_v2_instances').delete().eq('id', newInstance.id)
      throw new Error(waData.message || waData.error || 'Erro na API WaSender')
    }

    // 5. Atualiza a instância com a Key retornada (se houver)
    const sessionKey = waData.key || waData.session?.key || waData.token
    if (sessionKey) {
        await supabase
          .from('whatsapp_v2_instances')
          .update({ api_key: sessionKey })
          .eq('id', newInstance.id)
    }

    // 6. Retorna o QR Code para o Front-end
    return new Response(JSON.stringify({ 
      qrCode: waData.qrcode || waData.qr || waData.base64, 
      instanceId: newInstance.id 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    })

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido'
    console.error('Erro na automação:', errorMessage)
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400
    })
  }
})
