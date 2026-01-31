import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import SignatureCanvas from "react-signature-canvas";
import { generateWorkOrderPDF, uploadWorkOrderPDF } from "@/lib/generateWorkOrderPDF";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, UserCheck, CheckCircle } from "lucide-react";

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
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"end_session" | "complete_order">("end_session");
  const [hasActiveSession, setHasActiveSession] = useState(false);
  const [otherActiveEmployees, setOtherActiveEmployees] = useState<{ name: string }[]>([]);
  const { toast } = useToast();
  const signatureRef = useRef<SignatureCanvas>(null);
  const [signatureEmpty, setSignatureEmpty] = useState(true);

  useEffect(() => {
    if (open) {
      checkActiveSessions();
    }
  }, [open, workOrderId]);

  const checkActiveSessions = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Check if current user has active session
    const { data: mySession } = await supabase
      .from("time_entries")
      .select("id")
      .eq("work_order_id", workOrderId)
      .eq("user_id", user.id)
      .is("end_time", null)
      .maybeSingle();

    setHasActiveSession(!!mySession);

    // Check for other active sessions
    const { data: otherSessions } = await supabase
      .from("time_entries")
      .select(`
        user_id,
        profiles!time_entries_user_id_fkey (name)
      `)
      .eq("work_order_id", workOrderId)
      .is("end_time", null)
      .neq("user_id", user.id);

    if (otherSessions) {
      setOtherActiveEmployees(
        otherSessions.map((s: any) => ({ name: s.profiles?.name || "N/A" }))
      );
    }
  };

  const clearSignature = () => {
    signatureRef.current?.clear();
    setSignatureEmpty(true);
  };

  const handleSignatureEnd = () => {
    setSignatureEmpty(signatureRef.current?.isEmpty() ?? true);
  };

  const handleEndMySession = async () => {
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const now = new Date();

      // Get active time entry for current user
      const { data: activeTimeEntry } = await supabase
        .from("time_entries")
        .select("id, start_time")
        .eq("work_order_id", workOrderId)
        .eq("user_id", user.id)
        .is("end_time", null)
        .single();

      if (!activeTimeEntry) {
        toast({
          title: "Aviso",
          description: "Não tem uma sessão ativa para terminar",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // Calculate duration
      const startTime = new Date(activeTimeEntry.start_time);
      const sessionDurationHours = (now.getTime() - startTime.getTime()) / (1000 * 60 * 60);

      // Finalize time entry
      const { error: timeEntryError } = await supabase
        .from("time_entries")
        .update({
          end_time: now.toISOString(),
          duration_hours: sessionDurationHours,
          note: note || null,
        })
        .eq("id", activeTimeEntry.id);

      if (timeEntryError) throw timeEntryError;

      // Check if there are other active sessions
      const { count: otherActiveSessions } = await supabase
        .from("time_entries")
        .select("*", { count: "exact", head: true })
        .eq("work_order_id", workOrderId)
        .is("end_time", null)
        .neq("user_id", user.id);

      // Update status based on other sessions
      const newStatus = (otherActiveSessions && otherActiveSessions > 0) ? "in_progress" : "pending";

      const { error: updateError } = await supabase
        .from("work_orders")
        .update({ status: newStatus })
        .eq("id", workOrderId);

      if (updateError) throw updateError;

      toast({
        title: "Sessão Terminada",
        description: otherActiveSessions && otherActiveSessions > 0
          ? "A sua sessão foi terminada. Outros funcionários ainda estão a trabalhar."
          : "A sua sessão foi terminada. A ordem está agora pendente.",
      });

      setNote("");
      onOpenChange(false);
      onComplete();
    } catch (error) {
      console.error("Error ending session:", error);
      toast({
        title: "Erro",
        description: "Erro ao terminar sessão",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteOrder = async (e: React.FormEvent) => {
    e.preventDefault();

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

      const now = new Date();

      // Finalize ALL active time entries for this work order
      const { data: activeTimeEntries } = await supabase
        .from("time_entries")
        .select("id, start_time, user_id")
        .eq("work_order_id", workOrderId)
        .is("end_time", null);

      if (activeTimeEntries && activeTimeEntries.length > 0) {
        for (const entry of activeTimeEntries) {
          const startTime = new Date(entry.start_time);
          const durationHours = (now.getTime() - startTime.getTime()) / (1000 * 60 * 60);

          await supabase
            .from("time_entries")
            .update({
              end_time: now.toISOString(),
              duration_hours: durationHours,
              note: entry.user_id === user.id ? (note || null) : null,
            })
            .eq("id", entry.id);
        }
      }

      // Get total hours worked on this work order (sum of ALL employees' time entries)
      const { data: allTimeEntries } = await supabase
        .from("time_entries")
        .select("duration_hours")
        .eq("work_order_id", workOrderId);
      
      const totalHoursWorked = (allTimeEntries || []).reduce(
        (sum, entry) => sum + (entry.duration_hours || 0), 
        0
      );

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

      // Get client email via secure edge function
      let clientEmail = "N/A";
      if (workOrder.client_id) {
        try {
          const { data: emailData } = await supabase.functions.invoke("get-user-email", {
            body: { userId: workOrder.client_id },
          });
          clientEmail = emailData?.email || "N/A";
        } catch (emailError) {
          console.error("Error fetching client email:", emailError);
        }
      }

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
          client_email: clientEmail,
          assigned_employees: (workOrder.assignments as any[])?.map((a: any) => ({ name: a.user.name })) || [],
          total_hours: workOrder.total_hours,
          created_at: workOrder.created_at,
          completed_at: now.toISOString(),
        },
        signatureDataUrl,
        currentProfile?.name || user.email || "Funcionário",
        totalHoursWorked,
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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Terminar Trabalho</DialogTitle>
          <DialogDescription>
            Escolha se quer apenas terminar a sua sessão ou concluir a ordem de trabalho completamente.
          </DialogDescription>
        </DialogHeader>
        
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="end_session" className="flex items-center gap-1.5 text-xs">
              <UserCheck className="h-4 w-4" />
              Terminar Sessão
            </TabsTrigger>
            <TabsTrigger value="complete_order" className="flex items-center gap-1.5 text-xs">
              <CheckCircle className="h-4 w-4" />
              Concluir OT
            </TabsTrigger>
          </TabsList>

          <TabsContent value="end_session" className="mt-4 space-y-4">
            <div className="rounded-lg border bg-muted/50 p-3">
              <p className="text-sm text-muted-foreground">
                Terminar apenas a sua sessão de trabalho. A ordem de trabalho continuará disponível para outros funcionários ou para retomar mais tarde.
              </p>
            </div>

            {!hasActiveSession && (
              <div className="rounded-lg border border-warning/50 bg-warning/10 p-3 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-warning mt-0.5" />
                <p className="text-sm text-warning">
                  Não tem uma sessão ativa para terminar.
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="note-session">Notas (opcional)</Label>
              <Textarea
                id="note-session"
                placeholder="Adicione observações sobre o trabalho realizado..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={handleEndMySession} 
                disabled={loading || !hasActiveSession}
              >
                {loading ? "A terminar..." : "Terminar Minha Sessão"}
              </Button>
            </DialogFooter>
          </TabsContent>

          <TabsContent value="complete_order" className="mt-4">
            <form onSubmit={handleCompleteOrder} className="space-y-4">
              {otherActiveEmployees.length > 0 && (
                <div className="rounded-lg border border-warning/50 bg-warning/10 p-3 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-warning mt-0.5" />
                  <div className="text-sm text-warning">
                    <p className="font-medium">Atenção!</p>
                    <p>
                      Os seguintes funcionários ainda estão a trabalhar nesta ordem e as suas sessões serão terminadas automaticamente:
                    </p>
                    <ul className="list-disc list-inside mt-1">
                      {otherActiveEmployees.map((emp, idx) => (
                        <li key={idx}>{emp.name}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              <div className="rounded-lg border bg-muted/50 p-3">
                <p className="text-sm text-muted-foreground">
                  Concluir a ordem de trabalho completamente. Isto irá terminar todas as sessões ativas e marcar a ordem como concluída.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="note-complete">Notas (opcional)</Label>
                <Textarea
                  id="note-complete"
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
                  {loading ? "A concluir..." : "Concluir Ordem"}
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
