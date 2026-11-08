import { jsPDF } from "jspdf";
import { supabase } from "@/integrations/supabase/client";
import logoAsset from "@/assets/nr-techsolucion-logo.png.asset.json";

interface EmployeeHours {
  name: string;
  hours: number;
  laborHours?: number;
  afterHours?: number;
}

interface WorkOrderData {
  reference: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  service_type: string;
  scheduled_date: string | null;
  client_name: string;
  client_email: string;
  assigned_employees: Array<{ name: string }>;
  total_hours: number | null;
  created_at: string;
  completed_at: string;
  labor_hours_worked?: number;
  after_hours_worked?: number;
  equipments?: Array<{ name?: string | null; brand?: string | null; model?: string | null; serial_number?: string | null; location?: string | null; unit_part?: string | null }>;
}


function formatDecimalHoursToTime(decimalHours: number): string {
  const totalMinutes = Math.round(decimalHours * 60);
  if (totalMinutes < 60) {
    return `${totalMinutes} min`;
  }
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes.toString().padStart(2, '0')}min`;
}

export async function generateWorkOrderPDF(
  workOrderData: WorkOrderData,
  signatureDataUrl: string,
  employeeHoursList: EmployeeHours[],
  totalHoursWorked: number,
  notes: string | null
): Promise<Blob> {
  const doc = new jsPDF();

  // Company logo (top-left)
  try {
    const res = await fetch(logoAsset.url);
    const blob = await res.blob();
    const dataUrl: string = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
    doc.addImage(dataUrl, "PNG", 10, 4, 42, 24.6);
  } catch (e) {
    console.warn("Logo not loaded for WO PDF", e);
  }
  
  // Header
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("Folha de OT", 105, 20, { align: "center" });
  
  // Work Order Reference
  doc.setFontSize(14);
  doc.text(`Referência: ${workOrderData.reference}`, 20, 35);
  
  // Line separator
  doc.setLineWidth(0.5);
  doc.line(20, 40, 190, 40);
  
  // Work Order Details
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Detalhes da Ordem:", 20, 50);
  
  doc.setFont("helvetica", "normal");
  doc.text(`Título: ${workOrderData.title}`, 20, 58);
  const descriptionText = workOrderData.description || "N/A";
  const splitDescription = doc.splitTextToSize(`Descrição: ${descriptionText}`, 170);
  doc.text(splitDescription, 20, 66);
  const descEndY = 66 + splitDescription.length * 6;
  
  doc.text(`Tipo de Serviço: ${workOrderData.service_type}`, 20, descEndY + 2);
  doc.text(`Prioridade: ${workOrderData.priority}`, 20, descEndY + 10);
  doc.text(`Status: Concluída`, 20, descEndY + 18);

  
  // Client Information
  let sectionY = descEndY + 30;
  doc.setFont("helvetica", "bold");
  doc.text("Informações do Cliente:", 20, sectionY);
  
  doc.setFont("helvetica", "normal");
  doc.text(`Nome: ${workOrderData.client_name}`, 20, sectionY + 8);
  doc.text(`Email: ${workOrderData.client_email}`, 20, sectionY + 16);
  
  // Equipments
  let eqY = sectionY + 28;
  const eqs = workOrderData.equipments || [];
  if (eqs.length) {
    doc.setFont("helvetica", "bold");
    doc.text("Equipamentos Intervencionados:", 20, eqY);
    eqY += 8;
    doc.setFont("helvetica", "normal");
    for (const e of eqs) {
      const part = e.unit_part === "indoor" ? " (Unidade interior)" : e.unit_part === "outdoor" ? " (Unidade exterior)" : "";
      const head = [e.name, [e.brand, e.model].filter(Boolean).join(" ")].filter(Boolean).join(" - ") || "Equipamento";
      const extra = [e.serial_number ? `N.º série: ${e.serial_number}` : "", e.location ? `Local: ${e.location}` : ""].filter(Boolean).join("  |  ");
      const lines = doc.splitTextToSize(`• ${head}${part}`, 165);
      doc.text(lines, 25, eqY);
      eqY += lines.length * 6;
      if (extra) {
        doc.setFontSize(9);
        doc.text(extra, 30, eqY);
        doc.setFontSize(11);
        eqY += 6;
      }
      eqY += 1;
    }
    eqY += 5;
  }

  // Completion Details
  doc.setFont("helvetica", "bold");
  doc.text("Detalhes da Conclusão:", 20, eqY);
  
  doc.setFont("helvetica", "normal");
  
  // Per-employee breakdown
  let empY = eqY + 8;
  for (const emp of employeeHoursList) {
    doc.text(`• ${emp.name}: ${formatDecimalHoursToTime(emp.hours)}`, 25, empY);
    empY += 6;
    doc.setFontSize(9);
    doc.text(
      `Laboral: ${formatDecimalHoursToTime(emp.laborHours ?? 0)}  |  Pós-laboral: ${formatDecimalHoursToTime(emp.afterHours ?? 0)}`,
      30,
      empY
    );
    doc.setFontSize(11);
    empY += 7;
  }
  
  doc.setFont("helvetica", "bold");
  doc.text(`Total: ${formatDecimalHoursToTime(totalHoursWorked)}`, 20, empY + 2);
  empY += 10;

  doc.setFont("helvetica", "normal");
  const laborWorked = workOrderData.labor_hours_worked ?? 0;
  const afterWorked = workOrderData.after_hours_worked ?? 0;
  if (laborWorked > 0 || afterWorked > 0) {
    doc.text(`Horas laborais: ${formatDecimalHoursToTime(laborWorked)}`, 25, empY);
    empY += 7;
    doc.text(`Horas pós-laborais: ${formatDecimalHoursToTime(afterWorked)}`, 25, empY);
    empY += 10;
  }

  
  doc.setFont("helvetica", "normal");
  doc.text(`Data de conclusão: ${new Date(workOrderData.completed_at).toLocaleString("pt-BR")}`, 20, empY);
  
  // Observations section
  let currentY = empY + 12;
  
  if (notes) {
    doc.setFont("helvetica", "bold");
    doc.text("Observações:", 20, currentY);
    currentY += 8;
    
    doc.setFont("helvetica", "normal");
    const splitNotes: string[] = doc.splitTextToSize(notes, 170);
    for (const line of splitNotes) {
      if (currentY > 272) { doc.addPage(); currentY = 20; }
      doc.text(line, 20, currentY);
      currentY += 6;
    }
    currentY += 10;
  }
  
  // Client Signature (new page if it doesn't fit above the footer)
  let sigLabelY = Math.max(currentY, 180);
  if (sigLabelY + 40 > 272) {
    doc.addPage();
    sigLabelY = 20;
  }
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Assinatura do Cliente:", 20, sigLabelY);
  if (signatureDataUrl) {
    try {
      doc.addImage(signatureDataUrl, "PNG", 20, sigLabelY + 5, 80, 30);
    } catch (e) {
      console.warn("Signature not added to WO PDF", e);
    }
  }

  // Footer on every page
  const generatedAt = new Date().toLocaleString("pt-BR");
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(9);
    doc.setFont("helvetica", "italic");
    doc.text(`Documento gerado automaticamente em ${generatedAt}`, 105, 285, { align: "center" });
  }
  
  return doc.output("blob");
}

export async function uploadWorkOrderPDF(
  workOrderId: string,
  pdfBlob: Blob,
  reference: string,
  userId: string
): Promise<string> {
  const fileName = `${reference}_concluido_${Date.now()}.pdf`;
  const filePath = `${workOrderId}/${fileName}`;
  
  const { data, error } = await supabase.storage
    .from("work-order-attachments")
    .upload(filePath, pdfBlob, {
      contentType: "application/pdf",
      upsert: false,
    });
  
  if (error) throw error;
  
  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from("work-order-attachments")
    .getPublicUrl(filePath);
  
  // Save to attachments table
  const { error: attachmentError } = await supabase
    .from("attachments")
    .insert({
      work_order_id: workOrderId,
      uploaded_by: userId,
      url: filePath,
      filename: fileName,
    });
  
  if (attachmentError) throw attachmentError;
  
  return publicUrl;
}
