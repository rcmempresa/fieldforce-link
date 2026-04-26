import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  getBusyEmployeeIds,
  getSlot,
  getSlotLabel,
  MAX_PER_SLOT,
} from "@/lib/employeeAvailability";
import { SlotDateTimePicker } from "./SlotDateTimePicker";

interface EditWorkOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workOrder: {
    id: string;
    title: string;
    status: string;
    priority: string;
    scheduled_date: string | null;
  };
  onSuccess: () => void;
}

export function EditWorkOrderDialog({
  open,
  onOpenChange,
  workOrder,
  onSuccess,
}: EditWorkOrderDialogProps) {
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState<{ id: string; name: string }[]>([]);
  const [assignedIds, setAssignedIds] = useState<string[]>([]);
  const [busyEmployeeIds, setBusyEmployeeIds] = useState<Set<string>>(new Set());
  const [overbookingConfirm, setOverbookingConfirm] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    status: "",
    priority: "",
    scheduled_date: "",
    notes: "",
    address: "",
  });
  const { toast } = useToast();

  useEffect(() => {
    if (open && workOrder) {
      fetchWorkOrderDetails();
      fetchEmployees();
      fetchAssignedEmployees();
    }
  }, [open, workOrder]);

  // Recalcular ocupação quando data ou funcionários mudam
  useEffect(() => {
    const loadBusy = async () => {
      if (!formData.scheduled_date || employees.length === 0) {
        setBusyEmployeeIds(new Set());
        return;
      }
      const ids = await getBusyEmployeeIds(
        new Date(formData.scheduled_date),
        employees.map((e) => e.id),
        workOrder.id
      );
      setBusyEmployeeIds(ids);
    };
    loadBusy();
  }, [formData.scheduled_date, employees, workOrder.id]);

  const fetchEmployees = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("list-users", {
        body: { role: "employee" },
      });
      if (error) return;
      if (data?.users) {
        setEmployees(data.users.map((u: any) => ({ id: u.id, name: u.name })));
      }
    } catch (e) {
      console.error("Error fetching employees:", e);
    }
  };

  const fetchAssignedEmployees = async () => {
    const { data } = await supabase
      .from("work_order_assignments")
      .select("user_id")
      .eq("work_order_id", workOrder.id);
    if (data) setAssignedIds(data.map((d) => d.user_id));
  };

  const toggleEmployee = (employeeId: string) => {
    setAssignedIds((prev) =>
      prev.includes(employeeId)
        ? prev.filter((id) => id !== employeeId)
        : [...prev, employeeId]
    );
  };

  const fetchWorkOrderDetails = async () => {
    const { data } = await supabase
      .from("work_orders")
      .select("*")
      .eq("id", workOrder.id)
      .single();

    if (data) {
      setFormData({
        title: data.title || "",
        description: data.description || "",
        status: data.status || "",
        priority: data.priority || "",
        scheduled_date: data.scheduled_date
          ? (() => {
              const d = new Date(data.scheduled_date);
              const pad = (n: number) => String(n).padStart(2, "0");
              return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
                d.getDate()
              )}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
            })()
          : "",
        notes: data.notes || "",
        address: data.address || "",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Verificar overbooking
    if (
      formData.scheduled_date &&
      assignedIds.some((id) => busyEmployeeIds.has(id))
    ) {
      setOverbookingConfirm(true);
      return;
    }

    await submitUpdate();
  };

  const submitUpdate = async () => {
    setLoading(true);

    const { error } = await supabase
      .from("work_orders")
      .update({
        title: formData.title,
        description: formData.description,
        status: formData.status as "pending" | "in_progress" | "completed" | "cancelled",
        priority: formData.priority as "low" | "medium" | "high",
        scheduled_date: formData.scheduled_date || null,
        notes: formData.notes,
        address: formData.address || null,
      })
      .eq("id", workOrder.id);

    if (error) {
      setLoading(false);
      toast({
        title: "Erro",
        description: "Erro ao atualizar ordem de trabalho",
        variant: "destructive",
      });
      return;
    }

    // Sincronizar assignments
    {
      const { data: existing } = await supabase
        .from("work_order_assignments")
        .select("user_id")
        .eq("work_order_id", workOrder.id);
      const existingIds = new Set((existing || []).map((e) => e.user_id));
      const newIds = new Set(assignedIds);

      const toRemove = [...existingIds].filter((id) => !newIds.has(id));
      const toAdd = [...newIds].filter((id) => !existingIds.has(id));

      if (toRemove.length > 0) {
        await supabase
          .from("work_order_assignments")
          .delete()
          .eq("work_order_id", workOrder.id)
          .in("user_id", toRemove);
      }
      if (toAdd.length > 0) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.from("work_order_assignments").insert(
            toAdd.map((uid) => ({
              work_order_id: workOrder.id,
              user_id: uid,
              assigned_by: user.id,
            }))
          );
        }
      }
    }

    // Get work order details for notifications
    const { data: workOrderData } = await supabase
      .from("work_orders")
      .select(`
        reference,
        client_id,
        profiles!work_orders_client_id_fkey(name)
      `)
      .eq("id", workOrder.id)
      .single();

    if (workOrderData) {
      const clientProfile = workOrderData.profiles as any;

      // Notify client
      if (workOrderData.client_id) {
        await supabase.from("notifications").insert({
          user_id: workOrderData.client_id,
          work_order_id: workOrder.id,
          type: "work_order_updated",
          channel: "email",
          payload: JSON.stringify({
            reference: workOrderData.reference,
            message: `Ordem de trabalho ${workOrderData.reference} foi atualizada`,
          }),
        });

        if (clientProfile) {
          supabase.functions.invoke("send-notification-email", {
            body: {
              type: "work_order_updated",
              userId: workOrderData.client_id,
              data: {
                recipientName: clientProfile.name,
                workOrderReference: workOrderData.reference || "",
                workOrderTitle: formData.title,
                changes: "Estado, prioridade ou detalhes atualizados",
              },
            },
          });
        }
      }

      // Notify assigned employees
      const { data: assignments } = await supabase
        .from("work_order_assignments")
        .select("user_id, profiles!work_order_assignments_user_id_fkey(name)")
        .eq("work_order_id", workOrder.id);

      if (assignments && assignments.length > 0) {
        const employeeNotifications = assignments.map((assignment: any) => ({
          user_id: assignment.user_id,
          work_order_id: workOrder.id,
          type: "work_order_updated",
          channel: "email" as const,
          payload: JSON.stringify({
            reference: workOrderData.reference,
            message: `Ordem ${workOrderData.reference} foi atualizada`,
          }),
        }));
        await supabase.from("notifications").insert(employeeNotifications);

        for (const assignment of assignments) {
          const employeeProfile = assignment.profiles as any;
          if (employeeProfile) {
            supabase.functions.invoke("send-notification-email", {
              body: {
                type: "work_order_updated",
                userId: assignment.user_id,
                data: {
                  recipientName: employeeProfile.name,
                  workOrderReference: workOrderData.reference || "",
                  workOrderTitle: formData.title,
                  changes: "Estado, prioridade ou detalhes atualizados",
                },
              },
            });
          }
        }
      }

      // Notify all managers
      const { data: managers } = await supabase
        .from("user_roles")
        .select("user_id, profiles!user_roles_user_id_fkey(name)")
        .eq("role", "manager")
        .eq("approved", true);

      if (managers && managers.length > 0) {
        const managerNotifications = managers.map((manager: any) => ({
          user_id: manager.user_id,
          work_order_id: workOrder.id,
          type: "work_order_updated",
          channel: "email" as const,
          payload: JSON.stringify({
            reference: workOrderData.reference,
            client_name: clientProfile?.name || "Cliente",
            message: `Ordem ${workOrderData.reference} foi atualizada`,
          }),
        }));
        await supabase.from("notifications").insert(managerNotifications);

        for (const manager of managers) {
          const managerProfile = manager.profiles as any;
          if (managerProfile) {
            supabase.functions.invoke("send-notification-email", {
              body: {
                type: "work_order_updated",
                userId: manager.user_id,
                data: {
                  recipientName: managerProfile.name,
                  workOrderReference: workOrderData.reference || "",
                  workOrderTitle: formData.title,
                  clientName: clientProfile?.name || "Cliente",
                  changes: "Estado, prioridade ou detalhes atualizados",
                  isManager: true,
                },
              },
            });
          }
        }
      }
    }

    setLoading(false);
    toast({
      title: "Sucesso",
      description: "Ordem de trabalho atualizada com sucesso",
    });
    onOpenChange(false);
    onSuccess();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Ordem de Trabalho</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Título *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={4}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="status">Estado</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value })}
              >
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="in_progress">Em Progresso</SelectItem>
                  <SelectItem value="completed">Concluída</SelectItem>
                  <SelectItem value="cancelled">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Prioridade</Label>
              <Select
                value={formData.priority}
                onValueChange={(value) => setFormData({ ...formData, priority: value })}
              >
                <SelectTrigger id="priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Baixa</SelectItem>
                  <SelectItem value="medium">Média</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <SlotDateTimePicker
            value={formData.scheduled_date}
            onChange={(value) =>
              setFormData((prev) => ({ ...prev, scheduled_date: value }))
            }
            excludeWorkOrderId={workOrder.id}
          />

          <div className="space-y-2">
            <Label htmlFor="address">Morada do Local</Label>
            <Input
              id="address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="Ex: Rua do Exemplo, 123, Lisboa"
            />
          </div>

          {employees.length > 0 && (
            <div className="space-y-2">
              <Label>Funcionários Atribuídos</Label>
              <div className="border rounded-lg p-3 space-y-2 max-h-48 overflow-y-auto">
                {employees.map((employee) => {
                  const busy = busyEmployeeIds.has(employee.id);
                  return (
                    <label
                      key={employee.id}
                      className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 p-2 rounded"
                    >
                      <input
                        type="checkbox"
                        checked={assignedIds.includes(employee.id)}
                        onChange={() => toggleEmployee(employee.id)}
                        className="h-4 w-4"
                      />
                      <span className="font-medium text-sm flex-1">{employee.name}</span>
                      {formData.scheduled_date && (
                        busy ? (
                          <Badge variant="destructive" className="text-[10px] py-0 h-5">Ocupado</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px] py-0 h-5">Disponível</Badge>
                        )
                      )}
                    </label>
                  );
                })}
              </div>
              {formData.scheduled_date &&
                employees.length > 0 &&
                busyEmployeeIds.size === employees.length && (() => {
                  const slot = getSlot(new Date(formData.scheduled_date));
                  return (
                    <p className="text-xs text-destructive">
                      Todos os funcionários já têm uma OT no slot das{" "}
                      {slot !== null ? getSlotLabel(slot) : "—"}. Pode confirmar
                      overbooking ou escolher outro horário/dia.
                    </p>
                  );
                })()}
            </div>
          )}

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

      <AlertDialog open={overbookingConfirm} onOpenChange={setOverbookingConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar overbooking</AlertDialogTitle>
            <AlertDialogDescription>
              Selecionou funcionários que já têm {MAX_PER_SLOT} OT no mesmo
              slot horário do dia escolhido. Deseja guardar mesmo assim
              (overbooking) ou cancelar para escolher outro horário/funcionário?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                setOverbookingConfirm(false);
                await submitUpdate();
              }}
            >
              Confirmar overbooking
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
