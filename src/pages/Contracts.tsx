import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataPagination } from "@/components/ui/data-pagination";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { FileSignature, Plus, Search, Pencil, Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ContractScheduleFields, scheduleToIso } from "@/components/contracts/ContractScheduleFields";

export const CONTRACT_TYPE_LABEL: Record<string, string> = {
  hvac: "Manutenção AVAC",
  heat_pump: "Manutenção Bomba de Calor",
  electricity: "Manutenção Eletricidade",
};
export const FREQUENCY_LABEL: Record<string, string> = {
  monthly: "Mensal",
  quarterly: "Trimestral",
  yearly: "Anual",
};

interface Contract {
  id: string;
  client_id: string;
  contract_type: string;
  frequency: string;
  start_date: string;
  next_date: string;
  status: string;
  notes: string | null;
  profiles: { name: string; company_name: string | null } | null;
  maintenance_contract_equipments: { equipment_id: string; equipments: { name: string } | null }[];
}

const PAGE = 10;
const fmt = (d: string) => d.split("-").reverse().join("/");

export default function Contracts() {
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("active");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);

  const [clients, setClients] = useState<{ id: string; label: string }[]>([]);
  const [equipments, setEquipments] = useState<{ id: string; name: string; serial_number: string | null; equipment_type: string }[]>([]);
  const [form, setForm] = useState({ client_id: "", contract_type: "hvac", frequency: "monthly", start_date: new Date().toISOString().slice(0, 10), notes: "" });
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [schedule, setSchedule] = useState("");
  const [technician, setTechnician] = useState("");
  const [editing, setEditing] = useState<Contract | null>(null);
  const [editExtra, setEditExtra] = useState({ next_date: "", status: "active" });
  const [toDelete, setToDelete] = useState<Contract | null>(null);
  const pendingSel = useRef<string[] | null>(null);
  const [params, setParams] = useSearchParams();
  useEffect(() => {
    const e = params.get("edit"), d = params.get("delete");
    if ((!e && !d) || !contracts.length) return;
    const c = contracts.find((x) => x.id === (e || d));
    if (c) { e ? openEdit(c) : setToDelete(c); }
    setParams({}, { replace: true });
  }, [contracts, params]);

  const openNew = () => {
    setEditing(null); pendingSel.current = null;
    setForm({ client_id: "", contract_type: "hvac", frequency: "monthly", start_date: new Date().toISOString().slice(0, 10), notes: "" });
    setSchedule(""); setTechnician(""); setOpen(true);
  };
  const openEdit = (c: Contract) => {
    setEditing(c);
    pendingSel.current = c.maintenance_contract_equipments.map((e) => e.equipment_id);
    setForm({ client_id: c.client_id, contract_type: c.contract_type, frequency: c.frequency, start_date: c.start_date, notes: c.notes || "" });
    setEditExtra({ next_date: c.next_date, status: c.status });
    setSelected(pendingSel.current);
    setOpen(true);
  };
  const saveEdit = async () => {
    if (!editing) return;
    if (!selected.length) { toast({ title: "Escolha pelo menos um equipamento", variant: "destructive" }); return; }
    setSaving(true);
    const { error } = await supabase.from("maintenance_contracts").update({
      contract_type: form.contract_type, frequency: form.frequency, notes: form.notes || null,
      next_date: editExtra.next_date || editing.next_date, status: editExtra.status,
    }).eq("id", editing.id);
    if (!error) {
      const before = editing.maintenance_contract_equipments.map((e) => e.equipment_id);
      const removed = before.filter((id) => !selected.includes(id));
      const added = selected.filter((id) => !before.includes(id));
      if (removed.length) await supabase.from("maintenance_contract_equipments").delete().eq("contract_id", editing.id).in("equipment_id", removed);
      if (added.length) await supabase.from("maintenance_contract_equipments").insert(added.map((id) => ({ contract_id: editing.id, equipment_id: id, unit_part: "both" })));
    }
    setSaving(false);
    if (error) { toast({ title: "Erro ao guardar", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Contrato atualizado" });
    setOpen(false); setEditing(null); load();
  };
  const confirmDelete = async () => {
    if (!toDelete) return;
    const { error } = await supabase.from("maintenance_contracts").delete().eq("id", toDelete.id);
    if (error) toast({ title: "Erro ao eliminar", description: error.message, variant: "destructive" });
    else toast({ title: "Contrato eliminado", description: "As OTs já criadas mantêm-se." });
    setToDelete(null); load();
  };

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("maintenance_contracts")
      .select("*, profiles!maintenance_contracts_client_id_fkey(name, company_name), maintenance_contract_equipments(equipment_id, equipments(name))")
      .order("created_at", { ascending: false });
    if (error) toast({ title: "Erro ao carregar contratos", description: error.message, variant: "destructive" });
    setContracts((data as any) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    (async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "client").eq("approved", true);
      const ids = (roles || []).map((r) => r.user_id);
      if (!ids.length) return;
      const { data } = await supabase.from("profiles").select("id, name, company_name").in("id", ids);
      setClients((data || []).map((p) => ({ id: p.id, label: p.company_name || p.name })).sort((a, b) => a.label.localeCompare(b.label)));
    })();
  }, []);

  useEffect(() => {
    if (pendingSel.current) { setSelected(pendingSel.current); pendingSel.current = null; } else setSelected([]);
    if (!form.client_id) return setEquipments([]);
    supabase.from("equipments").select("id, name, serial_number, equipment_type").eq("client_id", form.client_id).order("name")
      .then(({ data }) => setEquipments(data || []));
  }, [form.client_id]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return contracts.filter((c) => {
      if (typeFilter !== "all" && c.contract_type !== typeFilter) return false;
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (!q) return true;
      const name = (c.profiles?.company_name || c.profiles?.name || "").toLowerCase();
      const eqs = c.maintenance_contract_equipments.map((e) => e.equipments?.name || "").join(" ").toLowerCase();
      return name.includes(q) || eqs.includes(q);
    });
  }, [contracts, search, typeFilter, statusFilter]);

  const save = async () => {
    if (!form.client_id || !selected.length) {
      toast({ title: "Escolha o cliente e pelo menos um equipamento", variant: "destructive" });
      return;
    }
    if (!schedule) {
      toast({ title: "Escolha o dia e a hora da primeira intervenção", variant: "destructive" });
      return;
    }
    const startDate = schedule.slice(0, 10);
    setSaving(true);
    const { data: c, error } = await supabase.from("maintenance_contracts").insert({
      client_id: form.client_id, contract_type: form.contract_type, frequency: form.frequency,
      start_date: startDate, next_date: startDate, notes: form.notes || null, created_by: user?.id,
    }).select("id").single();
    if (error || !c) {
      setSaving(false);
      toast({ title: "Erro ao criar contrato", description: error?.message, variant: "destructive" });
      return;
    }
    await supabase.from("maintenance_contract_equipments").insert(
      selected.map((id) => ({ contract_id: c.id, equipment_id: id, unit_part: "both" })),
    );
    const { error: woErr } = await supabase.rpc("create_contract_work_order", {
      _contract: c.id, _scheduled: scheduleToIso(schedule), _technician: technician || null,
    } as any);
    setSaving(false);
    if (woErr) toast({ title: "Contrato criado, mas a OT falhou", description: woErr.message, variant: "destructive" });
    else toast({ title: "Contrato criado", description: "A primeira OT ficou agendada no calendário." });
    setSchedule(""); setTechnician("");
    setOpen(false);
    setForm({ ...form, client_id: "", notes: "" });
    load();
  };

  const rows = filtered.slice((page - 1) * PAGE, page * PAGE);

  return (
    <DashboardLayout title="Contratos">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
          <CardTitle className="flex items-center gap-2"><FileSignature className="h-5 w-5" /> Contratos de manutenção</CardTitle>
          <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Novo contrato</Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-8" placeholder="Pesquisar cliente ou equipamento" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
            </div>
            <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                {Object.entries(CONTRACT_TYPE_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Ativos</SelectItem>
                <SelectItem value="ended">Terminados</SelectItem>
                <SelectItem value="all">Todos</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {loading ? <p className="text-sm text-muted-foreground">A carregar...</p> : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem contratos.</p>
          ) : (
            <div className="space-y-2">
              {rows.map((c) => (
                <div key={c.id} className="rounded-lg border p-3 space-y-1 cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/contracts/${c.id}`)}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{c.profiles?.company_name || c.profiles?.name}</span>
                    <Badge variant="secondary">{CONTRACT_TYPE_LABEL[c.contract_type]}</Badge>
                    <Badge variant="outline">{FREQUENCY_LABEL[c.frequency]}</Badge>
                    <Badge variant={c.status === "active" ? "default" : "outline"}>{c.status === "active" ? "Ativo" : "Terminado"}</Badge>
                    <div className="ml-auto flex gap-1">
                      <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); openEdit(c); }}><Pencil className="h-4 w-4 sm:mr-1" /><span className="hidden sm:inline">Editar</span></Button>
                      <Button size="sm" variant="outline" className="text-destructive" onClick={(e) => { e.stopPropagation(); setToDelete(c); }}><Trash2 className="h-4 w-4 sm:mr-1" /><span className="hidden sm:inline">Eliminar</span></Button>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground break-words">
                    {c.maintenance_contract_equipments.map((e) => e.equipments?.name).filter(Boolean).join(", ") || "Sem equipamentos"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Início {fmt(c.start_date)}{c.status === "active" && <> • Próxima intervenção {fmt(c.next_date)}</>}
                  </p>
                </div>
              ))}
            </div>
          )}
          {filtered.length > PAGE && <DataPagination currentPage={page} totalPages={Math.ceil(filtered.length / PAGE)} onPageChange={setPage} itemsPerPage={PAGE} totalItems={filtered.length} />}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Editar contrato de manutenção" : "Novo contrato de manutenção"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Tipo</Label>
              <Select value={form.contract_type} onValueChange={(v) => setForm({ ...form, contract_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(CONTRACT_TYPE_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Periodicidade</Label>
              <Select value={form.frequency} onValueChange={(v) => setForm({ ...form, frequency: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(FREQUENCY_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Cliente</Label>
              <Select value={form.client_id} disabled={!!editing} onValueChange={(v) => setForm({ ...form, client_id: v })}>
                <SelectTrigger><SelectValue placeholder="Escolher cliente" /></SelectTrigger>
                <SelectContent>{clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {form.client_id && (
              <div className="space-y-1">
                <Label>Equipamentos a intervencionar</Label>
                {equipments.length === 0 ? <p className="text-sm text-muted-foreground">Este cliente não tem equipamentos.</p> : (
                  <div className="max-h-48 overflow-y-auto rounded border p-2 space-y-2">
                    {equipments.map((e) => (
                      <label key={e.id} className="flex items-center gap-2 text-sm">
                        <Checkbox checked={selected.includes(e.id)} onCheckedChange={(v) => setSelected(v ? [...selected, e.id] : selected.filter((x) => x !== e.id))} />
                        <span>{e.name}{e.serial_number && <span className="text-muted-foreground"> • S/N {e.serial_number}</span>}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}
            {editing ? (
              <>
                <div className="space-y-1">
                  <Label>Próxima intervenção</Label>
                  <Input type="date" value={editExtra.next_date} onChange={(e) => setEditExtra({ ...editExtra, next_date: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>Estado</Label>
                  <Select value={editExtra.status} onValueChange={(v) => setEditExtra({ ...editExtra, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="active">Ativo</SelectItem><SelectItem value="ended">Terminado</SelectItem></SelectContent>
                  </Select>
                </div>
              </>
            ) : (
            <ContractScheduleFields
              label="Data e hora da primeira intervenção"
              value={schedule}
              onChange={setSchedule}
              technician={technician}
              onTechnicianChange={setTechnician}
            />
            )}
            <div className="space-y-1">
              <Label>Notas</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={editing ? saveEdit : save} disabled={saving}>{saving ? "A guardar..." : editing ? "Guardar" : "Criar contrato"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar contrato?</AlertDialogTitle>
            <AlertDialogDescription>O contrato de {toDelete?.profiles?.company_name || toDelete?.profiles?.name} é apagado. As OTs já criadas continuam a existir, mas deixam de estar ligadas ao contrato.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={confirmDelete}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
