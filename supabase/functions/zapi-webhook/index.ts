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
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
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
  'cloud': 'Não classificado',
  'prospect': 'Prospectando / Aguardando resposta',
  'contacted': 'Cliente nos chamou',
  'convincing': 'Convencendo a marcar call',
  'scheduled': 'Call agendada',
  'positive': 'Positivo/Interessado',
  'waiting_payment': 'Aguardando pagamento',
  'success': 'PAGO - Sucesso!',
  'trash': 'Sem interesse'
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

// Transcribe audio using OpenAI Whisper
async function transcribeAudio(audioUrl: string): Promise<string | null> {
  console.log('=== Transcribing Audio ===');
  console.log('Audio URL:', audioUrl);
  
  if (!OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY not configured');
    return null;
  }
  
  try {
    // Download the audio file
    console.log('Downloading audio file...');
    const audioResponse = await fetch(audioUrl);
    if (!audioResponse.ok) {
      console.error('Failed to download audio:', audioResponse.status);
      return null;
    }
    
    const audioBuffer = await audioResponse.arrayBuffer();
    console.log('Audio downloaded, size:', audioBuffer.byteLength, 'bytes');
    
    // Create form data for Whisper API
    const formData = new FormData();
    const audioBlob = new Blob([audioBuffer], { type: 'audio/ogg' });
    formData.append('file', audioBlob, 'audio.ogg');
    formData.append('model', 'whisper-1');
    formData.append('language', 'pt'); // Portuguese
    
    console.log('Sending to Whisper API...');
    const whisperResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: formData,
    });
    
    if (!whisperResponse.ok) {
      const errorText = await whisperResponse.text();
      console.error('Whisper API error:', whisperResponse.status, errorText);
      return null;
    }
    
    const result = await whisperResponse.json();
    console.log('Transcription result:', result.text);
    return result.text;
  } catch (error) {
    console.error('Error transcribing audio:', error);
    return null;
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
    existingLeads?: any[];
  }
) {
  // Build existing leads context for AI to know what's already in the system
  const existingLeadsInfo = context.existingLeads?.map(l => 
    `- ${l.name} (ID: ${l.id}, Instagram: @${l.instagram || 'N/A'}, Etapa: ${FUNNEL_STAGES[l.stage as keyof typeof FUNNEL_STAGES] || l.stage}, ${l.stars}⭐)`
  ).join('\n') || 'Nenhum lead recente';

  const systemPrompt = `Você é uma secretária virtual ALTAMENTE INTELIGENTE do Morphews CRM. Seu papel é ajudar usuários a gerenciar leads de vendas via WhatsApp.

🧠 REGRA #1 - PENSE ANTES DE AGIR:
Antes de responder, ANALISE COMPLETAMENTE a mensagem do usuário:
1. Identifique TODAS as informações mencionadas (nome, telefone, instagram, estrelas, etapa, reunião, etc.)
2. Identifique TODAS as ações solicitadas (criar, atualizar, agendar, etc.)
3. Execute TODAS as ações em uma única resposta
4. Liste TUDO que foi alterado na resposta para o usuário conferir

📝 REGRA #2 - CORREÇÃO ORTOGRÁFICA:
- Corrija automaticamente nomes com erros ortográficos comuns
- "Tiago" → "Thiago" (nome brasileiro comum com H)
- "Joao" → "João" (acentuação)
- Use a grafia CORRETA no banco de dados
- Se não tiver certeza, mantenha como o usuário escreveu

CONTEXTO DO USUÁRIO:
- Nome do usuário: ${context.userName}
- Data de hoje: ${new Date().toLocaleDateString('pt-BR')} (use para calcular datas como "amanhã", "semana que vem")
- Membros do time disponíveis: ${context.teamMembers.join(', ') || 'Nenhum configurado'}

LEADS EXISTENTES NA ORGANIZAÇÃO (BUSQUE AQUI PRIMEIRO!):
${existingLeadsInfo}

⚠️ REGRA - NUNCA CRIAR LEADS SEM DADOS REAIS:
- NUNCA crie leads com nomes genéricos como "Novo Lead", "Lead", "Contato"
- Se o usuário não fornecer o NOME REAL, pergunte!
- O campo "name" DEVE conter o nome real da pessoa

⚠️ REGRA - SE NÃO ENTENDEU, PERGUNTE:
- Se a mensagem não está clara, use action "ask_question"
- NUNCA tente adivinhar ou criar dados fictícios

ETAPAS DO FUNIL (stage):
- cloud: Não classificado (PADRÃO para novos leads)
- prospect: Prospectando / Aguardando resposta
- contacted: Cliente nos chamou
- convincing: Convencendo a marcar call
- scheduled: Call agendada
- positive: Call positiva/Interessado
- waiting_payment: Aguardando pagamento
- success: PAGO - Sucesso!
- trash: Sem interesse

ESTRELAS:
- 5 = Prioridade Máxima (muito promissor)
- 4 = Muito bom
- 3 = Mais ou menos (padrão)
- 2 = Não levo fé
- 1 = Baixa energia

FORMATO DE RESPOSTA (JSON):
{
  "action": "create_lead" | "update_lead" | "search_lead" | "create_event" | "ask_question" | "list_leads" | "help",
  "lead_id": "UUID do lead existente (OBRIGATÓRIO para update_lead, create_event)",
  "lead_data": {
    "name": "string - NOME CORRETO com ortografia certa",
    "whatsapp": "string",
    "instagram": "string (sem @)",
    "email": "string",
    "specialty": "string",
    "followers": number,
    "stage": "string",
    "stars": number,
    "assigned_to": "string",
    "observations": "string"
  },
  "event_data": {
    "title": "string - título do evento",
    "start_time": "string - ISO date YYYY-MM-DDTHH:MM:SS",
    "end_time": "string - ISO date (default: 1h após start)",
    "description": "string",
    "meeting_link": "string"
  },
  "changes_summary": ["lista de todas as alterações feitas para mostrar ao usuário"],
  "question": "string (pergunta para o usuário)",
  "response_message": "string - DEVE listar TODAS as alterações feitas para o usuário conferir!"
}

📋 REGRA #3 - RESPONSE_MESSAGE DEVE LISTAR TUDO:
Na response_message, SEMPRE liste TODAS as alterações feitas:
- Nome: [valor]
- WhatsApp: [valor]  
- Instagram: @[valor]
- Etapa: [etapa em português]
- Estrelas: [X]⭐
- Evento: [data e hora]
- Observações: [texto]

EXEMPLO DE RESPOSTA COMPLETA:
Se o usuário diz: "Marquei reunião com Tiago amanhã às 14h, 5 estrelas, instagram @thiagorocha"
Responda com action "create_event" E inclua na response_message:
"✅ Lead *Thiago* atualizado!

📝 *Alterações feitas:*
• Nome: Thiago (corrigido de Tiago)
• Instagram: @thiagorocha
• Estrelas: ⭐⭐⭐⭐⭐ (5 - Prioridade Máxima)
• Etapa: Call Agendada
• Reunião: 05/12 às 14:00

🔗 Ver no CRM: [link]

Confere se está tudo certo! 👍"

REGRAS FINAIS:
1. SEMPRE verifique se o lead já existe antes de criar
2. Use update_lead se o lead existe, create_lead se não existe
3. Ao criar evento, SEMPRE mude stage para "scheduled"
4. Corrija ortografia de nomes automaticamente
5. LISTE TODAS as alterações na resposta
6. Responda em português brasileiro

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
        model: 'google/gemini-2.5-pro',
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
  // Check lead limit for the organization's subscription plan
  const { data: subscription, error: subError } = await supabase
    .from('subscriptions')
    .select(`
      *,
      plan:subscription_plans(*)
    `)
    .eq('organization_id', organizationId)
    .maybeSingle();

  if (subError) {
    console.error('Error fetching subscription:', subError);
    throw new Error('Erro ao verificar plano de assinatura');
  }

  if (subscription?.plan?.max_leads !== null) {
    // Count leads created this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { count, error: countError } = await supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .gte('created_at', startOfMonth.toISOString());

    if (countError) {
      console.error('Error counting leads:', countError);
      throw new Error('Erro ao verificar limite de leads');
    }

    if (count !== null && count >= subscription.plan.max_leads) {
      throw new Error(`Limite de ${subscription.plan.max_leads} leads/mês atingido. Faça upgrade do plano em crm.morphews.com/equipe`);
    }
  }

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
      stage: leadData.stage || 'cloud',
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

async function createEvent(organizationId: string, userId: string, leadId: string, eventData: any) {
  // Parse and validate the start time
  let startTime = new Date(eventData.start_time);
  
  // If invalid date, try to parse common formats
  if (isNaN(startTime.getTime())) {
    console.error('Invalid start_time:', eventData.start_time);
    throw new Error('Data/hora inválida para o evento');
  }
  
  // Calculate end time (default 1 hour after start)
  let endTime: Date;
  if (eventData.end_time) {
    endTime = new Date(eventData.end_time);
    if (isNaN(endTime.getTime())) {
      endTime = new Date(startTime.getTime() + 60 * 60 * 1000);
    }
  } else {
    endTime = new Date(startTime.getTime() + 60 * 60 * 1000);
  }
  
  const { data, error } = await supabase
    .from('lead_events')
    .insert({
      lead_id: leadId,
      user_id: userId,
      organization_id: organizationId,
      title: eventData.title || 'Reunião',
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      description: eventData.description || null,
      meeting_link: eventData.meeting_link || null,
    })
    .select()
    .single();
  
  if (error) {
    console.error('Error creating event:', error);
    throw error;
  }
  
  console.log('Event created:', data.id);
  return data;
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
    // We're interested in received messages - text, image with caption, or audio
    const textMessage = payload.text?.message;
    const imageCaption = payload.image?.caption;
    const audioUrl = payload.audio?.audioUrl;
    
    // Check if it's an audio message - transcribe it first
    let audioTranscription: string | null = null;
    if (audioUrl && !textMessage && !imageCaption) {
      console.log('=== Audio Message Detected ===');
      audioTranscription = await transcribeAudio(audioUrl);
      if (!audioTranscription) {
        console.log('Failed to transcribe audio, ignoring message');
        return new Response(JSON.stringify({ status: 'audio_transcription_failed' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      console.log('Audio transcription:', audioTranscription);
    }
    
    const messageContent = textMessage || imageCaption || audioTranscription;
    
    if (!payload.phone || !messageContent) {
      console.log('Ignoring message without text/caption/audio or missing phone');
      return new Response(JSON.stringify({ status: 'ignored' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const senderPhone = payload.phone.replace(/\D/g, '');
    const messageText = messageContent; // Can be text message, image caption, or audio transcription
    const isFromMe = payload.fromMe === true;
    
    console.log('=== Message Content ===');
    console.log('Text message:', textMessage || 'N/A');
    console.log('Image caption:', imageCaption || 'N/A');
    console.log('Audio transcription:', audioTranscription || 'N/A');
    console.log('Using content:', messageText);

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
      
      await sendWhatsAppMessage(senderPhone, 
        `👋 Oi${senderName ? `, ${senderName.split(' ')[0]}` : ''}! Percebi que você ainda não tem uma conta no Morphews.\n\n` +
        `🎁 *TESTE GRÁTIS!*\n` +
        `Crie sua conta agora e ganhe:\n` +
        `✅ 5 leads por mês\n` +
        `✅ Secretária IA no WhatsApp\n` +
        `✅ Dashboard completo\n` +
        `✅ Sem cartão de crédito\n\n` +
        `📱 É só acessar:\nhttps://crm.morphews.com/planos\n\n` +
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

    // Get context and configurations - INCLUDING existing leads for context
    const [teamMembers, leadSources, products, existingLeadsData] = await Promise.all([
      getOrganizationUsers(organizationId),
      getLeadSources(organizationId),
      getLeadProducts(organizationId),
      supabase
        .from('leads')
        .select('id, name, instagram, stage, stars, whatsapp')
        .eq('organization_id', organizationId)
        .order('updated_at', { ascending: false })
        .limit(50)
    ]);
    
    const existingLeads = existingLeadsData.data || [];
    console.log(`Found ${existingLeads.length} existing leads for organization`);

    // Get or create conversation context
    let context = conversationContexts.get(senderPhone) || { history: [] };
    
    // Add user message to history
    context.history.push(`Usuário: ${messageText}`);

    // Process message with AI - now with existing leads context!
    const aiResponse = await processWithAI(messageText, {
      userName: `${user.first_name} ${user.last_name}`,
      organizationId,
      teamMembers,
      leadSources,
      products,
      conversationHistory: context.history,
      pendingAction: context.pendingAction,
      pendingLead: context.pendingLead,
      existingLeads: existingLeads
    });

    let responseMessage = aiResponse.response_message || 'Desculpe, não entendi. Pode repetir?';

    // Handle different actions
    switch (aiResponse.action) {
      case 'create_lead':
        if (aiResponse.lead_data?.name) {
          // Skip duplicate check if we just created a lead (prevents showing duplicates after creation)
          const skipDuplicateCheck = context.pendingAction?.startsWith('lead_created_') || 
                                     context.pendingAction?.includes('confirmed');
          
          // Check for similar leads first (unless we should skip)
          let similarLeads: any[] = [];
          if (!skipDuplicateCheck) {
            similarLeads = await findSimilarLeads(
              organizationId, 
              aiResponse.lead_data.name,
              aiResponse.lead_data.instagram
            );
          }

          if (similarLeads.length > 0) {
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
            
            // Use AI's response_message if provided (should list all changes), otherwise build one
            if (aiResponse.response_message && aiResponse.response_message.length > 20) {
              responseMessage = aiResponse.response_message
                .replace('[link]', `https://crm.morphews.com/leads/${lead.id}`)
                .replace(/🔗 Ver no CRM:.*$/m, `🔗 Ver no CRM: https://crm.morphews.com/leads/${lead.id}`);
            } else {
              responseMessage = `✅ Lead *${lead.name}* cadastrado!\n\n` +
                `📝 *Dados do lead:*\n` +
                `• Nome: ${lead.name}\n` +
                `• Etapa: ${stageLabel}\n` +
                `• Estrelas: ${'⭐'.repeat(lead.stars)} (${lead.stars})\n` +
                (lead.instagram ? `• Instagram: @${lead.instagram}\n` : '') +
                (lead.whatsapp ? `• WhatsApp: ${lead.whatsapp}\n` : '') +
                (lead.email ? `• Email: ${lead.email}\n` : '') +
                `\n🔗 Ver no CRM: https://crm.morphews.com/leads/${lead.id}\n\n` +
                `Confere se está tudo certo! 👍`;
            }
            
            // Clear pending and mark as just created to avoid duplicate check on next message
            context.pendingAction = `lead_created_${lead.id}`;
            context.pendingLead = undefined;
          }
        }
        break;

      case 'update_lead':
        let leadToUpdate = aiResponse.lead_id;
        
        // If no lead_id, try to find by name
        if (!leadToUpdate && aiResponse.lead_data?.name) {
          console.log('Searching lead by name for update:', aiResponse.lead_data.name);
          const foundLeads = await searchLeads(organizationId, aiResponse.lead_data.name);
          if (foundLeads.length > 0) {
            leadToUpdate = foundLeads[0].id;
            console.log('Found lead for update:', foundLeads[0].name, leadToUpdate);
          }
        }
        
        if (leadToUpdate) {
          const updated = await updateLead(leadToUpdate, aiResponse.lead_data);
          
          // Use AI's response_message if provided (it should list all changes), otherwise build a basic one
          if (aiResponse.response_message && aiResponse.response_message.length > 20) {
            // Replace [link] placeholder with actual link
            responseMessage = aiResponse.response_message
              .replace('[link]', `https://crm.morphews.com/leads/${updated.id}`)
              .replace(/🔗 Ver no CRM:.*$/m, `🔗 Ver no CRM: https://crm.morphews.com/leads/${updated.id}`);
          } else {
            const stageLabel = FUNNEL_STAGES[updated.stage as keyof typeof FUNNEL_STAGES] || updated.stage;
            responseMessage = `✅ Lead *${updated.name}* atualizado!\n\n` +
              `📝 *Alterações feitas:*\n` +
              (aiResponse.lead_data?.stage ? `• Etapa: ${stageLabel}\n` : '') +
              (aiResponse.lead_data?.stars ? `• Estrelas: ${'⭐'.repeat(updated.stars)} (${updated.stars})\n` : '') +
              (aiResponse.lead_data?.instagram ? `• Instagram: @${updated.instagram}\n` : '') +
              (aiResponse.lead_data?.whatsapp ? `• WhatsApp: ${updated.whatsapp}\n` : '') +
              (aiResponse.lead_data?.email ? `• Email: ${updated.email}\n` : '') +
              (aiResponse.lead_data?.observations ? `• Observações: ${updated.observations}\n` : '') +
              `\n🔗 Ver no CRM: https://crm.morphews.com/leads/${updated.id}\n\n` +
              `Confere se está tudo certo! 👍`;
          }
        } else {
          responseMessage = `⚠️ Não encontrei um lead com esse nome para atualizar. Você pode criar um novo ou me dizer o nome exato do lead.`;
        }
        break;

      case 'search_lead':
        // If lead_id is provided, get that specific lead's full data
        if (aiResponse.lead_id) {
          const { data: lead } = await supabase
            .from('leads')
            .select('*')
            .eq('id', aiResponse.lead_id)
            .maybeSingle();
          
          if (lead) {
            const stageLabel = FUNNEL_STAGES[lead.stage as keyof typeof FUNNEL_STAGES] || lead.stage;
            responseMessage = `📋 *Dados de ${lead.name}:*\n\n` +
              `📍 Etapa: ${stageLabel}\n` +
              `⭐ Estrelas: ${lead.stars}\n` +
              (lead.instagram ? `📸 Instagram: @${lead.instagram}\n` : '') +
              (lead.whatsapp ? `📱 WhatsApp: ${lead.whatsapp}\n` : '') +
              (lead.email ? `📧 Email: ${lead.email}\n` : '') +
              (lead.specialty ? `🏢 Especialidade: ${lead.specialty}\n` : '') +
              (lead.followers ? `👥 Seguidores: ${lead.followers}\n` : '') +
              (lead.observations ? `📝 Obs: ${lead.observations}\n` : '') +
              `\n🔗 Ver/editar no CRM:\nhttps://crm.morphews.com/leads/${lead.id}`;
          } else {
            responseMessage = `⚠️ Lead não encontrado.`;
          }
        } else if (aiResponse.search_query) {
          const leads = await searchLeads(organizationId, aiResponse.search_query);
          
          if (leads.length === 0) {
            responseMessage = `🔍 Nenhum lead encontrado para "${aiResponse.search_query}"`;
          } else if (leads.length === 1) {
            // Single result - show full data
            const lead = leads[0];
            const stageLabel = FUNNEL_STAGES[lead.stage as keyof typeof FUNNEL_STAGES] || lead.stage;
            responseMessage = `📋 *Dados de ${lead.name}:*\n\n` +
              `📍 Etapa: ${stageLabel}\n` +
              `⭐ Estrelas: ${lead.stars}\n` +
              (lead.instagram ? `📸 Instagram: @${lead.instagram}\n` : '') +
              (lead.whatsapp ? `📱 WhatsApp: ${lead.whatsapp}\n` : '') +
              `\n🔗 Ver/editar no CRM:\nhttps://crm.morphews.com/leads/${lead.id}`;
          } else {
            const leadsList = leads.map((l, i) => 
              `${i + 1}. *${l.name}* ${l.stars}⭐\n` +
              `   📍 ${FUNNEL_STAGES[l.stage as keyof typeof FUNNEL_STAGES]}\n` +
              (l.instagram ? `   📸 @${l.instagram}\n` : '')
            ).join('\n');
            
            responseMessage = `🔍 Encontrei ${leads.length} lead(s):\n\n${leadsList}\n\nQual você quer ver os dados completos?`;
          }
        } else {
          responseMessage = `⚠️ Me diga o nome do lead que você quer consultar.`;
        }
        break;

      case 'create_event':
        // Create an event/meeting for a lead
        let eventLeadId = aiResponse.lead_id;
        
        // If no lead_id, try to find by name from lead_data
        if (!eventLeadId && aiResponse.lead_data?.name) {
          console.log('Searching lead by name for event:', aiResponse.lead_data.name);
          const foundLeads = await searchLeads(organizationId, aiResponse.lead_data.name);
          if (foundLeads.length > 0) {
            eventLeadId = foundLeads[0].id;
            console.log('Found lead for event:', foundLeads[0].name, eventLeadId);
          }
        }
        
        if (eventLeadId && aiResponse.event_data?.start_time) {
          try {
            // Create the event
            const event = await createEvent(organizationId, user.user_id, eventLeadId, aiResponse.event_data);
            
            // Also update the lead stage to "scheduled" and any other lead_data
            let updatedLead;
            if (aiResponse.lead_data) {
              const updateData = { ...aiResponse.lead_data };
              if (!updateData.stage) {
                updateData.stage = 'scheduled';
              }
              updatedLead = await updateLead(eventLeadId, updateData);
            } else {
              updatedLead = await updateLead(eventLeadId, { stage: 'scheduled' });
            }
            
            const eventDate = new Date(event.start_time);
            const dateStr = eventDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
            const timeStr = eventDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            
            // Use AI's response_message if provided, otherwise build a detailed one
            if (aiResponse.response_message && aiResponse.response_message.length > 20) {
              responseMessage = aiResponse.response_message
                .replace('[link]', `https://crm.morphews.com/leads/${eventLeadId}`)
                .replace(/🔗 Ver no CRM:.*$/m, `🔗 Ver no CRM: https://crm.morphews.com/leads/${eventLeadId}`);
            } else {
              const stageLabel = FUNNEL_STAGES[updatedLead.stage as keyof typeof FUNNEL_STAGES] || updatedLead.stage;
              responseMessage = `✅ Lead *${updatedLead.name}* atualizado!\n\n` +
                `📝 *Alterações feitas:*\n` +
                `• Etapa: ${stageLabel}\n` +
                (aiResponse.lead_data?.stars ? `• Estrelas: ${'⭐'.repeat(updatedLead.stars)} (${updatedLead.stars})\n` : '') +
                (aiResponse.lead_data?.instagram ? `• Instagram: @${updatedLead.instagram}\n` : '') +
                `\n📅 *Evento criado:*\n` +
                `• ${event.title}\n` +
                `• Data: ${dateStr} às ${timeStr}\n` +
                (event.meeting_link ? `• Link: ${event.meeting_link}\n` : '') +
                `\n🔗 Ver no CRM: https://crm.morphews.com/leads/${eventLeadId}\n\n` +
                `Confere se está tudo certo! 👍`;
            }
          } catch (eventError: any) {
            console.error('Error creating event:', eventError);
            responseMessage = `⚠️ Erro ao criar evento: ${eventError.message}`;
          }
        } else if (!eventLeadId) {
          responseMessage = `⚠️ Não encontrei o lead mencionado. Qual é o nome do lead para agendar a reunião?`;
        } else {
          responseMessage = `⚠️ Preciso saber a data e hora da reunião. Pode me informar?`;
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
      
      default:
        // Unknown action or couldn't process
        responseMessage = `🤔 Não consegui entender sua mensagem.\n\n` +
          `Tente novamente ou acesse nossa versão web para cadastrar diretamente:\n` +
          `🌐 crm.morphews.com`;
        break;
    }

    // Fallback if no response was generated
    if (!responseMessage || responseMessage.trim() === '') {
      responseMessage = `🤔 Não consegui processar sua solicitação.\n\n` +
        `Tente enviar de outra forma ou acesse nossa versão web:\n` +
        `🌐 crm.morphews.com`;
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
    
    // Try to send error message to user if we have their phone
    try {
      const payload = await req.clone().json().catch(() => null);
      if (payload?.phone) {
        const errorMessage = `😕 Desculpe, ocorreu um erro ao processar sua mensagem.\n\n` +
          `Por favor, tente novamente ou acesse nossa versão web:\n` +
          `🌐 crm.morphews.com`;
        await sendWhatsAppMessage(payload.phone.replace(/\D/g, ''), errorMessage);
      }
    } catch (sendError) {
      console.error('Error sending error message:', sendError);
    }
    
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
