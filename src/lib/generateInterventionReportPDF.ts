import { jsPDF } from "jspdf";

export interface InterventionEquipment {
  model: string;
  serialNumber: string;
  location: string;
}

export interface InterventionMaterial {
  quantity: string;
  reference: string;
  designation: string;
}

export interface InterventionExecution {
  date: string;
  start: string;
  end: string;
  duration: string;
  extraHours: string;
  executor: string;
  km: string;
  observations: string;
}

export interface InterventionReportData {
  workOrderReference: string;
  reportDate: string;
  client: string;
  installation: string;
  cc: string;
  proposal: string;
  contract: string;
  equipments: InterventionEquipment[];
  materials: InterventionMaterial[];
  serviceDescription: string;
  emmUsed: boolean;
  emmCode: string;
  executions: InterventionExecution[];
  clientName: string;
  technicianName: string;
  clientSignature: string | null;
  technicianSignature: string | null;
}

const text = (value?: string | null) => value?.trim() || "-";

export function generateInterventionReportPDF(data: InterventionReportData): Blob {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 12;
  const width = pageWidth - margin * 2;
  let y = 12;

  const newPage = () => {
    doc.addPage();
    y = 14;
  };

  const ensureSpace = (height: number) => {
    if (y + height > pageHeight - 16) newPage();
  };

  const section = (title: string) => {
    ensureSpace(12);
    doc.setFillColor(31, 41, 55);
    doc.rect(margin, y, width, 8, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(title, margin + 3, y + 5.5);
    doc.setTextColor(0, 0, 0);
    y += 8;
  };

  const fieldsRow = (fields: Array<{ label: string; value: string; ratio?: number }>) => {
    ensureSpace(15);
    const totalRatio = fields.reduce((sum, field) => sum + (field.ratio || 1), 0);
    let x = margin;
    fields.forEach((field) => {
      const cellWidth = width * ((field.ratio || 1) / totalRatio);
      doc.setDrawColor(120, 120, 120);
      doc.rect(x, y, cellWidth, 15);
      doc.setFontSize(6.5);
      doc.setFont("helvetica", "bold");
      doc.text(field.label, x + 2, y + 4);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      const lines = doc.splitTextToSize(text(field.value), cellWidth - 4).slice(0, 2);
      doc.text(lines, x + 2, y + 9);
      x += cellWidth;
    });
    y += 15;
  };

  const table = (headers: string[], rows: string[][], ratios: number[]) => {
    const totalRatio = ratios.reduce((sum, ratio) => sum + ratio, 0);
    const columnWidths = ratios.map((ratio) => width * ratio / totalRatio);
    const drawHeader = () => {
      ensureSpace(8);
      let x = margin;
      headers.forEach((header, index) => {
        doc.setFillColor(229, 231, 235);
        doc.setDrawColor(120, 120, 120);
        doc.rect(x, y, columnWidths[index], 8, "FD");
        doc.setTextColor(0, 0, 0);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(6.5);
        doc.text(header, x + 1.5, y + 5, { maxWidth: columnWidths[index] - 3 });
        x += columnWidths[index];
      });
      y += 8;
    };

    drawHeader();
    const populatedRows = rows.length ? rows : [headers.map(() => "")];
    populatedRows.forEach((row) => {
      const wrapped = row.map((cell, index) => doc.splitTextToSize(text(cell), columnWidths[index] - 3));
      const rowHeight = Math.max(9, Math.max(...wrapped.map((lines) => lines.length)) * 3.5 + 3);
      if (y + rowHeight > pageHeight - 16) {
        newPage();
        drawHeader();
      }
      let x = margin;
      wrapped.forEach((lines, index) => {
        doc.rect(x, y, columnWidths[index], rowHeight);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(6.5);
        doc.text(lines, x + 1.5, y + 4);
        x += columnWidths[index];
      });
      y += rowHeight;
    });
  };

  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.text("NR TECH SOLUTION", margin, y + 4);
  doc.setFontSize(14);
  doc.text("RELATORIO DE INTERVENCAO", pageWidth - margin, y + 4, { align: "right" });
  y += 10;
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(`ORIGINAL N. ${text(data.workOrderReference)}`, pageWidth - margin, y, { align: "right" });
  y += 5;

  fieldsRow([{ label: "Cliente", value: data.client }]);
  fieldsRow([
    { label: "Instalacao", value: data.installation, ratio: 2 },
    { label: "Data", value: data.reportDate ? new Date(`${data.reportDate}T00:00:00`).toLocaleDateString("pt-PT") : "" },
    { label: "CC", value: data.cc },
  ]);
  fieldsRow([
    { label: "Proposta", value: data.proposal },
    { label: "Contrato (se aplicavel)", value: data.contract, ratio: 2 },
  ]);

  section("EQUIPAMENTO A INTERVENCIONAR");
  table(
    ["Modelo", "N. Serie", "Localizacao"],
    data.equipments.filter((item) => item.model || item.serialNumber || item.location).map((item) => [item.model, item.serialNumber, item.location]),
    [1, 1, 1.3],
  );

  y += 4;
  section("MATERIAIS APLICADOS");
  table(
    ["Quantidade", "Referencia", "Designacao"],
    data.materials.filter((item) => item.quantity || item.reference || item.designation).map((item) => [item.quantity, item.reference, item.designation]),
    [0.7, 1, 2.1],
  );

  y += 4;
  section("DESCRICAO DO SERVICO EFETUADO");
  const descriptionLines = doc.splitTextToSize(text(data.serviceDescription), width - 6);
  const descriptionHeight = Math.max(24, descriptionLines.length * 4 + 6);
  ensureSpace(descriptionHeight);
  doc.rect(margin, y, width, descriptionHeight);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(descriptionLines, margin + 3, y + 5);
  y += descriptionHeight;

  fieldsRow([{
    label: "Utilizacao de EMM",
    value: `${data.emmUsed ? "Sim" : "Nao"}${data.emmUsed && data.emmCode ? ` | Codigo: ${data.emmCode}` : ""}`,
  }]);

  section("EXECUCAO DA INTERVENCAO");
  table(
    ["Data", "Inicio", "Termo", "Duracao", "H. Extras", "Executante", "Km", "Observacoes"],
    data.executions.filter((item) => Object.values(item).some(Boolean)).map((item) => [
      item.date ? new Date(`${item.date}T00:00:00`).toLocaleDateString("pt-PT") : "",
      item.start,
      item.end,
      item.duration,
      item.extraHours,
      item.executor,
      item.km,
      item.observations,
    ]),
    [0.8, 0.55, 0.55, 0.65, 0.65, 1.1, 0.45, 1.5],
  );

  y += 5;
  ensureSpace(44);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text(`Data: ${data.reportDate ? new Date(`${data.reportDate}T00:00:00`).toLocaleDateString("pt-PT") : "-"}`, margin, y);
  y += 6;
  const signatureWidth = (width - 8) / 2;
  doc.rect(margin, y, signatureWidth, 34);
  doc.rect(margin + signatureWidth + 8, y, signatureWidth, 34);
  doc.text(`Cliente: ${text(data.clientName)}`, margin + 2, y + 5);
  doc.text(`O Tecnico: ${text(data.technicianName)}`, margin + signatureWidth + 10, y + 5);
  if (data.clientSignature) {
    const format = data.clientSignature.includes("image/jpeg") ? "JPEG" : "PNG";
    doc.addImage(data.clientSignature, format, margin + 4, y + 8, 65, 22);
  }
  if (data.technicianSignature) {
    const format = data.technicianSignature.includes("image/jpeg") ? "JPEG" : "PNG";
    doc.addImage(data.technicianSignature, format, margin + signatureWidth + 12, y + 8, 65, 22);
  }

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120, 120, 120);
    doc.text(`OT ${data.workOrderReference} | Pagina ${page}/${pageCount}`, margin, pageHeight - 7);
    doc.text("Documento gerado pela NR Tech Solution", pageWidth - margin, pageHeight - 7, { align: "right" });
  }

  return doc.output("blob");
}