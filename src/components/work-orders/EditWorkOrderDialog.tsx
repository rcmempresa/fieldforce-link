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
    }
  }, [open, workOrder]);

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
          ? new Date(data.scheduled_date).toISOString().slice(0, 16)
          : "",
        notes: data.notes || "",
        address: data.address || "",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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

          <div className="space-y-2">
            <Label htmlFor="scheduled_date">Data Agendada</Label>
            <Input
              id="scheduled_date"
              type="datetime-local"
              value={formData.scheduled_date}
              onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Morada do Local</Label>
            <Input
              id="address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="Ex: Rua do Exemplo, 123, Lisboa"
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
