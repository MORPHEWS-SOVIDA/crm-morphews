import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Resend } from 'https://esm.sh/resend@2.0.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AutoSendRequest {
  invoice_id: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body: AutoSendRequest = await req.json();
    const { invoice_id } = body;

    if (!invoice_id) {
      return new Response(JSON.stringify({ error: 'invoice_id é obrigatório' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get invoice with fiscal company
    const { data: invoice, error: invoiceError } = await supabase
      .from('fiscal_invoices')
      .select(`
        *,
        fiscal_company:fiscal_companies(*)
      `)
      .eq('id', invoice_id)
      .single();

    if (invoiceError || !invoice) {
      console.error('Invoice not found:', invoiceError);
      return new Response(JSON.stringify({ error: 'Nota fiscal não encontrada' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (invoice.status !== 'authorized') {
      return new Response(JSON.stringify({ error: 'Nota fiscal não está autorizada' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get auto-send config
    const { data: config } = await supabase
      .from('fiscal_auto_send_config')
      .select('*')
      .eq('organization_id', invoice.organization_id)
      .maybeSingle();

    if (!config) {
      return new Response(JSON.stringify({ message: 'No auto-send config found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const results = {
      email_sent: false,
      whatsapp_sent: false,
      errors: [] as string[],
    };

    // Prepare template variables
    const formatCurrency = (cents: number) => {
      return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      }).format(cents / 100);
    };

    const formatDate = (dateStr: string) => {
      return new Date(dateStr).toLocaleDateString('pt-BR');
    };

    const variables: Record<string, string> = {
      '{invoice_number}': invoice.invoice_number || '',
      '{company_name}': invoice.fiscal_company?.company_name || '',
      '{recipient_name}': invoice.recipient_name || '',
      '{total_value}': formatCurrency(invoice.total_cents || 0),
      '{emission_date}': formatDate(invoice.authorized_at || invoice.created_at),
      '{danfe_url}': invoice.pdf_url || '',
      '{xml_url}': invoice.xml_url || '',
    };

    const replaceVariables = (template: string): string => {
      let result = template;
      for (const [key, value] of Object.entries(variables)) {
        result = result.replaceAll(key, value);
      }
      return result;
    };

    // Send Email
    if (config.email_enabled && config.resend_api_key_encrypted && invoice.recipient_email) {
      try {
        // Decrypt API key (base64 fallback)
        let apiKey = config.resend_api_key_encrypted;
        try {
          apiKey = atob(config.resend_api_key_encrypted);
        } catch {
          // Already plain text or different encoding
        }

        const resend = new Resend(apiKey);

        const subject = replaceVariables(config.email_subject_template || 'Nota Fiscal #{invoice_number}');
        const htmlBody = replaceVariables(config.email_body_template || '')
          .replace(/\n/g, '<br>');

        // Build attachments array
        const attachments: any[] = [];
        
        // For now, we'll include links in the body since Resend requires actual file content for attachments
        // In production, you'd fetch the PDF/XML and attach them

        const emailResponse = await resend.emails.send({
          from: `${config.email_from_name || 'Notas Fiscais'} <${config.email_from_address || 'nfe@resend.dev'}>`,
          to: [invoice.recipient_email],
          subject,
          html: `
            ${htmlBody}
            ${config.email_send_danfe && invoice.pdf_url ? `<p><a href="${invoice.pdf_url}">📄 Baixar DANFE (PDF)</a></p>` : ''}
            ${config.email_send_xml && invoice.xml_url ? `<p><a href="${invoice.xml_url}">📋 Baixar XML</a></p>` : ''}
          `,
        });

        console.log('Email sent:', emailResponse);
        results.email_sent = true;

      } catch (emailError: any) {
        console.error('Error sending email:', emailError);
        results.errors.push(`Email: ${emailError.message}`);
      }
    }

    // Send WhatsApp
    if (config.whatsapp_enabled && config.whatsapp_instance_id && invoice.recipient_phone) {
      try {
        // Get instance details
        const { data: instance } = await supabase
          .from('whatsapp_instances')
          .select('*')
          .eq('id', config.whatsapp_instance_id)
          .single();

        if (instance && instance.connection_status === 'open') {
          const message = replaceVariables(config.whatsapp_message_template || '');

          // Clean phone number
          const phone = String(invoice.recipient_phone).replace(/\D/g, '');
          const formattedPhone = phone.startsWith('55') ? phone : `55${phone}`;

          // Call evolution-send-message function
          const { error: sendError } = await supabase.functions.invoke('evolution-send-message', {
            body: {
              instance_id: instance.id,
              remote_jid: `${formattedPhone}@s.whatsapp.net`,
              message_type: 'text',
              content: message,
            },
          });

          if (sendError) {
            throw sendError;
          }

          // Optionally send DANFE as document
          if (config.whatsapp_send_danfe && invoice.pdf_url) {
            await supabase.functions.invoke('evolution-send-message', {
              body: {
                instance_id: instance.id,
                remote_jid: `${formattedPhone}@s.whatsapp.net`,
                message_type: 'document',
                content: invoice.pdf_url,
                filename: `DANFE_${invoice.invoice_number}.pdf`,
              },
            });
          }

          results.whatsapp_sent = true;
        }

      } catch (waError: any) {
        console.error('Error sending WhatsApp:', waError);
        results.errors.push(`WhatsApp: ${waError.message}`);
      }
    }

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error in fiscal-auto-send:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
