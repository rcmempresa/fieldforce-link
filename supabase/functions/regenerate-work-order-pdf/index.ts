import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function formatDecimalHoursToTime(decimalHours: number): string {
  const totalMinutes = Math.round(decimalHours * 60);
  if (totalMinutes < 60) {
    return `${totalMinutes} min`;
  }
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes.toString().padStart(2, "0")}min`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { workOrderIds } = await req.json();

    if (!workOrderIds || !Array.isArray(workOrderIds)) {
      throw new Error("workOrderIds array is required");
    }

    const results = [];

    for (const workOrderId of workOrderIds) {
      // Get work order details
      const { data: wo, error: woError } = await supabase
        .from("work_orders")
        .select(`
          *, 
          client:profiles!work_orders_client_id_fkey(name, id),
          assignments:work_order_assignments(user:profiles!work_order_assignments_user_id_fkey(name))
        `)
        .eq("id", workOrderId)
        .single();

      if (woError || !wo) {
        results.push({ workOrderId, error: woError?.message || "Not found" });
        continue;
      }

      // Get client email
      let clientEmail = "N/A";
      if (wo.client_id) {
        const { data: userData } = await supabase.auth.admin.getUserById(wo.client_id);
        clientEmail = userData?.user?.email || "N/A";
      }

      // Get all time entries grouped by employee
      const { data: timeEntries } = await supabase
        .from("time_entries")
        .select("duration_hours, user_id, profiles!time_entries_user_id_fkey(name)")
        .eq("work_order_id", workOrderId);

      const employeeHoursMap = new Map<string, { name: string; hours: number }>();
      for (const entry of timeEntries || []) {
        const empName = (entry as any).profiles?.name || "N/A";
        const existing = employeeHoursMap.get(entry.user_id) || { name: empName, hours: 0 };
        existing.hours += entry.duration_hours || 0;
        employeeHoursMap.set(entry.user_id, existing);
      }
      const employeeHoursList = Array.from(employeeHoursMap.values());
      const totalHoursWorked = employeeHoursList.reduce((sum, e) => sum + e.hours, 0);

      // Get last time entry end_time as completed_at
      const { data: lastEntry } = await supabase
        .from("time_entries")
        .select("end_time")
        .eq("work_order_id", workOrderId)
        .not("end_time", "is", null)
        .order("end_time", { ascending: false })
        .limit(1)
        .single();

      const completedAt = lastEntry?.end_time || wo.updated_at;

      // Get the notes from time entries
      const { data: noteEntries } = await supabase
        .from("time_entries")
        .select("note")
        .eq("work_order_id", workOrderId)
        .not("note", "is", null);
      
      const notes = noteEntries?.map(e => e.note).filter(Boolean).join("; ") || null;

      // Generate PDF using a simple text-based approach since jsPDF isn't available in Deno
      // We'll use a simple PDF generator
      const pdfContent = generateSimplePDF({
        reference: wo.reference || "N/A",
        title: wo.title,
        description: wo.description,
        serviceType: wo.service_type,
        priority: wo.priority,
        clientName: (wo.client as any)?.name || "N/A",
        clientEmail,
        employeeHoursList,
        totalHoursWorked,
        completedAt,
        notes,
        assignedEmployees: (wo.assignments as any[])?.map((a: any) => a.user?.name) || [],
      });

      // Upload PDF
      const fileName = `${wo.reference}_concluido_corrigido_${Date.now()}.pdf`;
      const filePath = `${workOrderId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("work-order-attachments")
        .upload(filePath, pdfContent, {
          contentType: "application/pdf",
          upsert: false,
        });

      if (uploadError) {
        results.push({ workOrderId, reference: wo.reference, error: uploadError.message });
        continue;
      }

      // Get the first manager user for uploaded_by
      const { data: manager } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "manager")
        .eq("approved", true)
        .limit(1)
        .single();

      // Save attachment record
      await supabase.from("attachments").insert({
        work_order_id: workOrderId,
        uploaded_by: manager?.user_id || wo.created_by,
        url: filePath,
        filename: fileName,
      });

      results.push({ workOrderId, reference: wo.reference, success: true, fileName });
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// Minimal PDF generator (raw PDF spec)
function generateSimplePDF(data: {
  reference: string;
  title: string;
  description: string | null;
  serviceType: string;
  priority: string;
  clientName: string;
  clientEmail: string;
  employeeHoursList: { name: string; hours: number }[];
  totalHoursWorked: number;
  completedAt: string;
  notes: string | null;
  assignedEmployees: string[];
}): Uint8Array {
  const lines: string[] = [];
  
  lines.push("Folha de OT");
  lines.push("");
  lines.push(`Referencia: ${data.reference}`);
  lines.push("─────────────────────────────────────────");
  lines.push("");
  lines.push("Detalhes da Ordem:");
  lines.push(`Titulo: ${data.title}`);
  lines.push(`Descricao: ${data.description || "N/A"}`);
  lines.push(`Tipo de Servico: ${data.serviceType}`);
  lines.push(`Prioridade: ${data.priority}`);
  lines.push(`Status: Concluida`);
  lines.push("");
  lines.push("Informacoes do Cliente:");
  lines.push(`Nome: ${data.clientName}`);
  lines.push(`Email: ${data.clientEmail}`);
  lines.push("");
  lines.push("Detalhes da Conclusao:");
  
  for (const emp of data.employeeHoursList) {
    lines.push(`  * ${emp.name}: ${formatDecimalHoursToTime(emp.hours)}`);
  }
  
  lines.push(`Total: ${formatDecimalHoursToTime(data.totalHoursWorked)}`);
  lines.push("");
  lines.push(`Data de conclusao: ${new Date(data.completedAt).toLocaleString("pt-PT")}`);
  
  if (data.notes) {
    lines.push("");
    lines.push("Observacoes:");
    lines.push(data.notes);
  }

  lines.push("");
  lines.push("Assinatura do Cliente: [Documento corrigido - assinatura no documento original]");
  lines.push("");
  lines.push(`Documento gerado automaticamente em ${new Date().toLocaleString("pt-PT")}`);

  // Build a proper PDF
  return buildPDF(lines);
}

function buildPDF(textLines: string[]): Uint8Array {
  const encoder = new TextEncoder();
  
  // Simple PDF structure
  const objects: string[] = [];
  const offsets: number[] = [];
  
  // Object 1: Catalog
  objects.push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  
  // Object 2: Pages
  objects.push("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");
  
  // Build content stream
  const contentLines: string[] = [];
  contentLines.push("BT");
  contentLines.push("/F1 11 Tf");
  
  let y = 780;
  for (const line of textLines) {
    if (y < 50) break; // Don't go below page
    // Escape special PDF characters
    const escaped = line
      .replace(/\\/g, "\\\\")
      .replace(/\(/g, "\\(")
      .replace(/\)/g, "\\)")
      // Handle Portuguese characters by simplifying
      .replace(/[áàâã]/g, "a")
      .replace(/[éèê]/g, "e")
      .replace(/[íìî]/g, "i")
      .replace(/[óòôõ]/g, "o")
      .replace(/[úùû]/g, "u")
      .replace(/[ç]/g, "c")
      .replace(/[ÁÀÂÃ]/g, "A")
      .replace(/[ÉÈÊË]/g, "E")
      .replace(/[ÍÌÎÏ]/g, "I")
      .replace(/[ÓÒÔÕ]/g, "O")
      .replace(/[ÚÙÛÜ]/g, "U")
      .replace(/[Ç]/g, "C")
      .replace(/─/g, "-");
    
    // Title line bigger
    if (line === "Folha de OT") {
      contentLines.push("/F1 20 Tf");
      contentLines.push(`1 0 0 1 200 ${y} Tm`);
      contentLines.push(`(${escaped}) Tj`);
      contentLines.push("/F1 11 Tf");
      y -= 30;
    } else if (line === "" ) {
      y -= 10;
    } else if (line.startsWith("Detalhes da Ordem:") || line.startsWith("Informacoes do Cliente:") || line.startsWith("Detalhes da Conclusao:") || line.startsWith("Observacoes:") || line.startsWith("Total:")) {
      contentLines.push("/F1 12 Tf");
      contentLines.push(`1 0 0 1 40 ${y} Tm`);
      contentLines.push(`(${escaped}) Tj`);
      contentLines.push("/F1 11 Tf");
      y -= 16;
    } else {
      contentLines.push(`1 0 0 1 40 ${y} Tm`);
      contentLines.push(`(${escaped}) Tj`);
      y -= 14;
    }
  }
  
  contentLines.push("ET");
  const contentStream = contentLines.join("\n");
  
  // Object 3: Page
  objects.push(`3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n`);
  
  // Object 4: Content stream
  objects.push(`4 0 obj\n<< /Length ${contentStream.length} >>\nstream\n${contentStream}\nendstream\nendobj\n`);
  
  // Object 5: Font
  objects.push("5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n");
  
  // Build final PDF
  let pdf = "%PDF-1.4\n";
  
  for (let i = 0; i < objects.length; i++) {
    offsets.push(pdf.length);
    pdf += objects[i];
  }
  
  const xrefOffset = pdf.length;
  pdf += "xref\n";
  pdf += `0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (const offset of offsets) {
    pdf += `${offset.toString().padStart(10, "0")} 00000 n \n`;
  }
  
  pdf += "trailer\n";
  pdf += `<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  pdf += "startxref\n";
  pdf += `${xrefOffset}\n`;
  pdf += "%%EOF";
  
  return encoder.encode(pdf);
}
