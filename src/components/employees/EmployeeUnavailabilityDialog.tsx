import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/formatDate";
import { UNAVAILABILITY_REASONS, reasonInfo, type Unavailability, type UnavailabilityReason } from "@/lib/unavailability";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employees: { id: string; name: string }[];
  initialEmployeeId?: string;
  unavailabilities: Unavailability[];
  onChanged: () => void;
}

export function EmployeeUnavailabilityDialog({ open, onOpenChange, employees, initialEmployeeId, unavailabilities, onChanged }: Props) {
  const { toast } = useToast();
  const [employeeId, setEmployeeId] = useState(initialEmployeeId ?? "");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [reason, setReason] = useState<UnavailabilityReason>("ferias");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const current = employeeId || initialEmployeeId || "";
  const list = unavailabilities.filter((u) => u.user_id === current);

  const add = async () => {
    if (!current || !start || !end) {
      toast({ title: "Preencha funcionário e datas", variant: "destructive" });
      return;
    }
    if (end < start) {
      toast({ title: "A data de fim tem de ser igual ou posterior ao início", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("profile_unavailabilities").insert({
      user_id: current, start_date: start, end_date: end, reason,
      notes: notes.trim() || null, created_by: user?.id ?? null,
    });
    setSaving(false);
    if (error) {
      toast({ title: "Erro ao guardar", description: error.message, variant: "destructive" });
      return;
    }
    setStart(""); setEnd(""); setNotes(""); setReason("ferias");
    toast({ title: "Indisponibilidade adicionada" });
    onChanged();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("profile_unavailabilities").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro ao remover", description: error.message, variant: "destructive" });
      return;
    }
    onChanged();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Indisponibilidades</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Funcionário</Label>
            <Select value={current} onValueChange={setEmployeeId}>
              <SelectTrigger><SelectValue placeholder="Selecionar funcionário" /></SelectTrigger>
              <SelectContent>
                {employees.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1"><Label>Data início</Label><Input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></div>
            <div className="space-y-1"><Label>Data fim</Label><Input type="date" value={end} min={start} onChange={(e) => setEnd(e.target.value)} /></div>
          </div>
          <div className="space-y-1">
            <Label>Motivo</Label>
            <Select value={reason} onValueChange={(v) => setReason(v as UnavailabilityReason)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {UNAVAILABILITY_REASONS.map((r) => <SelectItem key={r.value} value={r.value}>{r.icon} {r.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1"><Label>Notas (opcional)</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} rows={2} /></div>
          <Button onClick={add} disabled={saving} className="w-full">Adicionar período</Button>

          <div className="space-y-2 pt-2">
            <p className="text-sm font-medium">Períodos bloqueados</p>
            {!current ? <p className="text-xs text-muted-foreground">Selecione um funcionário.</p>
              : list.length === 0 ? <p className="text-xs text-muted-foreground">Sem períodos futuros.</p>
              : list.map((u) => (
                <div key={u.id} className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm">
                  <div>
                    <p>{reasonInfo(u.reason).icon} {reasonInfo(u.reason).label}: {formatDate(u.start_date)} – {formatDate(u.end_date)}</p>
                    {u.notes && <p className="text-xs text-muted-foreground">{u.notes}</p>}
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => remove(u.id)} aria-label="Remover">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
