import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
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
  const [missingMaterial, setMissingMaterial] = useState<string>("");
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

    if (selectedReason === "falta_material" && !missingMaterial.trim()) {
      toast({
        title: "Erro",
        description: "Por favor, descreva o material em falta",
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
          note: selectedReason === "falta_material" ? `Material em falta: ${missingMaterial}` : null,
        })
        .eq("id", timeEntryId);

      if (timeEntryError) throw timeEntryError;

      // Update work order status back to pending
      const { error: updateError } = await supabase
        .from("work_orders")
        .update({ status: "pending" })
        .eq("id", workOrderId);

      if (updateError) throw updateError;

      // If missing material, send emails to client and manager
      if (selectedReason === "falta_material") {
        await sendMissingMaterialEmails(workOrderId, missingMaterial);
      }

      toast({
        title: "Trabalho Pausado",
        description: `Ordem ${workOrderReference} está agora pendente`,
      });

      setSelectedReason("");
      setMissingMaterial("");
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

  const sendMissingMaterialEmails = async (workOrderId: string, materialDescription: string) => {
    try {
      // Get work order details with client info
      const { data: workOrder } = await supabase
        .from("work_orders")
        .select(`
          id,
          reference,
          title,
          client_id,
          client:profiles!work_orders_client_id_fkey(id, name)
        `)
        .eq("id", workOrderId)
        .single();

      if (!workOrder) return;

      // Get current user (employee) name
      const { data: { user } } = await supabase.auth.getUser();
      const { data: employeeProfile } = await supabase
        .from("profiles")
        .select("name")
        .eq("id", user?.id)
        .single();

      const clientName = workOrder.client?.name || "Cliente";

      // Send email to client
      if (workOrder.client_id) {
        console.log("Sending missing material email to client:", workOrder.client_id);
        await supabase.functions.invoke("send-notification-email", {
          body: {
            type: "work_order_missing_material",
            userId: workOrder.client_id,
            data: {
              recipientName: clientName,
              workOrderReference: workOrder.reference,
              workOrderTitle: workOrder.title,
              employeeName: employeeProfile?.name,
              missingMaterial: materialDescription,
              isClient: true,
            },
          },
        });
      }

      // Send email to all managers via edge function (RLS bypass)
      console.log("Sending missing material email to managers for work order:", workOrderId);
      await supabase.functions.invoke("send-notification-email", {
        body: {
          type: "work_order_missing_material_managers",
          data: {
            workOrderId: workOrderId,
            workOrderReference: workOrder.reference,
            workOrderTitle: workOrder.title,
            employeeName: employeeProfile?.name,
            clientName: clientName,
            missingMaterial: materialDescription,
          },
        },
      });
    } catch (error) {
      console.error("Error sending missing material emails:", error);
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

          {selectedReason === "falta_material" && (
            <div className="space-y-2">
              <Label htmlFor="missingMaterial">Material em Falta *</Label>
              <Textarea
                id="missingMaterial"
                placeholder="Descreva o material que está em falta..."
                value={missingMaterial}
                onChange={(e) => setMissingMaterial(e.target.value)}
                rows={4}
              />
              <p className="text-xs text-muted-foreground">
                Esta informação será enviada por email ao cliente e ao gerente.
              </p>
            </div>
          )}

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