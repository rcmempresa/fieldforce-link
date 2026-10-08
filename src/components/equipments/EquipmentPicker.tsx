import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Search, MapPin, Snowflake } from "lucide-react";
import { cn } from "@/lib/utils";
import { UNIT_PART_LABEL, EQUIPMENT_CATEGORY_LABEL, type UnitPart, type EquipmentCategory } from "@/lib/equipmentLabel";

export interface PickerEquipment {
  id: string;
  name: string;
  brand?: string | null;
  model: string | null;
  serial_number: string | null;
  location: string | null;
  equipment_type?: string | null;
  outdoor_model?: string | null;
  outdoor_serial_number?: string | null;
  category?: string | null;
}

interface Props {
  equipments: PickerEquipment[];
  selected: string[];
  parts: Record<string, UnitPart>;
  onToggle: (id: string) => void;
  onPartChange: (id: string, part: UnitPart) => void;
  label?: string;
}

export const EQUIPMENT_SELECT =
  "id, name, brand, model, serial_number, location, equipment_type, outdoor_model, outdoor_serial_number, category";

export function EquipmentPicker({ equipments, selected, parts, onToggle, onPartChange, label = "Equipamento *" }: Props) {
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState<string>("all");
  const term = search.trim().toLowerCase();
  const cats = Array.from(new Set(equipments.map((e) => e.category || "other")));
  const list = equipments.filter((eq) => (cat === "all" || (eq.category || "other") === cat)).filter((eq) =>
    !term ||
    [eq.name, eq.brand, eq.model, eq.serial_number, eq.outdoor_model, eq.outdoor_serial_number, eq.location]
      .filter(Boolean).join(" ").toLowerCase().includes(term),
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        {selected.length > 0 && <span className="text-xs text-muted-foreground">{selected.length} selecionado(s)</span>}
      </div>
      {equipments.length === 0 ? (
        <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
          Este cliente ainda não tem equipamentos registados.
        </p>
      ) : (
        <>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Pesquisar por nome, modelo, nº série ou morada..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
          </div>
          {cats.length > 1 && (
            <div className="flex flex-wrap gap-1">
              {["all", ...cats].map((c) => (
                <button key={c} type="button" onClick={() => setCat(c)}
                  className={cn("rounded-full border px-3 py-1 text-xs", cat === c ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-muted")}>
                  {c === "all" ? "Todas" : EQUIPMENT_CATEGORY_LABEL[c as EquipmentCategory] || c}
                </button>
              ))}
            </div>
          )}
          <div className="max-h-72 space-y-2 overflow-y-auto rounded-lg border p-2">
            {list.length === 0 && <p className="p-3 text-center text-sm text-muted-foreground">Nenhum equipamento encontrado.</p>}
            {list.map((eq) => {
              const isSel = selected.includes(eq.id);
              const isAc = eq.equipment_type === "ac";
              return (
                <div key={eq.id} className={cn("rounded-md border p-2 transition-colors", isSel ? "border-primary bg-primary/5" : "border-transparent hover:bg-muted/50")}>
                  <label className="flex cursor-pointer items-start gap-2">
                    <input type="checkbox" checked={isSel} onChange={() => onToggle(eq.id)} className="mt-1 h-4 w-4" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
                        {eq.name}
                        {eq.category && eq.category !== "other" && <Badge variant="outline">{EQUIPMENT_CATEGORY_LABEL[eq.category as EquipmentCategory]}</Badge>}
                        {isAc && <Badge variant="secondary" className="gap-1"><Snowflake className="h-3 w-3" />AC</Badge>}
                      </div>
                      <div className="space-y-0.5 text-xs text-muted-foreground">
                        {(eq.model || eq.serial_number) && (
                          <div>{isAc && "Interior: "}{eq.model && `Modelo ${eq.model}`}{eq.model && eq.serial_number && " • "}{eq.serial_number && `S/N ${eq.serial_number}`}</div>
                        )}
                        {isAc && (eq.outdoor_model || eq.outdoor_serial_number) && (
                          <div>Exterior: {eq.outdoor_model && `Modelo ${eq.outdoor_model}`}{eq.outdoor_model && eq.outdoor_serial_number && " • "}{eq.outdoor_serial_number && `S/N ${eq.outdoor_serial_number}`}</div>
                        )}
                        {eq.location && <div className="flex items-center gap-1"><MapPin className="h-3 w-3" />{eq.location}</div>}
                      </div>
                    </div>
                  </label>
                  {isSel && isAc && (
                    <div className="mt-2 flex flex-wrap gap-1 pl-6">
                      {(["indoor", "outdoor", "both"] as UnitPart[]).map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => onPartChange(eq.id, p)}
                          className={cn(
                            "rounded-full border px-3 py-1 text-xs",
                            (parts[eq.id] || "both") === p ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-muted",
                          )}
                        >
                          {UNIT_PART_LABEL[p]}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
