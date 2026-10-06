import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { formatHours } from "@/lib/formatHours";
import { Lock, Unlock, Plus, Pencil, Target } from "lucide-react";

interface Row {
  id: string;
  client_id: string;
  contracted_hours: number;
  lock_when_exhausted: boolean;
  manually_unlocked: boolean;
  clientName: string;
  used: number;
}

export function ClientHourContracts() {
  const year = new Date().getFullYear();
  const [rows, setRows] = useState<Row[]>([]);
  const [clients, setClients] = useState<{ id: string; label: string }[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [form, setForm] = useState({ client_id: "", hours: "", lock: true });
  const { toast } = useToast();

  const load = async () => {
    const { data: quotas } = await supabase
      .from("client_hour_quotas")
      .select("*")
      .eq("year", year);
    const { data: clientRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "client")
      .eq("approved", true);
    const ids = Array.from(new Set([...(clientRoles || []).map((r) => r.user_id), ...(quotas || []).map((q) => q.client_id)]));
    const { data: profiles } = ids.length
      ? await supabase.from("profiles").select("id, name, company_name").in("id", ids)
      : { data: [] as any[] };
    const nameOf = (id: string) => {
      const p = (profiles || []).find((x: any) => x.id === id);
      return p?.company_name || p?.name || "Cliente";
    };
    setClients(
      (clientRoles || [])
        .map((r) => ({ id: r.user_id, label: nameOf(r.user_id) }))
        .sort((a, b) => a.label.localeCompare(b.label))
    );
    const result: Row[] = await Promise.all(
      (quotas || []).map(async (q: any) => {
        const { data: used } = await supabase.rpc("get_client_hours_used" as any, { _client_id: q.client_id, _year: year });
        return {
          id: q.id,
          client_id: q.client_id,
          contracted_hours: Number(q.contracted_hours),
          lock_when_exhausted: q.lock_when_exhausted,
          manually_unlocked: q.manually_unlocked,
          clientName: nameOf(q.client_id),
          used: Number(used) || 0,
        };
      })
    );
    result.sort((a, b) => b.used / b.contracted_hours - a.used / a.contracted_hours);
    setRows(result);
  };

  useEffect(() => {
    load();
  }, []);

  const openNew = () => {
    setEditing(null);
    setForm({ client_id: "", hours: "", lock: true });
    setDialogOpen(true);
  };
  const openEdit = (r: Row) => {
    setEditing(r);
    setForm({ client_id: r.client_id, hours: String(r.contracted_hours), lock: r.lock_when_exhausted });
    setDialogOpen(true);
  };

  const save = async () => {
    const hours = parseFloat(form.hours);
    if (!form.client_id || !(hours > 0)) {
      toast({ title: "Erro", description: "Escolha o cliente e indique as horas", variant: "destructive" });
      return;
    }
    const payload: any = { client_id: form.client_id, year, contracted_hours: hours, lock_when_exhausted: form.lock };
    const { error } = editing
      ? await supabase.from("client_hour_quotas").update(payload).eq("id", editing.id)
      : await supabase.from("client_hour_quotas").upsert(payload, { onConflict: "client_id,year" });
    if (error) {
      toast({ title: "Erro", description: "Não foi possível guardar o contrato", variant: "destructive" });
      return;
    }
    toast({ title: "Contrato guardado" });
    setDialogOpen(false);
    load();
  };

  const toggleUnlock = async (r: Row) => {
    const { error } = await supabase
      .from("client_hour_quotas")
      .update({ manually_unlocked: !r.manually_unlocked } as any)
      .eq("id", r.id);
    if (error) {
      toast({ title: "Erro", description: "Não foi possível alterar", variant: "destructive" });
      return;
    }
    toast({ title: r.manually_unlocked ? "Cliente bloqueado" : "Cliente desbloqueado" });
    load();
  };

  const available = useMemo(
    () => clients.filter((c) => editing?.client_id === c.id || !rows.some((r) => r.client_id === c.id)),
    [clients, rows, editing]
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          Clientes com Contrato de Horas {year}
        </CardTitle>
        <Button size="sm" onClick={openNew}>
          <Plus className="h-4 w-4 mr-1" /> Novo contrato
        </Button>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Nenhum cliente com contrato de horas este ano.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {rows.map((r) => {
              const pct = Math.min(100, (r.used / r.contracted_hours) * 100);
              const exhausted = r.used >= r.contracted_hours;
              const locked = exhausted && r.lock_when_exhausted && !r.manually_unlocked;
              return (
                <div key={r.id} className="min-w-0 rounded-lg border p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{r.clientName}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatHours(r.used)} de {r.contracted_hours}h · restam {formatHours(Math.max(0, r.contracted_hours - r.used))}
                      </p>
                    </div>
                    {locked ? (
                      <Badge variant="destructive" className="shrink-0 gap-1"><Lock className="h-3 w-3" />Bloqueado</Badge>
                    ) : exhausted && r.manually_unlocked ? (
                      <Badge variant="outline" className="shrink-0 gap-1"><Unlock className="h-3 w-3" />Desbloqueado</Badge>
                    ) : pct >= 80 ? (
                      <Badge variant="outline" className="shrink-0 text-warning border-warning">Quase a esgotar</Badge>
                    ) : (
                      <Badge variant="secondary">Ativo</Badge>
                    )}
                  </div>
                  <Progress value={pct} className="h-2" />
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground">
                      {pct.toFixed(0)}% · {r.lock_when_exhausted ? "bloqueia ao esgotar" : "sem bloqueio"}
                    </span>
                    <div className="flex gap-1">
                      {exhausted && r.lock_when_exhausted && (
                        <Button size="sm" variant="outline" onClick={() => toggleUnlock(r)}>
                          {r.manually_unlocked ? <><Lock className="h-3 w-3 mr-1" />Bloquear</> : <><Unlock className="h-3 w-3 mr-1" />Desbloquear</>}
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => openEdit(r)} aria-label="Editar contrato">
                        <Pencil className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar contrato" : "Novo contrato de horas"} {year}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Cliente</Label>
              <Select value={form.client_id} onValueChange={(v) => setForm({ ...form, client_id: v })} disabled={!!editing}>
                <SelectTrigger><SelectValue placeholder="Escolher cliente" /></SelectTrigger>
                <SelectContent>
                  {available.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Horas contratadas</Label>
              <Input type="number" min="1" step="0.5" value={form.hours} onChange={(e) => setForm({ ...form, hours: e.target.value })} />
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <p className="text-sm font-medium">Bloquear quando esgotar</p>
                <p className="text-xs text-muted-foreground">O cliente deixa de poder pedir novas OTs até desbloquear.</p>
              </div>
              <Switch checked={form.lock} onCheckedChange={(v) => setForm({ ...form, lock: v })} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={save}>Guardar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
