export type WorkRegime = "labor" | "after";

export interface RegimeFlags {
  is_labor_hours?: boolean | null;
  is_after_hours?: boolean | null;
}

/**
 * Classifica uma entrada de tempo como laboral ou pós-laboral.
 * Prioriza o regime definido na OT; se ambos (ou nenhum) estiverem marcados,
 * usa a hora real de execução (08:00–20:00 = laboral).
 */
export function classifyRegime(flags: RegimeFlags | null | undefined, startTime?: string | Date | null): WorkRegime {
  const labor = !!flags?.is_labor_hours;
  const after = !!flags?.is_after_hours;
  if (labor && !after) return "labor";
  if (after && !labor) return "after";

  const d = startTime ? new Date(startTime) : null;
  if (!d || isNaN(d.getTime())) return "labor";
  const h = d.getHours();
  return h >= 20 || h < 8 ? "after" : "labor";
}

export const regimeLabel = (r: WorkRegime) => (r === "labor" ? "Laboral" : "Pós-laboral");
