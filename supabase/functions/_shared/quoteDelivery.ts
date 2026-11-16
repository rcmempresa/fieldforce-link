// Pure rules for assistant quotes: totals, phone format and multi-channel outcome.
export type Channel = "email" | "whatsapp" | "ambos";
export interface LineInput { description: string; quantity: number; unit: string; unit_price: number }

const round2 = (v: number) => Math.round(v * 100) / 100;

export function computeQuoteTotals(lines: LineInput[], vatRate = 0.22) {
  const items = lines.map((l) => ({ ...l, total: round2(l.quantity * l.unit_price) }));
  const subtotal = round2(items.reduce((s, i) => s + i.total, 0));
  const vat_amount = round2(subtotal * vatRate);
  return { items, subtotal, vat_rate: vatRate, vat_amount, total: round2(subtotal + vat_amount) };
}

/** E.164 digits only, without "+"; 9-digit Portuguese numbers get 351. Null when unusable. */
export function normalizeWhatsappNumber(raw?: string | null): string | null {
  if (!raw) return null;
  let d = raw.replace(/[^\d+]/g, "");
  if (d.startsWith("+")) d = d.slice(1);
  else if (d.startsWith("00")) d = d.slice(2);
  else if (/^[29]\d{8}$/.test(d)) d = "351" + d;
  d = d.replace(/\D/g, "");
  return d.length >= 10 && d.length <= 15 ? d : null;
}

export const channelsFor = (c: Channel): Array<"email" | "whatsapp"> => (c === "ambos" ? ["email", "whatsapp"] : [c]);

/** A quote counts as sent when at least one channel delivered it. */
export const anyChannelSent = (results: Record<string, { ok: boolean }>) => Object.values(results).some((r) => r.ok);
