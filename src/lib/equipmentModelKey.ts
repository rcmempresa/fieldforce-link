export const normalizeKey = (s?: string | null) =>
  (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");

/** Brand + model key shared by every equipment of the same model; null when model is missing. */
export const equipmentModelKey = (brand?: string | null, model?: string | null) => {
  const m = normalizeKey(model);
  if (!m) return null;
  return { brand_key: normalizeKey(brand), model_key: m };
};

export const parseCauses = (text: string) =>
  text.split(/\r?\n|;/).map((c) => c.trim()).filter(Boolean);
