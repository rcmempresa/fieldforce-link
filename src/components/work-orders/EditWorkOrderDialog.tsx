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
      })
      .eq("id", workOrder.id);

    setLoading(false);

    if (error) {
      toast({
        title: "Erro",
        description: "Erro ao atualizar ordem de trabalho",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Sucesso",
        description: "Ordem de trabalho atualizada com sucesso",
      });
      onOpenChange(false);
      onSuccess();
    }
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
