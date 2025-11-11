import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { createClient } from "jsr:@supabase/supabase-js@2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationEmailRequest {
  type: "work_order_assigned" | "work_order_completed";
  userId: string; // User ID instead of email
  data: {
    recipientName: string;
    workOrderReference: string;
    workOrderTitle: string;
    employeeName?: string;
    clientName?: string;
    completedBy?: string;
    isManager?: boolean;
  };
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const { type, userId, data }: NotificationEmailRequest = await req.json();

    console.log("Sending notification email:", { type, userId });

    // Get user email
    const { data: { user }, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId);
    
    if (userError || !user?.email) {
      throw new Error("Failed to get user email");
    }

    const to = user.email;

    let html: string;
    let subject: string;

    if (type === "work_order_assigned") {
      subject = `Nova Ordem de Trabalho - ${data.workOrderReference}`;
      html = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 40px 20px;">
          <h1 style="color: #333; font-size: 24px; margin-bottom: 20px;">Nova Ordem de Trabalho Atribuída</h1>
          <p style="color: #333; font-size: 16px; line-height: 1.5;">Olá <strong>${data.recipientName}</strong>,</p>
          <p style="color: #333; font-size: 16px; line-height: 1.5;">Foi atribuído à seguinte ordem de trabalho:</p>
          <div style="background-color: #f4f4f5; border-radius: 8px; padding: 24px; margin: 24px 0;">
            <p style="color: #7c3aed; font-size: 18px; font-weight: bold; margin: 0 0 8px 0;">${data.workOrderReference}</p>
            <p style="color: #333; font-size: 16px; font-weight: 600; margin: 8px 0;">${data.workOrderTitle}</p>
            <p style="color: #71717a; font-size: 14px; margin: 8px 0 0 0;">Cliente: ${data.clientName || 'N/A'}</p>
          </div>
          <p style="color: #333; font-size: 16px; line-height: 1.5;">Por favor, aceda ao sistema para ver todos os detalhes.</p>
          <p style="color: #8898aa; font-size: 12px; margin-top: 32px;">Este é um email automático. Por favor, não responda.</p>
        </div>
      `;
    } else if (type === "work_order_completed") {
      subject = `Ordem Concluída - ${data.workOrderReference}`;
      html = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 40px 20px;">
          <h1 style="color: #333; font-size: 24px; margin-bottom: 20px;">Ordem de Trabalho Concluída</h1>
          <p style="color: #333; font-size: 16px; line-height: 1.5;">Olá <strong>${data.recipientName}</strong>,</p>
          <p style="color: #333; font-size: 16px; line-height: 1.5;">
            ${data.isManager 
              ? 'Uma ordem de trabalho foi concluída:'
              : 'A sua ordem de trabalho foi concluída:'}
          </p>
          <div style="background-color: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 24px; margin: 24px 0;">
            <p style="color: #16a34a; font-size: 18px; font-weight: bold; margin: 0 0 8px 0;">${data.workOrderReference}</p>
            <p style="color: #333; font-size: 16px; font-weight: 600; margin: 8px 0;">${data.workOrderTitle}</p>
            <p style="color: #71717a; font-size: 14px; margin: 8px 0 0 0;">Concluída por: ${data.completedBy || 'N/A'}</p>
          </div>
          <p style="color: #333; font-size: 16px; line-height: 1.5;">
            ${data.isManager 
              ? 'Por favor, aceda ao sistema para rever os detalhes.'
              : 'Obrigado por confiar nos nossos serviços.'}
          </p>
          <p style="color: #8898aa; font-size: 12px; margin-top: 32px;">Este é um email automático. Por favor, não responda.</p>
        </div>
      `;
    } else {
      throw new Error("Invalid notification type");
    }

    const { error } = await resend.emails.send({
      from: "Ordens de Trabalho <onboarding@resend.dev>",
      to: [to],
      subject,
      html,
    });

    if (error) {
      console.error("Error sending email:", error);
      throw error;
    }

    console.log("Email sent successfully to:", to);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-notification-email function:", error);
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
