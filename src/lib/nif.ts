/** Normaliza um NIF: retira espacos. Devolve null se vazio. */
export function normalizeNif(raw: string | null | undefined): string | null {
  const v = (raw ?? "").replace(/\s+/g, "");
  return v === "" ? null : v;
}

/** NIF opcional: vazio e valido; caso contrario tem de ter 9 digitos. */
export function isValidNif(raw: string | null | undefined): boolean {
  const v = normalizeNif(raw);
  return v === null || /^\d{9}$/.test(v);
}
