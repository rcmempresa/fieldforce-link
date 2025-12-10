import { jsPDF } from "jspdf";
import { supabase } from "@/integrations/supabase/client";

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
  employeeName: string,
  hoursWorked: number,
  notes: string | null
): Promise<Blob> {
  const doc = new jsPDF();
  
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
  doc.text(`Descrição: ${workOrderData.description || "N/A"}`, 20, 66);
  doc.text(`Tipo de Serviço: ${workOrderData.service_type}`, 20, 74);
  doc.text(`Prioridade: ${workOrderData.priority}`, 20, 82);
  doc.text(`Status: Concluída`, 20, 90);
  
  // Client Information
  doc.setFont("helvetica", "bold");
  doc.text("Informações do Cliente:", 20, 102);
  
  doc.setFont("helvetica", "normal");
  doc.text(`Nome: ${workOrderData.client_name}`, 20, 110);
  doc.text(`Email: ${workOrderData.client_email}`, 20, 118);
  
  // Completion Details
  doc.setFont("helvetica", "bold");
  doc.text("Detalhes da Conclusão:", 20, 130);
  
  doc.setFont("helvetica", "normal");
  doc.text(`Concluído por: ${employeeName}`, 20, 138);
  doc.text(`Horas trabalhadas: ${formatDecimalHoursToTime(hoursWorked)}`, 20, 146);
  doc.text(`Data de conclusão: ${new Date(workOrderData.completed_at).toLocaleString("pt-BR")}`, 20, 154);
  
  if (notes) {
    doc.text(`Notas: ${notes}`, 20, 162, { maxWidth: 170 });
  }
  
  // Client Signature
  doc.setFont("helvetica", "bold");
  doc.text("Assinatura do Cliente:", 20, 180);
  
  if (signatureDataUrl) {
    doc.addImage(signatureDataUrl, "PNG", 20, 185, 80, 30);
  }
  
  // Footer
  doc.setFontSize(9);
  doc.setFont("helvetica", "italic");
  doc.text(
    `Documento gerado automaticamente em ${new Date().toLocaleString("pt-BR")}`,
    105,
    280,
    { align: "center" }
  );
  
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
