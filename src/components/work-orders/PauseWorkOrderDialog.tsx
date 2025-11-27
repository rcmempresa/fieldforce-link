import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface PauseWorkOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workOrderId: string;
  workOrderReference: string;
  timeEntryId: string;
  onPause: () => void;
}

const pauseReasons = [
  { value: "falta_material", label: "Falta de Material" },
  { value: "enviado_oficina", label: "Enviado para a oficina" },
  { value: "enviado_orcamento", label: "Enviado Orçamento" },
  { value: "assinatura_gerente", label: "Assinatura do Gerente" },
];

export function PauseWorkOrderDialog({
  open,
  onOpenChange,
  workOrderId,
  workOrderReference,
  timeEntryId,
  onPause,
}: PauseWorkOrderDialogProps) {
  const [selectedReason, setSelectedReason] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedReason) {
      toast({
        title: "Erro",
        description: "Por favor, selecione um motivo para pausar",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Get time entry details to calculate duration
      const { data: timeEntry } = await supabase
        .from("time_entries")
        .select("start_time")
        .eq("id", timeEntryId)
        .single();

      if (!timeEntry) throw new Error("Entrada de tempo não encontrada");

      const now = new Date();
      const startTime = new Date(timeEntry.start_time);
      const durationHours = (now.getTime() - startTime.getTime()) / (1000 * 60 * 60);

      // Update time entry with end time, duration, and pause reason
      const { error: timeEntryError } = await supabase
        .from("time_entries")
        .update({
          end_time: now.toISOString(),
          duration_hours: durationHours,
          pause_reason: selectedReason as "falta_material" | "enviado_oficina" | "enviado_orcamento" | "assinatura_gerente",
        })
        .eq("id", timeEntryId);

      if (timeEntryError) throw timeEntryError;

      // Update work order status back to pending
      const { error: updateError } = await supabase
        .from("work_orders")
        .update({ status: "pending" })
        .eq("id", workOrderId);

      if (updateError) throw updateError;

      toast({
        title: "Trabalho Pausado",
        description: `Ordem ${workOrderReference} está agora pendente`,
      });

      setSelectedReason("");
      onOpenChange(false);
      onPause();
    } catch (error) {
      console.error("Error pausing work:", error);
      toast({
        title: "Erro",
        description: "Erro ao pausar trabalho",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pausar Ordem de Trabalho</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-3">
            <Label>Motivo da Pausa *</Label>
            <RadioGroup value={selectedReason} onValueChange={setSelectedReason}>
              {pauseReasons.map((reason) => (
                <div key={reason.value} className="flex items-center space-x-2">
                  <RadioGroupItem value={reason.value} id={reason.value} />
                  <Label htmlFor={reason.value} className="font-normal cursor-pointer">
                    {reason.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Pausando..." : "Pausar Trabalho"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}