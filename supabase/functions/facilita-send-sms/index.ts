import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface SendSMSRequest {
  organizationId: string;
  phone: string;
  message: string;
  leadId?: string;
  externalKey?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get auth user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { organizationId, phone, message, leadId, externalKey }: SendSMSRequest = await req.json();

    if (!organizationId || !phone || !message) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check SMS credits balance
    const { data: balance } = await supabase
      .from('sms_credits_balance')
      .select('current_credits')
      .eq('organization_id', organizationId)
      .single();

    if (!balance || balance.current_credits < 1) {
      return new Response(JSON.stringify({ 
        error: 'Créditos de SMS insuficientes',
        code: 'NO_CREDITS'
      }), {
        status: 402,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get global provider config from platform_settings
    const { data: platformSettings } = await supabase
      .from('platform_settings')
      .select('setting_key, setting_value')
      .in('setting_key', ['facilita_user', 'facilita_password']);

    const settingsMap: Record<string, string> = {};
    (platformSettings || []).forEach((s: { setting_key: string; setting_value: string }) => {
      settingsMap[s.setting_key] = s.setting_value;
    });

    const apiUser = settingsMap.facilita_user;
    const apiPassword = settingsMap.facilita_password;

    if (!apiUser || !apiPassword) {
      return new Response(JSON.stringify({ 
        error: 'Provedor de SMS não configurado. Configure as credenciais FacilitaMóvel no Super Admin.',
        code: 'PROVIDER_NOT_CONFIGURED'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Generate external key if not provided
    const extKey = externalKey || `${organizationId}-${Date.now()}`;

    // Format phone (remove +55 if present, keep just DDD+number)
    let formattedPhone = phone.replace(/\D/g, '');
    if (formattedPhone.startsWith('55') && formattedPhone.length > 11) {
      formattedPhone = formattedPhone.substring(2);
    }

    // Encode message for URL
    const encodedMessage = encodeURIComponent(message);

    // Call FacilitaMovel API
    const facilitaUrl = `https://www.facilitamovel.com.br/api/simpleSend.ft?user=${encodeURIComponent(apiUser)}&password=${encodeURIComponent(apiPassword)}&destinatario=${formattedPhone}&msg=${encodedMessage}&externalkey=${extKey}`;

    console.log('Sending SMS via FacilitaMovel to:', formattedPhone);

    const response = await fetch(facilitaUrl);
    const responseText = await response.text();
    console.log('FacilitaMovel response:', responseText);

    // Parse response (format: "6 - Mensagem enviada;123456" or error codes)
    const [statusPart, smsId] = responseText.split(';');
    const statusCode = parseInt(statusPart.split(' ')[0] || statusPart);

    let status = 'pending';
    let errorMessage: string | null = null;

    switch (statusCode) {
      case 5: // Mensagem Agendada
      case 6: // Mensagem enviada
        status = 'sent';
        break;
      case 1:
        status = 'failed';
        errorMessage = 'Login inválido na plataforma FacilitaMóvel';
        break;
      case 2:
        status = 'failed';
        errorMessage = 'Usuário sem créditos na FacilitaMóvel';
        break;
      case 3:
        status = 'failed';
        errorMessage = 'Número de celular inválido';
        break;
      case 4:
        status = 'failed';
        errorMessage = 'Mensagem inválida';
        break;
      default:
        status = 'failed';
        errorMessage = `Erro desconhecido: ${responseText}`;
    }

    // Create usage record
    await supabase.from('sms_usage').insert({
      organization_id: organizationId,
      lead_id: leadId || null,
      phone: formattedPhone,
      message,
      facilita_sms_id: smsId?.trim() || null,
      external_key: extKey,
      status,
      status_code: statusCode,
      credits_used: status === 'sent' ? 1 : 0,
      sent_by: user.id,
      error_message: errorMessage,
    });

    // Deduct credits only if sent successfully
    if (status === 'sent') {
      await supabase.rpc('deduct_sms_credits', {
        p_organization_id: organizationId,
        p_credits_to_deduct: 1,
      });
    }

    if (status === 'failed') {
      return new Response(JSON.stringify({ 
        success: false, 
        error: errorMessage,
        code: statusCode
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      smsId: smsId?.trim(),
      externalKey: extKey,
      status,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error sending SMS:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});