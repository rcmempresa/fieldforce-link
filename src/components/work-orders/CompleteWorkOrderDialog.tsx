import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import SignatureCanvas from "react-signature-canvas";
import { generateWorkOrderPDF, uploadWorkOrderPDF } from "@/lib/generateWorkOrderPDF";

interface CompleteWorkOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workOrderId: string;
  workOrderReference: string;
  onComplete: () => void;
}

export function CompleteWorkOrderDialog({
  open,
  onOpenChange,
  workOrderId,
  workOrderReference,
  onComplete,
}: CompleteWorkOrderDialogProps) {
  const [hours, setHours] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const signatureRef = useRef<SignatureCanvas>(null);
  const [signatureEmpty, setSignatureEmpty] = useState(true);

  const clearSignature = () => {
    signatureRef.current?.clear();
    setSignatureEmpty(true);
  };

  const handleSignatureEnd = () => {
    setSignatureEmpty(signatureRef.current?.isEmpty() ?? true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!hours || parseFloat(hours) <= 0) {
      toast({
        title: "Erro",
        description: "Por favor, insira um número válido de horas",
        variant: "destructive",
      });
      return;
    }

    if (signatureEmpty || !signatureRef.current) {
      toast({
        title: "Erro",
        description: "Por favor, assine antes de concluir a ordem",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Create time entry
      const now = new Date();
      const startTime = new Date(now.getTime() - parseFloat(hours) * 60 * 60 * 1000);

      const { error: timeEntryError } = await supabase
        .from("time_entries")
        .insert({
          work_order_id: workOrderId,
          user_id: user.id,
          start_time: startTime.toISOString(),
          end_time: now.toISOString(),
          duration_hours: parseFloat(hours),
          note: note || null,
        });

      if (timeEntryError) throw timeEntryError;

      // Get work order details for notifications and PDF
      const { data: workOrder } = await supabase
        .from("work_orders")
        .select(`
          *,
          client:profiles!work_orders_client_id_fkey(name, id),
          assignments:work_order_assignments(user:profiles!work_order_assignments_user_id_fkey(name))
        `)
        .eq("id", workOrderId)
        .single();

      if (!workOrder) throw new Error("Ordem de trabalho não encontrada");

      // Get client email
      const { data: clientAuth } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", workOrder.client_id)
        .single();

      const { data: { user: clientUser } } = await supabase.auth.admin.getUserById(
        clientAuth?.id || ""
      );

      // Get current user profile
      const { data: currentProfile } = await supabase
        .from("profiles")
        .select("name")
        .eq("id", user.id)
        .single();

      // Generate signature image
      const signatureDataUrl = signatureRef.current!.toDataURL();

      // Generate PDF with work order details
      const pdfBlob = await generateWorkOrderPDF(
        {
          reference: workOrderReference,
          title: workOrder.title,
          description: workOrder.description,
          status: "completed",
          priority: workOrder.priority,
          service_type: workOrder.service_type,
          scheduled_date: workOrder.scheduled_date,
          client_name: (workOrder.client as any)?.name || "N/A",
          client_email: clientUser?.email || "N/A",
          assigned_employees: (workOrder.assignments as any[])?.map((a: any) => ({ name: a.user.name })) || [],
          total_hours: workOrder.total_hours,
          created_at: workOrder.created_at,
          completed_at: now.toISOString(),
        },
        signatureDataUrl,
        currentProfile?.name || user.email || "Funcionário",
        parseFloat(hours),
        note || null
      );

      // Upload PDF to storage
      const pdfUrl = await uploadWorkOrderPDF(
        workOrderId,
        pdfBlob,
        workOrderReference,
        user.id
      );

      // Update work order status to completed
      const { error: updateError } = await supabase
        .from("work_orders")
        .update({ status: "completed" })
        .eq("id", workOrderId);

      if (updateError) throw updateError;

      // Create notification for client
      if (workOrder.client_id) {
        await supabase.from("notifications").insert({
          user_id: workOrder.client_id,
          work_order_id: workOrderId,
          type: "work_order_completed",
          channel: "email",
          payload: JSON.stringify({
            reference: workOrderReference,
            message: `Ordem de trabalho ${workOrderReference} foi concluída. Documento disponível nos anexos.`,
          }),
        });

        // Send email to client with PDF attachment
        if ((workOrder.client as any)?.name) {
          supabase.functions.invoke("send-notification-email", {
            body: {
              type: "work_order_completed",
              userId: workOrder.client_id,
              data: {
                recipientName: (workOrder.client as any).name,
                workOrderReference: workOrderReference,
                workOrderTitle: workOrder.title,
                completedBy: currentProfile?.name || user.email || "Funcionário",
                isManager: false,
                pdfUrl: pdfUrl,
              },
            },
          });
        }
      }

      // Create notification for all managers
      const { data: managers } = await supabase
        .from("user_roles")
        .select("user_id, profiles!user_roles_user_id_fkey(name)")
        .eq("role", "manager")
        .eq("approved", true);

      if (managers && managers.length > 0) {
        const managerNotifications = managers.map((manager: any) => ({
          user_id: manager.user_id,
          work_order_id: workOrderId,
          type: "work_order_completed",
          channel: "email" as const,
          payload: JSON.stringify({
            reference: workOrderReference,
            client_name: (workOrder.client as any)?.name || "Cliente",
            message: `Ordem ${workOrderReference} concluída. Documento disponível nos anexos.`,
          }),
        }));
        await supabase.from("notifications").insert(managerNotifications);

        // Send emails to managers with PDF attachment
        for (const manager of managers) {
          const managerProfile = manager.profiles as any;
          
          if (managerProfile) {
            supabase.functions.invoke("send-notification-email", {
              body: {
                type: "work_order_completed",
                userId: manager.user_id,
                data: {
                  recipientName: managerProfile.name,
                  workOrderReference: workOrderReference,
                  workOrderTitle: workOrder.title,
                  completedBy: currentProfile?.name || user.email || "Funcionário",
                  clientName: (workOrder.client as any)?.name,
                  isManager: true,
                  pdfUrl: pdfUrl,
                },
              },
            });
          }
        }
      }

      toast({
        title: "Sucesso",
        description: `Ordem ${workOrderReference} concluída e documento gerado!`,
      });

      setHours("");
      setNote("");
      signatureRef.current?.clear();
      setSignatureEmpty(true);
      onOpenChange(false);
      onComplete();
    } catch (error) {
      console.error("Error completing work order:", error);
      toast({
        title: "Erro",
        description: "Erro ao concluir a ordem de trabalho",
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
          <DialogTitle>Concluir Ordem de Trabalho</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="hours">Horas Trabalhadas *</Label>
            <Input
              id="hours"
              type="number"
              step="0.5"
              min="0"
              placeholder="Ex: 2.5"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="note">Notas (opcional)</Label>
            <Textarea
              id="note"
              placeholder="Adicione observações sobre o trabalho realizado..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label>Assinatura *</Label>
            <div className="border-2 border-border rounded-md">
              <SignatureCanvas
                ref={signatureRef}
                canvasProps={{
                  className: "w-full h-40 cursor-crosshair",
                }}
                onEnd={handleSignatureEnd}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={clearSignature}
              className="w-full"
            >
              Limpar Assinatura
            </Button>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Salvando..." : "Concluir Ordem"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
