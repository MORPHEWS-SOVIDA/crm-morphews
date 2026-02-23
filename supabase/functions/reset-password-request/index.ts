import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Simple in-memory rate limiting (resets on function cold start)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_MAX_REQUESTS = 3; // 3 requests per hour per IP

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  
  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    return true;
  }
  
  entry.count++;
  return false;
}

// Generate a random 8 character password
function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let password = '';
  for (let i = 0; i < 8; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Rate limiting by IP
    const clientIP = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || 
                     req.headers.get("x-real-ip") || 
                     "unknown";
    
    if (isRateLimited(clientIP)) {
      console.log("Rate limited IP:", clientIP);
      return new Response(
        JSON.stringify({ error: "Muitas tentativas. Tente novamente mais tarde." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { email } = await req.json();

    if (!email) {
      console.error("Email is required");
      return new Response(
        JSON.stringify({ error: "Email é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Processing password reset for email:", email);

    // Create Supabase admin client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Find user by email using pagination to handle large user bases
    let user = null;
    let page = 1;
    const perPage = 1000;
    
    while (!user) {
      const { data: userData, error: userError } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage,
      });
      
      if (userError) {
        console.error("Error listing users:", userError);
        throw userError;
      }

      // Search for user in current page
      user = userData.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
      
      // If no more users to check, break
      if (userData.users.length < perPage) {
        break;
      }
      
      page++;
      
      // Safety limit to avoid infinite loops
      if (page > 100) {
        console.error("Too many pages, stopping search");
        break;
      }
    }
    
    if (!user) {
      console.log("User not found for email:", email);
      // Return success anyway to prevent email enumeration
      return new Response(
        JSON.stringify({ success: true, message: "Se o email existir, você receberá uma senha provisória." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate temporary password
    const tempPassword = generateTempPassword();
    console.log("Generated temp password for user:", user.id);

    // Update user's password using admin client
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      password: tempPassword,
    });

    if (updateError) {
      console.error("Error updating user password:", updateError);
      throw updateError;
    }

    // Record the temp password reset in our tracking table
    const { error: insertError } = await supabaseAdmin
      .from("temp_password_resets")
      .insert({
        user_id: user.id,
        email: email.toLowerCase(),
      });

    if (insertError) {
      console.error("Error recording temp password reset:", insertError);
      // Continue anyway, the password was already changed
    }

    // Get user's first name from profiles
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("first_name")
      .eq("user_id", user.id)
      .single();

    const firstName = profile?.first_name || "Usuário";

    // Send email with temporary password via Resend
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.error("RESEND_API_KEY not configured");
      throw new Error("Serviço de email não configurado");
    }
    
    console.log("Sending temp password email to:", email);
    
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 40px 20px;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                <tr>
                  <td style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 40px 40px; text-align: center;">
                    <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">Atomic Sales</h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 40px;">
                    <h2 style="color: #1f2937; margin: 0 0 20px 0; font-size: 24px;">Senha Provisória</h2>
                    <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">Olá ${firstName},</p>
                     <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">Você solicitou a recuperação de sua senha. Use a senha provisória abaixo para fazer login:</p>
                     <div style="background-color: #f0f4ff; border: 2px solid #667eea; border-radius: 8px; padding: 20px; text-align: center; margin: 30px 0;">
                       <p style="color: #3730a3; font-size: 14px; margin: 0 0 10px 0; font-weight: 500;">Sua senha provisória (copie/cole sem espaços):</p>
                       <p style="color: #4f46e5; font-size: 28px; font-weight: 800; margin: 0; font-family: 'Courier New', monospace;">${tempPassword}</p>
                       <p style="color: #6b7280; font-size: 12px; margin: 12px 0 0 0;">Se ao colar aparecerem espaços entre letras, apague-os.</p>
                     </div>
                    <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;"><strong>Importante:</strong> Ao fazer login com esta senha, você será solicitado a criar uma nova senha segura.</p>
                    <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 30px 0 0 0;">Se você não solicitou esta recuperação, pode ignorar este email com segurança.</p>
                    <p style="color: #9ca3af; font-size: 12px; line-height: 1.6; margin: 20px 0 0 0;"><em>Esta senha provisória expira em 24 horas.</em></p>
                  </td>
                </tr>
                <tr>
                  <td style="background-color: #f9fafb; padding: 20px 40px; text-align: center; border-top: 1px solid #e5e7eb;">
                    <p style="color: #9ca3af; font-size: 12px; margin: 0;">© 2024 Atomic Sales. Todos os direitos reservados.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;
    
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: "Atomic Sales <onboarding@resend.dev>",
        to: [email],
        subject: "Sua Senha Provisória - Atomic Sales",
        html: emailHtml,
      }),
    });

    const emailData = await emailResponse.json();
    
    if (!emailResponse.ok) {
      console.error("Resend error:", emailData);
      throw new Error("Erro ao enviar email");
    }

    console.log("Email sent successfully:", emailData);

    return new Response(
      JSON.stringify({ success: true, message: "Senha provisória enviada para seu email." }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in reset-password-request:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro ao processar solicitação" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
