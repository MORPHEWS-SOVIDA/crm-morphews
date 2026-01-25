import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Email Sequence Processor
 * 
 * Runs every 5 minutes via cron to process pending email sends.
 * Handles: abandoned_cart, post_purchase, lead_created, recompra, upsell, crosssell
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  if (!RESEND_API_KEY) {
    console.error("RESEND_API_KEY not configured");
    return new Response(JSON.stringify({ error: "RESEND_API_KEY not set" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const now = new Date().toISOString();
    console.log("📧 Processing email sequences...");

    // 1. Find enrollments ready to send
    const { data: pendingEnrollments, error: fetchError } = await supabase
      .from('email_sequence_enrollments')
      .select(`
        id,
        sequence_id,
        organization_id,
        lead_id,
        email,
        current_step,
        triggered_by
      `)
      .eq('status', 'active')
      .lte('next_send_at', now)
      .limit(50);

    if (fetchError) throw fetchError;

    console.log(`Found ${pendingEnrollments?.length || 0} enrollments to process`);

    let sentCount = 0;
    let errorCount = 0;

    for (const enrollment of pendingEnrollments || []) {
      try {
        // Get next step
        const nextStepOrder = enrollment.current_step + 1;
        
        const { data: step } = await supabase
          .from('email_sequence_steps')
          .select(`
            id,
            template_id,
            delay_minutes,
            subject_override,
            is_active
          `)
          .eq('sequence_id', enrollment.sequence_id)
          .eq('step_order', nextStepOrder)
          .eq('is_active', true)
          .single();

        if (!step) {
          // Sequence completed
          await supabase
            .from('email_sequence_enrollments')
            .update({
              status: 'completed',
              completed_at: now,
            })
            .eq('id', enrollment.id);
          continue;
        }

        // Get template
        const { data: template } = await supabase
          .from('email_templates')
          .select('id, subject, html_content, variables')
          .eq('id', step.template_id)
          .single();

        if (!template) {
          console.error(`Template ${step.template_id} not found`);
          continue;
        }

        // Get email settings
        const { data: settings } = await supabase
          .from('email_settings')
          .select('from_name, from_email, reply_to, footer_html')
          .eq('organization_id', enrollment.organization_id)
          .maybeSingle();

        // Get lead data for variables
        let leadData: Record<string, string> = { nome: 'Cliente', email: enrollment.email };
        
        if (enrollment.lead_id) {
          const { data: lead } = await supabase
            .from('leads')
            .select('name, email, whatsapp')
            .eq('id', enrollment.lead_id)
            .single();
          
          if (lead) {
            leadData = {
              nome: lead.name?.split(' ')[0] || 'Cliente',
              nome_completo: lead.name || 'Cliente',
              email: lead.email || enrollment.email,
              whatsapp: lead.whatsapp || '',
            };
          }
        }

        // Get cart/sale data if applicable
        if (enrollment.triggered_by?.startsWith('cart_')) {
          const cartId = enrollment.triggered_by.replace('cart_', '');
          const { data: cart } = await supabase
            .from('ecommerce_carts')
            .select('items, total_cents, storefront_id')
            .eq('id', cartId)
            .single();
          
          if (cart) {
            const items = cart.items as { name?: string }[] || [];
            leadData.produtos = items.map(i => i.name || 'Produto').join(', ');
            leadData.valor = formatCurrency(cart.total_cents);
            
            // Get storefront link
            const { data: sf } = await supabase
              .from('tenant_storefronts')
              .select('slug')
              .eq('id', cart.storefront_id)
              .single();
            
            if (sf) {
              leadData.link_carrinho = `${supabaseUrl.replace('.supabase.co', '.lovable.app')}/loja/${sf.slug}/carrinho`;
            }
          }
        }

        // Replace variables in template
        let htmlContent = template.html_content;
        let subject = step.subject_override || template.subject;

        for (const [key, value] of Object.entries(leadData)) {
          const regex = new RegExp(`{{${key}}}`, 'gi');
          htmlContent = htmlContent.replace(regex, value);
          subject = subject.replace(regex, value);
        }

        // Add footer if exists
        if (settings?.footer_html) {
          htmlContent += settings.footer_html;
        }

        // Send email via Resend HTTP API
        const fromEmail = settings?.from_email || 'noreply@morphews.com.br';
        const fromName = settings?.from_name || 'Loja';

        const emailRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: `${fromName} <${fromEmail}>`,
            to: [enrollment.email],
            subject: subject,
            html: htmlContent,
            reply_to: settings?.reply_to,
          }),
        });

        const emailResult = await emailRes.json();
        const energyCost = 10; // 10 energy per email sent

        // Log the send with energy cost
        await supabase.from('email_sends').insert({
          organization_id: enrollment.organization_id,
          enrollment_id: enrollment.id,
          template_id: template.id,
          lead_id: enrollment.lead_id,
          email: enrollment.email,
          subject: subject,
          status: emailRes.ok ? 'sent' : 'failed',
          resend_id: emailResult.id,
          sent_at: now,
          error_message: emailRes.ok ? null : JSON.stringify(emailResult),
          energy_cost: emailRes.ok ? energyCost : 0,
        });

        // Debit energy from organization
        if (emailRes.ok) {
          await supabase.rpc('debit_organization_energy', {
            org_id: enrollment.organization_id,
            amount: energyCost,
            description: `Envio de e-mail: ${subject.substring(0, 50)}`
          });
        }

        // Update enrollment for next step
        const { data: nextStep } = await supabase
          .from('email_sequence_steps')
          .select('delay_minutes')
          .eq('sequence_id', enrollment.sequence_id)
          .eq('step_order', nextStepOrder + 1)
          .eq('is_active', true)
          .single();

        if (nextStep) {
          const nextSendAt = new Date(Date.now() + nextStep.delay_minutes * 60 * 1000);
          await supabase
            .from('email_sequence_enrollments')
            .update({
              current_step: nextStepOrder,
              next_send_at: nextSendAt.toISOString(),
            })
            .eq('id', enrollment.id);
        } else {
          // Last step, mark as completed
          await supabase
            .from('email_sequence_enrollments')
            .update({
              current_step: nextStepOrder,
              status: 'completed',
              completed_at: now,
            })
            .eq('id', enrollment.id);
        }

        sentCount++;
        console.log(`✅ Email sent to ${enrollment.email}`);
      } catch (e) {
        console.error(`Error processing enrollment ${enrollment.id}:`, e);
        errorCount++;

        // Log failed send
        await supabase.from('email_sends').insert({
          organization_id: enrollment.organization_id,
          enrollment_id: enrollment.id,
          lead_id: enrollment.lead_id,
          email: enrollment.email,
          subject: 'ERROR',
          status: 'failed',
          error_message: e instanceof Error ? e.message : 'Unknown error',
        });
      }
    }

    console.log(`📧 Complete: ${sentCount} sent, ${errorCount} errors`);

    return new Response(
      JSON.stringify({ success: true, sent: sentCount, errors: errorCount }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Sequence processor error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}
