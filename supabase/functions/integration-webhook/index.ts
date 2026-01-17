import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

// Rate limiting configuration
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute window
const RATE_LIMIT_MAX_REQUESTS_PER_TOKEN = 100; // 100 requests per minute per integration
const RATE_LIMIT_MAX_REQUESTS_PER_IP = 200; // 200 requests per minute per IP (across all tokens)
const DAILY_LEAD_LIMIT_DEFAULT = 1000; // Default daily lead limit per integration

// In-memory rate limiting (resets on cold start, but provides basic protection)
const tokenRateLimits = new Map<string, { count: number; resetAt: number; dailyCount: number; dailyResetAt: number }>();
const ipRateLimits = new Map<string, { count: number; resetAt: number }>();

interface RateLimitResult {
  limited: boolean;
  reason?: string;
  retryAfterSeconds?: number;
}

function checkRateLimit(integrationId: string, clientIp: string): RateLimitResult {
  const now = Date.now();
  const today = new Date().toDateString();
  
  // Check IP-based rate limit first (protection against distributed attacks)
  let ipEntry = ipRateLimits.get(clientIp);
  if (!ipEntry || now > ipEntry.resetAt) {
    ipEntry = { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS };
    ipRateLimits.set(clientIp, ipEntry);
  } else {
    ipEntry.count++;
    if (ipEntry.count > RATE_LIMIT_MAX_REQUESTS_PER_IP) {
      const retryAfter = Math.ceil((ipEntry.resetAt - now) / 1000);
      return { 
        limited: true, 
        reason: 'IP rate limit exceeded',
        retryAfterSeconds: retryAfter
      };
    }
  }
  
  // Check per-token rate limit
  let tokenEntry = tokenRateLimits.get(integrationId);
  const dailyResetAt = new Date(today).getTime() + 24 * 60 * 60 * 1000;
  
  if (!tokenEntry || now > tokenEntry.resetAt) {
    // Reset minute counter
    const dailyCount = tokenEntry && tokenEntry.dailyResetAt === dailyResetAt 
      ? tokenEntry.dailyCount + 1 
      : 1;
    tokenEntry = { 
      count: 1, 
      resetAt: now + RATE_LIMIT_WINDOW_MS,
      dailyCount,
      dailyResetAt
    };
    tokenRateLimits.set(integrationId, tokenEntry);
  } else {
    tokenEntry.count++;
    
    // Reset daily counter if new day
    if (tokenEntry.dailyResetAt !== dailyResetAt) {
      tokenEntry.dailyCount = 1;
      tokenEntry.dailyResetAt = dailyResetAt;
    } else {
      tokenEntry.dailyCount++;
    }
    
    // Check per-minute limit
    if (tokenEntry.count > RATE_LIMIT_MAX_REQUESTS_PER_TOKEN) {
      const retryAfter = Math.ceil((tokenEntry.resetAt - now) / 1000);
      return { 
        limited: true, 
        reason: 'Token rate limit exceeded (max 100/minute)',
        retryAfterSeconds: retryAfter
      };
    }
    
    // Check daily limit
    if (tokenEntry.dailyCount > DAILY_LEAD_LIMIT_DEFAULT) {
      return { 
        limited: true, 
        reason: 'Daily limit exceeded (max 1000 leads/day per integration)',
        retryAfterSeconds: Math.ceil((dailyResetAt - now) / 1000)
      };
    }
  }
  
  return { limited: false };
}

interface FieldMapping {
  source_field: string;
  target_field: string;
  transform_type: string;
}

interface Integration {
  id: string;
  organization_id: string;
  name: string;
  status: string;
  default_stage: string | null;
  default_responsible_user_ids: string[] | null;
  default_product_id: string | null;
  auto_followup_days: number | null;
  non_purchase_reason_id: string | null;
  settings: Record<string, any>;
  event_mode: 'lead' | 'sale' | 'both' | null;
  sale_status_on_create: string | null;
  sale_tag: string | null;
}

function normalizePhone(phone: string): string {
  if (!phone) return '';
  // Remove all non-digit characters
  let digits = phone.replace(/\D/g, '');

  // If starts with country code, keep it
  if (digits.startsWith('55') && digits.length >= 12) {
    return digits;
  }

  // Add Brazil country code if missing
  if (digits.length === 10 || digits.length === 11) {
    digits = '55' + digits;
  }

  return digits;
}

function applyTransform(value: any, transformType: string): string {
  if (value === null || value === undefined) return '';

  const strValue = String(value).trim();

  switch (transformType) {
    case 'phone_normalize':
      return normalizePhone(strValue);
    case 'uppercase':
      return strValue.toUpperCase();
    case 'lowercase':
      return strValue.toLowerCase();
    case 'trim':
      return strValue;
    default:
      return strValue;
  }
}

function extractNestedValue(obj: any, path: string): any {
  // Handle nested paths like "customer.name" or simple paths like "name"
  const parts = path.split('.');
  let value = obj;

  for (const part of parts) {
    if (value === null || value === undefined) return null;
    value = value[part];
  }

  return value;
}

function findValueInPayload(payload: any, sourceField: string): any {
  // Try exact match first
  let value = extractNestedValue(payload, sourceField);
  if (value !== null && value !== undefined) return value;

  // Try case-insensitive search
  const lowerField = sourceField.toLowerCase();

  function searchObject(obj: any, targetField: string): any {
    if (obj === null || typeof obj !== 'object') return null;

    for (const key of Object.keys(obj)) {
      if (
        key.toLowerCase() === targetField ||
        key.toLowerCase().replace(/[_\s-]/g, '') === targetField.replace(/[_\s-]/g, '')
      ) {
        return obj[key];
      }

      // Search nested objects
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        const found = searchObject(obj[key], targetField);
        if (found !== null) return found;
      }
    }

    return null;
  }

  return searchObject(payload, lowerField);
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Handle HEAD/GET for URL validation (platforms like Payt test the URL before saving)
  if (req.method === 'HEAD') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get('token');

    const isTest =
      url.pathname.endsWith('/test') ||
      url.searchParams.get('test') === '1' ||
      url.searchParams.get('mode') === 'test';

    // For GET requests without body, treat as validation/ping
    if (req.method === 'GET') {
      if (!token) {
        return new Response(JSON.stringify({ ok: true, message: 'Webhook endpoint ativo' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      // If token provided, validate it exists
      const backendUrl = Deno.env.get('SUPABASE_URL')!;
      const backendKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(backendUrl, backendKey);
      
      const { data: integration } = await supabase
        .from('integrations')
        .select('id, name, status')
        .eq('auth_token', token)
        .maybeSingle();
      
      if (integration) {
        return new Response(JSON.stringify({ 
          ok: true, 
          integration: integration.name,
          status: integration.status,
          message: integration.status === 'active' ? 'Integração ativa e pronta para receber dados' : 'Integração encontrada (inativa)'
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    if (!token) {
      console.error('No token provided');
      return new Response(JSON.stringify({ error: 'Token de autenticação não fornecido' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create backend client with service role
    const backendUrl = Deno.env.get('SUPABASE_URL')!;
    const backendKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(backendUrl, backendKey);

    // Find integration by token (log even if inactive)
    const { data: integration, error: integrationError } = await supabase
      .from('integrations')
      .select('*')
      .eq('auth_token', token)
      .maybeSingle();

    if (integrationError || !integration) {
      console.error('Integration not found:', integrationError);
      return new Response(JSON.stringify({ error: 'Integração não encontrada' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get client IP for rate limiting
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                     req.headers.get('x-real-ip') || 
                     'unknown';

    // Check rate limiting (skip for test mode and validation pings)
    if (!isTest) {
      const rateLimitCheck = checkRateLimit(integration.id, clientIp);
      if (rateLimitCheck.limited) {
        console.warn(`Rate limited: ${rateLimitCheck.reason} - IP: ${clientIp}, Integration: ${integration.id}`);
        
        // Log the rate limit hit
        await supabase.from('integration_logs').insert({
          integration_id: integration.id,
          organization_id: integration.organization_id,
          direction: 'inbound',
          status: 'rate_limited',
          event_type: 'rate_limit',
          request_payload: { ip: clientIp, reason: rateLimitCheck.reason },
          error_message: rateLimitCheck.reason,
          processing_time_ms: Date.now() - startTime,
        });

        return new Response(
          JSON.stringify({ 
            error: 'Rate limit exceeded', 
            message: rateLimitCheck.reason,
            retry_after_seconds: rateLimitCheck.retryAfterSeconds 
          }),
          { 
            status: 429, 
            headers: { 
              ...corsHeaders, 
              'Content-Type': 'application/json',
              'Retry-After': String(rateLimitCheck.retryAfterSeconds || 60)
            } 
          }
        );
      }
    }

    const typedIntegration = integration as Integration;

    // Read body once and try to parse (JSON or urlencoded). Always keep a log-friendly snapshot.
    const contentType = (req.headers.get('content-type') || '').toLowerCase();
    const headerSnapshot = {
      'content-type': req.headers.get('content-type') || undefined,
      'user-agent': req.headers.get('user-agent') || undefined,
    };

    let rawBodyText: string | null = null;
    if (!['GET', 'HEAD'].includes(req.method)) {
      try {
        rawBodyText = await req.text();
      } catch {
        rawBodyText = null;
      }
    }

    const requestPayloadForLog: any = {
      headers: headerSnapshot,
      query: Object.fromEntries(url.searchParams.entries()),
      body_raw: rawBodyText,
    };

    let payload: any = null;
    if (rawBodyText && rawBodyText.length > 0) {
      // Try JSON
      const looksJson = rawBodyText.trim().startsWith('{') || rawBodyText.trim().startsWith('[');
      if (contentType.includes('application/json') || looksJson) {
        try {
          payload = JSON.parse(rawBodyText);
        } catch (e) {
          // Log invalid JSON and return 400 (unless test mode)
          await supabase.from('integration_logs').insert({
            integration_id: typedIntegration.id,
            organization_id: typedIntegration.organization_id,
            direction: 'inbound',
            status: isTest ? 'test' : 'error',
            event_type: isTest ? 'test' : 'invalid_payload',
            request_payload: requestPayloadForLog,
            error_message: 'Invalid JSON payload',
            processing_time_ms: Date.now() - startTime,
          });

          return new Response(
            JSON.stringify({
              ok: isTest,
              mode: isTest ? 'test' : undefined,
              error: 'Payload JSON inválido',
              hint: 'Verifique se o provedor está enviando JSON válido ou use application/x-www-form-urlencoded.',
            }),
            { status: isTest ? 200 : 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } else if (contentType.includes('application/x-www-form-urlencoded')) {
        payload = Object.fromEntries(new URLSearchParams(rawBodyText).entries());
      } else {
        // Fallback: try JSON, else keep raw
        try {
          payload = JSON.parse(rawBodyText);
        } catch {
          payload = null;
        }
      }
    }

    const isPayloadTest = Boolean(payload && typeof payload === 'object' && (payload.test === true || payload.mode === 'test'));
    const effectiveTest = isTest || isPayloadTest;

    // Some providers validate the webhook URL by sending POST with empty body.
    // We should accept and respond 200 so they can save the URL.
    const isEmptyBodyPing = !['GET', 'HEAD'].includes(req.method) && (!rawBodyText || rawBodyText.trim() === '');
    if (isEmptyBodyPing) {
      await supabase.from('integration_logs').insert({
        integration_id: typedIntegration.id,
        organization_id: typedIntegration.organization_id,
        direction: 'inbound',
        status: 'ping',
        event_type: 'validation',
        request_payload: requestPayloadForLog,
        response_payload: { ok: true, mode: 'validation' },
        processing_time_ms: Date.now() - startTime,
      });

      return new Response(JSON.stringify({ ok: true, mode: 'validation' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // TEST mode: just log and return 200 (no lead creation)
    if (effectiveTest) {
      await supabase.from('integration_logs').insert({
        integration_id: typedIntegration.id,
        organization_id: typedIntegration.organization_id,
        direction: 'inbound',
        status: 'test',
        event_type: 'test',
        request_payload: payload ?? requestPayloadForLog,
        response_payload: { ok: true, mode: 'test' },
        processing_time_ms: Date.now() - startTime,
      });

      return new Response(JSON.stringify({ ok: true, mode: 'test' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // If inactive, reject but still log what arrived
    if (typedIntegration.status !== 'active') {
      await supabase.from('integration_logs').insert({
        integration_id: typedIntegration.id,
        organization_id: typedIntegration.organization_id,
        direction: 'inbound',
        status: 'rejected',
        event_type: 'inactive_integration',
        request_payload: payload ?? requestPayloadForLog,
        error_message: 'Integração inativa',
        processing_time_ms: Date.now() - startTime,
      });

      return new Response(JSON.stringify({ error: 'Integração inativa' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Processing webhook for integration: ${typedIntegration.name} (${typedIntegration.id})`);

    if (!payload || typeof payload !== 'object') {
      await supabase.from('integration_logs').insert({
        integration_id: typedIntegration.id,
        organization_id: typedIntegration.organization_id,
        direction: 'inbound',
        status: 'error',
        event_type: 'invalid_payload',
        request_payload: requestPayloadForLog,
        error_message: 'Payload não interpretável (esperado JSON ou urlencoded)',
        processing_time_ms: Date.now() - startTime,
      });

      return new Response(
        JSON.stringify({
          error: 'Payload inválido',
          hint: 'O provedor precisa enviar JSON ou application/x-www-form-urlencoded.',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Received payload:', JSON.stringify(payload));

    // Get field mappings
    const { data: mappings } = await supabase
      .from('integration_field_mappings')
      .select('*')
      .eq('integration_id', typedIntegration.id);

    const typedMappings = (mappings || []) as FieldMapping[];
    console.log(`Found ${typedMappings.length} field mappings`);

    // Build lead data from mappings
    const leadData: Record<string, any> = {
      organization_id: typedIntegration.organization_id,
      stage: typedIntegration.default_stage || 'cloud',
      stars: 0,
    };

    const addressData: Record<string, any> = {};
    const saleData: Record<string, any> = {};

    for (const mapping of typedMappings) {
      const rawValue = findValueInPayload(payload, mapping.source_field);
      const transformedValue = applyTransform(rawValue, mapping.transform_type);
      
      if (transformedValue) {
        if (mapping.target_field.startsWith('address_')) {
          const addressField = mapping.target_field.replace('address_', '');
          addressData[addressField] = transformedValue;
        } else if (mapping.target_field.startsWith('sale_')) {
          const saleField = mapping.target_field.replace('sale_', '');
          saleData[saleField] = transformedValue;
        } else {
          leadData[mapping.target_field] = transformedValue;
        }
      }
    }

    // If no mappings configured, try auto-detection for common field names
    if (typedMappings.length === 0) {
      console.log('No mappings configured, attempting auto-detection...');
      
      // Common field name variations
      const fieldAliases: Record<string, string[]> = {
        name: ['name', 'nome', 'nome_completo', 'full_name', 'fullName', 'customer_name', 'customerName', 'nome completo'],
        email: ['email', 'e-mail', 'mail', 'customer_email', 'customerEmail'],
        whatsapp: ['whatsapp', 'phone', 'telefone', 'celular', 'mobile', 'tel', 'fone', 'customer_phone', 'customerPhone'],
        cpf: ['cpf', 'documento', 'document', 'customer_cpf', 'customerCpf'],
        observations: ['observations', 'observacoes', 'notes', 'notas', 'observacao'],
        address_street: ['street', 'rua', 'endereco', 'address', 'logradouro'],
        address_number: ['number', 'numero', 'num', 'street_number'],
        address_complement: ['complement', 'complemento', 'comp'],
        address_neighborhood: ['neighborhood', 'bairro', 'district'],
        address_city: ['city', 'cidade', 'municipio'],
        address_state: ['state', 'estado', 'uf'],
        address_cep: ['cep', 'zipcode', 'zip', 'postal_code', 'postalCode', 'zip_code'],
        // Sale auto-detection
        sale_product_name: ['product.name', 'product_name', 'productName', 'link.title', 'item_name', 'item.name'],
        sale_product_sku: ['product.sku', 'product_sku', 'productSku', 'sku', 'product.code', 'product_code'],
        sale_quantity: ['quantity', 'quantidade', 'qty', 'qtd', 'product.quantity'],
        sale_total_cents: ['total_cents', 'amount', 'value', 'total', 'price', 'preco'],
        sale_external_id: ['order_id', 'orderId', 'external_id', 'transaction_id', 'transactionId', 'id_pedido'],
        sale_external_url: ['order_url', 'orderUrl', 'external_url', 'link', 'url_pedido'],
      };

      for (const [targetField, aliases] of Object.entries(fieldAliases)) {
        for (const alias of aliases) {
          const value = findValueInPayload(payload, alias);
          if (value) {
            const transformed = targetField === 'whatsapp' 
              ? normalizePhone(String(value)) 
              : String(value).trim();
            
            if (targetField.startsWith('address_')) {
              addressData[targetField.replace('address_', '')] = transformed;
            } else if (targetField.startsWith('sale_')) {
              saleData[targetField.replace('sale_', '')] = transformed;
            } else {
              if (!leadData[targetField]) {
                leadData[targetField] = transformed;
              }
            }
            break;
          }
        }
      }
    }

    // Validate required fields
    if (!leadData.name && !leadData.whatsapp && !leadData.email) {
      console.error('No identifiable data found in payload');
      
      await supabase.from('integration_logs').insert({
        integration_id: typedIntegration.id,
        organization_id: typedIntegration.organization_id,
        direction: 'inbound',
        status: 'error',
        request_payload: payload,
        error_message: 'Nenhum dado identificável encontrado (nome, whatsapp ou email)',
        processing_time_ms: Date.now() - startTime,
      });

      return new Response(
        JSON.stringify({ 
          error: 'Nenhum dado identificável encontrado',
          hint: 'Configure o mapeamento de campos ou envie dados com campos padrão (name, whatsapp, email)',
          received_fields: Object.keys(payload).slice(0, 20),
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check for existing lead by whatsapp
    let existingLead = null;
    if (leadData.whatsapp) {
      const { data: existing } = await supabase
        .from('leads')
        .select('id, name, whatsapp')
        .eq('organization_id', typedIntegration.organization_id)
        .eq('whatsapp', leadData.whatsapp)
        .maybeSingle();
      
      existingLead = existing;
    }

    let leadId: string;
    let action: string;

    if (existingLead) {
      // Update existing lead with new observations
      const updateData: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };
      
      // Append to observations
      const newObservation = `[Integração ${typedIntegration.name} - ${new Date().toLocaleString('pt-BR')}]\n${JSON.stringify(payload, null, 2)}`;
      
      const { data: currentLead } = await supabase
        .from('leads')
        .select('observations')
        .eq('id', existingLead.id)
        .single();
      
      updateData.observations = currentLead?.observations 
        ? `${currentLead.observations}\n\n${newObservation}`
        : newObservation;

      await supabase
        .from('leads')
        .update(updateData)
        .eq('id', existingLead.id);

      leadId = existingLead.id;
      action = 'updated';
      console.log(`Updated existing lead: ${leadId}`);
    } else {
      // Create new lead
      if (!leadData.name) {
        leadData.name = leadData.whatsapp || leadData.email || 'Lead sem nome';
      }

      // WhatsApp is required by schema
      if (!leadData.whatsapp) {
        await supabase.from('integration_logs').insert({
          integration_id: typedIntegration.id,
          organization_id: typedIntegration.organization_id,
          direction: 'inbound',
          status: 'error',
          event_type: 'missing_required',
          request_payload: payload,
          error_message: 'Campo whatsapp é obrigatório para criar lead',
          processing_time_ms: Date.now() - startTime,
        });

        return new Response(JSON.stringify({ error: 'Campo whatsapp é obrigatório para criar lead' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // assigned_to is NOT NULL in leads table; pick a default owner
      let assignedTo: string | null = null;
      if (typedIntegration.default_responsible_user_ids && typedIntegration.default_responsible_user_ids.length > 0) {
        assignedTo = String(typedIntegration.default_responsible_user_ids[0]);
      }

      if (!assignedTo) {
        const { data: ownerMember } = await supabase
          .from('organization_members')
          .select('user_id')
          .eq('organization_id', typedIntegration.organization_id)
          .eq('role', 'owner')
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();

        if (ownerMember?.user_id) assignedTo = String(ownerMember.user_id);
      }

      if (!assignedTo) {
        const { data: adminMember } = await supabase
          .from('organization_members')
          .select('user_id')
          .eq('organization_id', typedIntegration.organization_id)
          .eq('role', 'admin')
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();

        if (adminMember?.user_id) assignedTo = String(adminMember.user_id);
      }

      if (!assignedTo) {
        const { data: anyMember } = await supabase
          .from('organization_members')
          .select('user_id')
          .eq('organization_id', typedIntegration.organization_id)
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();

        if (anyMember?.user_id) assignedTo = String(anyMember.user_id);
      }

      if (!assignedTo) {
        await supabase.from('integration_logs').insert({
          integration_id: typedIntegration.id,
          organization_id: typedIntegration.organization_id,
          direction: 'inbound',
          status: 'error',
          event_type: 'missing_assigned_to',
          request_payload: payload,
          error_message: 'Nenhum usuário encontrado para atribuir o lead (assigned_to). Configure responsáveis padrão na integração.',
          processing_time_ms: Date.now() - startTime,
        });

        return new Response(
          JSON.stringify({
            error: 'Não foi possível atribuir o lead automaticamente',
            hint: 'Defina um vendedor responsável padrão na integração.',
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      leadData.assigned_to = assignedTo;

      // Add integration source to observations
      leadData.observations = `[Origem: Integração ${typedIntegration.name}]\n${JSON.stringify(payload, null, 2)}`;
      leadData.created_at = new Date().toISOString();
      leadData.updated_at = new Date().toISOString();

      const { data: newLead, error: insertError } = await supabase
        .from('leads')
        .insert(leadData)
        .select('id')
        .single();

      if (insertError) {
        console.error('Error creating lead:', insertError);

        await supabase.from('integration_logs').insert({
          integration_id: typedIntegration.id,
          organization_id: typedIntegration.organization_id,
          direction: 'inbound',
          status: 'error',
          request_payload: payload,
          error_message: insertError.message,
          processing_time_ms: Date.now() - startTime,
        });

        return new Response(
          JSON.stringify({ error: 'Erro ao criar lead', details: insertError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      leadId = newLead.id;
      action = 'created';
      console.log(`Created new lead: ${leadId}`);

      // Add address if we have address data
      if (Object.keys(addressData).length > 0) {
        await supabase.from('lead_addresses').insert({
          lead_id: leadId,
          organization_id: typedIntegration.organization_id,
          label: 'Principal',
          is_primary: true,
          street: addressData.street,
          street_number: addressData.number,
          complement: addressData.complement,
          neighborhood: addressData.neighborhood,
          city: addressData.city,
          state: addressData.state,
          cep: addressData.cep,
        });
      }

      // Add responsible users
      if (typedIntegration.default_responsible_user_ids && typedIntegration.default_responsible_user_ids.length > 0) {
        const responsibles = typedIntegration.default_responsible_user_ids.map((userId: string) => ({
          lead_id: leadId,
          user_id: userId,
          organization_id: typedIntegration.organization_id,
        }));
        
        await supabase.from('lead_responsibles').insert(responsibles);
      }

      // Link product if configured
      if (typedIntegration.default_product_id) {
        // Create lead product answer record to track interest
        await supabase.from('lead_product_answers').insert({
          lead_id: leadId,
          product_id: typedIntegration.default_product_id,
          organization_id: typedIntegration.organization_id,
        });
      }

      // Create followup if configured
      if (typedIntegration.auto_followup_days) {
        const followupDate = new Date();
        followupDate.setDate(followupDate.getDate() + typedIntegration.auto_followup_days);
        
        // Get first responsible or use system
        const responsibleId = typedIntegration.default_responsible_user_ids?.[0];
        if (responsibleId) {
          await supabase.from('lead_followups').insert({
            lead_id: leadId,
            organization_id: typedIntegration.organization_id,
            user_id: responsibleId,
            scheduled_at: followupDate.toISOString(),
            source_type: 'integration',
            notes: `Followup automático da integração: ${typedIntegration.name}`,
          });
        }
      }

      // Mark non-purchase reason if configured
      if (typedIntegration.non_purchase_reason_id) {
        await supabase.from('lead_non_purchase').insert({
          lead_id: leadId,
          organization_id: typedIntegration.organization_id,
          reason_id: typedIntegration.non_purchase_reason_id,
          notes: `Via integração: ${typedIntegration.name}`,
        });
      }
    }

    // Check if we should create a sale
    const eventMode = typedIntegration.event_mode || 'lead';
    let saleId: string | null = null;
    
    if (eventMode === 'sale' || eventMode === 'both') {
      console.log('Creating sale for integration mode:', eventMode);
      
      // Try to find product by SKU if provided
      let productId = typedIntegration.default_product_id;
      let productName = saleData.product_name || 'Produto via Integração';
      let productSku = saleData.product_sku || null;
      
      if (productSku) {
        console.log('Attempting to match product by SKU:', productSku);
        const { data: matchedProduct } = await supabase
          .from('lead_products')
          .select('id, name, sku')
          .eq('organization_id', typedIntegration.organization_id)
          .eq('sku', productSku)
          .maybeSingle();
        
        if (matchedProduct) {
          console.log('Found product by SKU:', matchedProduct.name);
          productId = matchedProduct.id;
          productName = matchedProduct.name;
        } else {
          console.log('No product found with SKU:', productSku);
        }
      }
      
      // Parse total value
      let totalCents = 0;
      if (saleData.total_cents) {
        const rawTotal = saleData.total_cents;
        // If it's a string with comma (BR format), convert
        if (typeof rawTotal === 'string') {
          const cleanValue = rawTotal.replace(/[^\d,\.]/g, '').replace(',', '.');
          const floatValue = parseFloat(cleanValue);
          // Check if it's already in cents or needs conversion
          totalCents = floatValue >= 100 ? Math.round(floatValue) : Math.round(floatValue * 100);
        } else {
          totalCents = typeof rawTotal === 'number' ? Math.round(rawTotal) : 0;
        }
      }
      
      // Parse quantity
      let quantity = 1;
      if (saleData.quantity) {
        quantity = parseInt(String(saleData.quantity)) || 1;
      }
      
      // Get seller user (first responsible)
      const sellerUserId = typedIntegration.default_responsible_user_ids?.[0] || leadData.assigned_to;
      
      // Get first address for the lead
      const { data: leadAddress } = await supabase
        .from('lead_addresses')
        .select('id')
        .eq('lead_id', leadId)
        .eq('is_primary', true)
        .maybeSingle();
      
      // Create the sale
      const salePayload: Record<string, any> = {
        organization_id: typedIntegration.organization_id,
        lead_id: leadId,
        created_by: sellerUserId,
        seller_user_id: sellerUserId,
        status: typedIntegration.sale_status_on_create || 'draft',
        subtotal_cents: totalCents,
        discount_cents: 0,
        total_cents: totalCents,
        delivery_type: 'carrier', // Default to carrier for online sales
        external_order_id: saleData.external_id || null,
        external_order_url: saleData.external_url || null,
        external_source: typedIntegration.name,
        observation_1: saleData.observation_1 || productName || null,
        observation_2: saleData.observation_2 || null,
        payment_notes: typedIntegration.sale_tag ? `[${typedIntegration.sale_tag}]` : null,
      };
      
      if (leadAddress?.id) {
        salePayload.shipping_address_id = leadAddress.id;
      }
      
      const { data: newSale, error: saleError } = await supabase
        .from('sales')
        .insert(salePayload)
        .select('id, romaneio_number')
        .single();
      
      if (saleError) {
        console.error('Error creating sale:', saleError);
        // Don't fail the whole webhook, just log the error
        await supabase.from('integration_logs').insert({
          integration_id: typedIntegration.id,
          organization_id: typedIntegration.organization_id,
          direction: 'inbound',
          status: 'partial',
          event_type: 'sale_creation_failed',
          request_payload: payload,
          error_message: `Lead criado, mas erro ao criar venda: ${saleError.message}`,
          lead_id: leadId,
          processing_time_ms: Date.now() - startTime,
        });
      } else {
        saleId = newSale.id;
        console.log(`Created sale: ${saleId} (romaneio: ${newSale.romaneio_number})`);
        
        // Create sale item if we have a product
        if (productId) {
          const unitPriceCents = Math.round(totalCents / quantity);
          
          const { error: itemError } = await supabase
            .from('sale_items')
            .insert({
              sale_id: saleId,
              product_id: productId,
              product_name: productName,
              quantity: quantity,
              unit_price_cents: unitPriceCents,
              discount_cents: 0,
              total_cents: totalCents,
              notes: productSku ? `SKU: ${productSku}` : null,
            });
          
          if (itemError) {
            console.error('Error creating sale item:', itemError);
          }
        } else {
          // No product matched - create a placeholder item with observation
          console.log('No product to attach to sale, observations will be used for manual matching');
        }
      }
    }

    // Log success
    const eventType = saleId 
      ? (action === 'created' ? 'lead_and_sale_created' : 'lead_updated_sale_created')
      : (action === 'created' ? 'lead_created' : 'lead_updated');
    
    await supabase.from('integration_logs').insert({
      integration_id: typedIntegration.id,
      organization_id: typedIntegration.organization_id,
      direction: 'inbound',
      status: 'success',
      event_type: eventType,
      request_payload: payload,
      response_payload: { lead_id: leadId, sale_id: saleId, action },
      lead_id: leadId,
      processing_time_ms: Date.now() - startTime,
    });

    return new Response(
      JSON.stringify({
        success: true,
        action,
        lead_id: leadId,
        sale_id: saleId,
        message: saleId 
          ? `Lead ${action === 'created' ? 'criado' : 'atualizado'} e venda criada com sucesso` 
          : `Lead ${action === 'created' ? 'criado' : 'atualizado'} com sucesso`,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Webhook error:', error);
    
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor', details: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
