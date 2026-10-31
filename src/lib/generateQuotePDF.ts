import { jsPDF } from "jspdf";
import { drawReportLogo } from "./reportLogo";

export interface QuoteItem {
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total: number;
}

export interface QuoteData {
  logo?: string | null;
  reference: string;
  date: string; // "YYYY-MM-DD"
  valid_until: string; // "YYYY-MM-DD"
  requires_visit: boolean;
  client_name: string;
  client_nif?: string;
  client_address?: string;
  client_phone?: string;
  client_email?: string;
  items: QuoteItem[];
  subtotal: number;
  vat_rate: number;
  vat_amount: number;
  total: number;
  notes?: string;
  work_order_reference?: string;
}

const text = (value?: string | null) => value?.trim() || "-";
const money = (value: number) => `${value.toFixed(2)} EUR`;
const fmtDate = (iso: string) => {
  const parts = iso.split("-");
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : iso;
};

export function generateQuotePDF(data: QuoteData): Blob {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const width = pageWidth - margin * 2;
  let y = 14;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - 18) {
      doc.addPage();
      y = 16;
    }
  };

  // Header
  drawReportLogo(doc, data.logo, margin, y, 45, 20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("ORCAMENTO", pageWidth - margin, y + 7, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(data.reference, pageWidth - margin, y + 13, { align: "right" });
  y += 24;
  doc.setDrawColor(200);
  doc.line(margin, y, pageWidth - margin, y);
  y += 7;

  // Dates and type
  doc.setFontSize(10);
  doc.text(`Data: ${fmtDate(data.date)}`, margin, y);
  doc.text(`Valido ate: ${fmtDate(data.valid_until)}`, margin + 55, y);
  doc.text(
    `Tipo: ${data.requires_visit ? "Sujeito a visita previa" : "Orcamento direto"}`,
    margin + 115,
    y,
  );
  y += 5;
  if (data.work_order_reference) {
    doc.text(`Ordem de trabalho: ${data.work_order_reference}`, margin, y);
    y += 5;
  }
  y += 3;

  // Client block
  doc.setFont("helvetica", "bold");
  doc.text("Cliente", margin, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  const clientLines = [
    text(data.client_name),
    data.client_nif ? `NIF: ${data.client_nif}` : null,
    data.client_address?.trim() || null,
    data.client_phone ? `Tel: ${data.client_phone}` : null,
    data.client_email?.trim() || null,
  ].filter(Boolean) as string[];
  for (const line of clientLines) {
    ensureSpace(5);
    doc.text(line, margin, y);
    y += 5;
  }
  y += 4;

  // Items table
  const cols = [
    { label: "Descricao", w: width * 0.42, align: "left" as const },
    { label: "Un.", w: width * 0.08, align: "left" as const },
    { label: "Qtd", w: width * 0.1, align: "right" as const },
    { label: "P. Unit.", w: width * 0.19, align: "right" as const },
    { label: "Total", w: width * 0.21, align: "right" as const },
  ];

  const drawTableHeader = () => {
    ensureSpace(9);
    doc.setFillColor(240, 240, 240);
    doc.rect(margin, y - 4.5, width, 7.5, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    let x = margin;
    for (const col of cols) {
      if (col.align === "right") doc.text(col.label, x + col.w - 1, y, { align: "right" });
      else doc.text(col.label, x + 1, y);
      x += col.w;
    }
    doc.setFont("helvetica", "normal");
    y += 6;
  };

  drawTableHeader();
  doc.setFontSize(9);
  for (const item of data.items) {
    const descLines = doc.splitTextToSize(text(item.description), cols[0].w - 2) as string[];
    const rowHeight = Math.max(5, descLines.length * 4.5);
    ensureSpace(rowHeight + 2);
    if (y === 16) drawTableHeader();
    let x = margin;
    doc.text(descLines, x + 1, y);
    x += cols[0].w;
    doc.text(text(item.unit), x + 1, y);
    x += cols[1].w;
    doc.text(String(item.quantity), x + cols[2].w - 1, y, { align: "right" });
    x += cols[2].w;
    doc.text(money(item.unit_price), x + cols[3].w - 1, y, { align: "right" });
    x += cols[3].w;
    doc.text(money(item.total), x + cols[4].w - 1, y, { align: "right" });
    y += rowHeight;
    doc.setDrawColor(230);
    doc.line(margin, y - rowHeight + 4.5 - 4.5 + rowHeight, pageWidth - margin, y);
  }
  y += 4;

  // Totals
  const totalsX = pageWidth - margin - 70;
  ensureSpace(24);
  doc.setFontSize(10);
  doc.text("Subtotal:", totalsX, y);
  doc.text(money(data.subtotal), pageWidth - margin, y, { align: "right" });
  y += 5.5;
  doc.text(`IVA (${Math.round(data.vat_rate * 100)}%):`, totalsX, y);
  doc.text(money(data.vat_amount), pageWidth - margin, y, { align: "right" });
  y += 6;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("TOTAL:", totalsX, y);
  doc.text(money(data.total), pageWidth - margin, y, { align: "right" });
  doc.setFont("helvetica", "normal");
  y += 10;

  // Notes
  if (data.notes?.trim()) {
    ensureSpace(14);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Notas", margin, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const noteLines = doc.splitTextToSize(data.notes.trim(), width) as string[];
    for (const line of noteLines) {
      ensureSpace(5);
      doc.text(line, margin, y);
      y += 4.5;
    }
  }

  // Footer on every page
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text("NR Tech Solution", margin, pageHeight - 8);
    doc.text(`Pagina ${i} de ${pages}`, pageWidth - margin, pageHeight - 8, { align: "right" });
    doc.setTextColor(0);
  }

  return doc.output("blob");
}
