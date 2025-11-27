import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Edit2, Trash2, Clock } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

interface TimeEntry {
  id: string;
  start_time: string;
  end_time: string | null;
  duration_hours: number | null;
  note: string | null;
  pause_reason: string | null;
}

interface EditTimeEntriesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workOrderId: string;
  workOrderReference: string;
  onUpdate: () => void;
}

export function EditTimeEntriesDialog({
  open,
  onOpenChange,
  workOrderId,
  workOrderReference,
  onUpdate,
}: EditTimeEntriesDialogProps) {
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);
  const [deleteEntryId, setDeleteEntryId] = useState<string | null>(null);
  const [editHours, setEditHours] = useState("");
  const [editNote, setEditNote] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchTimeEntries();
    }
  }, [open, workOrderId]);

  const fetchTimeEntries = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("time_entries")
      .select("*")
      .eq("work_order_id", workOrderId)
      .eq("user_id", user.id)
      .order("start_time", { ascending: false });

    if (error) {
      console.error("Error fetching time entries:", error);
      return;
    }

    setTimeEntries(data || []);
  };

  const handleEditClick = (entry: TimeEntry) => {
    setEditingEntry(entry);
    setEditHours(entry.duration_hours?.toString() || "");
    setEditNote(entry.note || "");
  };

  const handleSaveEdit = async () => {
    if (!editingEntry) return;

    if (!editHours || parseFloat(editHours) <= 0) {
      toast({
        title: "Erro",
        description: "Por favor, insira um número válido de horas",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const hours = parseFloat(editHours);
      const startTime = new Date(editingEntry.start_time);
      const endTime = new Date(startTime.getTime() + hours * 60 * 60 * 1000);

      const { error } = await supabase
        .from("time_entries")
        .update({
          duration_hours: hours,
          end_time: endTime.toISOString(),
          note: editNote || null,
        })
        .eq("id", editingEntry.id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Entrada de tempo atualizada",
      });

      setEditingEntry(null);
      setEditHours("");
      setEditNote("");
      await fetchTimeEntries();
      onUpdate();
    } catch (error) {
      console.error("Error updating time entry:", error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar entrada de tempo",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteEntryId) return;

    setLoading(true);

    try {
      const { error } = await supabase
        .from("time_entries")
        .delete()
        .eq("id", deleteEntryId);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Entrada de tempo removida",
      });

      setDeleteEntryId(null);
      await fetchTimeEntries();
      onUpdate();
    } catch (error) {
      console.error("Error deleting time entry:", error);
      toast({
        title: "Erro",
        description: "Erro ao remover entrada de tempo",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getPauseReasonLabel = (reason: string | null) => {
    if (!reason) return null;
    
    const labels: Record<string, string> = {
      falta_material: "Falta de Material",
      enviado_oficina: "Enviado para a oficina",
      enviado_orcamento: "Enviado Orçamento",
      assinatura_gerente: "Assinatura do Gerente",
    };
    
    return labels[reason] || reason;
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Gerenciar Horas - {workOrderReference}</DialogTitle>
          </DialogHeader>
          
          {timeEntries.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhuma entrada de tempo registrada
            </p>
          ) : (
            <div className="space-y-3">
              {timeEntries.map((entry) => (
                <div key={entry.id} className="rounded-lg border p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">
                          {format(new Date(entry.start_time), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                          {entry.end_time && ` - ${format(new Date(entry.end_time), "HH:mm", { locale: ptBR })}`}
                        </span>
                      </div>
                      {entry.duration_hours && (
                        <p className="text-sm text-muted-foreground">
                          Duração: {entry.duration_hours.toFixed(2)}h
                        </p>
                      )}
                      {!entry.end_time && (
                        <p className="text-sm text-primary font-medium">
                          Em andamento
                        </p>
                      )}
                      {entry.pause_reason && (
                        <p className="text-xs text-warning">
                          Pausado: {getPauseReasonLabel(entry.pause_reason)}
                        </p>
                      )}
                      {entry.note && (
                        <p className="text-xs text-muted-foreground">
                          Nota: {entry.note}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {entry.end_time && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEditClick(entry)}
                          >
                            <Edit2 className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setDeleteEntryId(entry.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingEntry} onOpenChange={(open) => !open && setEditingEntry(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Entrada de Tempo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-hours">Horas Trabalhadas *</Label>
              <Input
                id="edit-hours"
                type="number"
                step="0.5"
                min="0"
                placeholder="Ex: 2.5"
                value={editHours}
                onChange={(e) => setEditHours(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-note">Notas</Label>
              <Textarea
                id="edit-note"
                placeholder="Observações..."
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditingEntry(null)}
              >
                Cancelar
              </Button>
              <Button onClick={handleSaveEdit} disabled={loading}>
                {loading ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteEntryId} onOpenChange={(open) => !open && setDeleteEntryId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Entrada de Tempo</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover esta entrada de tempo? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} disabled={loading}>
              {loading ? "Removendo..." : "Remover"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
