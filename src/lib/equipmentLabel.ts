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

export type EquipmentCategory = "hvac" | "electricity" | "generator" | "cctv" | "refrigeration" | "freezing" | "industrial" | "domestic" | "other";

export const EQUIPMENT_CATEGORY_LABEL: Record<EquipmentCategory, string> = {
  hvac: "Climatização",
  electricity: "Eletricidade",
  generator: "Grupo Gerador",
  cctv: "CCTV",
  refrigeration: "Refrigeração",
  freezing: "Congelação",
  industrial: "Industrial",
  domestic: "Doméstico",
  other: "Outros",
};

/** Report type -> equipment category it lists (intervention lists all). */
export function categoryForReport(reportType: string | null | undefined): EquipmentCategory | null {
  if (reportType === "hvac" || reportType === "electricity" || reportType === "generator" || reportType === "cctv") return reportType;
  return null;
}

const GENERIC_CATEGORIES: EquipmentCategory[] = ["other", "industrial", "domestic"];

/** Whether an equipment category is listed by a report of the given category. */
export function matchesReportCategory(eqCategory: string | null | undefined, wanted: EquipmentCategory | null): boolean {
  const cat = eqCategory || "other";
  if (!wanted) return true;
  if (GENERIC_CATEGORIES.includes(cat as EquipmentCategory)) return true;
  if (wanted === "hvac") return cat === "hvac" || cat === "refrigeration" || cat === "freezing";
  return cat === wanted;
}
