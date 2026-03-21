import { jsPDF } from "jspdf";
import type { ChecklistItem, Measurement, Material, GeneratorData } from "./maintenanceReportDefaults";

export interface GeneratorReportData {
  report_date: string | null;
  technician_name: string | null;
  technician_id: string | null;
  supervisor_name: string | null;
  start_time: string | null;
  end_time: string | null;
  building: string | null;
  floor_number: string | null;
  specific_location: string | null;
  generatorData: GeneratorData;
  motorChecklist: ChecklistItem[];
  electricalChecklist: ChecklistItem[];
  motorMeasurements: Measurement[];
  electricalMeasurements: Measurement[];
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

export function generateGeneratorReportPDF(data: GeneratorReportData): Blob {
  const doc = new jsPDF();
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
    doc.setFillColor(30, 50, 80);
    doc.roundedRect(margin, y - 4, contentWidth, 10, 2, 2, "F");
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
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
    doc.text(value || "-", x, y + 5);
    doc.setDrawColor(200, 200, 200);
    doc.line(x, y + 7, x + width - 5, y + 7);
  };

  const halfW = contentWidth / 2;

  // === HEADER ===
  doc.setFillColor(30, 50, 80);
  doc.rect(0, 0, pageWidth, 28, "F");
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text("FICHA DE MANUTENCAO GERADOR", margin, 12);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Grupo Gerador: ${data.generatorData.brand || ""} ${data.generatorData.model || ""}`, margin, 19);
  // Badge
  doc.setFillColor(200, 50, 50);
  doc.roundedRect(pageWidth - 45, 6, 30, 8, 2, 2, "F");
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text("GERADOR", pageWidth - 30, 12, { align: "center" });
  doc.setTextColor(0, 0, 0);
  y = 35;

  // === IDENTIFICATION ===
  drawSectionHeader("IDENTIFICACAO DO RELATORIO");
  drawField("OT/N. Relatorio", data.work_order_reference, margin, halfW);
  drawField("Data", data.report_date ? new Date(data.report_date).toLocaleDateString("pt-PT") : "", margin + halfW, halfW);
  y += 14;

  // === GENERATOR DATA ===
  drawSectionHeader("DADOS DO GRUPO GERADOR");
  drawField("Marca/Fabricante", data.generatorData.brand, margin, halfW);
  drawField("Modelo", data.generatorData.model, margin + halfW, halfW);
  y += 14;
  drawField("N. Serie", data.generatorData.serial_number, margin, halfW);
  drawField("Potencia (kVA)", data.generatorData.kva_power, margin + halfW, halfW);
  y += 14;
  drawField("Tipo de Combustivel", data.generatorData.fuel_type, margin, halfW);
  drawField("Contador de Horas", data.generatorData.hours_counter, margin + halfW, halfW);
  y += 14;

  // === TECHNICIAN & LOCATION ===
  drawSectionHeader("DADOS DO TECNICO & LOCALIZACAO");
  drawField("Tecnico", data.technician_name || "", margin, halfW);
  drawField("ID/Funcionario", data.technician_id || "", margin + halfW, halfW);
  y += 14;
  drawField("Supervisor", data.supervisor_name || "", margin, halfW);
  drawField("Edificio", data.building || "", margin + halfW, halfW);
  y += 14;
  drawField("Piso / Zona", data.floor_number || "", margin, halfW);
  drawField("Localizacao", data.specific_location || "", margin + halfW, halfW);
  y += 14;

  // === MOTOR CHECKLIST ===
  drawSectionHeader("CHECKLIST DO MOTOR & SISTEMA MECANICO");
  // Table header
  doc.setFillColor(230, 235, 245);
  doc.rect(margin, y - 3, contentWidth, 8, "F");
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("Estado", margin + 3, y + 2);
  doc.text("Item de Inspecao", margin + 18, y + 2);
  doc.text("Observacoes", margin + contentWidth * 0.7, y + 2);
  y += 10;

  for (const item of data.motorChecklist) {
    checkPageBreak(8);
    const check = item.checked ? "[X]" : "[ ]";
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(check, margin + 3, y);
    const labelLines = doc.splitTextToSize(item.label, contentWidth * 0.5);
    doc.text(labelLines, margin + 18, y);
    if (item.observation) {
      const obsLines = doc.splitTextToSize(item.observation, contentWidth * 0.28);
      doc.text(obsLines, margin + contentWidth * 0.7, y);
    }
    doc.setDrawColor(230, 230, 230);
    doc.line(margin, y + 2, margin + contentWidth, y + 2);
    y += Math.max(labelLines.length, 1) * 4 + 3;
  }
  y += 3;

  // === MOTOR MEASUREMENTS ===
  checkPageBreak(30);
  drawSectionHeader("MEDICOES DO MOTOR");
  doc.setFillColor(230, 235, 245);
  doc.rect(margin, y - 3, contentWidth, 8, "F");
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("Parametro", margin + 3, y + 2);
  doc.text("Valor", margin + contentWidth * 0.55, y + 2);
  doc.text("Unidade", margin + contentWidth * 0.75, y + 2);
  doc.text("Estado", margin + contentWidth * 0.9, y + 2);
  y += 10;

  for (const m of data.motorMeasurements) {
    checkPageBreak(8);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(m.parameter, margin + 3, y);
    doc.text(m.value || "---", margin + contentWidth * 0.55, y);
    doc.text(m.unit, margin + contentWidth * 0.75, y);
    doc.setDrawColor(230, 230, 230);
    doc.line(margin, y + 2, margin + contentWidth, y + 2);
    y += 7;
  }
  y += 5;

  // === ELECTRICAL CHECKLIST ===
  checkPageBreak(20);
  drawSectionHeader("CHECKLIST ELETRICA & SISTEMA DE CONTROLO");
  doc.setFillColor(230, 235, 245);
  doc.rect(margin, y - 3, contentWidth, 8, "F");
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("Estado", margin + 3, y + 2);
  doc.text("Item de Inspecao", margin + 18, y + 2);
  doc.text("Observacoes", margin + contentWidth * 0.7, y + 2);
  y += 10;

  for (const item of data.electricalChecklist) {
    checkPageBreak(8);
    const check = item.checked ? "[X]" : "[ ]";
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(check, margin + 3, y);
    const labelLines = doc.splitTextToSize(item.label, contentWidth * 0.5);
    doc.text(labelLines, margin + 18, y);
    if (item.observation) {
      const obsLines = doc.splitTextToSize(item.observation, contentWidth * 0.28);
      doc.text(obsLines, margin + contentWidth * 0.7, y);
    }
    doc.setDrawColor(230, 230, 230);
    doc.line(margin, y + 2, margin + contentWidth, y + 2);
    y += Math.max(labelLines.length, 1) * 4 + 3;
  }
  y += 3;

  // === ELECTRICAL MEASUREMENTS ===
  checkPageBreak(30);
  drawSectionHeader("MEDICOES ELETRICAS (PAINEL DO GERADOR)");
  doc.setFillColor(230, 235, 245);
  doc.rect(margin, y - 3, contentWidth, 8, "F");
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("Parametro", margin + 3, y + 2);
  doc.text("Valor", margin + contentWidth * 0.55, y + 2);
  doc.text("Unidade", margin + contentWidth * 0.75, y + 2);
  doc.text("Estado", margin + contentWidth * 0.9, y + 2);
  y += 10;

  for (const m of data.electricalMeasurements) {
    checkPageBreak(8);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(m.parameter, margin + 3, y);
    doc.text(m.value || "---", margin + contentWidth * 0.55, y);
    doc.text(m.unit, margin + contentWidth * 0.75, y);
    doc.setDrawColor(230, 230, 230);
    doc.line(margin, y + 2, margin + contentWidth, y + 2);
    y += 7;
  }
  y += 5;

  // === MATERIALS ===
  if (data.materials.length > 0) {
    checkPageBreak(20);
    drawSectionHeader("MATERIAIS UTILIZADOS");
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
  drawSectionHeader("OBSERVACOES & RECOMENDACOES");
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

  // === APPROVAL & SIGNATURES ===
  checkPageBreak(50);
  drawSectionHeader("APROVACAO & ASSINATURAS");
  drawField("Proxima Manutencao", data.next_maintenance || "", margin, halfW);
  drawField("Data de Aprovacao", data.approval_date ? new Date(data.approval_date).toLocaleDateString("pt-PT") : "", margin + halfW, halfW);
  y += 14;
  drawField("Aprovado por", data.approved_by_name || "", margin, contentWidth);
  y += 14;

  // Signatures
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

  // Footer on each page
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Relatorio: ${data.work_order_reference}`,
      margin,
      287
    );
    doc.text(
      `Gerado em: ${new Date().toLocaleString("pt-PT")}`,
      pageWidth / 2,
      287,
      { align: "center" }
    );
    doc.text(
      `Pagina ${i} / ${totalPages}`,
      pageWidth - margin,
      287,
      { align: "right" }
    );
    doc.setTextColor(0, 0, 0);
  }

  return doc.output("blob");
}
