import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { EquipmentFormFields, emptyEquipmentForm, equipmentPayload, type EquipmentFormData } from "./EquipmentFormFields";

interface ClientChoice {
  id: string;
  label: string;
}

interface CreateEquipmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  /** When given, the client is fixed and no picker is shown. */
  clientId?: string | null;
  /** Client list for the picker, used when clientId is not given. */
  clients?: ClientChoice[];
}

export function CreateEquipmentDialog({
  open,
  onOpenChange,
  onSuccess,
  clientId,
  clients,
}: CreateEquipmentDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<EquipmentFormData>(emptyEquipmentForm);
  const [pickedClient, setPickedClient] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    if (!open) {
      setFormData(emptyEquipmentForm);
      setPickedClient("");
    }
  }, [open]);

  const resolvedClientId = clientId ?? pickedClient;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolvedClientId) {
      toast({
        title: "Falta o cliente",
        description: "Escolhe o cliente a que pertence o equipamento.",
        variant: "destructive",
      });
      return;
    }
    setLoading(true);
    const { error } = await supabase
      .from("equipments")
      .insert({ ...equipmentPayload(formData), client_id: resolvedClientId });
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
          {!clientId && (
            <div className="space-y-2">
              <Label htmlFor="eq-client">Cliente *</Label>
              <Select value={pickedClient} onValueChange={setPickedClient}>
                <SelectTrigger id="eq-client">
                  <SelectValue placeholder="Escolher cliente" />
                </SelectTrigger>
                <SelectContent>
                  {(clients || []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
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
