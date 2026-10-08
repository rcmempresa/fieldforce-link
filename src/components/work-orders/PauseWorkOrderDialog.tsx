import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
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
  { value: "saida_temporaria", label: "Vou sair, mas irei voltar" },
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
  const [materialFiles, setMaterialFiles] = useState<File[]>([]);
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

    if (selectedReason === "falta_material" && materialFiles.length === 0) {
      toast({
        title: "Erro",
        description: "Adicione pelo menos um anexo (foto ou documento) do material em falta",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Upload missing-material attachments first so the pause only happens with evidence
      const attachmentPaths: { path: string; filename: string }[] = [];
      if (selectedReason === "falta_material") {
        const { data: { user: up } } = await supabase.auth.getUser();
        for (const file of materialFiles) {
          const ext = file.name.split(".").pop();
          const path = `${workOrderId}/${Date.now()}-${Math.random().toString(36).substring(2)}.${ext}`;
          const { error: upErr } = await supabase.storage.from("work-order-attachments").upload(path, file);
          if (upErr) throw upErr;
          await supabase.from("attachments").insert({ work_order_id: workOrderId, filename: `Falta material - ${file.name}`, url: path, uploaded_by: up?.id });
          attachmentPaths.push({ path, filename: file.name });
        }
      }

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
          pause_reason: selectedReason as "falta_material" | "enviado_oficina" | "enviado_orcamento" | "assinatura_gerente" | "saida_temporaria",
          note: selectedReason === "falta_material" ? `Material em falta: ${missingMaterial}` : null,
        })
        .eq("id", timeEntryId);

      if (timeEntryError) throw timeEntryError;

      // Get total hours from all time entries for this work order
      const { data: allTimeEntries } = await supabase
        .from("time_entries")
        .select("duration_hours")
        .eq("work_order_id", workOrderId)
        .not("duration_hours", "is", null);

      const totalHours = (allTimeEntries || []).reduce(
        (sum, entry) => sum + (entry.duration_hours || 0),
        0
      );

      // Get current user ID
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Check if there are OTHER employees with active sessions
      const { count: otherActiveSessions } = await supabase
        .from("time_entries")
        .select("*", { count: "exact", head: true })
        .eq("work_order_id", workOrderId)
        .is("end_time", null)
        .neq("user_id", user.id);

      // Only update status to pending if no other employees are actively working
      const newStatus = (otherActiveSessions && otherActiveSessions > 0) ? "in_progress" : "pending";

      // Update work order status and total_hours
      const { error: updateError } = await supabase
        .from("work_orders")
        .update({ 
          status: newStatus,
          total_hours: totalHours
        })
        .eq("id", workOrderId);

      if (updateError) throw updateError;

      // If missing material, send emails to client and manager
      if (selectedReason === "falta_material") {
        await sendMissingMaterialEmails(workOrderId, missingMaterial, attachmentPaths);
      }

      toast({
        title: "Trabalho Pausado",
        description: newStatus === "in_progress" 
          ? `A sua sessão foi pausada. Outros funcionários ainda estão a trabalhar nesta ordem.`
          : `Ordem ${workOrderReference} está agora pendente`,
      });

      setSelectedReason("");
      setMissingMaterial("");
      setMaterialFiles([]);
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

  const sendMissingMaterialEmails = async (workOrderId: string, materialDescription: string, attachmentPaths: { path: string; filename: string }[]) => {
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
              attachmentPaths,
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
            attachmentPaths,
          },
        },
      });
    } catch (error) {
      console.error("Error sending missing material emails:", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] overflow-y-auto">
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
              <Label htmlFor="materialFiles">Anexo *</Label>
              <Input
                id="materialFiles"
                type="file"
                multiple
                accept="image/*,application/pdf"
                onChange={(e) => setMaterialFiles(Array.from(e.target.files || []))}
              />
              {materialFiles.length > 0 && (
                <p className="text-xs text-muted-foreground">{materialFiles.length} ficheiro(s) selecionado(s)</p>
              )}
              <p className="text-xs text-muted-foreground">
                O comentário e o anexo são enviados por email ao cliente, ao gerente e à loja.
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