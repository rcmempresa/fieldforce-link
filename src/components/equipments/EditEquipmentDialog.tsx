import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface EditEquipmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  equipment: {
    id: string;
    name: string;
    model: string | null;
    serial_number: string | null;
    location: string | null;
    notes: string | null;
  };
  onSuccess: () => void;
}

export function EditEquipmentDialog({
  open,
  onOpenChange,
  equipment,
  onSuccess,
}: EditEquipmentDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    model: "",
    serial_number: "",
    location: "",
    notes: "",
  });
  const { toast } = useToast();

  useEffect(() => {
    if (open && equipment) {
      setFormData({
        name: equipment.name || "",
        model: equipment.model || "",
        serial_number: equipment.serial_number || "",
        location: equipment.location || "",
        notes: equipment.notes || "",
      });
    }
  }, [open, equipment]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase
      .from("equipments")
      .update({
        name: formData.name,
        model: formData.model || null,
        serial_number: formData.serial_number || null,
        location: formData.location || null,
        notes: formData.notes || null,
      })
      .eq("id", equipment.id);

    setLoading(false);

    if (error) {
      toast({
        title: "Erro",
        description: "Erro ao atualizar equipamento",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Sucesso",
        description: "Equipamento atualizado com sucesso",
      });
      onOpenChange(false);
      onSuccess();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Editar Equipamento</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="model">Modelo</Label>
              <Input
                id="model"
                value={formData.model}
                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="serial_number">Número de Série</Label>
              <Input
                id="serial_number"
                value={formData.serial_number}
                onChange={(e) =>
                  setFormData({ ...formData, serial_number: e.target.value })
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="location">Localização</Label>
            <Input
              id="location"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notas</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "A guardar..." : "Guardar Alterações"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
