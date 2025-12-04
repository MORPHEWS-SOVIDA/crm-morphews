import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ZAPI_INSTANCE_ID = Deno.env.get('ZAPI_INSTANCE_ID');
const ZAPI_TOKEN = Deno.env.get('ZAPI_TOKEN');
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Funnel stages mapping
const FUNNEL_STAGES = {
  'prospect': 'Prospectando',
  'contacted': 'Contatado',
  'convincing': 'Convencendo a marcar call',
  'scheduled': 'Call agendada',
  'positive': 'Positivo/Interessado',
  'waiting_payment': 'Aguardando pagamento',
  'success': 'Sucesso/Pagou',
  'trash': 'Não interessado',
  'cloud': 'Nuvem (ainda não pronto)'
};

async function sendWhatsAppMessage(phone: string, message: string) {
  const url = `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}/send-text`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: phone,
        message: message
      })
    });
    
    const data = await response.json();
    console.log('Z-API response:', data);
    return data;
  } catch (error) {
    console.error('Error sending WhatsApp message:', error);
    throw error;
  }
}

async function findUserByWhatsApp(whatsapp: string) {
  // Clean phone number
  const cleanPhone = whatsapp.replace(/\D/g, '');
  
  console.log('Looking for user with WhatsApp:', cleanPhone);
  
  // Try exact match first
  let { data, error } = await supabase
    .from('profiles')
    .select('*, organization_members(organization_id, role)')
    .eq('whatsapp', cleanPhone)
    .single();
  
  if (!error && data) {
    console.log('User found with exact match:', data.first_name, data.last_name);
    return data;
  }
  
  // Brazilian phone number normalization
  // Try adding the 9th digit if the phone has 12 digits (55 + DD + 8 digits)
  if (cleanPhone.length === 12 && cleanPhone.startsWith('55')) {
    const withNinthDigit = cleanPhone.slice(0, 4) + '9' + cleanPhone.slice(4);
    console.log('Trying with 9th digit added:', withNinthDigit);
    
    const result = await supabase
      .from('profiles')
      .select('*, organization_members(organization_id, role)')
      .eq('whatsapp', withNinthDigit)
      .single();
    
    if (!result.error && result.data) {
      console.log('User found with 9th digit:', result.data.first_name, result.data.last_name);
      return result.data;
    }
  }
  
  // Try removing the 9th digit if the phone has 13 digits (55 + DD + 9 digits)
  if (cleanPhone.length === 13 && cleanPhone.startsWith('55')) {
    const withoutNinthDigit = cleanPhone.slice(0, 4) + cleanPhone.slice(5);
    console.log('Trying without 9th digit:', withoutNinthDigit);
    
    const result = await supabase
      .from('profiles')
      .select('*, organization_members(organization_id, role)')
      .eq('whatsapp', withoutNinthDigit)
      .single();
    
    if (!result.error && result.data) {
      console.log('User found without 9th digit:', result.data.first_name, result.data.last_name);
      return result.data;
    }
  }
  
  // List all profiles with WhatsApp to debug
  const { data: allProfiles } = await supabase
    .from('profiles')
    .select('whatsapp, first_name, last_name')
    .not('whatsapp', 'is', null);
  
  console.log('User not found. Available WhatsApp numbers:', 
    allProfiles?.map(p => `${p.first_name}: ${p.whatsapp}`).join(', '));
  
  return null;
}

async function findSimilarLeads(organizationId: string, name?: string, instagram?: string) {
  let query = supabase
    .from('leads')
    .select('*')
    .eq('organization_id', organizationId);
  
  if (name) {
    query = query.ilike('name', `%${name}%`);
  }
  
  if (instagram) {
    const cleanInsta = instagram.replace('@', '').toLowerCase();
    query = query.ilike('instagram', `%${cleanInsta}%`);
  }
  
  const { data } = await query.limit(5);
  return data || [];
}

async function getOrganizationUsers(organizationId: string) {
  const { data } = await supabase
    .from('profiles')
    .select('first_name, last_name')
    .eq('organization_id', organizationId);
  
  return data?.map(p => `${p.first_name} ${p.last_name}`) || [];
}

async function getLeadSources(organizationId: string) {
  const { data } = await supabase
    .from('lead_sources')
    .select('name')
    .eq('organization_id', organizationId)
    .eq('is_active', true);
  
  return data?.map(s => s.name) || [];
}

async function getLeadProducts(organizationId: string) {
  const { data } = await supabase
    .from('lead_products')
    .select('name')
    .eq('organization_id', organizationId)
    .eq('is_active', true);
  
  return data?.map(p => p.name) || [];
}

async function processWithAI(
  message: string, 
  context: {
    userName: string;
    organizationId: string;
    teamMembers: string[];
    leadSources: string[];
    products: string[];
    conversationHistory: string[];
    pendingAction?: string;
    pendingLead?: any;
  }
) {
  const systemPrompt = `Você é uma secretária virtual inteligente do Morphews CRM. Seu papel é ajudar usuários a gerenciar leads de vendas via WhatsApp.

CONTEXTO DO USUÁRIO:
- Nome do usuário: ${context.userName}
- Membros do time disponíveis para atribuição: ${context.teamMembers.join(', ') || 'Nenhum configurado'}
- Fontes de lead disponíveis: ${context.leadSources.join(', ') || 'Nenhuma configurada'}
- Produtos disponíveis: ${context.products.join(', ') || 'Nenhum configurado'}

ETAPAS DO FUNIL (use exatamente esses valores):
- prospect: Prospectando/Aguardando resposta
- contacted: Contatado
- convincing: Convencendo a marcar call
- scheduled: Call agendada
- positive: Positivo/Interessado após call
- waiting_payment: Aguardando pagamento
- success: Sucesso/Pagou
- trash: Não interessado/Descartado
- cloud: Nuvem (ainda não está pronto)

ESTRELAS (1-5):
- 5 estrelas: Lead muito importante, muitos seguidores/influência
- 4 estrelas: Lead importante
- 3 estrelas: Lead médio (padrão)
- 2 estrelas: Lead pequeno
- 1 estrela: Lead muito pequeno, profissional não formado

SUAS RESPONSABILIDADES:
1. Extrair informações de leads das mensagens
2. Perguntar informações faltantes importantes (especialmente etapa do funil e estrelas)
3. Criar ou atualizar leads
4. Buscar leads existentes
5. Dar um resumo claro das ações tomadas

FORMATO DE RESPOSTA (JSON):
{
  "action": "create_lead" | "update_lead" | "search_lead" | "ask_question" | "list_leads" | "help",
  "lead_data": {
    "name": "string (obrigatório para criar)",
    "whatsapp": "string",
    "instagram": "string (sem @)",
    "email": "string",
    "specialty": "string",
    "followers": number,
    "stage": "string (valor do enum)",
    "stars": number (1-5),
    "assigned_to": "string (nome do membro do time)",
    "lead_source": "string",
    "products": ["array de produtos"],
    "meeting_date": "YYYY-MM-DD",
    "meeting_time": "HH:MM",
    "meeting_link": "string",
    "observations": "string"
  },
  "search_query": "string (para buscar leads)",
  "lead_id": "string (para atualizar lead específico)",
  "question": "string (pergunta para o usuário)",
  "missing_fields": ["campos importantes faltando"],
  "response_message": "string (mensagem amigável para o usuário)"
}

REGRAS IMPORTANTES:
1. Se o usuário mencionar um lead mas não disser a etapa do funil ou estrelas, PERGUNTE
2. Seja proativo em perguntar informações que ajudem a qualificar o lead
3. Sempre confirme a criação/atualização do lead
4. Se encontrar lead similar, pergunte se é o mesmo antes de criar novo
5. Mantenha o tom profissional mas amigável
6. Responda SEMPRE em português brasileiro
7. O campo mais importante é: nome, etapa do funil e estrelas

${context.pendingAction ? `AÇÃO PENDENTE: ${context.pendingAction}` : ''}
${context.pendingLead ? `LEAD PENDENTE: ${JSON.stringify(context.pendingLead)}` : ''}

HISTÓRICO DA CONVERSA:
${context.conversationHistory.slice(-10).join('\n') || 'Nenhum histórico'}`;

  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    console.log('AI Response:', content);
    
    return JSON.parse(content);
  } catch (error) {
    console.error('Error processing with AI:', error);
    throw error;
  }
}

async function createLead(organizationId: string, userId: string, leadData: any) {
  const { data, error } = await supabase
    .from('leads')
    .insert({
      organization_id: organizationId,
      created_by: userId,
      name: leadData.name,
      whatsapp: leadData.whatsapp?.replace(/\D/g, '') || '',
      instagram: leadData.instagram?.replace('@', '') || '',
      email: leadData.email || null,
      specialty: leadData.specialty || null,
      followers: leadData.followers || 0,
      stage: leadData.stage || 'prospect',
      stars: leadData.stars || 3,
      assigned_to: leadData.assigned_to || '',
      lead_source: leadData.lead_source || null,
      products: leadData.products || null,
      meeting_date: leadData.meeting_date || null,
      meeting_time: leadData.meeting_time || null,
      meeting_link: leadData.meeting_link || null,
      observations: leadData.observations || null
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating lead:', error);
    throw error;
  }

  return data;
}

async function updateLead(leadId: string, updates: any) {
  const { data, error } = await supabase
    .from('leads')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', leadId)
    .select()
    .single();

  if (error) {
    console.error('Error updating lead:', error);
    throw error;
  }

  return data;
}

async function searchLeads(organizationId: string, query: string) {
  const { data } = await supabase
    .from('leads')
    .select('*')
    .eq('organization_id', organizationId)
    .or(`name.ilike.%${query}%,instagram.ilike.%${query}%,specialty.ilike.%${query}%`)
    .limit(10);

  return data || [];
}

// Store conversation context (in-memory for now, could be database)
const conversationContexts = new Map<string, {
  history: string[];
  pendingAction?: string;
  pendingLead?: any;
}>();

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    console.log('Z-API Webhook payload:', JSON.stringify(payload, null, 2));

    // Z-API sends different event types
    // We're interested in received messages
    if (!payload.phone || !payload.text?.message) {
      console.log('Ignoring non-text message or missing phone');
      return new Response(JSON.stringify({ status: 'ignored' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const senderPhone = payload.phone.replace(/\D/g, '');
    const messageText = payload.text.message;
    const isFromMe = payload.fromMe === true;

    // Ignore messages sent by the system itself
    if (isFromMe) {
      console.log('Ignoring message sent by system');
      return new Response(JSON.stringify({ status: 'ignored_self' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Message from ${senderPhone}: ${messageText}`);

    // Find user by WhatsApp
    const user = await findUserByWhatsApp(senderPhone);
    
    if (!user) {
      await sendWhatsAppMessage(senderPhone, 
        '❌ Desculpe, não encontrei sua conta no Morphews CRM.\n\n' +
        'Para usar o assistente via WhatsApp, seu número precisa estar cadastrado no seu perfil do sistema.\n\n' +
        'Acesse o CRM e adicione seu WhatsApp nas configurações do perfil.'
      );
      return new Response(JSON.stringify({ status: 'user_not_found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const organizationId = user.organization_members?.[0]?.organization_id;
    
    if (!organizationId) {
      await sendWhatsAppMessage(senderPhone, 
        '❌ Sua conta não está associada a nenhuma organização.\n\n' +
        'Entre em contato com o administrador do sistema.'
      );
      return new Response(JSON.stringify({ status: 'no_organization' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get context and configurations
    const [teamMembers, leadSources, products] = await Promise.all([
      getOrganizationUsers(organizationId),
      getLeadSources(organizationId),
      getLeadProducts(organizationId)
    ]);

    // Get or create conversation context
    let context = conversationContexts.get(senderPhone) || { history: [] };
    
    // Add user message to history
    context.history.push(`Usuário: ${messageText}`);

    // Process message with AI
    const aiResponse = await processWithAI(messageText, {
      userName: `${user.first_name} ${user.last_name}`,
      organizationId,
      teamMembers,
      leadSources,
      products,
      conversationHistory: context.history,
      pendingAction: context.pendingAction,
      pendingLead: context.pendingLead
    });

    let responseMessage = aiResponse.response_message || 'Desculpe, não entendi. Pode repetir?';

    // Handle different actions
    switch (aiResponse.action) {
      case 'create_lead':
        if (aiResponse.lead_data?.name) {
          // Check for similar leads first
          const similarLeads = await findSimilarLeads(
            organizationId, 
            aiResponse.lead_data.name,
            aiResponse.lead_data.instagram
          );

          if (similarLeads.length > 0 && !context.pendingAction?.includes('confirmed')) {
            // Found similar leads, ask for confirmation
            const leadsList = similarLeads.map(l => 
              `• ${l.name} (@${l.instagram || 'sem insta'}) - ${FUNNEL_STAGES[l.stage as keyof typeof FUNNEL_STAGES]} ${l.stars}⭐`
            ).join('\n');
            
            responseMessage = `🔍 Encontrei leads parecidos:\n\n${leadsList}\n\n` +
              `É algum desses? Responda o número ou "novo" para criar um novo lead.`;
            
            context.pendingAction = 'confirm_lead_creation';
            context.pendingLead = aiResponse.lead_data;
          } else {
            // Create the lead
            const lead = await createLead(organizationId, user.user_id, aiResponse.lead_data);
            const stageLabel = FUNNEL_STAGES[lead.stage as keyof typeof FUNNEL_STAGES] || lead.stage;
            
            responseMessage = `✅ Lead *${lead.name}* cadastrado!\n\n` +
              `📍 Etapa: ${stageLabel}\n` +
              `⭐ Estrelas: ${lead.stars}\n` +
              (lead.instagram ? `📸 Instagram: @${lead.instagram}\n` : '') +
              (lead.whatsapp ? `📱 WhatsApp: ${lead.whatsapp}\n` : '') +
              `\n🔗 Ver no CRM: ${SUPABASE_URL.replace('.supabase.co', '.lovableproject.com')}/lead/${lead.id}`;
            
            // Clear pending
            context.pendingAction = undefined;
            context.pendingLead = undefined;
          }
        }
        break;

      case 'update_lead':
        if (aiResponse.lead_id) {
          const updated = await updateLead(aiResponse.lead_id, aiResponse.lead_data);
          const stageLabel = FUNNEL_STAGES[updated.stage as keyof typeof FUNNEL_STAGES] || updated.stage;
          
          responseMessage = `✅ Lead *${updated.name}* atualizado!\n\n` +
            `📍 Etapa: ${stageLabel}\n` +
            `⭐ Estrelas: ${updated.stars}`;
        }
        break;

      case 'search_lead':
        if (aiResponse.search_query) {
          const leads = await searchLeads(organizationId, aiResponse.search_query);
          
          if (leads.length === 0) {
            responseMessage = `🔍 Nenhum lead encontrado para "${aiResponse.search_query}"`;
          } else {
            const leadsList = leads.map((l, i) => 
              `${i + 1}. *${l.name}* ${l.stars}⭐\n` +
              `   📍 ${FUNNEL_STAGES[l.stage as keyof typeof FUNNEL_STAGES]}\n` +
              (l.instagram ? `   📸 @${l.instagram}\n` : '')
            ).join('\n');
            
            responseMessage = `🔍 Encontrei ${leads.length} lead(s):\n\n${leadsList}`;
          }
        }
        break;

      case 'ask_question':
        // AI is asking for more information
        context.pendingAction = 'waiting_answer';
        context.pendingLead = aiResponse.lead_data;
        break;

      case 'help':
        responseMessage = `🤖 *Sou sua secretária virtual do Morphews CRM!*\n\n` +
          `Você pode me enviar mensagens como:\n\n` +
          `📝 *Criar lead:*\n` +
          `"Acabei de falar com Dr. João, cirurgião plástico, @drjoao no insta, muito interessado, 5 estrelas"\n\n` +
          `🔍 *Buscar lead:*\n` +
          `"Busca o lead João" ou "Procura @drjoao"\n\n` +
          `📊 *Atualizar lead:*\n` +
          `"O Dr. João agendou call para amanhã" ou "João agora é 5 estrelas"\n\n` +
          `Sempre me diga a *etapa do funil* e *quantas estrelas* o lead merece! 🌟`;
        break;
    }

    // Add response to history
    context.history.push(`Assistente: ${responseMessage}`);
    
    // Keep only last 20 messages
    if (context.history.length > 20) {
      context.history = context.history.slice(-20);
    }
    
    // Save context
    conversationContexts.set(senderPhone, context);

    // Send response via WhatsApp
    await sendWhatsAppMessage(senderPhone, responseMessage);

    return new Response(JSON.stringify({ 
      status: 'success',
      action: aiResponse.action,
      message: responseMessage
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error processing webhook:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
