export type UnitPart = "indoor" | "outdoor" | "both";

export interface EquipmentLike {
  id: string;
  name: string;
  equipment_type?: string | null;
}

export const UNIT_PART_LABEL: Record<UnitPart, string> = {
  indoor: "Unid. Interior",
  outdoor: "Unid. Exterior",
  both: "Interior + Exterior",
};

/** Human label for an equipment linked to a WO, including the AC unit when relevant. */
export function equipmentLinkLabel(eq: EquipmentLike, part?: string | null) {
  if (eq.equipment_type === "ac" && part && part in UNIT_PART_LABEL) {
    return `${eq.name} (${UNIT_PART_LABEL[part as UnitPart]})`;
  }
  return eq.name;
}

/** WO title generated from the selected equipment. */
export function buildEquipmentTitle(items: Array<{ eq: EquipmentLike; part?: string | null }>, fallback = "") {
  if (!items.length) return fallback;
  return items.map(({ eq, part }) => equipmentLinkLabel(eq, part)).join(", ").slice(0, 200);
}

export type EquipmentCategory =
  | "hvac"
  | "electricity"
  | "generator"
  | "cctv"
  | "automatismos"
  | "refrigeration"
  | "thermal_accumulator"
  | "heat_pump"
  | "industrial"
  | "domestic"
  | "other";

export const EQUIPMENT_CATEGORY_LABEL: Record<EquipmentCategory, string> = {
  hvac: "Climatização",
  electricity: "Eletricidade",
  generator: "Grupo Gerador",
  cctv: "CCTV",
  automatismos: "Automatismos",
  refrigeration: "Refrigeração & Congelação",
  thermal_accumulator: "Termo Acumulador",
  heat_pump: "Bomba de Calor",
  industrial: "Industrial",
  domestic: "Doméstico",
  other: "Outros",
};

/** Categories retired from the picker but still stored on old rows. */
const LEGACY_CATEGORY_LABEL: Record<string, string> = {
  freezing: "Refrigeração & Congelação",
};

/** Label for any stored category value, including legacy ones. */
export function equipmentCategoryLabel(cat: string | null | undefined): string {
  const key = cat && cat in EQUIPMENT_CATEGORY_LABEL ? (cat as EquipmentCategory) : null;
  if (key) return EQUIPMENT_CATEGORY_LABEL[key];
  if (cat && cat in LEGACY_CATEGORY_LABEL) return LEGACY_CATEGORY_LABEL[cat];
  return EQUIPMENT_CATEGORY_LABEL.other;
}

/** Report type -> equipment category it lists (intervention lists all). */
export function categoryForReport(reportType: string | null | undefined): EquipmentCategory | null {
  if (reportType === "hvac" || reportType === "electricity" || reportType === "generator" || reportType === "cctv") return reportType;
  return null;
}

const GENERIC_CATEGORIES: EquipmentCategory[] = ["other", "industrial", "domestic"];

/** Extra equipment categories a report of the given category also lists. */
const REPORT_CATEGORY_GROUPS: Partial<Record<EquipmentCategory, EquipmentCategory[]>> = {
  hvac: ["hvac", "refrigeration", "thermal_accumulator", "heat_pump"],
  electricity: ["electricity", "automatismos"],
};

/** Whether an equipment category is listed by a report of the given category. */
export function matchesReportCategory(eqCategory: string | null | undefined, wanted: EquipmentCategory | null): boolean {
  const cat = (eqCategory || "other") as EquipmentCategory;
  if (!wanted) return true;
  if (GENERIC_CATEGORIES.includes(cat)) return true;
  const group = REPORT_CATEGORY_GROUPS[wanted];
  if (group) return group.includes(cat);
  return cat === wanted;
}
