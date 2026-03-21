import { jsPDF } from "jspdf";
import { supabase } from "@/integrations/supabase/client";
import type { ChecklistItem, Measurement, Material } from "./maintenanceReportDefaults";

interface ReportData {
  report_type: string;
  report_date: string | null;
  technician_name: string | null;
  technician_id: string | null;
  supervisor_name: string | null;
  start_time: string | null;
  end_time: string | null;
  building: string | null;
  floor_number: string | null;
  specific_location: string | null;
  equipment_name: string | null;
  equipment_serial: string | null;
  designation: string | null;
  designation_serial: string | null;
  checklist_items: ChecklistItem[];
  measurements: Measurement[];
  materials: Material[];
  general_observations: string | null;
  recommendations: string | null;
  next_maintenance: string | null;
  approved_by_name: string | null;
  approval_date: string | null;
  technician_signature: string | null;
  supervisor_signature: string | null;
  work_order_reference: string;
}

export function generateMaintenanceReportPDF(data: ReportData): Blob {
  const doc = new jsPDF();
  const isElectricity = data.report_type === "electricity";
  const isCctv = data.report_type === "cctv";
  const typeLabel = isElectricity ? "Eletricidade" : isCctv ? "CCTV" : "Climatizacao";
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let y = 15;

  const checkPageBreak = (needed: number) => {
    if (y + needed > 275) {
      doc.addPage();
      y = 15;
    }
  };

  const drawSectionHeader = (title: string) => {
    checkPageBreak(15);
    doc.setFillColor(240, 245, 255);
    doc.roundedRect(margin, y - 4, contentWidth, 10, 2, 2, "F");
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 64, 175);
    doc.text(title, margin + 3, y + 3);
    doc.setTextColor(0, 0, 0);
    y += 12;
  };

  const drawField = (label: string, value: string, x: number, width: number) => {
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text(label, x, y);
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "normal");
    const val = value || "-";
    doc.text(val, x, y + 5);
    doc.setDrawColor(200, 200, 200);
    doc.line(x, y + 7, x + width - 5, y + 7);
  };

  // === HEADER ===
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  const title = `Folha de Manutencao - ${typeLabel}`;
  doc.text(title, pageWidth / 2, y, { align: "center" });
  y += 6;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text(`OT: ${data.work_order_reference}`, pageWidth / 2, y, { align: "center" });
  doc.setTextColor(0, 0, 0);
  y += 10;

  // === IDENTIFICATION ===
  drawSectionHeader("Identificacao do Relatorio");
  const halfW = contentWidth / 2;
  drawField("Nº Relatório", data.work_order_reference, margin, halfW);
  drawField("Data", data.report_date ? new Date(data.report_date).toLocaleDateString("pt-PT") : "", margin + halfW, halfW);
  y += 14;
  drawField("Tipo de Manutencao", typeLabel, margin, halfW);
  drawField("Prioridade", "", margin + halfW, halfW);
  y += 14;

  // === TECHNICIAN ===
  drawSectionHeader("Dados do Tecnico");
  drawField("Nome do Tecnico", data.technician_name || "", margin, halfW);
  drawField("ID / No Funcionario", data.technician_id || "", margin + halfW, halfW);
  y += 14;
  drawField("Supervisor", data.supervisor_name || "", margin, halfW);
  y += 14;
  drawField("Hora de Inicio", data.start_time || "", margin, halfW);
  drawField("Hora de Fim", data.end_time || "", margin + halfW, halfW);
  y += 14;

  // === LOCATION ===
  drawSectionHeader("Localizacao & Equipamento");
  drawField("Edificio", data.building || "", margin, halfW);
  drawField("Piso / Zona", data.floor_number || "", margin + halfW, halfW);
  y += 14;
  drawField("Localizacao Especifica", data.specific_location || "", margin, contentWidth);
  y += 14;
  drawField("Equipamento", data.equipment_name || "", margin, halfW);
  drawField("No Serie", data.equipment_serial || "", margin + halfW, halfW);
  y += 14;
  drawField("Designacao", data.designation || "", margin, halfW);
  drawField("No Serie", data.designation_serial || "", margin + halfW, halfW);
  y += 14;

  // === CHECKLIST ===
  const checklistLabel = isElectricity ? "Eletrica" : isCctv ? "CCTV" : "AVAC";
  drawSectionHeader(`Checklist de Inspecao ${checklistLabel}`);
  for (const item of data.checklist_items) {
    checkPageBreak(14);
    const check = item.checked ? "[X]" : "[ ]";
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`${check} ${item.label}`, margin + 2, y);
    y += 5;
    if (item.observation) {
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      const obsLines = doc.splitTextToSize(`Obs: ${item.observation}`, contentWidth - 10);
      doc.text(obsLines, margin + 8, y);
      y += obsLines.length * 4;
      doc.setTextColor(0, 0, 0);
    }
    y += 3;
  }

  // === MEASUREMENTS ===
  checkPageBreak(30);
  drawSectionHeader(`Medicoes ${checklistLabel}`);
  
  // Table header
  doc.setFillColor(230, 235, 245);
  doc.rect(margin, y - 3, contentWidth, 8, "F");
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("Parametro", margin + 3, y + 2);
  doc.text("Valor", margin + contentWidth * 0.55, y + 2);
  doc.text("Unidade", margin + contentWidth * 0.8, y + 2);
  y += 10;

  for (const m of data.measurements) {
    checkPageBreak(8);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(m.parameter, margin + 3, y);
    doc.text(m.value || "-", margin + contentWidth * 0.55, y);
    doc.text(m.unit, margin + contentWidth * 0.8, y);
    doc.setDrawColor(230, 230, 230);
    doc.line(margin, y + 2, margin + contentWidth, y + 2);
    y += 7;
  }
  y += 5;

  // === MATERIALS ===
  if (data.materials.length > 0) {
    checkPageBreak(20);
    drawSectionHeader("Materiais Utilizados");
    for (const mat of data.materials) {
      checkPageBreak(8);
      doc.setFontSize(9);
      doc.text(`- ${mat.description} - Qtd: ${mat.quantity} ${mat.unit}`, margin + 3, y);
      y += 7;
    }
    y += 5;
  }

  // === OBSERVATIONS ===
  checkPageBreak(25);
  drawSectionHeader("Observacoes & Recomendacoes");
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  if (data.general_observations) {
    doc.setFont("helvetica", "bold");
    doc.text("Observacoes Gerais:", margin, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    const obsLines = doc.splitTextToSize(data.general_observations, contentWidth);
    doc.text(obsLines, margin, y);
    y += obsLines.length * 5 + 5;
  }
  if (data.recommendations) {
    checkPageBreak(15);
    doc.setFont("helvetica", "bold");
    doc.text("Recomendacoes:", margin, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    const recLines = doc.splitTextToSize(data.recommendations, contentWidth);
    doc.text(recLines, margin, y);
    y += recLines.length * 5 + 5;
  }

  // === APPROVAL ===
  checkPageBreak(35);
  drawSectionHeader("Aprovacao & Seguimento");
  drawField("Proxima Manutencao", data.next_maintenance || "", margin, halfW);
  y += 14;
  drawField("Aprovado por", data.approved_by_name || "", margin, halfW);
  drawField("Data de Aprovacao", data.approval_date ? new Date(data.approval_date).toLocaleDateString("pt-PT") : "", margin + halfW, halfW);
  y += 14;

  // === SIGNATURES ===
  checkPageBreak(45);
  drawSectionHeader("Assinaturas");
  
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("Assinatura do Tecnico", margin, y);
  doc.text("Assinatura do Supervisor", margin + halfW, y);
  y += 5;

  if (data.technician_signature) {
    try {
      const format = data.technician_signature.includes("image/jpeg") ? "JPEG" : "PNG";
      doc.addImage(data.technician_signature, format, margin, y, 70, 25);
    } catch (e) {
      console.error("Error adding technician signature:", e);
    }
  }
  if (data.supervisor_signature) {
    try {
      const format = data.supervisor_signature.includes("image/jpeg") ? "JPEG" : "PNG";
      doc.addImage(data.supervisor_signature, format, margin + halfW, y, 70, 25);
    } catch (e) {
      console.error("Error adding supervisor signature:", e);
    }
  }
  y += 30;

  // Footer
  doc.setFontSize(8);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(150, 150, 150);
  doc.text(
    `Documento gerado automaticamente em ${new Date().toLocaleString("pt-PT")}`,
    pageWidth / 2,
    285,
    { align: "center" }
  );

  return doc.output("blob");
}

export async function uploadMaintenanceReportPDF(
  workOrderId: string,
  pdfBlob: Blob,
  reportType: string,
  reference: string,
  userId: string
): Promise<string> {
  const typeMap: Record<string, string> = { electricity: "eletricidade", hvac: "climatizacao", cctv: "cctv", generator: "gerador" };
  const typeLabel2 = typeMap[reportType] || reportType;
  const fileName = `${reference}_relatorio_${typeLabel}_${Date.now()}.pdf`;
  const filePath = `${workOrderId}/${fileName}`;

  const { error } = await supabase.storage
    .from("work-order-attachments")
    .upload(filePath, pdfBlob, {
      contentType: "application/pdf",
      upsert: false,
    });

  if (error) throw error;

  // Save to attachments table
  await supabase.from("attachments").insert({
    work_order_id: workOrderId,
    uploaded_by: userId,
    url: filePath,
    filename: fileName,
  });

  return filePath;
}
