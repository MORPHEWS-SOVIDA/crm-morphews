import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

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

  const startTime = Date.now();

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get('token');

    const isTest =
      url.pathname.endsWith('/test') ||
      url.searchParams.get('test') === '1' ||
      url.searchParams.get('mode') === 'test';

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

    // TEST endpoint: just log and return 200 (no lead creation)
    if (isTest) {
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

    for (const mapping of typedMappings) {
      const rawValue = findValueInPayload(payload, mapping.source_field);
      const transformedValue = applyTransform(rawValue, mapping.transform_type);
      
      if (transformedValue) {
        if (mapping.target_field.startsWith('address_')) {
          const addressField = mapping.target_field.replace('address_', '');
          addressData[addressField] = transformedValue;
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
        const responsibles = typedIntegration.default_responsible_user_ids.map(userId => ({
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

    // Log success
    await supabase.from('integration_logs').insert({
      integration_id: typedIntegration.id,
      organization_id: typedIntegration.organization_id,
      direction: 'inbound',
      status: 'success',
      event_type: action === 'created' ? 'lead_created' : 'lead_updated',
      request_payload: payload,
      response_payload: { lead_id: leadId, action },
      lead_id: leadId,
      processing_time_ms: Date.now() - startTime,
    });

    return new Response(
      JSON.stringify({
        success: true,
        action,
        lead_id: leadId,
        message: action === 'created' 
          ? 'Lead criado com sucesso' 
          : 'Lead existente atualizado',
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
