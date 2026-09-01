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
import { formatHours } from "@/lib/formatHours";
import { WorkRegime, entryRegime, regimeLabel } from "@/lib/workRegime";

interface TimeEntry {
  id: string;
  user_id: string;
  start_time: string;
  end_time: string | null;
  duration_hours: number | null;
  note: string | null;
  pause_reason: string | null;
  work_regime: WorkRegime | null;
  user_name?: string;
}

interface EditTimeEntriesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workOrderId: string;
  workOrderReference: string;
  onUpdate: () => void;
  /** Quando true, as horas só podem ser consultadas (OT concluída/faturada) */
  readOnly?: boolean;
  /** Modo gerente: mostra e permite editar as sessões de todos os técnicos */
  allUsers?: boolean;
}

export function EditTimeEntriesDialog({
  open,
  onOpenChange,
  workOrderId,
  workOrderReference,
  onUpdate,
  readOnly = false,
  allUsers = false,
}: EditTimeEntriesDialogProps) {
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);
  const [deleteEntryId, setDeleteEntryId] = useState<string | null>(null);
  const [editHours, setEditHours] = useState("");
  const [editNote, setEditNote] = useState("");
  const [editRegime, setEditRegime] = useState<WorkRegime>("labor");
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchTimeEntries();
    }
  }, [open, workOrderId]);

  const fetchTimeEntries = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    let query = supabase
      .from("time_entries")
      .select("*, profiles!time_entries_user_id_fkey (name)")
      .eq("work_order_id", workOrderId);

    if (!allUsers) query = query.eq("user_id", user.id);

    const { data, error } = await query.order("start_time", { ascending: false });

    if (error) {
      console.error("Error fetching time entries:", error);
      return;
    }

    setTimeEntries(
      (data || []).map((e: any) => ({ ...e, user_name: e.profiles?.name })) as any
    );
  };

  const totals = timeEntries.reduce(
    (acc, e) => {
      const h = Number(e.duration_hours) || 0;
      if (entryRegime(e) === "labor") acc.labor += h;
      else acc.after += h;
      return acc;
    },
    { labor: 0, after: 0 }
  );

  const handleRegimeChange = async (entry: TimeEntry, regime: WorkRegime) => {
    if (readOnly || entryRegime(entry) === regime) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from("time_entries")
        .update({ work_regime: regime } as any)
        .eq("id", entry.id);
      if (error) throw error;
      await fetchTimeEntries();
      onUpdate();
    } catch (error) {
      console.error("Error updating regime:", error);
      toast({
        title: "Erro",
        description: "Não foi possível alterar o regime desta sessão",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (entry: TimeEntry) => {
    setEditingEntry(entry);
    setEditHours(entry.duration_hours?.toString() || "");
    setEditNote(entry.note || "");
    setEditRegime(entryRegime(entry));
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
          work_regime: editRegime,
        } as any)
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
      saida_temporaria: "Vou sair, mas irei voltar",
    };

    return labels[reason] || reason;
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {readOnly ? "Horas Registadas" : "Gerenciar Horas"} - {workOrderReference}
            </DialogTitle>
          </DialogHeader>

          {readOnly && (
            <p className="rounded-md border border-muted bg-muted/40 p-3 text-xs text-muted-foreground">
              Esta ordem de trabalho está fechada. As horas já não podem ser alteradas — contacte o gerente se for necessário corrigir algum registo.
            </p>
          )}

          {timeEntries.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border p-3 bg-success/5">
                <p className="text-xs text-muted-foreground">Horas laborais</p>
                <p className="text-lg font-bold text-success">{formatHours(totals.labor)}</p>
              </div>
              <div className="rounded-lg border p-3 bg-warning/5">
                <p className="text-xs text-muted-foreground">Horas pós-laborais</p>
                <p className="text-lg font-bold text-warning">{formatHours(totals.after)}</p>
              </div>
            </div>
          )}

          {timeEntries.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhuma entrada de tempo registrada
            </p>
          ) : (
            <div className="space-y-3">
              {timeEntries.map((entry) => {
                const regime = entryRegime(entry);
                return (
                  <div key={entry.id} className="rounded-lg border p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">
                            {format(new Date(entry.start_time), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                            {entry.end_time && ` - ${format(new Date(entry.end_time), "HH:mm", { locale: ptBR })}`}
                          </span>
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                              regime === "labor"
                                ? "bg-success/10 text-success"
                                : "bg-warning/10 text-warning"
                            }`}
                          >
                            {regimeLabel(regime)}
                          </span>
                        </div>
                        {allUsers && entry.user_name && (
                          <p className="text-xs font-medium">Técnico: {entry.user_name}</p>
                        )}
                        {entry.duration_hours && (
                          <p className="text-sm text-muted-foreground">
                            Duração: {formatHours(entry.duration_hours)}
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
                        {!readOnly && (
                          <div className="flex items-center gap-2 pt-1">
                            <Button
                              size="sm"
                              variant={regime === "labor" ? "default" : "outline"}
                              disabled={loading}
                              onClick={() => handleRegimeChange(entry, "labor")}
                            >
                              Laboral
                            </Button>
                            <Button
                              size="sm"
                              variant={regime === "after" ? "default" : "outline"}
                              disabled={loading}
                              onClick={() => handleRegimeChange(entry, "after")}
                            >
                              Pós-laboral
                            </Button>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        {entry.end_time && !readOnly && (
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
                );
              })}
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
              <Label>Regime de trabalho *</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={editRegime === "labor" ? "default" : "outline"}
                  onClick={() => setEditRegime("labor")}
                >
                  Laboral
                </Button>
                <Button
                  type="button"
                  variant={editRegime === "after" ? "default" : "outline"}
                  onClick={() => setEditRegime("after")}
                >
                  Pós-laboral
                </Button>
              </div>
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
