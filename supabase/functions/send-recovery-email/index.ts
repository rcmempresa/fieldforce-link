import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email } = await req.json();

    if (!email) {
      return new Response(JSON.stringify({ error: "Email é obrigatório" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Generate password reset link using admin API
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email: email,
      options: {
        redirectTo: `${Deno.env.get("SUPABASE_URL")?.replace('/rest/v1', '').replace('https://', 'https://')}/auth/v1/verify`,
      },
    });

    if (linkError) {
      console.error("Error generating recovery link:", linkError);
      return new Response(JSON.stringify({ error: "Erro ao gerar link de recuperação" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Build the recovery URL - extract token from the generated link
    const generatedUrl = linkData?.properties?.action_link;
    if (!generatedUrl) {
      console.error("No action link generated");
      return new Response(JSON.stringify({ error: "Erro ao gerar link" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    console.log("Generated recovery link for:", email);

    // Get user name from profiles
    let userName = "Utilizador";
    if (linkData?.user?.id) {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("name")
        .eq("id", linkData.user.id)
        .single();
      if (profile?.name) userName = profile.name;
    }

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 40px 20px;">
        <h1 style="color: #333; font-size: 24px; margin-bottom: 20px;">🔒 Recuperação de Password</h1>
        <p style="color: #333; font-size: 16px; line-height: 1.5;">Olá <strong>${userName}</strong>,</p>
        <p style="color: #333; font-size: 16px; line-height: 1.5;">Recebemos um pedido para redefinir a password da sua conta.</p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${generatedUrl}" style="background-color: #3b82f6; color: #ffffff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-size: 16px; font-weight: bold; display: inline-block;">
            Redefinir Password
          </a>
        </div>
        <p style="color: #71717a; font-size: 14px; line-height: 1.5;">Se não solicitou esta alteração, pode ignorar este email. O link expira em 24 horas.</p>
        <p style="color: #8898aa; font-size: 12px; margin-top: 32px;">Este é um email automático. Por favor, não responda.</p>
      </div>
    `;

    // Send email via Resend
    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Ordens de Trabalho <geral@nrtechsolucion.pt>",
        to: [email],
        subject: "Recuperação de Password - Ordens de Trabalho",
        html,
      }),
    });

    if (!resendResponse.ok) {
      const errorText = await resendResponse.text();
      console.error("Resend error:", errorText);

      // Log failed email
      if (linkData?.user?.id) {
        await supabaseAdmin.from("email_logs").insert({
          user_id: linkData.user.id,
          email: email,
          subject: "Recuperação de Password - Ordens de Trabalho",
          notification_type: "password_recovery",
          status: "failed",
          error_message: errorText,
        });
      }

      return new Response(JSON.stringify({ error: "Erro ao enviar email" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const result = await resendResponse.json();
    console.log("Recovery email sent successfully:", result);

    // Log successful email
    if (linkData?.user?.id) {
      await supabaseAdmin.from("email_logs").insert({
        user_id: linkData.user.id,
        email: email,
        subject: "Recuperação de Password - Ordens de Trabalho",
        notification_type: "password_recovery",
        status: "sent",
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error) {
    console.error("Error in send-recovery-email:", error);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
