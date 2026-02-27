import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type NotificationType = 
  | "welcome" 
  | "account_approved"
  | "account_rejected"
  | "work_order_request_received"
  | "work_order_approved"
  | "work_order_rejected"
  | "work_order_assigned" 
  | "work_order_started"
  | "work_order_paused"
  | "work_order_resumed"
  | "work_order_completed" 
  | "work_order_created" 
  | "work_order_updated" 
  | "work_order_assignment_removed"
  | "work_order_scheduled"
  | "work_order_missing_material"
  | "work_order_missing_material_managers"
  | "work_order_created_notify_managers";

interface NotificationEmailRequest {
  type: NotificationType;
  userId?: string;
  data: {
    recipientName?: string;
    workOrderId?: string;
    workOrderReference?: string;
    workOrderTitle?: string;
    employeeName?: string;
    clientName?: string;
    completedBy?: string;
    isManager?: boolean;
    isClient?: boolean;
    isEmployee?: boolean;
    changes?: string;
    pdfUrl?: string;
    scheduledDate?: string;
    pauseReason?: string;
    role?: string;
    missingMaterial?: string;
  };
}

async function sendEmailViaResend(to: string, subject: string, html: string, attachments?: any[]): Promise<Response> {
  const payload: any = {
    from: "Ordens de Trabalho <geral@nrtechsolucion.pt>",
    to: [to],
    subject,
    html,
  };

  if (attachments && attachments.length > 0) {
    payload.attachments = attachments;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  return response;
}

// Helper function to send missing material emails to all managers
async function sendMissingMaterialToManagers(supabaseAdmin: any, data: any): Promise<Response> {
  console.log("Sending missing material emails to all managers");

  const { data: managers, error: managersError } = await supabaseAdmin
    .from("user_roles")
    .select("user_id")
    .eq("role", "manager")
    .eq("approved", true);

  if (managersError) {
    console.error("Error fetching managers:", managersError);
    throw new Error("Failed to fetch managers");
  }

  console.log("Found managers:", managers?.length || 0);

  if (!managers || managers.length === 0) {
    console.log("No approved managers found");
    return new Response(JSON.stringify({ success: true, message: "No managers to notify" }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  let workOrderId: string | null = null;
  if (data.workOrderId) {
    workOrderId = data.workOrderId;
  } else if (data.workOrderReference) {
    const { data: woData } = await supabaseAdmin
      .from('work_orders')
      .select('id')
      .eq('reference', data.workOrderReference)
      .maybeSingle();
    workOrderId = woData?.id || null;
  }

  const subject = `Falta de Material - ${data.workOrderReference}`;
  
  for (const manager of managers) {
    try {
      const { data: managerProfile } = await supabaseAdmin
        .from("profiles")
        .select("name")
        .eq("id", manager.user_id)
        .single();

      const { data: { user }, error: userError } = await supabaseAdmin.auth.admin.getUserById(manager.user_id);
      
      if (userError || !user?.email) {
        console.error("Failed to get manager email for:", manager.user_id);
        continue;
      }

      const html = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 40px 20px;">
          <h1 style="color: #ef4444; font-size: 24px; margin-bottom: 20px;">⚠️ Falta de Material</h1>
          <p style="color: #333; font-size: 16px; line-height: 1.5;">Olá <strong>${managerProfile?.name || 'Gerente'}</strong>,</p>
          <p style="color: #333; font-size: 16px; line-height: 1.5;">Uma ordem de trabalho foi pausada devido a falta de material.</p>
          <div style="background-color: #fef2f2; border: 1px solid #ef4444; border-radius: 8px; padding: 24px; margin: 24px 0;">
            <p style="color: #ef4444; font-size: 18px; font-weight: bold; margin: 0 0 8px 0;">${data.workOrderReference}</p>
            <p style="color: #333; font-size: 16px; font-weight: 600; margin: 8px 0;">${data.workOrderTitle}</p>
            ${data.clientName ? `<p style="color: #71717a; font-size: 14px; margin: 8px 0 0 0;">Cliente: ${data.clientName}</p>` : ''}
            ${data.employeeName ? `<p style="color: #71717a; font-size: 14px; margin: 8px 0 0 0;">Funcionário: ${data.employeeName}</p>` : ''}
          </div>
          <div style="background-color: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 24px; margin: 24px 0;">
            <p style="color: #f59e0b; font-size: 14px; font-weight: bold; margin: 0 0 8px 0;">📦 Material em Falta:</p>
            <p style="color: #333; font-size: 14px; margin: 0; white-space: pre-wrap;">${data.missingMaterial || 'Não especificado'}</p>
          </div>
          <p style="color: #333; font-size: 16px; line-height: 1.5;">Por favor, providencie o material necessário.</p>
          <p style="color: #8898aa; font-size: 12px; margin-top: 32px;">Este é um email automático. Por favor, não responda.</p>
        </div>
      `;

      const response = await sendEmailViaResend(user.email, subject, html);

      if (!response.ok) {
        const result = await response.text();
        console.error("Error sending email to manager:", manager.user_id, result);
        
        await supabaseAdmin.from('email_logs').insert({
          user_id: manager.user_id,
          email: user.email,
          subject,
          notification_type: 'work_order_missing_material',
          status: 'failed',
          error_message: result,
          work_order_id: workOrderId,
        });
      } else {
        const result = await response.json();
        console.log("Email sent successfully to manager:", user.email, result);
        
        await supabaseAdmin.from('email_logs').insert({
          user_id: manager.user_id,
          email: user.email,
          subject,
          notification_type: 'work_order_missing_material',
          status: 'sent',
          work_order_id: workOrderId,
        });
      }
    } catch (error) {
      console.error("Error sending email to manager:", manager.user_id, error);
    }
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

// Helper function to send new work order emails to all managers
async function sendWorkOrderCreatedToManagers(supabaseAdmin: any, data: any): Promise<Response> {
  console.log("Sending new work order emails to all managers");

  const { data: managers, error: managersError } = await supabaseAdmin
    .from("user_roles")
    .select("user_id")
    .eq("role", "manager")
    .eq("approved", true);

  if (managersError) {
    console.error("Error fetching managers:", managersError);
    throw new Error("Failed to fetch managers");
  }

  console.log("Found managers:", managers?.length || 0);

  if (!managers || managers.length === 0) {
    console.log("No approved managers found");
    return new Response(JSON.stringify({ success: true, message: "No managers to notify" }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const workOrderId = data.workOrderId || null;
  const subject = `Nova Solicitação de Serviço - ${data.workOrderReference}`;
  
  for (const manager of managers) {
    try {
      const { data: managerProfile } = await supabaseAdmin
        .from("profiles")
        .select("name")
        .eq("id", manager.user_id)
        .single();

      const { data: { user }, error: userError } = await supabaseAdmin.auth.admin.getUserById(manager.user_id);
      
      if (userError || !user?.email) {
        console.error("Failed to get manager email for:", manager.user_id);
        continue;
      }

      const html = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 40px 20px;">
          <h1 style="color: #f59e0b; font-size: 24px; margin-bottom: 20px;">📋 Nova Solicitação de Serviço</h1>
          <p style="color: #333; font-size: 16px; line-height: 1.5;">Olá <strong>${managerProfile?.name || 'Gerente'}</strong>,</p>
          <p style="color: #333; font-size: 16px; line-height: 1.5;">Uma nova solicitação de serviço foi submetida por um cliente e está aguardando a sua aprovação.</p>
          <div style="background-color: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 24px; margin: 24px 0;">
            <p style="color: #f59e0b; font-size: 18px; font-weight: bold; margin: 0 0 8px 0;">${data.workOrderReference}</p>
            <p style="color: #333; font-size: 16px; font-weight: 600; margin: 8px 0;">${data.workOrderTitle}</p>
            <p style="color: #71717a; font-size: 14px; margin: 8px 0 0 0;">Cliente: ${data.clientName || 'N/A'}</p>
            <p style="color: #71717a; font-size: 14px; margin: 8px 0 0 0;">Estado: Aguardando Aprovação</p>
          </div>
          <p style="color: #333; font-size: 16px; line-height: 1.5;">Por favor, aceda ao sistema para analisar e aprovar ou rejeitar esta solicitação.</p>
          <p style="color: #8898aa; font-size: 12px; margin-top: 32px;">Este é um email automático. Por favor, não responda.</p>
        </div>
      `;

      const response = await sendEmailViaResend(user.email, subject, html);

      if (!response.ok) {
        const result = await response.text();
        console.error("Error sending email to manager:", manager.user_id, result);
        
        await supabaseAdmin.from('email_logs').insert({
          user_id: manager.user_id,
          email: user.email,
          subject,
          notification_type: 'work_order_created',
          status: 'failed',
          error_message: result,
          work_order_id: workOrderId,
        });
      } else {
        const result = await response.json();
        console.log("Email sent successfully to manager:", user.email, result);
        
        await supabaseAdmin.from('email_logs').insert({
          user_id: manager.user_id,
          email: user.email,
          subject,
          notification_type: 'work_order_created',
          status: 'sent',
          work_order_id: workOrderId,
        });
      }
    } catch (error) {
      console.error("Error sending email to manager:", manager.user_id, error);
    }
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

const handler = async (req: Request): Promise<Response> => {
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

    // Handle special case for sending to all managers
    if (type === "work_order_missing_material_managers") {
      return await sendMissingMaterialToManagers(supabaseAdmin, data);
    }

    // Handle new work order notification to all managers
    if (type === "work_order_created_notify_managers") {
      return await sendWorkOrderCreatedToManagers(supabaseAdmin, data);
    }

    // For all other types, userId is required
    if (!userId) {
      throw new Error("userId is required for this notification type");
    }

    let workOrderId: string | null = null;

    if (data.workOrderReference) {
      const { data: woData } = await supabaseAdmin
        .from('work_orders')
        .select('id')
        .eq('reference', data.workOrderReference)
        .maybeSingle();
      workOrderId = woData?.id || null;
    }

    const { data: { user }, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId);
    
    if (userError || !user?.email) {
      throw new Error("Failed to get user email");
    }

    const to = user.email;

    let html: string;
    let subject: string;

    switch (type) {
      case "welcome":
        subject = "Bem-vindo à Plataforma de Ordens de Trabalho";
        html = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 40px 20px;">
            <h1 style="color: #333; font-size: 24px; margin-bottom: 20px;">Bem-vindo!</h1>
            <p style="color: #333; font-size: 16px; line-height: 1.5;">Olá <strong>${data.recipientName}</strong>,</p>
            <p style="color: #333; font-size: 16px; line-height: 1.5;">A sua conta foi criada com sucesso na nossa plataforma de gestão de ordens de trabalho.</p>
            <div style="background-color: #f0f9ff; border: 1px solid #3b82f6; border-radius: 8px; padding: 24px; margin: 24px 0;">
              <p style="color: #3b82f6; font-size: 16px; font-weight: bold; margin: 0;">Próximos passos:</p>
              <p style="color: #333; font-size: 14px; margin: 12px 0 0 0;">A sua conta está pendente de aprovação. Será notificado assim que um administrador aprovar o seu acesso.</p>
            </div>
            <p style="color: #333; font-size: 16px; line-height: 1.5;">Obrigado por se juntar a nós!</p>
            <p style="color: #8898aa; font-size: 12px; margin-top: 32px;">Este é um email automático. Por favor, não responda.</p>
          </div>
        `;
        break;

      case "account_approved":
        subject = "Conta Aprovada - Acesso Concedido";
        html = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 40px 20px;">
            <h1 style="color: #16a34a; font-size: 24px; margin-bottom: 20px;">Conta Aprovada!</h1>
            <p style="color: #333; font-size: 16px; line-height: 1.5;">Olá <strong>${data.recipientName}</strong>,</p>
            <p style="color: #333; font-size: 16px; line-height: 1.5;">A sua conta foi aprovada com sucesso!</p>
            <div style="background-color: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 24px; margin: 24px 0;">
              <p style="color: #16a34a; font-size: 16px; font-weight: bold; margin: 0;">Papel atribuído: ${data.role === 'manager' ? 'Gerente' : data.role === 'employee' ? 'Funcionário' : 'Cliente'}</p>
              <p style="color: #333; font-size: 14px; margin: 12px 0 0 0;">Já pode aceder à plataforma e utilizar todas as funcionalidades disponíveis para o seu perfil.</p>
            </div>
            <p style="color: #8898aa; font-size: 12px; margin-top: 32px;">Este é um email automático. Por favor, não responda.</p>
          </div>
        `;
        break;

      case "account_rejected":
        subject = "Conta Não Aprovada";
        html = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 40px 20px;">
            <h1 style="color: #ef4444; font-size: 24px; margin-bottom: 20px;">Conta Não Aprovada</h1>
            <p style="color: #333; font-size: 16px; line-height: 1.5;">Olá <strong>${data.recipientName}</strong>,</p>
            <p style="color: #333; font-size: 16px; line-height: 1.5;">Lamentamos informar que o seu pedido de conta não foi aprovado.</p>
            <div style="background-color: #fef2f2; border: 1px solid #ef4444; border-radius: 8px; padding: 24px; margin: 24px 0;">
              <p style="color: #333; font-size: 14px; margin: 0;">Se acredita que isto foi um erro, por favor entre em contacto connosco.</p>
            </div>
            <p style="color: #8898aa; font-size: 12px; margin-top: 32px;">Este é um email automático. Por favor, não responda.</p>
          </div>
        `;
        break;

      case "work_order_request_received":
        subject = `Solicitação Recebida - ${data.workOrderReference}`;
        html = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 40px 20px;">
            <h1 style="color: #333; font-size: 24px; margin-bottom: 20px;">Solicitação de Serviço Recebida</h1>
            <p style="color: #333; font-size: 16px; line-height: 1.5;">Olá <strong>${data.recipientName}</strong>,</p>
            <p style="color: #333; font-size: 16px; line-height: 1.5;">A sua solicitação de serviço foi recebida com sucesso e está aguardando aprovação.</p>
            <div style="background-color: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 24px; margin: 24px 0;">
              <p style="color: #f59e0b; font-size: 18px; font-weight: bold; margin: 0 0 8px 0;">${data.workOrderReference}</p>
              <p style="color: #333; font-size: 16px; font-weight: 600; margin: 8px 0;">${data.workOrderTitle}</p>
              <p style="color: #71717a; font-size: 14px; margin: 8px 0 0 0;">Estado: Aguardando Aprovação</p>
            </div>
            <p style="color: #333; font-size: 16px; line-height: 1.5;">Será notificado assim que a sua solicitação for aprovada.</p>
            <p style="color: #8898aa; font-size: 12px; margin-top: 32px;">Este é um email automático. Por favor, não responda.</p>
          </div>
        `;
        break;

      case "work_order_approved":
        subject = `Solicitação Aprovada - ${data.workOrderReference}`;
        html = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 40px 20px;">
            <h1 style="color: #16a34a; font-size: 24px; margin-bottom: 20px;">Solicitação Aprovada!</h1>
            <p style="color: #333; font-size: 16px; line-height: 1.5;">Olá <strong>${data.recipientName}</strong>,</p>
            <p style="color: #333; font-size: 16px; line-height: 1.5;">A sua solicitação de serviço foi aprovada.</p>
            <div style="background-color: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 24px; margin: 24px 0;">
              <p style="color: #16a34a; font-size: 18px; font-weight: bold; margin: 0 0 8px 0;">${data.workOrderReference}</p>
              <p style="color: #333; font-size: 16px; font-weight: 600; margin: 8px 0;">${data.workOrderTitle}</p>
              ${data.scheduledDate ? `<p style="color: #71717a; font-size: 14px; margin: 8px 0 0 0;">Data Agendada: ${data.scheduledDate}</p>` : ''}
            </div>
            <p style="color: #333; font-size: 16px; line-height: 1.5;">A nossa equipa entrará em contacto em breve.</p>
            <p style="color: #8898aa; font-size: 12px; margin-top: 32px;">Este é um email automático. Por favor, não responda.</p>
          </div>
        `;
        break;

      case "work_order_rejected":
        subject = `Solicitação Não Aprovada - ${data.workOrderReference}`;
        html = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 40px 20px;">
            <h1 style="color: #ef4444; font-size: 24px; margin-bottom: 20px;">Solicitação Não Aprovada</h1>
            <p style="color: #333; font-size: 16px; line-height: 1.5;">Olá <strong>${data.recipientName}</strong>,</p>
            <p style="color: #333; font-size: 16px; line-height: 1.5;">Lamentamos informar que a sua solicitação de serviço não foi aprovada.</p>
            <div style="background-color: #fef2f2; border: 1px solid #ef4444; border-radius: 8px; padding: 24px; margin: 24px 0;">
              <p style="color: #ef4444; font-size: 18px; font-weight: bold; margin: 0 0 8px 0;">${data.workOrderReference}</p>
              <p style="color: #333; font-size: 16px; font-weight: 600; margin: 8px 0;">${data.workOrderTitle}</p>
            </div>
            <p style="color: #333; font-size: 16px; line-height: 1.5;">Por favor, entre em contacto connosco para mais informações.</p>
            <p style="color: #8898aa; font-size: 12px; margin-top: 32px;">Este é um email automático. Por favor, não responda.</p>
          </div>
        `;
        break;

      case "work_order_assigned":
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
              ${data.scheduledDate ? `<p style="color: #71717a; font-size: 14px; margin: 8px 0 0 0;">Data Agendada: ${data.scheduledDate}</p>` : ''}
            </div>
            <p style="color: #333; font-size: 16px; line-height: 1.5;">Por favor, aceda ao sistema para ver todos os detalhes.</p>
            <p style="color: #8898aa; font-size: 12px; margin-top: 32px;">Este é um email automático. Por favor, não responda.</p>
          </div>
        `;
        break;

      case "work_order_started":
        subject = `Trabalho Iniciado - ${data.workOrderReference}`;
        html = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 40px 20px;">
            <h1 style="color: #3b82f6; font-size: 24px; margin-bottom: 20px;">Trabalho Iniciado</h1>
            <p style="color: #333; font-size: 16px; line-height: 1.5;">Olá <strong>${data.recipientName}</strong>,</p>
            <p style="color: #333; font-size: 16px; line-height: 1.5;">${data.isClient ? 'O trabalho na sua ordem de serviço foi iniciado.' : 'Um funcionário iniciou o trabalho na seguinte ordem:'}</p>
            <div style="background-color: #f0f9ff; border: 1px solid #3b82f6; border-radius: 8px; padding: 24px; margin: 24px 0;">
              <p style="color: #3b82f6; font-size: 18px; font-weight: bold; margin: 0 0 8px 0;">${data.workOrderReference}</p>
              <p style="color: #333; font-size: 16px; font-weight: 600; margin: 8px 0;">${data.workOrderTitle}</p>
              ${data.employeeName ? `<p style="color: #71717a; font-size: 14px; margin: 8px 0 0 0;">Funcionário: ${data.employeeName}</p>` : ''}
            </div>
            <p style="color: #8898aa; font-size: 12px; margin-top: 32px;">Este é um email automático. Por favor, não responda.</p>
          </div>
        `;
        break;

      case "work_order_paused":
        subject = `Trabalho Pausado - ${data.workOrderReference}`;
        const pauseReasonText = data.pauseReason === 'falta_material' ? 'Falta de Material' :
          data.pauseReason === 'enviado_oficina' ? 'Enviado para Oficina' :
          data.pauseReason === 'enviado_orcamento' ? 'Enviado para Orçamento' :
          data.pauseReason === 'assinatura_gerente' ? 'Aguarda Assinatura do Gerente' : data.pauseReason;
        html = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 40px 20px;">
            <h1 style="color: #f59e0b; font-size: 24px; margin-bottom: 20px;">Trabalho Pausado</h1>
            <p style="color: #333; font-size: 16px; line-height: 1.5;">Olá <strong>${data.recipientName}</strong>,</p>
            <p style="color: #333; font-size: 16px; line-height: 1.5;">${data.isClient ? 'O trabalho na sua ordem de serviço foi temporariamente pausado.' : 'Uma ordem de trabalho foi pausada.'}</p>
            <div style="background-color: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 24px; margin: 24px 0;">
              <p style="color: #f59e0b; font-size: 18px; font-weight: bold; margin: 0 0 8px 0;">${data.workOrderReference}</p>
              <p style="color: #333; font-size: 16px; font-weight: 600; margin: 8px 0;">${data.workOrderTitle}</p>
              <p style="color: #71717a; font-size: 14px; margin: 8px 0 0 0;">Motivo: ${pauseReasonText}</p>
            </div>
            <p style="color: #333; font-size: 16px; line-height: 1.5;">Será notificado quando o trabalho for retomado.</p>
            <p style="color: #8898aa; font-size: 12px; margin-top: 32px;">Este é um email automático. Por favor, não responda.</p>
          </div>
        `;
        break;

      case "work_order_resumed":
        subject = `Trabalho Retomado - ${data.workOrderReference}`;
        html = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 40px 20px;">
            <h1 style="color: #3b82f6; font-size: 24px; margin-bottom: 20px;">Trabalho Retomado</h1>
            <p style="color: #333; font-size: 16px; line-height: 1.5;">Olá <strong>${data.recipientName}</strong>,</p>
            <p style="color: #333; font-size: 16px; line-height: 1.5;">${data.isClient ? 'O trabalho na sua ordem de serviço foi retomado.' : 'O trabalho numa ordem foi retomado.'}</p>
            <div style="background-color: #f0f9ff; border: 1px solid #3b82f6; border-radius: 8px; padding: 24px; margin: 24px 0;">
              <p style="color: #3b82f6; font-size: 18px; font-weight: bold; margin: 0 0 8px 0;">${data.workOrderReference}</p>
              <p style="color: #333; font-size: 16px; font-weight: 600; margin: 8px 0;">${data.workOrderTitle}</p>
            </div>
            <p style="color: #8898aa; font-size: 12px; margin-top: 32px;">Este é um email automático. Por favor, não responda.</p>
          </div>
        `;
        break;

      case "work_order_completed":
        subject = `Ordem Concluída - ${data.workOrderReference}`;
        html = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 40px 20px;">
            <h1 style="color: #333; font-size: 24px; margin-bottom: 20px;">Ordem de Trabalho Concluída</h1>
            <p style="color: #333; font-size: 16px; line-height: 1.5;">Olá <strong>${data.recipientName}</strong>,</p>
            <p style="color: #333; font-size: 16px; line-height: 1.5;">
              ${data.isManager 
                ? 'Uma ordem de trabalho foi concluída:'
                : data.isClient
                  ? 'A sua ordem de trabalho foi concluída:'
                  : 'A ordem de trabalho foi concluída:'}
            </p>
            <div style="background-color: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 24px; margin: 24px 0;">
              <p style="color: #16a34a; font-size: 18px; font-weight: bold; margin: 0 0 8px 0;">${data.workOrderReference}</p>
              <p style="color: #333; font-size: 16px; font-weight: 600; margin: 8px 0;">${data.workOrderTitle}</p>
              ${data.completedBy ? `<p style="color: #71717a; font-size: 14px; margin: 8px 0 0 0;">Concluída por: ${data.completedBy}</p>` : ''}
            </div>
            <p style="color: #333; font-size: 16px; line-height: 1.5;">
              ${data.isClient 
                ? 'Obrigado por confiar nos nossos serviços. Em anexo encontra a folha de obra assinada.'
                : 'Por favor, aceda ao sistema para rever os detalhes.'}
            </p>
            <p style="color: #8898aa; font-size: 12px; margin-top: 32px;">Este é um email automático. Por favor, não responda.</p>
          </div>
        `;
        break;

      case "work_order_created":
        subject = `Nova Ordem Criada - ${data.workOrderReference}`;
        html = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 40px 20px;">
            <h1 style="color: #333; font-size: 24px; margin-bottom: 20px;">Nova Solicitação de Serviço</h1>
            <p style="color: #333; font-size: 16px; line-height: 1.5;">Olá <strong>${data.recipientName}</strong>,</p>
            <p style="color: #333; font-size: 16px; line-height: 1.5;">Uma nova solicitação de serviço foi criada e aguarda a sua aprovação:</p>
            <div style="background-color: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 24px; margin: 24px 0;">
              <p style="color: #f59e0b; font-size: 18px; font-weight: bold; margin: 0 0 8px 0;">${data.workOrderReference}</p>
              <p style="color: #333; font-size: 16px; font-weight: 600; margin: 8px 0;">${data.workOrderTitle}</p>
              <p style="color: #71717a; font-size: 14px; margin: 8px 0 0 0;">Cliente: ${data.clientName || 'N/A'}</p>
            </div>
            <p style="color: #333; font-size: 16px; line-height: 1.5;">Por favor, aceda ao sistema para aprovar ou rejeitar a solicitação.</p>
            <p style="color: #8898aa; font-size: 12px; margin-top: 32px;">Este é um email automático. Por favor, não responda.</p>
          </div>
        `;
        break;

      case "work_order_updated":
        subject = `Ordem Atualizada - ${data.workOrderReference}`;
        html = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 40px 20px;">
            <h1 style="color: #333; font-size: 24px; margin-bottom: 20px;">Ordem de Trabalho Atualizada</h1>
            <p style="color: #333; font-size: 16px; line-height: 1.5;">Olá <strong>${data.recipientName}</strong>,</p>
            <p style="color: #333; font-size: 16px; line-height: 1.5;">${data.isClient ? 'A sua ordem de trabalho foi atualizada:' : 'Uma ordem de trabalho foi atualizada:'}</p>
            <div style="background-color: #f0f9ff; border: 1px solid #3b82f6; border-radius: 8px; padding: 24px; margin: 24px 0;">
              <p style="color: #3b82f6; font-size: 18px; font-weight: bold; margin: 0 0 8px 0;">${data.workOrderReference}</p>
              <p style="color: #333; font-size: 16px; font-weight: 600; margin: 8px 0;">${data.workOrderTitle}</p>
              ${data.changes ? `<p style="color: #71717a; font-size: 14px; margin: 8px 0 0 0;">Alterações: ${data.changes}</p>` : ''}
            </div>
            <p style="color: #333; font-size: 16px; line-height: 1.5;">Por favor, aceda ao sistema para ver todos os detalhes.</p>
            <p style="color: #8898aa; font-size: 12px; margin-top: 32px;">Este é um email automático. Por favor, não responda.</p>
          </div>
        `;
        break;

      case "work_order_assignment_removed":
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
        break;

      case "work_order_scheduled":
        subject = `Ordem Agendada - ${data.workOrderReference}`;
        html = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 40px 20px;">
            <h1 style="color: #333; font-size: 24px; margin-bottom: 20px;">Ordem de Trabalho Agendada</h1>
            <p style="color: #333; font-size: 16px; line-height: 1.5;">Olá <strong>${data.recipientName}</strong>,</p>
            <p style="color: #333; font-size: 16px; line-height: 1.5;">${data.isClient ? 'A sua ordem de trabalho foi agendada:' : 'Uma ordem de trabalho foi agendada:'}</p>
            <div style="background-color: #f0f9ff; border: 1px solid #3b82f6; border-radius: 8px; padding: 24px; margin: 24px 0;">
              <p style="color: #3b82f6; font-size: 18px; font-weight: bold; margin: 0 0 8px 0;">${data.workOrderReference}</p>
              <p style="color: #333; font-size: 16px; font-weight: 600; margin: 8px 0;">${data.workOrderTitle}</p>
              ${data.scheduledDate ? `<p style="color: #16a34a; font-size: 14px; font-weight: bold; margin: 8px 0 0 0;">📅 Data: ${data.scheduledDate}</p>` : ''}
            </div>
            <p style="color: #8898aa; font-size: 12px; margin-top: 32px;">Este é um email automático. Por favor, não responda.</p>
          </div>
        `;
        break;

      case "work_order_missing_material":
        subject = `Falta de Material - ${data.workOrderReference}`;
        html = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 40px 20px;">
            <h1 style="color: #ef4444; font-size: 24px; margin-bottom: 20px;">⚠️ Falta de Material</h1>
            <p style="color: #333; font-size: 16px; line-height: 1.5;">Olá <strong>${data.recipientName}</strong>,</p>
            <p style="color: #333; font-size: 16px; line-height: 1.5;">${data.isClient ? 'A sua ordem de trabalho foi pausada devido a falta de material.' : 'Uma ordem de trabalho foi pausada devido a falta de material.'}</p>
            <div style="background-color: #fef2f2; border: 1px solid #ef4444; border-radius: 8px; padding: 24px; margin: 24px 0;">
              <p style="color: #ef4444; font-size: 18px; font-weight: bold; margin: 0 0 8px 0;">${data.workOrderReference}</p>
              <p style="color: #333; font-size: 16px; font-weight: 600; margin: 8px 0;">${data.workOrderTitle}</p>
              ${data.employeeName ? `<p style="color: #71717a; font-size: 14px; margin: 8px 0 0 0;">Funcionário: ${data.employeeName}</p>` : ''}
            </div>
            <div style="background-color: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 24px; margin: 24px 0;">
              <p style="color: #f59e0b; font-size: 14px; font-weight: bold; margin: 0 0 8px 0;">📦 Material em Falta:</p>
              <p style="color: #333; font-size: 14px; margin: 0; white-space: pre-wrap;">${data.missingMaterial || 'Não especificado'}</p>
            </div>
            <p style="color: #333; font-size: 16px; line-height: 1.5;">${data.isClient ? 'Entraremos em contacto assim que o material estiver disponível.' : 'Por favor, providencie o material necessário.'}</p>
            <p style="color: #8898aa; font-size: 12px; margin-top: 32px;">Este é um email automático. Por favor, não responda.</p>
          </div>
        `;
        break;

      default:
        throw new Error("Invalid notification type");
    }

    // Handle PDF attachment for completed work orders
    let attachments: any[] | undefined;
    if (type === "work_order_completed" && data.pdfUrl) {
      try {
        console.log("Downloading PDF from storage:", data.pdfUrl);
        
        const urlParts = data.pdfUrl.split('/work-order-attachments/');
        const filePath = urlParts[1];
        
        const { data: pdfData, error: downloadError } = await supabaseAdmin.storage
          .from("work-order-attachments")
          .download(filePath);

        if (downloadError) {
          console.error("Error downloading PDF:", downloadError);
        } else if (pdfData) {
          const buffer = await pdfData.arrayBuffer();
          const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
          
          attachments = [{
            content: base64,
            filename: `${data.workOrderReference}_concluido.pdf`,
          }];
          
          console.log("PDF attached to email successfully");
        }
      } catch (pdfError) {
        console.error("Error processing PDF attachment:", pdfError);
      }
    }

    const response = await sendEmailViaResend(to, subject, html, attachments);

    if (!response.ok) {
      const result = await response.text();
      console.error("Error sending email:", result);
      
      await supabaseAdmin.from('email_logs').insert({
        user_id: userId,
        email: to,
        subject,
        notification_type: type,
        status: 'failed',
        error_message: result,
        work_order_id: workOrderId,
      });

      // Don't throw - log the error but return success to avoid blocking the caller
      console.error("Email failed but not blocking:", result);
      return new Response(JSON.stringify({ success: false, error: "Email sending failed" }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const resultJson = await response.json();
    console.log("Email sent successfully to:", to, resultJson);

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
    
    // Return 200 with error info to avoid blocking callers
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
