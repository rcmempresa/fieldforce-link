import { expect, test } from "bun:test";
import { anyChannelSent, channelsFor, computeQuoteTotals, normalizeWhatsappNumber } from "./quoteDelivery.ts";

test("totais com IVA 22%", () => {
  const t = computeQuoteTotals([{ description: "A", quantity: 2, unit: "un", unit_price: 10.5 }, { description: "B", quantity: 1, unit: "h", unit_price: 30 }]);
  expect(t.subtotal).toBe(51);
  expect(t.vat_amount).toBe(11.22);
  expect(t.total).toBe(62.22);
});
test("telemovel portugues ganha 351", () => {
  expect(normalizeWhatsappNumber("912 345 678")).toBe("351912345678");
  expect(normalizeWhatsappNumber("+351 912345678")).toBe("351912345678");
  expect(normalizeWhatsappNumber("00351912345678")).toBe("351912345678");
  expect(normalizeWhatsappNumber("123")).toBeNull();
});
test("ambos = email e whatsapp", () => {
  expect(channelsFor("ambos")).toEqual(["email", "whatsapp"]);
  expect(channelsFor("whatsapp")).toEqual(["whatsapp"]);
});
test("enviado quando pelo menos um canal funciona", () => {
  expect(anyChannelSent({ email: { ok: false }, whatsapp: { ok: true } })).toBe(true);
  expect(anyChannelSent({ email: { ok: false }, whatsapp: { ok: false } })).toBe(false);
});
