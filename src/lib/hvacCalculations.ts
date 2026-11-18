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
  { id: "subcool", section: "Subarrefecimento", label: "Delta T subarrefecimento", a: "t_descarga", b: "t_fim_cond", min: 3, max: 10, formula: "T saturacao - T linha liquido" },
  { id: "cond", section: "Rendimento do condensador", label: "Delta T condensador", a: "t_ar_saida_cond", b: "t_ar_entrada_cond", min: 10, max: 15, formula: "T saida - T entrada" },
  { id: "sh_util", section: "Sobreaquecimento util", label: "Delta T sobreaquecimento util", a: "t_saida_evap", b: "t_evap_util", min: 8, max: 15, formula: "T saida evaporador - T evaporacao" },
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
    "Formula: T saturacao (condensacao, lida no manometro de alta) - T real da linha de liquido.",
    "Ideal: 3 K a 10 K.",
    "Abaixo de 3 K: falta de fluido, condensador sujo com pouca troca termica ou problemas no compressor.",
    "Acima de 10 K (sem subarrefecedor): excesso de carga, filtro secador entupido ou obstrucao na linha de liquido.",
  ],
  "Rendimento do condensador": [
    "Delta T condensacao (T condensacao - T ar entrada): standard 10 K a 15 K; alta eficiencia 6 K a 10 K.",
    "Delta T do ar (T saida - T entrada): habitualmente 6 K a 12 K.",
    "Delta T condensacao > 16 K: serpentina suja, ventilador lento, excesso de fluido, nao condensaveis ou recirculacao de ar quente.",
    "Delta T condensacao < 6 K: falta de fluido, compressor fraco ou exterior muito frio.",
    "Delta T do ar > 14 K: alhetas obstruidas ou ventilador com rotacao reduzida.",
  ],
  "Sobreaquecimento util": [
    "Formula: T real a saida do evaporador (10-20 cm, sonda isolada) - T saturacao de evaporacao.",
    "Split / AC: 8 K a 15 K. Valvula de expansao termostatica (TXV): 4 K a 10 K.",
    "Alto: falta de fluido ou restricao no dispositivo de expansao.",
    "Baixo ou zero: excesso de carga ou falha na regulacao da valvula - risco de retorno de liquido ao compressor.",
  ],
  "Sobreaquecimento total": [
    "Formula: T linha de succao (10 cm da valvula de servico do compressor) - T saturacao de evaporacao.",
    "Ideal: 8 K a 15 K na entrada do compressor.",
    "Abaixo de 8 K: risco de retorno de liquido ao compressor (golpe de liquido).",
    "Acima de 15 K: baixa troca termica, falta de fluido ou sobreaquecimento do motor do compressor.",
  ],
  "Rendimento do evaporador": [
    "Delta T do ar (retorno - insuflacao): AC 10 K a 14 K; camaras frigorificas 3 K a 6 K.",
    "Delta T evaporacao (T ar retorno - T evaporacao): AC 15 K a 20 K.",
    "Delta T do ar < 8 K: falta de fluido, filtro/serpentina suja ou ventilador demasiado rapido.",
    "Delta T do ar > 16 K: falta de caudal - filtros entupidos, turbina suja ou risco de congelamento.",
    "Delta T evaporacao muito alto: evaporador sujo ou com gelo, falta de gas ou valvula mal afinada.",
  ],
};
