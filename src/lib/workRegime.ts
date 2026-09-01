export type WorkRegime = "labor" | "after";

export interface RegimeEntry {
  work_regime?: WorkRegime | string | null;
  start_time?: string | Date | null;
}

/**
 * Classifica um registo de horas como laboral ou pós-laboral.
 * Usa o regime escolhido pelo técnico (time_entries.work_regime);
 * se não existir, deduz pela hora real de execução (08:00–20:00 = laboral).
 */
export function entryRegime(entry: RegimeEntry | null | undefined): WorkRegime {
  if (entry?.work_regime === "labor" || entry?.work_regime === "after") {
    return entry.work_regime;
  }
  const d = entry?.start_time ? new Date(entry.start_time) : null;
  if (!d || isNaN(d.getTime())) return "labor";
  const h = d.getHours();
  return h >= 20 || h < 8 ? "after" : "labor";
}

export const regimeLabel = (r: WorkRegime) => (r === "labor" ? "Laboral" : "Pós-laboral");
