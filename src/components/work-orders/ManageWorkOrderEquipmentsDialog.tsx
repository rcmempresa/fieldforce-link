import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { EquipmentPicker, EQUIPMENT_SELECT, type PickerEquipment } from "@/components/equipments/EquipmentPicker";
import type { UnitPart } from "@/lib/equipmentLabel";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  workOrderId: string;
  canRemove: boolean;
  onSaved: () => void;
}

export function ManageWorkOrderEquipmentsDialog({ open, onOpenChange, workOrderId, canRemove, onSaved }: Props) {
  const { toast } = useToast();
  const [equipments, setEquipments] = useState<PickerEquipment[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [initial, setInitial] = useState<string[]>([]);
  const [parts, setParts] = useState<Record<string, UnitPart>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data: wo } = await supabase.from("work_orders").select("client_id").eq("id", workOrderId).single();
      const [{ data: eqs }, { data: links }] = await Promise.all([
        supabase.from("equipments").select(EQUIPMENT_SELECT).eq("client_id", wo?.client_id || "").order("name"),
        supabase.from("work_order_equipments").select("equipment_id, unit_part").eq("work_order_id", workOrderId),
      ]);
      setEquipments((eqs as any) || []);
      const ids = (links || []).map((l) => l.equipment_id);
      setSelected(ids);
      setInitial(ids);
      const p: Record<string, UnitPart> = {};
      (links || []).forEach((l) => (p[l.equipment_id] = (l.unit_part as UnitPart) || "both"));
      setParts(p);
    })();
  }, [open, workOrderId]);

  const toggle = (id: string) => {
    if (!canRemove && initial.includes(id)) return;
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  };

  const save = async () => {
    setSaving(true);
    const toAdd = selected.filter((id) => !initial.includes(id));
    const toRemove = canRemove ? initial.filter((id) => !selected.includes(id)) : [];
    const partOf = (id: string) => (equipments.find((e) => e.id === id)?.equipment_type === "ac" ? parts[id] || "both" : "both");
    let error = null as any;
    if (toAdd.length) {
      ({ error } = await supabase.from("work_order_equipments").insert(toAdd.map((id) => ({ work_order_id: workOrderId, equipment_id: id, unit_part: partOf(id) }))));
    }
    if (!error && toRemove.length) {
      ({ error } = await supabase.from("work_order_equipments").delete().eq("work_order_id", workOrderId).in("equipment_id", toRemove));
    }
    if (!error && canRemove) {
      for (const id of selected.filter((x) => initial.includes(x))) {
        await supabase.from("work_order_equipments").update({ unit_part: partOf(id) }).eq("work_order_id", workOrderId).eq("equipment_id", id);
      }
    }
    setSaving(false);
    if (error) {
      toast({ title: "Erro", description: "Não foi possível guardar os equipamentos", variant: "destructive" });
      return;
    }
    toast({ title: "Equipamentos atualizados" });
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Equipamentos da OT</DialogTitle>
          <DialogDescription>Escolhe todos os equipamentos onde vai ser feito trabalho nesta OT.</DialogDescription>
        </DialogHeader>
        <EquipmentPicker
          equipments={equipments}
          selected={selected}
          parts={parts}
          onToggle={toggle}
          onPartChange={(id, p) => setParts((s) => ({ ...s, [id]: p }))}
          label="Equipamentos"
        />
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>{saving ? "A guardar..." : "Guardar"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
