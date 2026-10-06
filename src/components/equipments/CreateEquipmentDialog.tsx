import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { EquipmentFormFields, emptyEquipmentForm, equipmentPayload, type EquipmentFormData } from "./EquipmentFormFields";

interface CreateEquipmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  clientId: string;
}

export function CreateEquipmentDialog({ open, onOpenChange, onSuccess, clientId }: CreateEquipmentDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<EquipmentFormData>(emptyEquipmentForm);
  const { toast } = useToast();

  useEffect(() => {
    if (!open) setFormData(emptyEquipmentForm);
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.from("equipments").insert({ ...equipmentPayload(formData), client_id: clientId });
    setLoading(false);

    if (error) {
      toast({ title: "Erro", description: "Erro ao criar equipamento", variant: "destructive" });
    } else {
      toast({ title: "Sucesso", description: "Equipamento criado com sucesso" });
      onOpenChange(false);
      onSuccess();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Equipamento</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <EquipmentFormFields value={formData} onChange={setFormData} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={loading}>{loading ? "A criar..." : "Criar Equipamento"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
