import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") ?? "";
const EVOLUTION_API_URL = Deno.env.get("EVOLUTION_API_URL") ?? "";
const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY") ?? "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ============================================================================
// INTERFACES
// ============================================================================

interface AIBot {
  id: string;
  organization_id: string;
  name: string;
  system_prompt: string;
  welcome_message: string | null;
  transfer_message: string | null;
  out_of_hours_message: string | null;
  transfer_keywords: string[] | null;
  max_messages_before_transfer: number | null;
  transfer_on_confusion: boolean | null;
  working_hours_start: string | null;
  working_hours_end: string | null;
  working_days: number[] | null;
  max_energy_per_message: number | null;
  max_energy_per_conversation: number | null;
}

interface ConversationContext {
  conversationId: string;
  instanceId: string;
  organizationId: string;
  contactName: string;
  phoneNumber: string;
  chatId: string;
  botMessagesCount: number;
  botEnergyConsumed: number;
}

interface ProcessResult {
  success: boolean;
  action: 'responded' | 'transferred' | 'no_energy' | 'out_of_hours' | 'error';
  message?: string;
  energyUsed?: number;
}

// ============================================================================
// HELPERS
// ============================================================================

function isWithinWorkingHours(bot: AIBot): boolean {
  if (!bot.working_hours_start || !bot.working_hours_end || !bot.working_days) {
    return true; // Sem restrição = sempre disponível
  }

  const now = new Date();
  // Ajustar para horário de Brasília (UTC-3)
  const brasiliaOffset = -3 * 60;
  const localTime = new Date(now.getTime() + (brasiliaOffset - now.getTimezoneOffset()) * 60000);
  
  const dayOfWeek = localTime.getDay();
  const currentHour = localTime.getHours();
  const currentMinute = localTime.getMinutes();
  const currentTimeMinutes = currentHour * 60 + currentMinute;

  // Verificar dia da semana
  if (!bot.working_days.includes(dayOfWeek)) {
    return false;
  }

  // Verificar horário
  const [startHour, startMin] = bot.working_hours_start.split(':').map(Number);
  const [endHour, endMin] = bot.working_hours_end.split(':').map(Number);
  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;

  return currentTimeMinutes >= startMinutes && currentTimeMinutes <= endMinutes;
}

function shouldTransferByKeywords(message: string, keywords: string[] | null): boolean {
  if (!keywords || keywords.length === 0) return false;
  
  const lowerMessage = message.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  
  return keywords.some(keyword => {
    const lowerKeyword = keyword.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return lowerMessage.includes(lowerKeyword);
  });
}

// ============================================================================
// AI PROCESSING
// ============================================================================

async function getConversationHistory(conversationId: string, limit = 20): Promise<Array<{role: string, content: string}>> {
  const { data: messages } = await supabase
    .from('whatsapp_messages')
    .select('content, direction, is_from_bot, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (!messages) return [];

  // Inverter para ordem cronológica e mapear para formato OpenAI
  return messages.reverse().map(msg => ({
    role: msg.direction === 'inbound' ? 'user' : 'assistant',
    content: msg.content || ''
  })).filter(m => m.content);
}

async function generateAIResponse(
  bot: AIBot, 
  userMessage: string, 
  conversationHistory: Array<{role: string, content: string}>,
  contactName: string
): Promise<{ response: string; tokensUsed: number }> {
  
  // Construir sistema prompt com contexto
  const systemPrompt = `${bot.system_prompt}

CONTEXTO ATUAL:
- Nome do cliente: ${contactName}
- Data/Hora atual: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}

INSTRUÇÕES IMPORTANTES:
- Responda de forma natural e empática
- Use o nome do cliente quando apropriado
- Mantenha respostas concisas mas completas
- Se não souber algo, seja honesto e ofereça transferir para um humano`;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory.slice(-15), // Últimas 15 mensagens para contexto
    { role: 'user', content: userMessage }
  ];

  console.log('🤖 Calling Lovable AI with', messages.length, 'messages');

  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages,
      max_tokens: 500,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('❌ Lovable AI error:', response.status, errorText);
    
    if (response.status === 429) {
      throw new Error('RATE_LIMITED');
    }
    if (response.status === 402) {
      throw new Error('PAYMENT_REQUIRED');
    }
    throw new Error(`AI_ERROR: ${response.status}`);
  }

  const data = await response.json();
  const aiResponse = data.choices?.[0]?.message?.content || '';
  const tokensUsed = (data.usage?.prompt_tokens || 0) + (data.usage?.completion_tokens || 0);

  console.log('✅ AI Response generated:', aiResponse.substring(0, 100) + '...');
  
  return { response: aiResponse, tokensUsed };
}

// ============================================================================
// SEND MESSAGE VIA EVOLUTION
// ============================================================================

async function sendWhatsAppMessage(
  instanceName: string, 
  chatId: string, 
  message: string,
  conversationId: string,
  instanceId: string,
  botId: string
): Promise<boolean> {
  try {
    const endpoint = `${EVOLUTION_API_URL}/message/sendText/${instanceName}`;
    
    console.log('📤 Sending message via Evolution:', {
      instance: instanceName,
      chatId,
      messagePreview: message.substring(0, 50) + '...'
    });

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': EVOLUTION_API_KEY,
      },
      body: JSON.stringify({
        number: chatId,
        text: message,
      }),
    });

    if (!response.ok) {
      console.error('❌ Evolution send failed:', response.status);
      return false;
    }

    const result = await response.json();
    const providerMessageId = result?.key?.id || null;

    // Salvar mensagem no banco
    await supabase.from('whatsapp_messages').insert({
      id: crypto.randomUUID(),
      instance_id: instanceId,
      conversation_id: conversationId,
      message_type: 'text',
      content: message,
      direction: 'outbound',
      status: 'sent',
      is_from_bot: true,
      provider: 'evolution',
      provider_message_id: providerMessageId,
    });

    console.log('✅ Bot message sent and saved');
    return true;
  } catch (error) {
    console.error('❌ Error sending message:', error);
    return false;
  }
}

// ============================================================================
// ENERGY MANAGEMENT
// ============================================================================

async function checkAndConsumeEnergy(
  organizationId: string, 
  botId: string,
  conversationId: string,
  tokensUsed: number,
  actionType: string
): Promise<{ success: boolean; energyConsumed: number }> {
  // Calcular energia baseada em tokens (1 energia = ~100 tokens)
  const energyToConsume = Math.max(1, Math.ceil(tokensUsed / 100));

  // Usar a função do banco para consumir energia atomicamente
  const { data, error } = await supabase.rpc('consume_energy', {
    p_organization_id: organizationId,
    p_amount: energyToConsume
  });

  if (error || data === false) {
    console.log('⚡ No energy available');
    return { success: false, energyConsumed: 0 };
  }

  // Log do uso de energia
  await supabase.from('energy_usage_log').insert({
    organization_id: organizationId,
    bot_id: botId,
    conversation_id: conversationId,
    action_type: actionType,
    energy_consumed: energyToConsume,
    tokens_used: tokensUsed,
    details: { timestamp: new Date().toISOString() }
  });

  console.log('⚡ Energy consumed:', energyToConsume);
  return { success: true, energyConsumed: energyToConsume };
}

// ============================================================================
// TRANSFER TO HUMAN
// ============================================================================

async function transferToHuman(
  conversationId: string,
  reason: string,
  transferMessage: string | null
): Promise<void> {
  console.log('🔄 Transferring to human:', reason);

  // Usar a função do banco para transferir
  await supabase.rpc('transfer_from_bot_to_human', {
    p_conversation_id: conversationId
  });

  // Se tem mensagem de transferência, ela já foi enviada ou será enviada
  console.log('✅ Transferred to human, status now pending');
}

// ============================================================================
// MAIN PROCESS
// ============================================================================

async function processMessage(
  bot: AIBot,
  context: ConversationContext,
  userMessage: string,
  instanceName: string
): Promise<ProcessResult> {
  
  console.log('🤖 Processing message for bot:', bot.name);

  // 1. Verificar horário de funcionamento
  if (!isWithinWorkingHours(bot)) {
    console.log('⏰ Out of working hours');
    
    if (bot.out_of_hours_message) {
      await sendWhatsAppMessage(
        instanceName,
        context.chatId,
        bot.out_of_hours_message,
        context.conversationId,
        context.instanceId,
        bot.id
      );
    }
    
    return { success: true, action: 'out_of_hours' };
  }

  // 2. Verificar keywords de transferência
  if (shouldTransferByKeywords(userMessage, bot.transfer_keywords)) {
    console.log('🔑 Transfer keyword detected');
    
    await transferToHuman(context.conversationId, 'keyword_trigger', bot.transfer_message);
    
    if (bot.transfer_message) {
      await sendWhatsAppMessage(
        instanceName,
        context.chatId,
        bot.transfer_message,
        context.conversationId,
        context.instanceId,
        bot.id
      );
    }
    
    return { success: true, action: 'transferred', message: 'Transfer keyword detected' };
  }

  // 3. Verificar limite de mensagens
  if (bot.max_messages_before_transfer && context.botMessagesCount >= bot.max_messages_before_transfer) {
    console.log('📊 Max messages reached, transferring');
    
    await transferToHuman(context.conversationId, 'max_messages', bot.transfer_message);
    
    if (bot.transfer_message) {
      await sendWhatsAppMessage(
        instanceName,
        context.chatId,
        bot.transfer_message,
        context.conversationId,
        context.instanceId,
        bot.id
      );
    }
    
    return { success: true, action: 'transferred', message: 'Max messages reached' };
  }

  // 4. Buscar histórico da conversa
  const conversationHistory = await getConversationHistory(context.conversationId);

  // 5. Gerar resposta IA
  let aiResponse: string;
  let tokensUsed: number;
  
  try {
    const result = await generateAIResponse(bot, userMessage, conversationHistory, context.contactName);
    aiResponse = result.response;
    tokensUsed = result.tokensUsed;
  } catch (error: any) {
    console.error('❌ AI generation error:', error.message);
    
    if (error.message === 'RATE_LIMITED' || error.message === 'PAYMENT_REQUIRED') {
      // Transferir para humano se sem créditos
      await transferToHuman(context.conversationId, 'no_credits', bot.transfer_message);
      return { success: false, action: 'no_energy', message: error.message };
    }
    
    return { success: false, action: 'error', message: error.message };
  }

  // 6. Consumir energia
  const energyResult = await checkAndConsumeEnergy(
    context.organizationId,
    bot.id,
    context.conversationId,
    tokensUsed,
    'ai_response'
  );

  if (!energyResult.success) {
    // Sem energia, transferir para humano
    await transferToHuman(context.conversationId, 'no_energy', bot.transfer_message);
    
    if (bot.transfer_message) {
      // Tentar enviar mensagem de transferência mesmo sem energia
      await sendWhatsAppMessage(
        instanceName,
        context.chatId,
        bot.transfer_message,
        context.conversationId,
        context.instanceId,
        bot.id
      );
    }
    
    return { success: true, action: 'no_energy', message: 'No energy available' };
  }

  // 7. Enviar resposta
  const sent = await sendWhatsAppMessage(
    instanceName,
    context.chatId,
    aiResponse,
    context.conversationId,
    context.instanceId,
    bot.id
  );

  if (!sent) {
    return { success: false, action: 'error', message: 'Failed to send message' };
  }

  // 8. Atualizar contadores da conversa
  await supabase
    .from('whatsapp_conversations')
    .update({
      bot_messages_count: context.botMessagesCount + 1,
      bot_energy_consumed: context.botEnergyConsumed + energyResult.energyConsumed,
    })
    .eq('id', context.conversationId);

  return { 
    success: true, 
    action: 'responded', 
    energyUsed: energyResult.energyConsumed 
  };
}

// ============================================================================
// HANDLER
// ============================================================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    
    const {
      botId,
      conversationId,
      instanceId,
      instanceName,
      organizationId,
      userMessage,
      contactName,
      phoneNumber,
      chatId,
      isFirstMessage,
    } = body;

    console.log('🤖 AI Bot Process request:', {
      botId,
      conversationId,
      isFirstMessage,
      messagePreview: userMessage?.substring(0, 50)
    });

    // Validar inputs
    if (!botId || !conversationId || !userMessage) {
      return new Response(JSON.stringify({ 
        error: 'Missing required fields',
        success: false 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Buscar bot
    const { data: bot, error: botError } = await supabase
      .from('ai_bots')
      .select('*')
      .eq('id', botId)
      .eq('is_active', true)
      .single();

    if (botError || !bot) {
      console.error('❌ Bot not found or inactive:', botId);
      return new Response(JSON.stringify({ 
        error: 'Bot not found or inactive',
        success: false 
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Buscar dados da conversa
    const { data: conversation } = await supabase
      .from('whatsapp_conversations')
      .select('bot_messages_count, bot_energy_consumed')
      .eq('id', conversationId)
      .single();

    const context: ConversationContext = {
      conversationId,
      instanceId,
      organizationId,
      contactName: contactName || 'Cliente',
      phoneNumber,
      chatId,
      botMessagesCount: conversation?.bot_messages_count || 0,
      botEnergyConsumed: conversation?.bot_energy_consumed || 0,
    };

    // Se é primeira mensagem e tem welcome message, enviar primeiro
    if (isFirstMessage && bot.welcome_message) {
      console.log('👋 Sending welcome message');
      await sendWhatsAppMessage(
        instanceName,
        chatId,
        bot.welcome_message,
        conversationId,
        instanceId,
        bot.id
      );
      
      // Consumir energia pelo welcome
      await checkAndConsumeEnergy(organizationId, bot.id, conversationId, 50, 'welcome_message');
    }

    // Processar mensagem
    const result = await processMessage(bot, context, userMessage, instanceName);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('❌ AI Bot Process error:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      success: false,
      action: 'error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
