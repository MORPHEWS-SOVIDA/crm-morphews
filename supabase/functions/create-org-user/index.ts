import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreateOrgUserRequest {
  organizationId: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  planName: string;
  isAdditionalUser?: boolean; // For adding users to existing org
}

function generateTemporaryPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let password = "";
  for (let i = 0; i < 10; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { organizationId, ownerName, ownerEmail, ownerPhone, planName, isAdditionalUser }: CreateOrgUserRequest = await req.json();

    console.log("Creating user for organization:", organizationId, "Email:", ownerEmail, "isAdditionalUser:", isAdditionalUser);

    // Validate required fields
    if (!organizationId || !ownerName || !ownerEmail) {
      throw new Error("Campos obrigatórios: organizationId, ownerName, ownerEmail");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY não configurada");
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Check if user already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email === ownerEmail);
    
    if (existingUser) {
      throw new Error("Já existe um usuário com este email");
    }

    // Generate temporary password
    const tempPassword = generateTemporaryPassword();
    const [firstName, ...lastNameParts] = ownerName.trim().split(" ");
    const lastName = lastNameParts.join(" ") || "Usuário";

    // Create user in auth.users
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: ownerEmail,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
      },
    });

    if (authError) {
      console.error("Error creating auth user:", authError);
      throw new Error(`Erro ao criar usuário: ${authError.message}`);
    }

    const userId = authData.user.id;
    console.log("Auth user created:", userId);

    // Only update organization owner info if this is the primary owner (not additional user)
    if (!isAdditionalUser) {
      const { error: orgError } = await supabaseAdmin
        .from("organizations")
        .update({
          owner_name: ownerName,
          owner_email: ownerEmail,
          phone: ownerPhone,
        })
        .eq("id", organizationId);

      if (orgError) {
        console.error("Error updating organization:", orgError);
        throw new Error(`Erro ao atualizar organização: ${orgError.message}`);
      }
    }

    // Update profile with organization_id
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({
        organization_id: organizationId,
        first_name: firstName,
        last_name: lastName,
        whatsapp: ownerPhone || null,
      })
      .eq("user_id", userId);

    if (profileError) {
      console.error("Error updating profile:", profileError);
      // Profile might be created by trigger, try insert if update fails
      const { error: insertError } = await supabaseAdmin
        .from("profiles")
        .insert({
          user_id: userId,
          first_name: firstName,
          last_name: lastName,
          organization_id: organizationId,
          whatsapp: ownerPhone || null,
        });

      if (insertError) {
        console.error("Error inserting profile:", insertError);
      }
    }

    // Add user to organization_members
    // Use "member" role for additional users, "owner" for primary owner
    const memberRole = isAdditionalUser ? "member" : "owner";
    
    const { error: memberError } = await supabaseAdmin
      .from("organization_members")
      .insert({
        organization_id: organizationId,
        user_id: userId,
        role: memberRole,
      });

    if (memberError) {
      console.error("Error adding organization member:", memberError);
      throw new Error(`Erro ao adicionar membro: ${memberError.message}`);
    }

    // Record temp password reset for forced password change
    const { error: tempResetError } = await supabaseAdmin
      .from("temp_password_resets")
      .insert({
        user_id: userId,
        email: ownerEmail,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
      });

    if (tempResetError) {
      console.error("Error recording temp password reset:", tempResetError);
    }

    // Send welcome email with credentials
    const loginUrl = "https://crm.morphews.com/login";
    const roleText = isAdditionalUser 
      ? `Você foi adicionado à equipe no ${planName}!`
      : `sua conta no plano ${planName} está pronta!`;

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px;">🎉 Bem-vindo ao Morphews CRM!</h1>
          <p style="color: rgba(255,255,255,0.9); margin-top: 10px;">Olá ${firstName}, ${roleText}</p>
        </div>
        
        <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 12px 12px;">
          <h2 style="color: #333; margin-top: 0;">Suas credenciais de acesso:</h2>
          
          <div style="background: white; border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>📧 E-mail:</strong> ${ownerEmail}</p>
            <p style="margin: 5px 0;"><strong>🔑 Senha provisória:</strong> <code style="background: #f0f0f0; padding: 4px 8px; border-radius: 4px; font-size: 16px;">${tempPassword}</code></p>
          </div>
          
          <div style="background: #fff3cd; border: 1px solid #ffc107; border-radius: 8px; padding: 15px; margin: 20px 0;">
            <p style="margin: 0; color: #856404;">⚠️ <strong>Importante:</strong> No primeiro login, você deverá criar uma nova senha.</p>
          </div>
          
          <div style="text-align: center; margin-top: 30px;">
            <a href="${loginUrl}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Acessar o Sistema</a>
          </div>
          
          <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
          
          <p style="color: #666; font-size: 14px; text-align: center; margin: 0;">
            Precisa de ajuda? Entre em contato pelo WhatsApp<br>
            <strong>Morphews CRM</strong> - Transforme seus leads em clientes
          </p>
        </div>
      </body>
      </html>
    `;

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: "Morphews CRM <noreply@morphews.com>",
        to: [ownerEmail],
        subject: "🎉 Bem-vindo ao Morphews CRM - Suas credenciais de acesso",
        html: emailHtml,
      }),
    });

    const emailData = await emailRes.json();

    if (!emailRes.ok) {
      console.error("Resend API error:", emailData);
      // Don't fail the whole process if email fails, just log it
    } else {
      console.log("Welcome email sent successfully:", emailData);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        userId,
        message: "Usuário criado e email enviado com sucesso!" 
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in create-org-user:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
