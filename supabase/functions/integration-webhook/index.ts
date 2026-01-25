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

interface TriggerRule {
  id: string;
  type: 'time_since_webhook' | 'has_active_sale' | 'source_match' | 'source_exclude';
  operator?: 'less_than' | 'greater_than' | 'equals' | 'not_equals';
  value?: string | number;
  integration_ids?: string[];
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
  event_mode: 'lead' | 'sale' | 'both' | 'sac' | null;
  sale_status_on_create: string | null;
  sale_tag: string | null;
  // SAC fields
  sac_category: string | null;
  sac_subcategory: string | null;
  sac_priority: string | null;
  // New fields for seller and trigger rules
  default_seller_id: string | null;
  trigger_rules: TriggerRule[] | null;
  trigger_rules_logic: 'AND' | 'OR' | null;
}

/**
 * Validates and normalizes a Brazilian phone number.
 * Returns normalized phone if valid, or null if invalid.
 * 
 * Valid formats:
 * - Mobile: 55 + DDD (2 digits) + 9 + 8 digits = 13 digits (e.g., 5565999934325)
 * - Landline: 55 + DDD (2 digits) + 8 digits starting with 2/3/4/5 = 12 digits
 */
function validateBrazilianPhone(phone: string): { valid: boolean; normalized: string; message?: string } {
  if (!phone) return { valid: false, normalized: '', message: 'Número vazio' };
  
  // Remove all non-digit characters
  let digits = phone.replace(/\D/g, '');
  
  if (!digits) return { valid: false, normalized: '', message: 'Nenhum dígito encontrado' };
  
  // Normalize: add country code if missing
  if (!digits.startsWith('55')) {
    if (digits.length === 10 || digits.length === 11) {
      digits = '55' + digits;
    }
  }
  
  const length = digits.length;
  
  // Check valid lengths (12 for landline, 13 for mobile)
  if (length < 12 || length > 13) {
    return { 
      valid: false, 
      normalized: digits, 
      message: `Número com ${length} dígitos - deve ter 12 ou 13` 
    };
  }
  
  // Must start with Brazil country code
  if (!digits.startsWith('55')) {
    return { valid: false, normalized: digits, message: 'Deve começar com 55' };
  }
  
  // Check for duplicated country code (e.g., 555565...)
  if (digits.startsWith('5555')) {
    return { valid: false, normalized: digits, message: 'Código do país duplicado (5555...)' };
  }
  
  // Extract DDD and number
  const ddd = digits.substring(2, 4);
  const number = digits.substring(4);
  
  // Validate DDD
  const dddNum = parseInt(ddd, 10);
  if (dddNum < 11 || dddNum > 99) {
    return { valid: false, normalized: digits, message: `DDD inválido: ${ddd}` };
  }
  
  // For 13-digit numbers (mobile): must start with 9 after DDD
  if (length === 13) {
    if (!number.startsWith('9')) {
      return { valid: false, normalized: digits, message: 'Celular deve começar com 9 após DDD' };
    }
    const secondDigit = number.charAt(1);
    if (!['6', '7', '8', '9'].includes(secondDigit)) {
      return { valid: false, normalized: digits, message: 'Celular inválido após o 9' };
    }
  }
  
  // For 12-digit numbers (landline): should start with 2, 3, 4, or 5
  if (length === 12) {
    const firstDigit = number.charAt(0);
    if (!['2', '3', '4', '5'].includes(firstDigit)) {
      return { valid: false, normalized: digits, message: 'Fixo deve começar com 2, 3, 4 ou 5 após DDD' };
    }
  }
  
  return { valid: true, normalized: digits };
}

function normalizePhone(phone: string): string {
  const result = validateBrazilianPhone(phone);
  if (!result.valid) {
    console.warn(`Invalid phone number: ${phone} - ${result.message}`);
  }
  return result.normalized;
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

/**
 * Evaluates trigger rules to determine if follow-ups should be created.
 * Returns { shouldTrigger: boolean, reason: string }
 */
async function evaluateTriggerRules(
  supabase: any,
  integration: Integration,
  leadId: string,
  organizationId: string
): Promise<{ shouldTrigger: boolean; reason: string }> {
  const rules = integration.trigger_rules;
  const logic = integration.trigger_rules_logic || 'AND';

  // No rules = always trigger
  if (!rules || rules.length === 0) {
    return { shouldTrigger: true, reason: 'No rules configured' };
  }

  const ruleResults: { rule: TriggerRule; passed: boolean; detail: string }[] = [];

  for (const rule of rules) {
    let passed = true;
    let detail = '';

    switch (rule.type) {
      case 'time_since_webhook': {
        // Check last webhook log for this lead (from any integration)
        const hoursLimit = Number(rule.value) || 24;
        const cutoffTime = new Date(Date.now() - hoursLimit * 60 * 60 * 1000).toISOString();

        const { data: recentLogs } = await supabase
          .from('integration_logs')
          .select('id, created_at')
          .eq('organization_id', organizationId)
          .eq('lead_id', leadId)
          .neq('integration_id', integration.id) // Exclude current integration
          .gte('created_at', cutoffTime)
          .eq('status', 'success')
          .limit(1);

        const hasRecentWebhook = recentLogs && recentLogs.length > 0;

        if (rule.operator === 'less_than') {
          // "Don't trigger if < X hours" => passed = NOT hasRecentWebhook
          passed = !hasRecentWebhook;
          detail = hasRecentWebhook 
            ? `Lead recebeu webhook há menos de ${hoursLimit}h` 
            : `Nenhum webhook recente (>${hoursLimit}h)`;
        } else {
          // "Only trigger if > X hours"
          passed = !hasRecentWebhook;
          detail = hasRecentWebhook 
            ? `Lead recebeu webhook recentemente (<${hoursLimit}h)` 
            : `Passaram mais de ${hoursLimit}h desde último webhook`;
        }
        break;
      }

      case 'has_active_sale': {
        // Check if lead has active (pending/paid but not delivered) sales
        const { data: activeSales } = await supabase
          .from('sales')
          .select('id, status')
          .eq('lead_id', leadId)
          .eq('organization_id', organizationId)
          .in('status', ['draft', 'pending', 'paid', 'processing'])
          .limit(1);

        const hasActiveSale = activeSales && activeSales.length > 0;

        if (rule.operator === 'equals') {
          // "Don't trigger if HAS active sale"
          passed = !hasActiveSale;
          detail = hasActiveSale 
            ? 'Lead já tem venda ativa - follow-up bloqueado' 
            : 'Nenhuma venda ativa';
        } else {
          // "Only trigger if HAS active sale"
          passed = hasActiveSale;
          detail = hasActiveSale 
            ? 'Lead tem venda ativa - pode prosseguir' 
            : 'Lead sem venda ativa';
        }
        break;
      }

      case 'source_match': {
        // Only trigger if lead came from specific integrations
        // Check lead_responsibles or leads.source_integration_id if exists
        const targetIds = rule.integration_ids || [];
        if (targetIds.length === 0) {
          passed = true;
          detail = 'Nenhuma integração configurada na regra';
        } else {
          // Check recent logs to see where lead came from
          const { data: leadSources } = await supabase
            .from('integration_logs')
            .select('integration_id')
            .eq('lead_id', leadId)
            .eq('organization_id', organizationId)
            .eq('status', 'success')
            .order('created_at', { ascending: false })
            .limit(10);

          const leadIntegrationIds = [...new Set((leadSources || []).map((l: any) => l.integration_id))];
          const matchesSource = targetIds.some(id => leadIntegrationIds.includes(id));
          passed = matchesSource;
          detail = matchesSource 
            ? 'Lead veio de integração permitida' 
            : 'Lead não veio das integrações configuradas';
        }
        break;
      }

      case 'source_exclude': {
        // Don't trigger if lead came from specific integrations
        const excludeIds = rule.integration_ids || [];
        if (excludeIds.length === 0) {
          passed = true;
          detail = 'Nenhuma integração configurada para exclusão';
        } else {
          const { data: leadSources } = await supabase
            .from('integration_logs')
            .select('integration_id')
            .eq('lead_id', leadId)
            .eq('organization_id', organizationId)
            .eq('status', 'success')
            .order('created_at', { ascending: false })
            .limit(10);

          const leadIntegrationIds = [...new Set((leadSources || []).map((l: any) => l.integration_id))];
          const matchesExclude = excludeIds.some(id => leadIntegrationIds.includes(id));
          passed = !matchesExclude;
          detail = matchesExclude 
            ? 'Lead veio de integração excluída - follow-up bloqueado' 
            : 'Lead não veio das integrações excluídas';
        }
        break;
      }

      default:
        passed = true;
        detail = `Unknown rule type: ${rule.type}`;
    }

    ruleResults.push({ rule, passed, detail });
  }

  // Apply logic
  const allPassed = ruleResults.every(r => r.passed);
  const anyPassed = ruleResults.some(r => r.passed);
  const shouldTrigger = logic === 'AND' ? allPassed : anyPassed;

  const failedRules = ruleResults.filter(r => !r.passed);
  const reason = shouldTrigger
    ? 'Todas as regras satisfeitas'
    : failedRules.map(r => r.detail).join('; ');

  console.log(`[trigger-rules] Integration ${integration.name}: shouldTrigger=${shouldTrigger}, logic=${logic}, results:`, 
    ruleResults.map(r => ({ type: r.rule.type, passed: r.passed, detail: r.detail })));

  return { shouldTrigger, reason };
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

    // VALID lead table columns - only these will be written to leads table
    const VALID_LEAD_COLUMNS = new Set([
      'name', 'email', 'whatsapp', 'observations', 'stage', 'stars', 
      'organization_id', 'assigned_to', 'webhook_data', 'created_at', 'updated_at'
    ]);
    
    // Build lead data from mappings
    const leadData: Record<string, any> = {
      organization_id: typedIntegration.organization_id,
      stage: typedIntegration.default_stage || 'cloud',
      stars: 0,
    };

    const addressData: Record<string, any> = {};
    const saleData: Record<string, any> = {};
    const customFieldsData: Record<string, string> = {}; // Store custom field values (field_name -> value)

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
        } else if (mapping.target_field.startsWith('custom_')) {
          // Store custom field for later processing
          const customFieldName = mapping.target_field.replace('custom_', '');
          customFieldsData[customFieldName] = transformedValue;
          console.log(`Collected custom field: ${customFieldName} = ${transformedValue}`);
        } else {
          // Only add to leadData if it's a valid column (ignore unknown fields like 'cpf')
          if (VALID_LEAD_COLUMNS.has(mapping.target_field)) {
            leadData[mapping.target_field] = transformedValue;
          } else {
            console.log(`Ignoring unknown lead field: ${mapping.target_field} (not in schema)`);
          }
        }
      }
    }

    // If no mappings configured, try auto-detection for common field names
    if (typedMappings.length === 0) {
      console.log('No mappings configured, attempting auto-detection...');
      
      // Common field name variations - ONLY for fields that exist in leads table
      const fieldAliases: Record<string, string[]> = {
        name: ['name', 'nome', 'nome_completo', 'full_name', 'fullName', 'customer_name', 'customerName', 'nome completo'],
        email: ['email', 'e-mail', 'mail', 'customer_email', 'customerEmail'],
        whatsapp: ['whatsapp', 'phone', 'phone_number', 'phoneNumber', 'telefone', 'celular', 'mobile', 'tel', 'fone', 'customer_phone', 'customerPhone'],
        observations: ['observations', 'observacoes', 'notes', 'notas', 'observacao'],
        // Address fields
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
              // Only set valid lead columns
              if (VALID_LEAD_COLUMNS.has(targetField) && !leadData[targetField]) {
                leadData[targetField] = transformed;
              }
            }
            break;
          }
        }
      }
    }

    // ========== ENHANCED WHATSAPP FALLBACK ==========
    // If no whatsapp found via mappings, try aggressive auto-detection
    if (!leadData.whatsapp) {
      console.log('No whatsapp found via mappings, attempting fallback detection...');
      
      const phoneAliases = [
        'whatsapp', 'phone', 'phone_number', 'phoneNumber', 'telefone', 'celular', 
        'mobile', 'tel', 'fone', 'customer_phone', 'customerPhone', 'buyer_phone',
        'contact_phone', 'numero_telefone', 'numero_whatsapp', 'contact', 'number',
        // Nested common paths
        'customer.phone', 'customer.whatsapp', 'customer.telefone', 'customer.celular',
        'buyer.phone', 'buyer.whatsapp', 'contact.phone', 'data.phone', 'data.whatsapp',
        'order.phone', 'order.customer.phone', 'lead.phone', 'lead.whatsapp',
      ];
      
      for (const alias of phoneAliases) {
        const value = findValueInPayload(payload, alias);
        if (value) {
          const normalized = normalizePhone(String(value));
          if (normalized && normalized.length >= 10) {
            console.log(`Fallback found phone via "${alias}": ${normalized}`);
            leadData.whatsapp = normalized;
            break;
          }
        }
      }
    }

    // ========== DETAILED ERROR FOR MISSING WHATSAPP ==========
    // Validate required fields with detailed error message
    if (!leadData.name && !leadData.whatsapp && !leadData.email) {
      // Collect all phone-like fields found in payload for debugging
      const phoneFieldsFound: string[] = [];
      const collectPhoneFields = (obj: any, prefix = ''): void => {
        if (!obj || typeof obj !== 'object') return;
        for (const key of Object.keys(obj)) {
          const fullKey = prefix ? `${prefix}.${key}` : key;
          const value = obj[key];
          const lowerKey = key.toLowerCase();
          if (lowerKey.includes('phone') || lowerKey.includes('whatsapp') || lowerKey.includes('tel') || 
              lowerKey.includes('celular') || lowerKey.includes('mobile') || lowerKey.includes('fone')) {
            phoneFieldsFound.push(`${fullKey}=${value}`);
          }
          if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            collectPhoneFields(value, fullKey);
          }
        }
      };
      collectPhoneFields(payload);

      const errorDetails = phoneFieldsFound.length > 0 
        ? `Campos de telefone encontrados mas não reconhecidos: ${phoneFieldsFound.slice(0, 5).join(', ')}. Configure o mapeamento manualmente.`
        : 'Nenhum campo de telefone encontrado no payload. Verifique se o provedor está enviando o número.';

      console.error('No identifiable data found in payload. Phone fields:', phoneFieldsFound);
      
      await supabase.from('integration_logs').insert({
        integration_id: typedIntegration.id,
        organization_id: typedIntegration.organization_id,
        direction: 'inbound',
        status: 'error',
        request_payload: payload,
        error_message: `Nenhum dado identificável encontrado. ${errorDetails}`,
        processing_time_ms: Date.now() - startTime,
      });

      return new Response(
        JSON.stringify({ 
          error: 'Nenhum dado identificável encontrado',
          hint: errorDetails,
          phone_fields_detected: phoneFieldsFound.slice(0, 10),
          received_fields: Object.keys(payload).slice(0, 20),
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ============================================================
    // DEDUPLICATION: Check for existing lead by whatsapp OR email
    // Each lead can only be in ONE stage. If found, UPDATE the stage.
    // ============================================================
    let existingLead: { id: string; name: string; whatsapp: string; stage: string } | null = null;

    // Priority 1: Match by WhatsApp (most reliable identifier)
    if (leadData.whatsapp) {
      const { data: existing } = await supabase
        .from('leads')
        .select('id, name, whatsapp, stage')
        .eq('organization_id', typedIntegration.organization_id)
        .eq('whatsapp', leadData.whatsapp)
        .maybeSingle();
      
      existingLead = existing;
    }

    // Priority 2: If no WhatsApp match, try email
    if (!existingLead && leadData.email) {
      const { data: existing } = await supabase
        .from('leads')
        .select('id, name, whatsapp, stage')
        .eq('organization_id', typedIntegration.organization_id)
        .eq('email', leadData.email)
        .maybeSingle();
      
      existingLead = existing;
    }

    let leadId: string;
    let action: string;

    if (existingLead) {
      // ============================================================
      // EXISTING LEAD: Update stage + data (CRITICAL: single stage rule)
      // ============================================================
      const previousStage = existingLead.stage;
      const newStage = leadData.stage || typedIntegration.default_stage || previousStage;

      const updateData: Record<string, any> = {
        updated_at: new Date().toISOString(),
        webhook_data: payload,
      };

      // Update stage if different (integration event changes the stage)
      if (newStage && newStage !== previousStage) {
        updateData.stage = newStage;
        console.log(`Changing lead stage: ${previousStage} -> ${newStage}`);

        // Record stage change in history for audit trail
        try {
          await supabase.from('lead_stage_history').insert({
            lead_id: existingLead.id,
            organization_id: typedIntegration.organization_id,
            stage: newStage,
            previous_stage: previousStage,
            reason: `Evento de integração: ${typedIntegration.name}`,
            changed_by: null, // System change
          });
        } catch (historyError) {
          console.log('Could not insert stage history (table may not exist):', historyError);
        }
      }

      // Update other fields if provided (name, email, etc.) - don't overwrite with nulls
      if (leadData.name && leadData.name !== existingLead.name) {
        updateData.name = leadData.name;
      }
      if (leadData.email && !updateData.email) {
        updateData.email = leadData.email;
      }
      
      // Only append minimal note to observations, not full JSON
      const integrationNote = `[Integração ${typedIntegration.name} - ${new Date().toLocaleString('pt-BR')}]`;
      
      const { data: currentLead } = await supabase
        .from('leads')
        .select('observations')
        .eq('id', existingLead.id)
        .single();
      
      // Append short note if not already present
      if (currentLead?.observations) {
        if (!currentLead.observations.includes(`Integração ${typedIntegration.name}`)) {
          updateData.observations = `${currentLead.observations}\n\n${integrationNote}`;
        }
      } else {
        updateData.observations = integrationNote;
      }

      await supabase
        .from('leads')
        .update(updateData)
        .eq('id', existingLead.id);

      leadId = existingLead.id;
      action = newStage !== previousStage ? 'stage_changed' : 'updated';
      console.log(`Updated existing lead: ${leadId}, action: ${action}`);
    } else {
      // Create new lead
      if (!leadData.name) {
        leadData.name = leadData.whatsapp || leadData.email || 'Lead sem nome';
      }

      // WhatsApp is required by schema - provide detailed error
      if (!leadData.whatsapp) {
        // Collect phone-like fields for better debugging
        const phoneFieldsFound: string[] = [];
        const collectPhoneFields = (obj: any, prefix = ''): void => {
          if (!obj || typeof obj !== 'object') return;
          for (const key of Object.keys(obj)) {
            const fullKey = prefix ? `${prefix}.${key}` : key;
            const value = obj[key];
            const lowerKey = key.toLowerCase();
            if (lowerKey.includes('phone') || lowerKey.includes('whatsapp') || lowerKey.includes('tel') || 
                lowerKey.includes('celular') || lowerKey.includes('mobile') || lowerKey.includes('fone')) {
              phoneFieldsFound.push(`${fullKey}=${value}`);
            }
            if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
              collectPhoneFields(value, fullKey);
            }
          }
        };
        collectPhoneFields(payload);

        const errorMessage = phoneFieldsFound.length > 0
          ? `Campo whatsapp é obrigatório para criar lead. Encontrei campos de telefone que não foram mapeados: ${phoneFieldsFound.slice(0, 3).join(', ')}. Configure o mapeamento na aba "Mapeamento" da integração.`
          : `Campo whatsapp é obrigatório para criar lead. Nenhum campo de telefone encontrado no payload. Verifique se o provedor está enviando o número corretamente.`;

        await supabase.from('integration_logs').insert({
          integration_id: typedIntegration.id,
          organization_id: typedIntegration.organization_id,
          direction: 'inbound',
          status: 'error',
          event_type: 'missing_required',
          request_payload: payload,
          error_message: errorMessage,
          processing_time_ms: Date.now() - startTime,
        });

        return new Response(JSON.stringify({ 
          error: 'Campo whatsapp é obrigatório para criar lead',
          hint: errorMessage,
          phone_fields_detected: phoneFieldsFound.slice(0, 10),
        }), {
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

      // Store raw webhook payload in dedicated field, keep observations clean
      leadData.webhook_data = payload;
      leadData.observations = `[Origem: Integração ${typedIntegration.name}]`;
      leadData.created_at = new Date().toISOString();
      leadData.updated_at = new Date().toISOString();
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

      // ========== TRIGGER RULES EVALUATION ==========
      // Check if follow-ups should be created based on trigger rules
      const triggerEvaluation = await evaluateTriggerRules(
        supabase,
        typedIntegration,
        leadId,
        typedIntegration.organization_id
      );

      if (!triggerEvaluation.shouldTrigger) {
        console.log(`[integration-webhook] Follow-ups blocked by trigger rules: ${triggerEvaluation.reason}`);
      }

      // Create followup if configured AND trigger rules allow
      if (typedIntegration.auto_followup_days && triggerEvaluation.shouldTrigger) {
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

      // Mark non-purchase reason if configured AND schedule automatic messages
      // Only schedule messages if trigger rules allow
      if (typedIntegration.non_purchase_reason_id && triggerEvaluation.shouldTrigger) {
        console.log(`[integration-webhook] Processing non_purchase_reason: ${typedIntegration.non_purchase_reason_id} for lead ${leadId}`);
        
        // Insert non-purchase record
        await supabase.from('lead_non_purchase').insert({
          lead_id: leadId,
          organization_id: typedIntegration.organization_id,
          reason_id: typedIntegration.non_purchase_reason_id,
          notes: `Via integração: ${typedIntegration.name}`,
        });

        // CRITICAL: Schedule automatic WhatsApp messages based on templates
        // This was missing before - messages were only being scheduled via frontend
        try {
          // Fetch active message templates for this reason
          const { data: templates, error: templatesError } = await supabase
            .from('non_purchase_message_templates')
            .select('*')
            .eq('non_purchase_reason_id', typedIntegration.non_purchase_reason_id)
            .eq('is_active', true)
            .order('position', { ascending: true });

          if (templatesError) {
            console.error('[integration-webhook] Error fetching templates:', templatesError);
          } else if (templates && templates.length > 0) {
            console.log(`[integration-webhook] Found ${templates.length} active templates to schedule`);
            
            const baseTime = new Date();
            const scheduledMessages = [];

            for (const template of templates) {
              // Calculate scheduled time based on delay_minutes
              let scheduledAt = new Date(baseTime.getTime() + (template.delay_minutes || 0) * 60 * 1000);

              // Check business hours constraint
              if (template.send_start_hour !== null && template.send_end_hour !== null) {
                const hour = scheduledAt.getHours();
                
                // If outside business hours, adjust to next valid time
                if (hour < template.send_start_hour) {
                  scheduledAt.setHours(template.send_start_hour, 0, 0, 0);
                } else if (hour >= template.send_end_hour) {
                  // Move to next day at start hour
                  scheduledAt.setDate(scheduledAt.getDate() + 1);
                  scheduledAt.setHours(template.send_start_hour, 0, 0, 0);
                }
              }

              // Replace variables in message using lead data
              const leadNameStr = String(leadData.name || '');
              const firstName = leadNameStr.split(' ')[0] || leadNameStr;
              
              let finalMessage = template.message_template || '';
              finalMessage = finalMessage.replace(/\{\{nome\}\}/gi, leadNameStr);
              finalMessage = finalMessage.replace(/\{\{primeiro_nome\}\}/gi, firstName);
              finalMessage = finalMessage.replace(/\{\{vendedor\}\}/gi, ''); // No seller context in webhook
              finalMessage = finalMessage.replace(/\{\{produto\}\}/gi, '');
              finalMessage = finalMessage.replace(/\{\{marca_do_produto\}\}/gi, '');

              scheduledMessages.push({
                organization_id: typedIntegration.organization_id,
                lead_id: leadId,
                template_id: template.id,
                whatsapp_instance_id: template.whatsapp_instance_id,
                scheduled_at: scheduledAt.toISOString(),
                original_scheduled_at: scheduledAt.toISOString(),
                final_message: finalMessage,
                status: 'pending',
                created_by: null, // System-created
                media_type: template.media_type || null,
                media_url: template.media_url || null,
                media_filename: template.media_filename || null,
                fallback_bot_enabled: template.fallback_bot_enabled ?? false,
                fallback_bot_id: template.fallback_bot_id || null,
                fallback_timeout_minutes: template.fallback_timeout_minutes ?? 30,
              });
            }

            if (scheduledMessages.length > 0) {
              const { error: insertError } = await supabase
                .from('lead_scheduled_messages')
                .insert(scheduledMessages);

              if (insertError) {
                console.error('[integration-webhook] Error scheduling messages:', insertError);
              } else {
                console.log(`[integration-webhook] Successfully scheduled ${scheduledMessages.length} messages for lead ${leadId}`);
              }
            }
          } else {
            console.log(`[integration-webhook] No active templates found for reason ${typedIntegration.non_purchase_reason_id}`);
          }
        } catch (scheduleError) {
          console.error('[integration-webhook] Error in message scheduling:', scheduleError);
          // Don't fail the whole webhook for scheduling errors
        }
      }
    }

    // ========== SAVE CUSTOM FIELDS ==========
    // Process custom fields for both new and updated leads
    if (Object.keys(customFieldsData).length > 0) {
      console.log('Processing custom fields:', customFieldsData);
      
      // Get all custom field definitions for this organization
      const { data: fieldDefinitions } = await supabase
        .from('lead_custom_field_definitions')
        .select('id, field_name, field_label')
        .eq('organization_id', typedIntegration.organization_id)
        .eq('is_active', true);
      
      if (fieldDefinitions && fieldDefinitions.length > 0) {
        // Build a map from field_name (lowercase) to definition for matching
        const fieldMap = new Map<string, { id: string; field_name: string }>();
        for (const def of fieldDefinitions) {
          // Match by field_name (normalized)
          fieldMap.set(def.field_name.toLowerCase(), { id: def.id, field_name: def.field_name });
          // Also try matching by field_label (lowercase, normalized)
          const normalizedLabel = def.field_label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
          if (normalizedLabel) {
            fieldMap.set(normalizedLabel, { id: def.id, field_name: def.field_name });
          }
        }
        
        // Prepare values to upsert
        const customFieldValues: { lead_id: string; field_definition_id: string; value: string; organization_id: string }[] = [];
        
        for (const [customKey, customValue] of Object.entries(customFieldsData)) {
          // Try to find matching definition
          const normalizedKey = customKey.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
          const matchedDef = fieldMap.get(normalizedKey) || fieldMap.get(customKey.toLowerCase());
          
          if (matchedDef) {
            customFieldValues.push({
              lead_id: leadId,
              field_definition_id: matchedDef.id,
              value: String(customValue),
              organization_id: typedIntegration.organization_id,
            });
            console.log(`Matched custom field "${customKey}" to definition "${matchedDef.field_name}" (${matchedDef.id})`);
          } else {
            console.log(`No custom field definition found for "${customKey}" in organization`);
          }
        }
        
        // Upsert custom field values (update existing or insert new)
        if (customFieldValues.length > 0) {
          for (const cfv of customFieldValues) {
            // Check if value already exists
            const { data: existing } = await supabase
              .from('lead_custom_field_values')
              .select('id')
              .eq('lead_id', cfv.lead_id)
              .eq('field_definition_id', cfv.field_definition_id)
              .maybeSingle();
            
            if (existing) {
              // Update existing
              await supabase
                .from('lead_custom_field_values')
                .update({ value: cfv.value })
                .eq('id', existing.id);
            } else {
              // Insert new
              await supabase
                .from('lead_custom_field_values')
                .insert(cfv);
            }
          }
          console.log(`Saved ${customFieldValues.length} custom field values for lead ${leadId}`);
        }
      } else {
        console.log('No active custom field definitions found for organization');
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
      let matchedKitId: string | null = null;
      let matchedKitQuantity: number | null = null;
      let matchedKitPriceCents: number | null = null;
      
      if (productSku) {
        console.log('Attempting to match by SKU:', productSku);
        
        // FIRST: Try to match by kit SKU (more specific)
        const { data: matchedKit } = await supabase
          .from('product_price_kits')
          .select('id, product_id, quantity, promotional_price_cents, regular_price_cents, sku')
          .eq('organization_id', typedIntegration.organization_id)
          .eq('sku', productSku)
          .maybeSingle();
        
        if (matchedKit) {
          console.log('Found kit by SKU:', productSku, 'Product ID:', matchedKit.product_id, 'Qty:', matchedKit.quantity);
          productId = matchedKit.product_id;
          matchedKitId = matchedKit.id;
          matchedKitQuantity = matchedKit.quantity;
          matchedKitPriceCents = matchedKit.promotional_price_cents || matchedKit.regular_price_cents;
          
          // Get product name
          const { data: kitProduct } = await supabase
            .from('lead_products')
            .select('name')
            .eq('id', matchedKit.product_id)
            .single();
          
          if (kitProduct) {
            productName = kitProduct.name;
          }
        } else {
          // FALLBACK: Try to match by product SKU
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
            console.log('No product or kit found with SKU:', productSku);
          }
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
      
      // Parse quantity - use kit quantity if matched, otherwise from payload
      let quantity = matchedKitQuantity || 1;
      if (!matchedKitQuantity && saleData.quantity) {
        quantity = parseInt(String(saleData.quantity)) || 1;
      }
      
      // If we matched a kit and it has a price, use that for total if not provided
      if (matchedKitPriceCents && totalCents === 0) {
        totalCents = matchedKitPriceCents;
        console.log('Using kit price:', totalCents / 100);
      }
      
      // Get seller user - prioritize default_seller_id (new field), then first responsible, then lead's assigned_to
      const sellerUserId = typedIntegration.default_seller_id 
        || typedIntegration.default_responsible_user_ids?.[0] 
        || leadData.assigned_to;
      
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

    // ========== SAC TICKET CREATION ==========
    let sacTicketId: string | null = null;
    
    if (typedIntegration.event_mode === 'sac') {
      console.log('SAC mode - creating ticket');
      
      if (!typedIntegration.sac_category || !typedIntegration.sac_subcategory) {
        console.warn('SAC mode enabled but category/subcategory not configured');
        await supabase.from('integration_logs').insert({
          integration_id: typedIntegration.id,
          organization_id: typedIntegration.organization_id,
          direction: 'inbound',
          status: 'error',
          event_type: 'sac_config_missing',
          request_payload: payload,
          error_message: 'Modo SAC ativado mas categoria/subcategoria não configuradas',
          lead_id: leadId,
          processing_time_ms: Date.now() - startTime,
        });
      } else {
        // Get a user ID for created_by - use first responsible or find org owner
        let createdByUserId = typedIntegration.default_responsible_user_ids?.[0];
        
        if (!createdByUserId) {
          const { data: orgOwner } = await supabase
            .from('profiles')
            .select('id')
            .eq('organization_id', typedIntegration.organization_id)
            .eq('role', 'owner')
            .maybeSingle();
          
          createdByUserId = orgOwner?.id;
          
          if (!createdByUserId) {
            const { data: anyMember } = await supabase
              .from('profiles')
              .select('id')
              .eq('organization_id', typedIntegration.organization_id)
              .limit(1)
              .maybeSingle();
            
            createdByUserId = anyMember?.id;
          }
        }
        
        if (!createdByUserId) {
          console.error('No user found to create SAC ticket');
        } else {
          // Build description from payload
          const description = `Chamado criado automaticamente via integração: ${typedIntegration.name}\n\n` +
            `Dados recebidos:\n${JSON.stringify(payload, null, 2)}`;
          
          // Create the SAC ticket
          const { data: ticket, error: ticketError } = await supabase
            .from('sac_tickets')
            .insert({
              organization_id: typedIntegration.organization_id,
              lead_id: leadId,
              sale_id: saleId || null,
              created_by: createdByUserId,
              category: typedIntegration.sac_category,
              subcategory: typedIntegration.sac_subcategory,
              priority: typedIntegration.sac_priority || 'normal',
              description: description,
              status: 'pending', // Goes to "Não Tratados" column
              source: 'integration',
              source_integration_id: typedIntegration.id,
              external_reference: saleData.external_id || null,
            })
            .select('id')
            .single();
          
          if (ticketError) {
            console.error('Error creating SAC ticket:', ticketError);
            await supabase.from('integration_logs').insert({
              integration_id: typedIntegration.id,
              organization_id: typedIntegration.organization_id,
              direction: 'inbound',
              status: 'partial',
              event_type: 'sac_creation_failed',
              request_payload: payload,
              error_message: `Lead processado, mas erro ao criar chamado SAC: ${ticketError.message}`,
              lead_id: leadId,
              processing_time_ms: Date.now() - startTime,
            });
          } else {
            sacTicketId = ticket.id;
            console.log(`Created SAC ticket: ${sacTicketId}`);
          }
        }
      }
    }

    // Log success
    let eventType = 'lead_created';
    if (sacTicketId) {
      eventType = 'sac_ticket_created';
    } else if (saleId) {
      eventType = action === 'created' ? 'lead_and_sale_created' : 'lead_updated_sale_created';
    } else {
      eventType = action === 'created' ? 'lead_created' : 'lead_updated';
    }
    
    await supabase.from('integration_logs').insert({
      integration_id: typedIntegration.id,
      organization_id: typedIntegration.organization_id,
      direction: 'inbound',
      status: 'success',
      event_type: eventType,
      request_payload: payload,
      response_payload: { lead_id: leadId, sale_id: saleId, sac_ticket_id: sacTicketId, action },
      lead_id: leadId,
      processing_time_ms: Date.now() - startTime,
    });
    
    // Save to lead_webhook_history for detailed tracking
    await supabase.from('lead_webhook_history').insert({
      lead_id: leadId,
      organization_id: typedIntegration.organization_id,
      integration_id: typedIntegration.id,
      integration_name: typedIntegration.name,
      payload: payload,
      received_at: new Date().toISOString(),
      processed_successfully: true,
      error_message: null,
    });

    // Build response message
    let message = '';
    if (sacTicketId) {
      message = 'Chamado SAC criado com sucesso';
    } else if (saleId) {
      message = `Lead ${action === 'created' ? 'criado' : 'atualizado'} e venda criada com sucesso`;
    } else {
      message = `Lead ${action === 'created' ? 'criado' : 'atualizado'} com sucesso`;
    }

    return new Response(
      JSON.stringify({
        success: true,
        action,
        lead_id: leadId,
        sale_id: saleId,
        sac_ticket_id: sacTicketId,
        message,
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
