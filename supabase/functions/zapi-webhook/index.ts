import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ZAPI_INSTANCE_ID = Deno.env.get('ZAPI_INSTANCE_ID');
const ZAPI_TOKEN = Deno.env.get('ZAPI_TOKEN');
const ZAPI_CLIENT_TOKEN = Deno.env.get('ZAPI_CLIENT_TOKEN');
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Debug: Log environment variables (redacted)
console.log('=== Z-API Configuration ===');
console.log('ZAPI_INSTANCE_ID:', ZAPI_INSTANCE_ID ? `${ZAPI_INSTANCE_ID.substring(0, 8)}...` : 'NOT SET');
console.log('ZAPI_TOKEN:', ZAPI_TOKEN ? `${ZAPI_TOKEN.substring(0, 8)}...` : 'NOT SET');
console.log('ZAPI_CLIENT_TOKEN:', ZAPI_CLIENT_TOKEN ? `${ZAPI_CLIENT_TOKEN.substring(0, 8)}...` : 'NOT SET');
console.log('SUPABASE_URL:', SUPABASE_URL ? 'SET' : 'NOT SET');
console.log('SUPABASE_SERVICE_ROLE_KEY:', SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'NOT SET');
console.log('===========================');

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Funnel stages mapping
const FUNNEL_STAGES = {
  'prospect': 'Não classificado',
  'contacted': 'Cliente nos chamou',
  'convincing': 'Convencendo a marcar call',
  'scheduled': 'Call agendada',
  'positive': 'Positivo/Interessado',
  'waiting_payment': 'Aguardando pagamento',
  'success': 'PAGO - Sucesso!',
  'trash': 'Sem interesse',
  'cloud': 'Não classificado'
};

// Brazilian phone number normalization
// Always normalize to 13 digits: 55 + DD + 9 + XXXXXXXX
function normalizeBrazilianPhone(phone: string): string[] {
  const clean = phone.replace(/\D/g, '');
  const variants: string[] = [];
  
  // Add the original cleaned number
  variants.push(clean);
  
  // Only process Brazilian numbers (starting with 55)
  if (!clean.startsWith('55')) {
    return variants;
  }
  
  // 12 digits: 55 + DD + 8 digits (missing 9th digit)
  // Convert to 13 digits by adding 9 after area code
  if (clean.length === 12) {
    const normalized = clean.slice(0, 4) + '9' + clean.slice(4);
    variants.push(normalized);
    console.log(`Phone normalization: ${clean} -> added 9th digit -> ${normalized}`);
  }
  
  // 13 digits: 55 + DD + 9 digits (has 9th digit)
  // Also try without the 9th digit for backwards compatibility
  if (clean.length === 13) {
    const withoutNinth = clean.slice(0, 4) + clean.slice(5);
    variants.push(withoutNinth);
    console.log(`Phone normalization: ${clean} -> removed 9th digit -> ${withoutNinth}`);
  }
  
  // 11 digits: DD + 9 + XXXXXXXX (missing country code)
  if (clean.length === 11 && clean.charAt(2) === '9') {
    const withCountry = '55' + clean;
    variants.push(withCountry);
    console.log(`Phone normalization: ${clean} -> added country code -> ${withCountry}`);
  }
  
  // 10 digits: DD + XXXXXXXX (missing country code and 9th digit)
  if (clean.length === 10) {
    const withCountryAnd9th = '55' + clean.slice(0, 2) + '9' + clean.slice(2);
    variants.push(withCountryAnd9th);
    console.log(`Phone normalization: ${clean} -> added country + 9th -> ${withCountryAnd9th}`);
  }
  
  return [...new Set(variants)]; // Remove duplicates
}

async function sendWhatsAppMessage(phone: string, message: string) {
  const url = `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}/send-text`;
  
  console.log('=== Sending WhatsApp Message ===');
  console.log('Phone:', phone);
  console.log('URL:', url);
  console.log('Client-Token configured:', ZAPI_CLIENT_TOKEN ? 'YES' : 'NO');
  
  // Headers with Client-Token for account security
  const headers: Record<string, string> = { 
    'Content-Type': 'application/json',
    'Client-Token': ZAPI_CLIENT_TOKEN || ''
  };
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        phone: phone,
        message: message
      })
    });
    
    const responseText = await response.text();
    console.log('Z-API response status:', response.status);
    console.log('Z-API response body:', responseText);
    
    try {
      return JSON.parse(responseText);
    } catch {
      return { raw: responseText };
    }
  } catch (error) {
    console.error('Error sending WhatsApp message:', error);
    throw error;
  }
}

async function findUserByWhatsApp(whatsapp: string) {
  const phoneVariants = normalizeBrazilianPhone(whatsapp);
  
  console.log('=== Finding User by WhatsApp ===');
  console.log('Input phone:', whatsapp);
  console.log('Phone variants to search:', phoneVariants);
  
  // Try each variant directly - query profiles WITHOUT the join that doesn't exist
  for (const phone of phoneVariants) {
    console.log(`Trying direct match for: ${phone}`);
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('whatsapp', phone)
      .maybeSingle();
    
    if (error) {
      console.log(`Error searching for ${phone}:`, error.message);
      continue;
    }
    
    if (profile) {
      console.log(`✅ User found: ${profile.first_name} ${profile.last_name} (matched with ${phone})`);
      
      // Now get organization membership separately
      const { data: membership } = await supabase
        .from('organization_members')
        .select('organization_id, role')
        .eq('user_id', profile.user_id)
        .maybeSingle();
      
      const orgId = membership?.organization_id || profile.organization_id;
      console.log(`   Organization ID: ${orgId || 'N/A'}`);
      
      return { ...profile, organization_id: orgId, membership };
    }
  }
  
  console.log('Direct match failed. Trying to fetch all profiles...');
  
  // If not found, fetch all profiles and do manual matching
  const { data: allProfiles, error: fetchError } = await supabase
    .from('profiles')
    .select('*')
    .not('whatsapp', 'is', null);
  
  if (fetchError) {
    console.error('Error fetching all profiles:', fetchError.message);
  }
  
  console.log(`Found ${allProfiles?.length || 0} profiles with WhatsApp numbers`);
  
  if (allProfiles && allProfiles.length > 0) {
    for (const profile of allProfiles) {
      console.log(`  Checking: ${profile.first_name} ${profile.last_name} - ${profile.whatsapp}`);
      
      if (!profile.whatsapp) continue;
      
      const storedVariants = normalizeBrazilianPhone(profile.whatsapp);
      
      // Check if any variant matches
      for (const incomingVariant of phoneVariants) {
        if (storedVariants.includes(incomingVariant)) {
          console.log(`✅ User found via cross-match: ${profile.first_name} ${profile.last_name}`);
          
          // Get organization membership
          const { data: membership } = await supabase
            .from('organization_members')
            .select('organization_id, role')
            .eq('user_id', profile.user_id)
            .maybeSingle();
          
          return { ...profile, organization_id: membership?.organization_id || profile.organization_id, membership };
        }
      }
    }
  }
  
  console.log('❌ User NOT found');
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
  const systemPrompt = `Você é uma secretária virtual inteligente do Morphews CRM. Seu papel é ajudar usuários a gerenciar leads de vendas via WhatsApp de forma RÁPIDA e PRÁTICA.

CONTEXTO DO USUÁRIO:
- Nome do usuário: ${context.userName}
- Membros do time disponíveis: ${context.teamMembers.join(', ') || 'Nenhum configurado'}

REGRA PRINCIPAL: FACILITAR, NÃO DIFICULTAR!
- Leads SEMPRE são criados com stage "prospect" (Não classificado) por padrão
- Leads SEMPRE iniciam com 3 estrelas se não mencionado
- NÃO fique perguntando muitas coisas - apenas o NOME é obrigatório para criar um lead!

ETAPAS DO FUNIL (stage):
- prospect: Não classificado / Prospectando (PADRÃO)
- contacted: Cliente nos chamou
- convincing: Convencendo a marcar call
- scheduled: Call agendada
- positive: Call positiva/Interessado
- waiting_payment: Aguardando pagamento
- success: PAGO - Sucesso!
- trash: Sem interesse
- cloud: Não classificado

ESTRELAS - SIMPLIFICADO:
- 5 = TOP (lead muito promissor, grandes chances)
- 3 = Normal (padrão se não informado)
- 1 = Baixa prioridade (não investir tanto tempo)

FORMATO DE RESPOSTA (JSON):
{
  "action": "create_lead" | "update_lead" | "search_lead" | "ask_question" | "list_leads" | "help",
  "lead_data": {
    "name": "string (ÚNICO campo obrigatório)",
    "whatsapp": "string",
    "instagram": "string (sem @)",
    "email": "string",
    "specialty": "string",
    "followers": number,
    "stage": "prospect",
    "stars": 3,
    "assigned_to": "string",
    "observations": "string"
  },
  "question": "string (pergunta SIMPLES para o usuário)",
  "response_message": "string (mensagem curta e objetiva)"
}

REGRAS:
1. Se tem NOME, CRIE O LEAD IMEDIATAMENTE com stage="prospect" e stars=3
2. Depois de criar, pergunte de forma SIMPLES: "Lead criado! Quer classificar como 5⭐ (TOP) ou 1⭐ (baixa prioridade)? Se não responder, fica 3⭐."
3. NÃO pergunte etapa do funil - sempre começa como "prospect" (Não classificado)
4. Seja DIRETO e PRÁTICO
5. Responda em português brasileiro

${context.pendingAction ? `AÇÃO PENDENTE: ${context.pendingAction}` : ''}
${context.pendingLead ? `LEAD PENDENTE: ${JSON.stringify(context.pendingLead)}` : ''}

HISTÓRICO:
${context.conversationHistory.slice(-5).join('\n') || 'Nenhum'}`;

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
      // User not registered - send invitation to sign up for free plan
      const senderName = payload.senderName || payload.chatName || 'Olá';
      
      console.log(`User not found. Sending signup invitation to ${senderPhone} (${senderName})`);
      
      // Save as interested lead
      try {
        await supabase.from('interested_leads').insert({
          name: senderName,
          whatsapp: senderPhone,
          status: 'whatsapp_signup_invite',
        });
        console.log('Interested lead saved from WhatsApp');
      } catch (e) {
        console.log('Could not save interested lead (may already exist):', e);
      }
      
      const signupUrl = `${Deno.env.get('SUPABASE_URL')?.replace('.supabase.co', '.lovable.app')}/planos`;
      
      await sendWhatsAppMessage(senderPhone, 
        `👋 Oi${senderName ? `, ${senderName.split(' ')[0]}` : ''}! Percebi que você ainda não tem uma conta no Morphews.\n\n` +
        `🎁 *TESTE GRÁTIS!*\n` +
        `Crie sua conta agora e ganhe:\n` +
        `✅ 5 leads por mês\n` +
        `✅ Secretária IA no WhatsApp\n` +
        `✅ Dashboard completo\n` +
        `✅ Sem cartão de crédito\n\n` +
        `📱 É só acessar:\nhttps://morphews.lovable.app/planos\n\n` +
        `Crie sua conta gratuita e volte a me mandar mensagem! 🚀`
      );
      
      return new Response(JSON.stringify({ status: 'signup_invitation_sent' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    // Get organization ID from the returned user data
    const organizationId = user.membership?.organization_id || user.organization_id;
    
    console.log('=== Processing Message ===');
    console.log('User:', user.first_name, user.last_name);
    console.log('Organization ID:', organizationId);
    
    if (!organizationId) {
      console.log('ERROR: No organization ID found for user');
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
