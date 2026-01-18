import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
}

// SECURITY: Webhook secret for authenticating incoming requests
const WHATSAPP_WEBHOOK_SECRET = Deno.env.get('WHATSAPP_WEBHOOK_SECRET') ?? ''

// Constant-time string comparison to prevent timing attacks
function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}

// Validate webhook secret from header
function validateWebhookSecret(req: Request): boolean {
  const providedSecret = req.headers.get("x-webhook-secret")
  
  // If no secret is configured, reject all requests (fail-closed)
  if (!WHATSAPP_WEBHOOK_SECRET) {
    console.error("❌ WHATSAPP_WEBHOOK_SECRET not configured - rejecting request")
    return false
  }
  
  // If no header provided, reject
  if (!providedSecret) {
    console.error("❌ Missing x-webhook-secret header")
    return false
  }
  
  // Constant-time comparison
  if (!secureCompare(providedSecret, WHATSAPP_WEBHOOK_SECRET)) {
    console.error("❌ Invalid webhook secret")
    return false
  }
  
  return true
}

// Input validation helpers
const VALID_MESSAGE_TYPES = new Set([
  'conversation', 'extendedTextMessage', 'imageMessage', 
  'audioMessage', 'videoMessage', 'documentMessage', 'stickerMessage',
  'locationMessage', 'contactMessage', 'reactionMessage'
])

const WHATSAPP_JID_REGEX = /^[\d]+@(s\.whatsapp\.net|g\.us)$/

function isValidWhatsAppJid(jid: string | null | undefined): boolean {
  if (!jid || typeof jid !== 'string') return false
  return WHATSAPP_JID_REGEX.test(jid)
}

function sanitizeString(value: unknown, maxLength: number = 1000): string {
  if (typeof value !== 'string') return ''
  // Remove control characters and limit length
  return value.replace(/[\x00-\x1F\x7F]/g, '').slice(0, maxLength)
}

function sanitizeUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !value) return null
  // Only allow http/https URLs, limit length
  const cleaned = value.slice(0, 2048)
  try {
    const url = new URL(cleaned)
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      return cleaned
    }
  } catch {
    // Invalid URL
  }
  return null
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // SECURITY: Validate webhook secret before processing
    if (!validateWebhookSecret(req)) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const url = new URL(req.url)
    const instanceId = url.searchParams.get('instance_id')
    
    // Validate instance_id format (should be UUID)
    if (!instanceId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(instanceId)) {
      return new Response(JSON.stringify({ error: 'Valid Instance ID required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const body = await req.json()
    // WaSender payload usually wraps data in 'data' object, or sends directly
    const data = body.data || body

    console.log('Received webhook payload for instance:', instanceId)

    // Extract and validate message type
    const messageType = sanitizeString(data.messageType, 50)
    if (messageType && !VALID_MESSAGE_TYPES.has(messageType)) {
      console.log('Unsupported message type, ignoring:', messageType)
      return new Response(JSON.stringify({ message: 'Unsupported message type' }), { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const isFromMe = data.key?.fromMe === true
    const remoteJid = data.key?.remoteJid
    
    // Validate remoteJid format
    if (!isValidWhatsAppJid(remoteJid)) {
      console.log('Invalid or missing remoteJid, ignoring')
      return new Response(JSON.stringify({ message: 'Invalid remoteJid' }), { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Sanitize user-controlled fields
    const pushName = sanitizeString(data.pushName, 100) || remoteJid

    // Determine content and media with sanitization
    let content = ''
    let mediaUrl: string | null = null
    let type = 'text'

    if (messageType === 'conversation' || messageType === 'extendedTextMessage') {
      content = sanitizeString(data.message?.conversation || data.message?.extendedTextMessage?.text, 4000)
    } else if (messageType === 'imageMessage') {
      type = 'image'
      content = sanitizeString(data.message?.imageMessage?.caption, 1000)
      mediaUrl = sanitizeUrl(data.url || data.message?.imageMessage?.url)
    } else if (messageType === 'audioMessage') {
      type = 'audio'
      mediaUrl = sanitizeUrl(data.url || data.message?.audioMessage?.url)
    } else if (messageType === 'videoMessage') {
      type = 'video'
      content = sanitizeString(data.message?.videoMessage?.caption, 1000)
      mediaUrl = sanitizeUrl(data.url || data.message?.videoMessage?.url)
    } else if (messageType === 'documentMessage') {
      type = 'document'
      content = sanitizeString(data.message?.documentMessage?.fileName, 255)
      mediaUrl = sanitizeUrl(data.url || data.message?.documentMessage?.url)
    } else if (messageType === 'stickerMessage') {
      type = 'sticker'
      mediaUrl = sanitizeUrl(data.url || data.message?.stickerMessage?.url)
    }

    // 1. Get Instance & Tenant (validates instance belongs to a real tenant)
    const { data: instance, error: instanceError } = await supabase
      .from('whatsapp_v2_instances')
      .select('tenant_id')
      .eq('id', instanceId)
      .single()

    if (instanceError || !instance) {
      // Don't reveal whether instance exists or not
      console.error('Instance lookup failed:', instanceId)
      return new Response(JSON.stringify({ error: 'Request failed' }), { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log('Processing message for tenant:', instance.tenant_id)

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
        last_message: type === 'text' ? content.slice(0, 500) : `[${type}]`,
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

    // 3. Insert Message with sanitized wa_message_id
    const waMessageId = sanitizeString(data.key?.id, 100)
    
    const { error: msgError } = await supabase.from('whatsapp_v2_messages').insert({
      chat_id: chat.id,
      tenant_id: instance.tenant_id,
      content: content,
      media_url: mediaUrl,
      media_type: type,
      is_from_me: isFromMe,
      wa_message_id: waMessageId || null,
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
    // Don't expose internal error details
    return new Response(JSON.stringify({ error: 'Processing failed' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    })
  }
})
