export const normalizeKey = (s?: string | null) =>
  (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");

/** Brand + model key shared by every equipment of the same model; falls back to the equipment name when model is missing. */
export const equipmentModelKey = (brand?: string | null, model?: string | null, name?: string | null) => {
  const m = normalizeKey(model) || (normalizeKey(name) ? `nome:${normalizeKey(name)}` : "");
  if (!m) return null;
  return { brand_key: normalizeKey(brand), model_key: m };
};

export const parseCauses = (text: string) =>
  text.split(/\r?\n|;/).map((c) => c.trim()).filter(Boolean);
