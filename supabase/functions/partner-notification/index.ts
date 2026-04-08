import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PartnerNotificationRequest {
  type: 'invitation_created' | 'application_approved';
  data: {
    email: string;
    name: string;
    whatsapp?: string;
    temp_password?: string;
    org_name: string;
    invite_code?: string;
    affiliate_code?: string;
    needs_user_creation?: boolean;
    organization_id?: string;
    partner_role?: string;
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, data }: PartnerNotificationRequest = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    let emailSent = false;
    let whatsappSent = false;
    let createdUserId: string | null = null;
    let finalPassword = data.temp_password;

    // Se precisa criar usuário
    if (data.needs_user_creation && data.email) {
      finalPassword = 'Morph' + Math.random().toString(36).substring(2, 8) + '!';
      
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: data.email,
        password: finalPassword,
        email_confirm: true,
        user_metadata: {
          full_name: data.name,
          is_partner: true,
        },
      });

      if (createError) {
        console.error("Erro ao criar usuário:", createError);
      } else {
        createdUserId = newUser.user?.id || null;
        console.log("Usuário criado:", createdUserId);

        // Atualizar virtual_account com user_id
        if (createdUserId) {
          await supabase
            .from('virtual_accounts')
            .update({ user_id: createdUserId })
            .eq('holder_email', data.email)
            .is('user_id', null);

          // Criar/atualizar profile
          await supabase
            .from('profiles')
            .upsert({
              user_id: createdUserId,
              full_name: data.name,
              is_partner: true,
            }, { onConflict: 'user_id' });

          // Buscar organization_id da application/invitation
          if (data.organization_id && data.partner_role) {
            // Criar organization_member com role de parceiro
            await supabase
              .from('organization_members')
              .upsert({
                user_id: createdUserId,
                organization_id: data.organization_id,
                role: data.partner_role,
              }, { onConflict: 'user_id,organization_id' });

            // Criar user_permissions básicas para parceiros
            // Partner can see sales (their own) and use whatsapp
            await supabase
              .from('user_permissions')
              .upsert({
                user_id: createdUserId,
                organization_id: data.organization_id,
                sales_view: true,
                sales_view_only_own: true,
                whatsapp_send: true,
                leads_hide_new_button: true,
                default_landing_page: '/ecommerce',
              }, { onConflict: 'user_id,organization_id' });

            console.log("Permissões de parceiro aplicadas:", data.partner_role);
          }
        }
      }
    }

    // Enviar e-mail
    if (resendApiKey && data.email) {
      try {
        let subject = '';
        let htmlContent = '';

        if (type === 'invitation_created') {
          const inviteUrl = `${Deno.env.get("SITE_URL") || "https://atomic.ia.br"}/parceiro/convite/${data.invite_code}`;
          subject = `🎉 Você foi convidado(a) para ser parceiro(a) da ${data.org_name}!`;
          htmlContent = `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
              <h1 style="color: #16a34a;">Bem-vindo(a) à ${data.org_name}!</h1>
              <p>Olá <strong>${data.name}</strong>,</p>
              <p>Você foi convidado(a) para se tornar nosso(a) parceiro(a) de negócios!</p>
              <p>Clique no botão abaixo para aceitar o convite e criar sua conta:</p>
              <p style="text-align: center; margin: 30px 0;">
                <a href="${inviteUrl}" 
                   style="background-color: #16a34a; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">
                  Aceitar Convite
                </a>
              </p>
              <p style="color: #666; font-size: 14px;">
                Este convite expira em 30 dias.
              </p>
            </div>
          `;
        } else if (type === 'application_approved') {
          const loginUrl = `${Deno.env.get("SITE_URL") || "https://atomic.ia.br"}/login`;
          subject = `✅ Seu cadastro foi aprovado - ${data.org_name}`;
          htmlContent = `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
              <h1 style="color: #16a34a;">Parabéns, ${data.name}!</h1>
              <p>Seu cadastro como parceiro(a) da <strong>${data.org_name}</strong> foi aprovado!</p>
              
              <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="margin-top: 0;">Seus dados de acesso:</h3>
                <p><strong>E-mail:</strong> ${data.email}</p>
                ${finalPassword ? `<p><strong>Senha provisória:</strong> ${finalPassword}</p>` : ''}
                ${data.affiliate_code ? `<p><strong>Código de Afiliado:</strong> ${data.affiliate_code}</p>` : ''}
              </div>
              
              <p style="text-align: center; margin: 30px 0;">
                <a href="${loginUrl}" 
                   style="background-color: #16a34a; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">
                  Fazer Login
                </a>
              </p>
              
              <p style="color: #666; font-size: 14px;">
                Recomendamos que você altere sua senha após o primeiro acesso.
              </p>
            </div>
          `;
        }

        const emailResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${resendApiKey}`,
          },
          body: JSON.stringify({
            from: "Atomic Sales <noreply@updates.atomic.ia.br>",
            to: [data.email],
            subject,
            html: htmlContent,
          }),
        });

        if (emailResponse.ok) {
          emailSent = true;
          console.log("E-mail enviado com sucesso");
          
          // Registrar no log de comunicações
          await supabase.from('system_communication_logs').insert({
            organization_id: data.organization_id,
            channel: 'email',
            source: 'partner_approval',
            recipient_email: data.email,
            recipient_name: data.name,
            subject: subject,
            message_content: `Aprovação de parceiro: ${data.name}`,
            status: 'sent',
            metadata: {
              type: type,
              affiliate_code: data.affiliate_code,
            },
          });
        } else {
          const errorText = await emailResponse.text();
          console.error("Erro ao enviar e-mail:", errorText);
          
          // Registrar erro no log
          await supabase.from('system_communication_logs').insert({
            organization_id: data.organization_id,
            channel: 'email',
            source: 'partner_approval',
            recipient_email: data.email,
            recipient_name: data.name,
            subject: subject,
            message_content: `Aprovação de parceiro: ${data.name}`,
            status: 'failed',
            error_message: errorText,
            metadata: {
              type: type,
            },
          });
        }
      } catch (emailError) {
        console.error("Erro ao enviar e-mail:", emailError);
      }
    }

    // Enviar WhatsApp via instância global
    if (data.whatsapp) {
      try {
        // Buscar instância global de WhatsApp
        const { data: globalInstance } = await supabase
          .from('whatsapp_instances')
          .select('id, instance_name, evolution_api_url, evolution_api_key')
          .eq('is_global', true)
          .eq('status', 'connected')
          .maybeSingle();

        if (globalInstance?.evolution_api_url && globalInstance?.evolution_api_key) {
          let message = '';

          if (type === 'invitation_created') {
            const inviteUrl = `${Deno.env.get("SITE_URL") || "https://atomic.ia.br"}/parceiro/convite/${data.invite_code}`;
            message = `🎉 *Convite de Parceria*\n\nOlá ${data.name}!\n\nVocê foi convidado(a) para ser parceiro(a) da *${data.org_name}*!\n\nAcesse o link para aceitar:\n${inviteUrl}\n\nEste convite expira em 30 dias.`;
          } else if (type === 'application_approved') {
            message = `✅ *Cadastro Aprovado!*\n\nOlá ${data.name}!\n\nSeu cadastro como parceiro(a) da *${data.org_name}* foi aprovado!\n\n📧 E-mail: ${data.email}${finalPassword ? `\n🔑 Senha: ${finalPassword}` : ''}${data.affiliate_code ? `\n🏷️ Código: ${data.affiliate_code}` : ''}\n\nAcesse: https://atomic.ia.br/login`;
          }

          // Normalizar número
          let phone = data.whatsapp.replace(/\D/g, '');
          if (!phone.startsWith('55')) {
            phone = '55' + phone;
          }

          const whatsappResponse = await fetch(
            `${globalInstance.evolution_api_url}/message/sendText/${globalInstance.instance_name}`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                apikey: globalInstance.evolution_api_key,
              },
              body: JSON.stringify({
                number: phone,
                text: message,
              }),
            }
          );

          if (whatsappResponse.ok) {
            whatsappSent = true;
            console.log("WhatsApp enviado com sucesso");
          } else {
            console.error("Erro ao enviar WhatsApp:", await whatsappResponse.text());
          }
        }
      } catch (whatsappError) {
        console.error("Erro ao enviar WhatsApp:", whatsappError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        email_sent: emailSent,
        whatsapp_sent: whatsappSent,
        user_created: !!createdUserId,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    console.error("Erro na função partner-notification:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
