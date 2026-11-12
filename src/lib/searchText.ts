const normalize = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();

/** Lowercase, accent-free text used for search matching ("Filtro de Ar" -> "filtro de ar"). */
export const normalizeSearch = (value?: string | number | null) =>
  normalize(value === undefined || value === null ? "" : String(value));

/**
 * True when every word typed by the user appears somewhere in the given fields.
 * Ignores accents and letter case, so "filt ar" finds "Filtro de Ar".
 */
export const matchesSearch = (
  fields: (string | number | null | undefined)[],
  term: string,
) => {
  const query = normalizeSearch(term);
  if (!query) return true;
  const haystack = normalizeSearch(
    fields
      .filter((f) => f !== undefined && f !== null && f !== "")
      .join(" "),
  );
  return query.split(" ").every((word) => haystack.includes(word));
};
