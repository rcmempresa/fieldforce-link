import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

// SendGrid API
const SENDGRID_API_KEY = Deno.env.get("SENDGRID_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationEmailRequest {
  type: "work_order_assigned" | "work_order_completed" | "work_order_created" | "work_order_updated" | "work_order_assignment_removed";
  userId: string; // User ID instead of email
  data: {
    recipientName: string;
    workOrderReference: string;
    workOrderTitle: string;
    employeeName?: string;
    clientName?: string;
    completedBy?: string;
    isManager?: boolean;
    changes?: string;
    pdfUrl?: string;
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

    let workOrderId: string | null = null;

    // Get work order ID early for logging purposes
    if (data.workOrderReference) {
      const { data: woData } = await supabaseAdmin
        .from('work_orders')
        .select('id')
        .eq('reference', data.workOrderReference)
        .single();
      workOrderId = woData?.id || null;
    }

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
    } else if (type === "work_order_created") {
      subject = `Nova Ordem Criada - ${data.workOrderReference}`;
      html = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 40px 20px;">
          <h1 style="color: #333; font-size: 24px; margin-bottom: 20px;">Nova Ordem de Trabalho Criada</h1>
          <p style="color: #333; font-size: 16px; line-height: 1.5;">Olá <strong>${data.recipientName}</strong>,</p>
          <p style="color: #333; font-size: 16px; line-height: 1.5;">Uma nova ordem de trabalho foi criada:</p>
          <div style="background-color: #f0f9ff; border: 1px solid #3b82f6; border-radius: 8px; padding: 24px; margin: 24px 0;">
            <p style="color: #3b82f6; font-size: 18px; font-weight: bold; margin: 0 0 8px 0;">${data.workOrderReference}</p>
            <p style="color: #333; font-size: 16px; font-weight: 600; margin: 8px 0;">${data.workOrderTitle}</p>
            <p style="color: #71717a; font-size: 14px; margin: 8px 0 0 0;">Cliente: ${data.clientName || 'N/A'}</p>
          </div>
          <p style="color: #333; font-size: 16px; line-height: 1.5;">Por favor, aceda ao sistema para ver todos os detalhes.</p>
          <p style="color: #8898aa; font-size: 12px; margin-top: 32px;">Este é um email automático. Por favor, não responda.</p>
        </div>
      `;
    } else if (type === "work_order_updated") {
      subject = `Ordem Atualizada - ${data.workOrderReference}`;
      html = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 40px 20px;">
          <h1 style="color: #333; font-size: 24px; margin-bottom: 20px;">Ordem de Trabalho Atualizada</h1>
          <p style="color: #333; font-size: 16px; line-height: 1.5;">Olá <strong>${data.recipientName}</strong>,</p>
          <p style="color: #333; font-size: 16px; line-height: 1.5;">Uma ordem de trabalho foi atualizada:</p>
          <div style="background-color: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 24px; margin: 24px 0;">
            <p style="color: #f59e0b; font-size: 18px; font-weight: bold; margin: 0 0 8px 0;">${data.workOrderReference}</p>
            <p style="color: #333; font-size: 16px; font-weight: 600; margin: 8px 0;">${data.workOrderTitle}</p>
            ${data.changes ? `<p style="color: #71717a; font-size: 14px; margin: 8px 0 0 0;">Alterações: ${data.changes}</p>` : ''}
          </div>
          <p style="color: #333; font-size: 16px; line-height: 1.5;">Por favor, aceda ao sistema para ver todos os detalhes.</p>
          <p style="color: #8898aa; font-size: 12px; margin-top: 32px;">Este é um email automático. Por favor, não responda.</p>
        </div>
      `;
    } else if (type === "work_order_assignment_removed") {
      subject = `Removido da Ordem - ${data.workOrderReference}`;
      html = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 40px 20px;">
          <h1 style="color: #333; font-size: 24px; margin-bottom: 20px;">Atribuição Removida</h1>
          <p style="color: #333; font-size: 16px; line-height: 1.5;">Olá <strong>${data.recipientName}</strong>,</p>
          <p style="color: #333; font-size: 16px; line-height: 1.5;">Foi removido da seguinte ordem de trabalho:</p>
          <div style="background-color: #fef2f2; border: 1px solid #ef4444; border-radius: 8px; padding: 24px; margin: 24px 0;">
            <p style="color: #ef4444; font-size: 18px; font-weight: bold; margin: 0 0 8px 0;">${data.workOrderReference}</p>
            <p style="color: #333; font-size: 16px; font-weight: 600; margin: 8px 0;">${data.workOrderTitle}</p>
          </div>
          <p style="color: #8898aa; font-size: 12px; margin-top: 32px;">Este é um email automático. Por favor, não responda.</p>
        </div>
      `;
    } else {
      throw new Error("Invalid notification type");
    }

    // Prepare email data for SendGrid
    const emailData: any = {
      personalizations: [
        {
          to: [{ email: to }]
        }
      ],
      from: { 
        email: "geral@nrenergias.pt",
        name: "Ordens de Trabalho"
      },
      subject,
      content: [
        {
          type: "text/html",
          value: html
        }
      ]
    };

    // If there's a PDF URL for work_order_completed, download and attach it
    if (type === "work_order_completed" && data.pdfUrl) {
      try {
        console.log("Downloading PDF from storage:", data.pdfUrl);
        
        // Extract the file path from the public URL
        const urlParts = data.pdfUrl.split('/work-order-attachments/');
        const filePath = urlParts[1];
        
        // Download the PDF from Supabase storage
        const { data: pdfData, error: downloadError } = await supabaseAdmin.storage
          .from("work-order-attachments")
          .download(filePath);

        if (downloadError) {
          console.error("Error downloading PDF:", downloadError);
        } else if (pdfData) {
          // Convert blob to base64
          const buffer = await pdfData.arrayBuffer();
          const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
          
          emailData.attachments = [{
            content: base64,
            filename: `${data.workOrderReference}_concluido.pdf`,
            type: "application/pdf",
            disposition: "attachment"
          }];
          
          console.log("PDF attached to email successfully");
        }
      } catch (pdfError) {
        console.error("Error processing PDF attachment:", pdfError);
        // Continue sending email without attachment
      }
    }

    // Send email using SendGrid API
    const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SENDGRID_API_KEY}`,
      },
      body: JSON.stringify(emailData),
    });

    if (!response.ok) {
      const result = await response.text();
      console.error("Error sending email:", result);
      
      // Log failed email attempt
      await supabaseAdmin.from('email_logs').insert({
        user_id: userId,
        email: to,
        subject,
        notification_type: type,
        status: 'failed',
        error_message: result,
        work_order_id: workOrderId,
      });

      throw new Error(result || "Failed to send email");
    }

    console.log("Email sent successfully to:", to);

    // Log the email in the database
    await supabaseAdmin.from('email_logs').insert({
      user_id: userId,
      email: to,
      subject,
      notification_type: type,
      status: 'sent',
      work_order_id: workOrderId,
    });

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
