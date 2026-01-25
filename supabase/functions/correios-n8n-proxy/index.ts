/**
 * Correios N8N Proxy - Usa n8n como intermediário para a API dos Correios
 * 
 * Esta função envia os dados para um workflow no n8n que faz a requisição
 * para os Correios e retorna o resultado. Isso resolve problemas de CORS,
 * headers e permite debugging mais fácil.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simple encryption/decryption using base64 + XOR
function decrypt(encrypted: string): string {
  try {
    const key = Deno.env.get('CORREIOS_ENCRYPTION_KEY') || 'morphews-correios-2024';
    const decoded = atob(encrypted);
    let result = '';
    for (let i = 0; i < decoded.length; i++) {
      result += String.fromCharCode(decoded.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    return result;
  } catch {
    return encrypted;
  }
}

function getServiceName(code: string): string {
  const services: Record<string, string> = {
    '03220': 'SEDEX',
    '03298': 'PAC',
    '03140': 'SEDEX 12',
    '03158': 'SEDEX 10',
    '04669': 'PAC Mini',
    '04227': 'Mini Envios',
  };
  return services[code] || code;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const n8nWebhookUrl = Deno.env.get('N8N_CORREIOS_WEBHOOK_URL');

  if (!n8nWebhookUrl) {
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'N8N_CORREIOS_WEBHOOK_URL não configurado. Configure o webhook do n8n primeiro.' 
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const body = await req.json();
    const { action, ...params } = body;

    console.log(`[N8N Proxy] Action: ${action}`);

    if (action === 'create_label') {
      const {
        organization_id,
        sale_id,
        recipient,
        package: pkg,
        service_code,
        invoice_number,
        invoice_key,
      } = params;

      // Get Correios config
      const { data: config, error: configError } = await supabase
        .from('correios_config')
        .select('*')
        .eq('organization_id', organization_id)
        .single();

      if (configError || !config) {
        throw new Error('Configuração de Correios não encontrada');
      }

      if (!config.is_active) {
        throw new Error('Integração com Correios está desativada');
      }

      // Decrypt credentials
      const codigoAcesso = decrypt(config.codigo_acesso_encrypted);

      // Build payload for n8n
      const n8nPayload = {
        action: 'create_label',
        credentials: {
          id_correios: config.id_correios,
          codigo_acesso: codigoAcesso,
          contrato: config.contrato,
          cartao_postagem: config.cartao_postagem,
          ambiente: config.ambiente,
        },
        sender: {
          name: config.sender_name,
          cpf_cnpj: config.sender_cpf_cnpj,
          street: config.sender_street,
          number: config.sender_number,
          complement: config.sender_complement || '',
          neighborhood: config.sender_neighborhood,
          city: config.sender_city,
          state: config.sender_state,
          cep: config.sender_cep,
          phone: config.sender_phone,
          email: config.sender_email,
        },
        recipient: {
          name: recipient.name,
          cpf_cnpj: recipient.cpf_cnpj || '',
          street: recipient.street,
          number: recipient.number,
          complement: recipient.complement || '',
          neighborhood: recipient.neighborhood,
          city: recipient.city,
          state: recipient.state,
          cep: recipient.cep.replace(/\D/g, ''),
          phone: recipient.phone || '',
          email: recipient.email || '',
        },
        package: {
          weight_grams: pkg?.weight_grams || config.default_weight_grams || 300,
          height_cm: pkg?.height_cm || config.default_height_cm || 4,
          width_cm: pkg?.width_cm || config.default_width_cm || 12,
          length_cm: pkg?.length_cm || config.default_length_cm || 17,
          declared_value_cents: pkg?.declared_value_cents || 0,
        },
        service_code: service_code || config.default_service_code || '03298',
        invoice_number: invoice_number || '',
        invoice_key: invoice_key || '',
      };

      console.log('[N8N Proxy] Sending to n8n:', JSON.stringify(n8nPayload, null, 2));

      // Call n8n webhook
      console.log('[N8N Proxy] Calling n8n at URL:', n8nWebhookUrl);
      
      const n8nResponse = await fetch(n8nWebhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(n8nPayload),
      });

      // Get raw text first to diagnose HTML responses
      const responseText = await n8nResponse.text();
      console.log('[N8N Proxy] n8n response status:', n8nResponse.status);
      console.log('[N8N Proxy] n8n response (first 500 chars):', responseText.substring(0, 500));

      // Check if response is HTML (common when n8n returns login page or error page)
      if (responseText.trim().startsWith('<!DOCTYPE') || responseText.trim().startsWith('<html') || responseText.trim().startsWith('<')) {
        console.error('[N8N Proxy] n8n returned HTML instead of JSON. This usually means:');
        console.error('  - The webhook URL is incorrect');
        console.error('  - The n8n workflow is not active/deployed');
        console.error('  - The n8n instance is showing a login page');
        
        return new Response(
          JSON.stringify({
            success: false,
            error: 'O n8n retornou uma página HTML ao invés de JSON. Verifique se o workflow está ativo e se a URL do webhook está correta.',
            details: {
              status: n8nResponse.status,
              response_preview: responseText.substring(0, 300),
              webhook_url_used: n8nWebhookUrl.replace(/\/webhook\/.*/, '/webhook/***'),
            }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Parse JSON
      let n8nResult: any;
      try {
        n8nResult = JSON.parse(responseText);
      } catch (parseError) {
        console.error('[N8N Proxy] Failed to parse n8n response as JSON:', parseError);
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Resposta do n8n não é um JSON válido',
            details: {
              status: n8nResponse.status,
              response_preview: responseText.substring(0, 300),
            }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('[N8N Proxy] Response from n8n:', JSON.stringify(n8nResult, null, 2));

      if (!n8nResult.success) {
        // Log error for debugging
        await supabase.from('error_logs').insert({
          organization_id,
          source: 'correios-n8n-proxy',
          error_type: 'n8n_correios_error',
          error_message: n8nResult.error || 'Erro desconhecido do n8n',
          error_details: {
            n8n_response: n8nResult,
            payload_sent: n8nPayload,
          },
        });

        return new Response(
          JSON.stringify({
            success: false,
            error: n8nResult.error || 'Erro ao processar no n8n',
            n8n_details: n8nResult,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // n8n returned success - process the label
      const { tracking_code, prepostagem_id, label_pdf_base64 } = n8nResult;

      if (!tracking_code || !label_pdf_base64) {
        throw new Error('n8n não retornou tracking_code ou label_pdf_base64');
      }

      // Decode base64 PDF and upload to storage
      const labelPdfBuffer = Uint8Array.from(atob(label_pdf_base64), c => c.charCodeAt(0));
      const fileName = `correios-labels/${organization_id}/${tracking_code}.pdf`;

      const { error: uploadError } = await supabase.storage
        .from('sales-documents')
        .upload(fileName, labelPdfBuffer, {
          contentType: 'application/pdf',
          upsert: true,
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
      }

      const { data: urlData } = supabase.storage
        .from('sales-documents')
        .getPublicUrl(fileName);

      // Handle declaration PDF if provided
      let declaracaoPublicUrl: string | null = null;
      if (n8nResult.declaration_pdf_base64) {
        try {
          const declPdfBuffer = Uint8Array.from(atob(n8nResult.declaration_pdf_base64), c => c.charCodeAt(0));
          const declFileName = `correios-declaracoes/${organization_id}/${tracking_code}.pdf`;

          await supabase.storage
            .from('sales-documents')
            .upload(declFileName, declPdfBuffer, {
              contentType: 'application/pdf',
              upsert: true,
            });

          const { data: declUrlData } = supabase.storage
            .from('sales-documents')
            .getPublicUrl(declFileName);

          declaracaoPublicUrl = declUrlData?.publicUrl ?? null;
        } catch (e) {
          console.error('Declaration upload error:', e);
        }
      }

      // Save label record
      const { data: labelRecord, error: insertError } = await supabase
        .from('correios_labels')
        .insert({
          organization_id,
          sale_id,
          tracking_code,
          service_code: n8nPayload.service_code,
          service_name: getServiceName(n8nPayload.service_code),
          recipient_name: recipient.name,
          recipient_cpf_cnpj: recipient.cpf_cnpj,
          recipient_street: recipient.street,
          recipient_number: recipient.number,
          recipient_complement: recipient.complement,
          recipient_neighborhood: recipient.neighborhood,
          recipient_city: recipient.city,
          recipient_state: recipient.state,
          recipient_cep: recipient.cep,
          recipient_phone: recipient.phone,
          weight_grams: n8nPayload.package.weight_grams,
          height_cm: n8nPayload.package.height_cm,
          width_cm: n8nPayload.package.width_cm,
          length_cm: n8nPayload.package.length_cm,
          declared_value_cents: n8nPayload.package.declared_value_cents,
          label_pdf_url: urlData?.publicUrl,
          declaration_pdf_url: declaracaoPublicUrl,
          status: 'generated',
          correios_prepostagem_id: prepostagem_id,
          api_response: n8nResult,
        })
        .select()
        .single();

      if (insertError) {
        console.error('Insert label error:', insertError);
      }

      // Update sale with tracking code
      if (sale_id && tracking_code) {
        await supabase
          .from('sales')
          .update({
            tracking_code,
            carrier_tracking_status: 'waiting_post',
          })
          .eq('id', sale_id);

        // Insert carrier tracking history entry
        const { data: saleData } = await supabase
          .from('sales')
          .select('organization_id')
          .eq('id', sale_id)
          .single();

        if (saleData) {
          await supabase
            .from('carrier_tracking_history')
            .insert({
              sale_id,
              organization_id: saleData.organization_id,
              status: 'waiting_post',
              notes: `Etiqueta gerada via n8n - Rastreio: ${tracking_code}`,
            });
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          label: labelRecord,
          tracking_code,
          pdf_url: urlData?.publicUrl,
          via: 'n8n_proxy',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // For other actions, just forward to n8n
    const n8nResponse = await fetch(n8nWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...params }),
    });

    const responseText = await n8nResponse.text();
    
    // Check for HTML response
    if (responseText.trim().startsWith('<')) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'O n8n retornou HTML ao invés de JSON. Verifique se o workflow está ativo.',
          details: { status: n8nResponse.status, preview: responseText.substring(0, 200) }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let n8nResult: any;
    try {
      n8nResult = JSON.parse(responseText);
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: 'Resposta do n8n não é JSON válido', preview: responseText.substring(0, 200) }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify(n8nResult),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[N8N Proxy] Error:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Erro desconhecido',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
