import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { FileSignature, Plus, Search } from "lucide-react";

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
  maintenance_contract_equipments: { equipments: { name: string } | null }[];
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

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("maintenance_contracts")
      .select("*, profiles!maintenance_contracts_client_id_fkey(name, company_name), maintenance_contract_equipments(equipments(name))")
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
    setSelected([]);
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
    setSaving(true);
    const { data: c, error } = await supabase.from("maintenance_contracts").insert({
      client_id: form.client_id, contract_type: form.contract_type, frequency: form.frequency,
      start_date: form.start_date, next_date: form.start_date, notes: form.notes || null, created_by: user?.id,
    }).select("id").single();
    if (error || !c) {
      setSaving(false);
      toast({ title: "Erro ao criar contrato", description: error?.message, variant: "destructive" });
      return;
    }
    await supabase.from("maintenance_contract_equipments").insert(
      selected.map((id) => ({ contract_id: c.id, equipment_id: id, unit_part: equipments.find((e) => e.id === id)?.equipment_type ? "both" : "both" })),
    );
    const { error: woErr } = await supabase.rpc("create_contract_work_order", { _contract: c.id });
    setSaving(false);
    if (woErr) toast({ title: "Contrato criado, mas a OT falhou", description: woErr.message, variant: "destructive" });
    else toast({ title: "Contrato criado", description: "A primeira OT ficou pendente a aguardar data e técnico." });
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
          <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" /> Novo contrato</Button>
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
                <div key={c.id} className="rounded-lg border p-3 space-y-1 cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/work-orders?contract=${c.id}`)}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{c.profiles?.company_name || c.profiles?.name}</span>
                    <Badge variant="secondary">{CONTRACT_TYPE_LABEL[c.contract_type]}</Badge>
                    <Badge variant="outline">{FREQUENCY_LABEL[c.frequency]}</Badge>
                    <Badge variant={c.status === "active" ? "default" : "outline"}>{c.status === "active" ? "Ativo" : "Terminado"}</Badge>
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
          {filtered.length > PAGE && <DataPagination currentPage={page} totalPages={Math.ceil(filtered.length / PAGE)} onPageChange={setPage} />}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Novo contrato de manutenção</DialogTitle></DialogHeader>
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
              <Select value={form.client_id} onValueChange={(v) => setForm({ ...form, client_id: v })}>
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
            <div className="space-y-1">
              <Label>Data da primeira intervenção</Label>
              <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Notas</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>{saving ? "A guardar..." : "Criar contrato"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
