import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Snowflake, Wrench } from "lucide-react";

export interface EquipmentFormData {
  equipment_type: "general" | "ac";
  name: string;
  brand: string;
  model: string;
  serial_number: string;
  outdoor_model: string;
  outdoor_serial_number: string;
  location: string;
  notes: string;
}

export const emptyEquipmentForm: EquipmentFormData = {
  equipment_type: "general",
  name: "",
  brand: "",
  model: "",
  serial_number: "",
  outdoor_model: "",
  outdoor_serial_number: "",
  location: "",
  notes: "",
};

export function equipmentPayload(f: EquipmentFormData) {
  const isAc = f.equipment_type === "ac";
  return {
    equipment_type: f.equipment_type,
    name: f.name.trim(),
    brand: f.brand || null,
    model: f.model || null,
    serial_number: f.serial_number || null,
    outdoor_model: isAc ? f.outdoor_model || null : null,
    outdoor_serial_number: isAc ? f.outdoor_serial_number || null : null,
    location: f.location || null,
    notes: f.notes || null,
  };
}

interface Props {
  value: EquipmentFormData;
  onChange: (v: EquipmentFormData) => void;
}

export function EquipmentFormFields({ value, onChange }: Props) {
  const set = (k: keyof EquipmentFormData, v: string) => onChange({ ...value, [k]: v });
  const isAc = value.equipment_type === "ac";

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Tipo de equipamento</Label>
        <div className="grid grid-cols-2 gap-2">
          {([
            { v: "general", label: "Equipamento geral", icon: Wrench },
            { v: "ac", label: "Ar condicionado", icon: Snowflake },
          ] as const).map(({ v, label, icon: Icon }) => (
            <button
              key={v}
              type="button"
              onClick={() => onChange({ ...value, equipment_type: v })}
              className={cn(
                "flex items-center justify-center gap-2 rounded-lg border p-3 text-sm font-medium transition-colors",
                value.equipment_type === v ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted",
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="eq-name">Nome *</Label>
          <Input id="eq-name" value={value.name} onChange={(e) => set("name", e.target.value)} placeholder={isAc ? "Ex: AC Sala de reuniões" : "Ex: Quadro elétrico piso 1"} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="eq-brand">Marca</Label>
          <Input id="eq-brand" value={value.brand} onChange={(e) => set("brand", e.target.value)} />
        </div>
      </div>

      <div className={cn("grid gap-4", isAc && "sm:grid-cols-2")}>
        <div className="space-y-3 rounded-lg border p-3">
          {isAc && <p className="text-sm font-semibold">Unidade Interior</p>}
          <div className="space-y-2">
            <Label htmlFor="eq-model">Modelo</Label>
            <Input id="eq-model" value={value.model} onChange={(e) => set("model", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="eq-serial">Número de Série</Label>
            <Input id="eq-serial" value={value.serial_number} onChange={(e) => set("serial_number", e.target.value)} />
          </div>
        </div>
        {isAc && (
          <div className="space-y-3 rounded-lg border p-3">
            <p className="text-sm font-semibold">Unidade Exterior</p>
            <div className="space-y-2">
              <Label htmlFor="eq-omodel">Modelo</Label>
              <Input id="eq-omodel" value={value.outdoor_model} onChange={(e) => set("outdoor_model", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="eq-oserial">Número de Série</Label>
              <Input id="eq-oserial" value={value.outdoor_serial_number} onChange={(e) => set("outdoor_serial_number", e.target.value)} />
            </div>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="eq-location">Localização / Morada</Label>
        <Input id="eq-location" value={value.location} onChange={(e) => set("location", e.target.value)} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="eq-notes">Notas</Label>
        <Textarea id="eq-notes" value={value.notes} onChange={(e) => set("notes", e.target.value)} rows={3} />
      </div>
    </div>
  );
}
