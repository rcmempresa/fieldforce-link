import { jsPDF } from "jspdf";
import { drawReportLogo } from "./reportLogo";

// ── Dados da empresa (actualizar NIF e IBAN quando disponíveis) ──────────────
const COMPANY = {
  name:    "Nuno Robinson Unipessoal LDA",
  nif:     "",                             // TODO: preencher NIF
  address: "Estrada Padre Ernesto e Jardim Rc 16",
  city:    "9400-120 Porto Santo — Madeira",
  email:   "geral@nrtechsolucion.pt",
  website: "loja.nrtechsolucion.pt",
  phone:   "962 515 190",
  iban:    "",                             // TODO: preencher IBAN
};

const VAT_RATE_LABEL = "IVA 22% (R.A. Madeira)";

// ── Tipos ────────────────────────────────────────────────────────────────────

export interface QuoteItem {
  description: string;
  quantity:   number;
  unit:       string;       // un, m², h, vb, ml, …
  unit_price: number;
  total:      number;
}

export interface QuoteData {
  logo?:                 string | null;
  reference:             string;   // ex: ORC-2026-0001
  date:                  string;   // ISO "2026-10-31"
  valid_until:           string;   // ISO "2026-11-30"
  requires_visit:        boolean;

  // Cliente
  client_name:    string;
  client_nif?:    string;
  client_address?: string;
  client_phone?:  string;
  client_email?:  string;

  // Itens
  items: QuoteItem[];

  // Totais (calculados externamente)
  subtotal:   number;
  vat_rate:   number;   // 0.22
  vat_amount: number;
  total:      number;

  // Opcional
  notes?:                string;
  work_order_reference?: string;  // OT associada (visita prévia)
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return n.toFixed(2).replace(".", ",") + " EUR";
}

function fmtDate(iso: string): string {
  if (!iso) return "—";
  try {
    return new Date(`${iso}T00:00:00`).toLocaleDateString("pt-PT");
  } catch {
    return iso;
  }
}

const t = (v?: string | null) => (v?.trim() || "—");

// ── Gerador principal ─────────────────────────────────────────────────────────

export function generateQuotePDF(data: QuoteData): Blob {
  const doc       = new jsPDF();
  const pW        = doc.internal.pageSize.getWidth();
  const pH        = doc.internal.pageSize.getHeight();
  const margin    = 14;
  const cw        = pW - margin * 2;   // content width
  let y           = 14;

  const ensure = (h: number) => {
    if (y + h > pH - 18) { doc.addPage(); y = 14; }
  };

  // ── CABEÇALHO ───────────────────────────────────────────────────────────────
  if (data.logo) {
    drawReportLogo(doc, data.logo, margin, y, 42, 20);
  }

  const infoX = data.logo ? margin + 46 : margin;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(31, 41, 55);
  doc.text(COMPANY.name, infoX, y + 5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(90, 90, 90);
  doc.text(COMPANY.address, infoX, y + 10);
  doc.text(COMPANY.city,    infoX, y + 14);
  doc.text(
    `Email: ${COMPANY.email}   Web: ${COMPANY.website}   Tel: ${COMPANY.phone}`,
    infoX, y + 18,
  );
  if (COMPANY.nif) {
    doc.text(`NIF: ${COMPANY.nif}`, infoX, y + 22);
  }

  // Título "ORCAMENTO" à direita
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(31, 41, 55);
  doc.text("ORCAMENTO", pW - margin, y + 10, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(90, 90, 90);
  doc.text(`Ref.: ${data.reference}`, pW - margin, y + 17, { align: "right" });
  doc.text(`Data: ${fmtDate(data.date)}`,          pW - margin, y + 22, { align: "right" });

  y += 28;

  // Linha separadora
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, pW - margin, y);
  y += 6;

  // ── BLOCO CLIENTE ───────────────────────────────────────────────────────────
  doc.setFillColor(245, 247, 250);
  doc.setDrawColor(210, 214, 220);
  doc.rect(margin, y, cw, 26, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.setTextColor(120, 120, 120);
  doc.text("CLIENTE", margin + 3, y + 5);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(20, 20, 20);
  doc.text(t(data.client_name), margin + 3, y + 12);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(70, 70, 70);

  const row2 = [
    data.client_nif     ? `NIF: ${data.client_nif}`   : null,
    data.client_address ? data.client_address          : null,
  ].filter(Boolean).join("   |   ");
  if (row2) doc.text(row2, margin + 3, y + 18);

  const row3 = [
    data.client_phone ? `Tel: ${data.client_phone}`   : null,
    data.client_email ? `Email: ${data.client_email}` : null,
  ].filter(Boolean).join("   ");
  if (row3) doc.text(row3, margin + 3, y + 23);

  // Lado direito do bloco: validade + tipo
  const rx = margin + cw * 0.58;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.setTextColor(120, 120, 120);
  doc.text("VALIDO ATE", rx, y + 5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(20, 20, 20);
  doc.text(fmtDate(data.valid_until), rx, y + 12);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.setTextColor(120, 120, 120);
  doc.text("TIPO", rx + 48, y + 5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(20, 20, 20);
  doc.text(data.requires_visit ? "Apos visita" : "Orcamento direto", rx + 48, y + 12);

  if (data.work_order_reference) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(120, 120, 120);
    doc.text("OT ASSOCIADA", rx, y + 19);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(20, 20, 20);
    doc.text(data.work_order_reference, rx, y + 24);
  }

  y += 32;

  // ── TABELA DE ITENS ─────────────────────────────────────────────────────────
  // Cabeçalho da secção
  doc.setFillColor(31, 41, 55);
  doc.rect(margin, y, cw, 8, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  doc.text("DESCRICAO DOS TRABALHOS / MATERIAIS", margin + 3, y + 5.5);
  y += 8;

  // Colunas: Descrição | Un | Qtd | P.Unit | Total
  const C = {
    desc:  { x: margin,                w: cw * 0.50 },
    unit:  { x: margin + cw * 0.50,    w: cw * 0.09 },
    qty:   { x: margin + cw * 0.59,    w: cw * 0.09 },
    price: { x: margin + cw * 0.68,    w: cw * 0.16 },
    total: { x: margin + cw * 0.84,    w: cw * 0.16 },
  };

  const drawItemsHeader = () => {
    ensure(8);
    doc.setFillColor(229, 231, 235);
    doc.setDrawColor(160, 160, 160);
    Object.values(C).forEach(({ x, w }) => doc.rect(x, y, w, 8, "FD"));
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(0, 0, 0);
    doc.text("Descricao",     C.desc.x  + 2, y + 5.5);
    doc.text("Un.",           C.unit.x  + 2, y + 5.5);
    doc.text("Qtd.",          C.qty.x   + 2, y + 5.5);
    doc.text("P. Unit.",      C.price.x + 2, y + 5.5);
    doc.text("Total",         C.total.x + 2, y + 5.5);
    y += 8;
  };

  drawItemsHeader();

  data.items.forEach((item, idx) => {
    const lines  = doc.splitTextToSize(t(item.description), C.desc.w - 4);
    const rowH   = Math.max(9, lines.length * 4 + 3);
    if (y + rowH > pH - 18) { doc.addPage(); y = 14; drawItemsHeader(); }

    const bg = idx % 2 === 0 ? [255, 255, 255] : [248, 249, 251];
    doc.setFillColor(bg[0], bg[1], bg[2]);
    doc.setDrawColor(200, 200, 200);
    Object.values(C).forEach(({ x, w }) => doc.rect(x, y, w, rowH, "FD"));

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    doc.text(lines,                   C.desc.x  + 2, y + 5);
    doc.text(t(item.unit),            C.unit.x  + 2, y + 5);
    doc.text(String(item.quantity),   C.qty.x   + 2, y + 5);
    doc.text(fmt(item.unit_price),    C.price.x + 2, y + 5);
    doc.setFont("helvetica", "bold");
    doc.text(fmt(item.total),         C.total.x + 2, y + 5);
    y += rowH;
  });

  y += 5;

  // ── TOTAIS ───────────────────────────────────────────────────────────────────
  ensure(36);
  const tX = pW - margin - 72;
  const tW = 72;

  const totalRow = (label: string, value: string, bold = false, dark = false) => {
    const h = dark ? 10 : 8;
    if (dark) {
      doc.setFillColor(31, 41, 55);
      doc.rect(tX, y, tW, h, "F");
      doc.setTextColor(255, 255, 255);
    } else {
      doc.setFillColor(245, 247, 250);
      doc.setDrawColor(210, 214, 220);
      doc.rect(tX, y, tW, h, "FD");
      doc.setTextColor(20, 20, 20);
    }
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(bold ? 9 : 8);
    doc.text(label, tX + 3, y + (dark ? 7 : 5.5));
    doc.text(value, tX + tW - 3, y + (dark ? 7 : 5.5), { align: "right" });
    y += h;
  };

  totalRow("Subtotal (s/ IVA)", fmt(data.subtotal));
  totalRow(VAT_RATE_LABEL,      fmt(data.vat_amount));
  totalRow("TOTAL",             fmt(data.total), true, true);

  if (COMPANY.iban) {
    y += 4;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(90, 90, 90);
    doc.text(`IBAN: ${COMPANY.iban}`, tX, y);
    y += 5;
  }

  y += 8;

  // ── NOTAS ────────────────────────────────────────────────────────────────────
  if (data.notes?.trim()) {
    ensure(20);
    doc.setFillColor(31, 41, 55);
    doc.rect(margin, y, cw, 7, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text("NOTAS", margin + 3, y + 5);
    y += 7;

    const noteLines = doc.splitTextToSize(data.notes.trim(), cw - 6);
    const noteH     = Math.max(12, noteLines.length * 4.5 + 5);
    ensure(noteH);
    doc.setDrawColor(200, 200, 200);
    doc.rect(margin, y, cw, noteH);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(20, 20, 20);
    doc.text(noteLines, margin + 3, y + 5);
    y += noteH + 6;
  }

  // ── CONDIÇÕES GERAIS ─────────────────────────────────────────────────────────
  ensure(28);
  doc.setFillColor(31, 41, 55);
  doc.rect(margin, y, cw, 7, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text("CONDICOES GERAIS", margin + 3, y + 5);
  y += 7;

  const conditions = [
    `- Orcamento valido ate ${fmtDate(data.valid_until)}.`,
    "- O inicio dos trabalhos fica condicionado a aceitacao formal deste orcamento.",
    "- Valores incluem IVA a taxa de 22% (Regiao Autonoma da Madeira).",
    "- Trabalho adicional nao previsto sera orcamentado separadamente.",
    "- Deslocacao e mao-de-obra incluidas salvo indicacao em contrario.",
  ].join("\n");

  const condLines = doc.splitTextToSize(conditions, cw - 6);
  const condH     = Math.max(22, condLines.length * 4 + 5);
  ensure(condH);
  doc.setDrawColor(200, 200, 200);
  doc.rect(margin, y, cw, condH);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(70, 70, 70);
  doc.text(condLines, margin + 3, y + 5);
  y += condH + 8;

  // ── ACEITE ───────────────────────────────────────────────────────────────────
  ensure(30);
  const sigW = (cw - 8) / 2;
  doc.setDrawColor(150, 150, 150);
  doc.rect(margin,              y, sigW, 26);
  doc.rect(margin + sigW + 8,   y, sigW, 26);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(80, 80, 80);
  doc.text("ACEITE PELO CLIENTE",          margin + 2,            y + 5);
  doc.text("NUNO ROBINSON UNIPESSOAL LDA", margin + sigW + 10,    y + 5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text("Data: ___________  Assinatura: _______________", margin + 2,         y + 22);
  doc.text("Data: ___________  Assinatura: _______________", margin + sigW + 10, y + 22);

  // ── RODAPÉ ───────────────────────────────────────────────────────────────────
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFontSize(6.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(160, 160, 160);
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, pH - 11, pW - margin, pH - 11);
    doc.text(
      `${COMPANY.name}  |  ${COMPANY.address}, ${COMPANY.city}  |  ${COMPANY.email}`,
      margin, pH - 6,
    );
    doc.text(`Pag. ${p}/${pages}`, pW - margin, pH - 6, { align: "right" });
  }

  return doc.output("blob");
}
