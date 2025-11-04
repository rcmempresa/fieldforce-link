import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

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

      // Update work order status to completed
      const { error: updateError } = await supabase
        .from("work_orders")
        .update({ status: "completed" })
        .eq("id", workOrderId);

      if (updateError) throw updateError;

      toast({
        title: "Sucesso",
        description: `Ordem ${workOrderReference} concluída!`,
      });

      setHours("");
      setNote("");
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
