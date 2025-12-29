import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const url = new URL(req.url)
    const instanceId = url.searchParams.get('instance_id')
    
    if (!instanceId) {
      return new Response(JSON.stringify({ error: 'Instance ID required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const body = await req.json()
    // WaSender payload usually wraps data in 'data' object, or sends directly
    const data = body.data || body

    console.log('Received webhook payload:', JSON.stringify(data, null, 2))

    // Basic extraction
    const messageType = data.messageType
    const isFromMe = data.key?.fromMe || false
    const remoteJid = data.key?.remoteJid
    const pushName = data.pushName || remoteJid

    if (!remoteJid) {
       console.log('No remoteJid found, ignoring')
       return new Response(JSON.stringify({ message: 'No remoteJid found, ignoring' }), { 
         status: 200,
         headers: { ...corsHeaders, 'Content-Type': 'application/json' }
       })
    }

    // Determine content and media
    let content = ''
    let mediaUrl = null
    let type = 'text'

    if (messageType === 'conversation' || messageType === 'extendedTextMessage') {
      content = data.message?.conversation || data.message?.extendedTextMessage?.text || ''
    } else if (messageType === 'imageMessage') {
      type = 'image'
      content = data.message?.imageMessage?.caption || ''
      mediaUrl = data.url || data.message?.imageMessage?.url 
    } else if (messageType === 'audioMessage') {
      type = 'audio'
      mediaUrl = data.url || data.message?.audioMessage?.url 
    } else if (messageType === 'videoMessage') {
      type = 'video'
      content = data.message?.videoMessage?.caption || ''
      mediaUrl = data.url || data.message?.videoMessage?.url
    } else if (messageType === 'documentMessage') {
      type = 'document'
      content = data.message?.documentMessage?.fileName || ''
      mediaUrl = data.url || data.message?.documentMessage?.url
    } else if (messageType === 'stickerMessage') {
      type = 'sticker'
      mediaUrl = data.url || data.message?.stickerMessage?.url
    }

    // 1. Get Instance & Tenant
    const { data: instance, error: instanceError } = await supabase
      .from('whatsapp_v2_instances')
      .select('tenant_id')
      .eq('id', instanceId)
      .single()

    if (instanceError || !instance) {
      console.error('Instance not found:', instanceId, instanceError)
      return new Response(JSON.stringify({ error: 'Instance not found' }), { 
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log('Found instance for tenant:', instance.tenant_id)

    // 2. Upsert Chat
    // First, try to find existing chat to get current unread count
    const { data: existingChat } = await supabase
      .from('whatsapp_v2_chats')
      .select('id, unread_count')
      .eq('instance_id', instanceId)
      .eq('whatsapp_id', remoteJid)
      .maybeSingle()

    let newUnreadCount = existingChat?.unread_count || 0
    if (!isFromMe) {
      newUnreadCount += 1
    } else {
      newUnreadCount = 0 // Reset if I sent it
    }

    const { data: chat, error: chatError } = await supabase
      .from('whatsapp_v2_chats')
      .upsert({
        instance_id: instanceId,
        whatsapp_id: remoteJid,
        tenant_id: instance.tenant_id,
        name: pushName,
        is_group: remoteJid.endsWith('@g.us'),
        last_message: type === 'text' ? content : `[${type}]`,
        last_message_time: new Date().toISOString(),
        unread_count: newUnreadCount
      }, { onConflict: 'instance_id, whatsapp_id' })
      .select()
      .single()

    if (chatError) {
      console.error('Error upserting chat:', chatError)
      throw chatError
    }

    console.log('Upserted chat:', chat.id)

    // 3. Insert Message
    const { error: msgError } = await supabase.from('whatsapp_v2_messages').insert({
      chat_id: chat.id,
      tenant_id: instance.tenant_id,
      content: content,
      media_url: mediaUrl,
      media_type: type,
      is_from_me: isFromMe,
      wa_message_id: data.key?.id,
      sender_name: pushName,
      status: 'received'
    })

    if (msgError) {
      console.error('Error inserting message:', msgError)
      throw msgError
    }

    console.log('Message inserted successfully')

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    })

  } catch (error: unknown) {
    console.error('Webhook error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    })
  }
})
