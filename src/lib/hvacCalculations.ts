import type { Measurement } from "./maintenanceReportDefaults";

export type HvacStatus = "ok" | "low" | "high";

export interface HvacCalc {
  id: string;
  section: string;
  label: string;
  /** Measurement keys: result = a - b */
  a: string;
  b: string;
  min: number;
  max: number;
  formula: string;
}

export const HVAC_CALCS: HvacCalc[] = [
  { id: "subcool", section: "Subarrefecimento", label: "Delta T subarrefecimento", a: "t_descarga", b: "t_fim_cond", min: 4, max: 7, formula: "Td - Tf" },
  { id: "cond", section: "Rendimento do condensador", label: "Delta T condensador", a: "t_ar_saida_cond", b: "t_ar_entrada_cond", min: 10, max: 15, formula: "T saida - T entrada" },
  { id: "sh_util", section: "Sobreaquecimento util", label: "Delta T sobreaquecimento util", a: "t_saida_evap", b: "t_evap_util", min: 3, max: 6, formula: "T saida evaporador - T evaporacao" },
  { id: "sh_total", section: "Sobreaquecimento total", label: "Delta T sobreaquecimento total", a: "t_succao", b: "t_evap_total", min: 8, max: 15, formula: "T linha succao - T evaporacao" },
  { id: "evap", section: "Rendimento do evaporador", label: "Delta T evaporador", a: "t_retorno", b: "t_insuflacao", min: 10, max: 14, formula: "T retorno - T insuflacao" },
];

const num = (v: string | undefined) => {
  if (v == null || v.trim() === "") return null;
  const n = Number(v.replace(",", ".").trim());
  return Number.isFinite(n) ? n : null;
};

export function computeHvacCalc(calc: HvacCalc, values: Record<string, string | undefined>) {
  const a = num(values[calc.a]);
  const b = num(values[calc.b]);
  if (a == null || b == null) return null;
  const value = Math.round((a - b) * 10) / 10;
  const status: HvacStatus = value < calc.min ? "low" : value > calc.max ? "high" : "ok";
  return { value, status };
}

/** Calculations for one equipment's measurement rows (only rows with keys count). */
export function computeHvacCalcs(rows: Measurement[]) {
  const values: Record<string, string> = {};
  rows.forEach((m) => { if (m.key) values[m.key] = m.value; });
  return HVAC_CALCS.map((c) => ({ calc: c, result: computeHvacCalc(c, values) }));
}

export const HVAC_STATUS_LABEL: Record<HvacStatus, string> = { ok: "OK", low: "Baixo", high: "Alto" };

/** Technical support text (ASCII, used in form and PDF). */
export const HVAC_SUPPORT: Record<string, string[]> = {
  "Subarrefecimento": [
    "Ideal geral: 4 K a 7 K (microcanais: 5 K a 8 K).",
    "Com deposito de liquido: 1 K a 3 K a saida do deposito. Capilar/orificio fixo: 3 K a 6 K.",
    "Abaixo de 3 K: falta de fluido ou condensador com baixa troca termica (sujidade, ventilador avariado).",
    "Acima de 8-10 K: excesso de carga, filtro secador entupido ou valvula de expansao obstruida.",
  ],
  "Rendimento do condensador": [
    "Delta T condensacao (T condensacao - T ar entrada): standard 10 K a 15 K; alta eficiencia 6 K a 10 K.",
    "Delta T do ar (T saida - T entrada): habitualmente 6 K a 12 K.",
    "Delta T condensacao > 16 K: serpentina suja, ventilador lento, excesso de fluido, nao condensaveis ou recirculacao de ar quente.",
    "Delta T condensacao < 6 K: falta de fluido, compressor fraco ou exterior muito frio.",
    "Delta T do ar > 14 K: alhetas obstruidas ou ventilador com rotacao reduzida.",
  ],
  "Sobreaquecimento util": [
    "Medido a saida do evaporador, junto ao bolbo da valvula. AC: 4 K a 7 K; refrig. positiva: 5 K a 8 K; negativa: 4 K a 6 K; VEE: 3 K a 5 K.",
    "Abaixo de 3 K: evaporador inundado - fechar ligeiramente a valvula (sentido horario).",
    "4 K a 8 K: sistema afinado, nao mexer.",
    "Acima de 8-10 K: evaporador subalimentado - verificar falta de gas; se a carga estiver boa, abrir ligeiramente a valvula (anti-horario).",
  ],
  "Sobreaquecimento total": [
    "Medido na linha de succao antes do compressor. Capilar: 5 K a 12 K; com valvula (VET/VEE): 8 K a 15 K; refrig. positiva: 8 K a 14 K; negativa: 12 K a 20 K.",
    "Abaixo de 4 K: risco de retorno de liquido - excesso de carga, valvula muito aberta ou evaporador sujo.",
    "Acima de 15-20 K: falta de fluido, valvula entupida/fechada, succao longa ou isolamento danificado.",
  ],
  "Rendimento do evaporador": [
    "Delta T do ar (retorno - insuflacao): AC 10 K a 14 K; camaras frigorificas 3 K a 6 K.",
    "Delta T evaporacao (T ar retorno - T evaporacao): AC 15 K a 20 K.",
    "Delta T do ar < 8 K: falta de fluido, filtro/serpentina suja ou ventilador demasiado rapido.",
    "Delta T do ar > 16 K: falta de caudal - filtros entupidos, turbina suja ou risco de congelamento.",
    "Delta T evaporacao muito alto: evaporador sujo ou com gelo, falta de gas ou valvula mal afinada.",
  ],
};
