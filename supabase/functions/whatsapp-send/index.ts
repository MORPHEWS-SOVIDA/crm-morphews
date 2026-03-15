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

    const { chatId, content, instanceId } = await req.json()

    console.log('Recebido pedido de envio:', { chatId, instanceId, contentLength: content?.length })

    if (!chatId || !content || !instanceId) {
      throw new Error('chatId, content e instanceId são obrigatórios')
    }

    // 1. Buscar credenciais da instância (URL e Token)
    const { data: instance, error: instError } = await supabase
      .from('whatsapp_v2_instances')
      .select('*')
      .eq('id', instanceId)
      .single()

    if (instError || !instance) {
      console.error('Erro ao buscar instância:', instError)
      throw new Error('Instância não encontrada ou sem permissão.')
    }

    console.log('Instância encontrada:', { id: instance.id, name: instance.name, status: instance.status })

    // 2. Buscar dados do Chat (para pegar o número/remoteJid)
    const { data: chat, error: chatError } = await supabase
      .from('whatsapp_v2_chats')
      .select('whatsapp_id, name')
      .eq('id', chatId)
      .single()

    if (chatError || !chat) {
      console.error('Erro ao buscar chat:', chatError)
      throw new Error('Chat não encontrado.')
    }

    console.log('Chat encontrado:', { whatsapp_id: chat.whatsapp_id, name: chat.name })

    // 3. Preparar envio para WaSender
    const baseUrl = (instance.api_url || 'https://api.wasenderapi.com').replace(/\/$/, '')
    const apiUrl = `${baseUrl}/api/send-message`
    
    // Tratamento do número (remover o @s.whatsapp.net ou @g.us se presente)
    const number = chat.whatsapp_id.split('@')[0]

    const payload = {
      number: number,
      message: content,
    }

    console.log('Enviando para WaSender:', { apiUrl, number })

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${instance.api_key}`
      },
      body: JSON.stringify(payload)
    })

    const responseData = await response.json()

    console.log('Resposta WaSender:', { status: response.status, data: responseData })

    if (!response.ok) {
      console.error('Erro WaSender:', responseData)
      throw new Error(responseData.message || responseData.error || 'Falha ao enviar mensagem na API externa')
    }

    // 4. Salvar mensagem no banco como "sent"
    const { data: msg, error: msgError } = await supabase
      .from('whatsapp_v2_messages')
      .insert({
        chat_id: chatId,
        content: content,
        media_type: 'text',
        is_from_me: true,
        status: 'sent',
        wa_message_id: responseData.messageId || responseData.id || `sent_${Date.now()}`,
        tenant_id: instance.tenant_id
      })
      .select()
      .single()

    if (msgError) {
      console.error('Erro ao salvar mensagem:', msgError)
      throw new Error('Mensagem enviada, mas erro ao salvar no banco.')
    }

    // 5. Atualizar o chat com última mensagem
    await supabase
      .from('whatsapp_v2_chats')
      .update({
        last_message: content.substring(0, 100),
        last_message_time: new Date().toISOString(),
      })
      .eq('id', chatId)

    console.log('Mensagem enviada e salva com sucesso:', msg.id)

    return new Response(JSON.stringify(msg), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    })

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('Send error:', errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    })
  }
})
