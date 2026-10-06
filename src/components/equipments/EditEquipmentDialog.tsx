import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { EquipmentFormFields, emptyEquipmentForm, equipmentPayload, type EquipmentFormData } from "./EquipmentFormFields";

interface EditEquipmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  equipment: {
    id: string;
    name: string;
    brand: string | null;
    model: string | null;
    serial_number: string | null;
    location: string | null;
    notes: string | null;
  };
  onSuccess: () => void;
}

export function EditEquipmentDialog({ open, onOpenChange, equipment, onSuccess }: EditEquipmentDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<EquipmentFormData>(emptyEquipmentForm);
  const { toast } = useToast();

  useEffect(() => {
    if (!open || !equipment) return;
    supabase.from("equipments").select("*").eq("id", equipment.id).maybeSingle().then(({ data }) => {
      const e = (data || equipment) as any;
      setFormData({
        equipment_type: e.equipment_type === "ac" ? "ac" : "general",
        name: e.name || "",
        brand: e.brand || "",
        model: e.model || "",
        serial_number: e.serial_number || "",
        outdoor_model: e.outdoor_model || "",
        outdoor_serial_number: e.outdoor_serial_number || "",
        location: e.location || "",
        notes: e.notes || "",
      });
    });
  }, [open, equipment]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.from("equipments").update(equipmentPayload(formData)).eq("id", equipment.id);
    setLoading(false);

    if (error) {
      toast({ title: "Erro", description: "Erro ao atualizar equipamento", variant: "destructive" });
    } else {
      toast({ title: "Sucesso", description: "Equipamento atualizado com sucesso" });
      onOpenChange(false);
      onSuccess();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Equipamento</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <EquipmentFormFields value={formData} onChange={setFormData} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={loading}>{loading ? "A guardar..." : "Guardar"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
