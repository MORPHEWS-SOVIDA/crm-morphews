import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Webhook for receiving SMS delivery status and responses from FacilitaMóvel
// Status URL: /facilita-sms-webhook?type=status&fone=XXX&idSMS=XXX&statusEntregue=XXX&chaveCliente=XXX&dataPostagem=XXX
// Response URL: /facilita-sms-webhook?type=response&fone=XXX&datahora=XXX&mensagem=XXX&smsId=XXX&externalKey=XXX

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const type = url.searchParams.get('type') || 'status';

    if (type === 'status') {
      // Status webhook
      const phone = url.searchParams.get('fone');
      const smsId = url.searchParams.get('idSMS');
      const statusCode = url.searchParams.get('statusEntregue');
      const externalKey = url.searchParams.get('chaveCliente');
      const postedAt = url.searchParams.get('dataPostagem');

      console.log('SMS Status webhook:', { phone, smsId, statusCode, externalKey, postedAt });

      // Map status codes
      // 1 - Enfileirada, 2 - Agendada, 3 - Enviando, 4 - Enviada, 5 - Erro
      let status = 'pending';
      switch (parseInt(statusCode || '0')) {
        case 1:
          status = 'queued';
          break;
        case 2:
          status = 'scheduled';
          break;
        case 3:
          status = 'sending';
          break;
        case 4:
          status = 'delivered';
          break;
        case 5:
          status = 'failed';
          break;
      }

      // Update SMS usage record
      const updateData: Record<string, unknown> = {
        status,
        status_code: parseInt(statusCode || '0'),
      };

      if (status === 'delivered') {
        updateData.delivered_at = new Date().toISOString();
      }

      // Try to find by external_key first, then by facilita_sms_id
      if (externalKey) {
        await supabase
          .from('sms_usage')
          .update(updateData)
          .eq('external_key', externalKey);
      } else if (smsId) {
        await supabase
          .from('sms_usage')
          .update(updateData)
          .eq('facilita_sms_id', smsId);
      }

      return new Response('OK', { status: 200, headers: corsHeaders });

    } else if (type === 'response') {
      // Response (MO) webhook - customer replied to SMS
      const phone = url.searchParams.get('fone');
      const datetime = url.searchParams.get('datahora');
      const message = url.searchParams.get('mensagem');
      const smsId = url.searchParams.get('smsId');
      const externalKey = url.searchParams.get('externalKey');

      console.log('SMS Response webhook:', { phone, datetime, message, smsId, externalKey });

      // Find the original SMS to get the lead and organization
      let originalSms = null;
      if (externalKey) {
        const { data } = await supabase
          .from('sms_usage')
          .select('organization_id, lead_id')
          .eq('external_key', externalKey)
          .order('sent_at', { ascending: false })
          .limit(1)
          .single();
        originalSms = data;
      }

      if (!originalSms && phone) {
        // Try to find by phone number (last SMS sent to this phone)
        const formattedPhone = phone.replace(/\D/g, '');
        const { data } = await supabase
          .from('sms_usage')
          .select('organization_id, lead_id')
          .eq('phone', formattedPhone)
          .order('sent_at', { ascending: false })
          .limit(1)
          .single();
        originalSms = data;
      }

      if (originalSms) {
        // Could create a received messages table or trigger an event
        console.log('Found original SMS, organization:', originalSms.organization_id, 'lead:', originalSms.lead_id);
        
        // TODO: Could add to a sms_responses table or integrate with chat
      }

      return new Response('OK', { status: 200, headers: corsHeaders });
    }

    return new Response('Invalid type', { status: 400, headers: corsHeaders });

  } catch (error) {
    console.error('Webhook error:', error);
    return new Response('Error', { status: 500, headers: corsHeaders });
  }
});