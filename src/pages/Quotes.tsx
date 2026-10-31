import { useCallback, useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ReportLogoPicker } from "@/components/work-orders/ReportLogoPicker";
import { generateQuotePDF, type QuoteData } from "@/lib/generateQuotePDF";
import { Download, FileText, Pencil, Plus, Trash2 } from "lucide-react";

const VAT_RATE = 0.22;
const LOGO_KEY = "quote_logo";
const UNIT_SUGGESTIONS = ["un", "m²", "h", "vb", "ml", "m"];

const STATUS_LABELS: Record<string, string> = {
  rascunho: "Rascunho",
  enviado: "Enviado",
  aceite: "Aceite",
  rejeitado: "Rejeitado",
  expirado: "Expirado",
};

const STATUS_CLASSES: Record<string, string> = {
  rascunho: "bg-muted text-muted-foreground",
  enviado: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  aceite: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  rejeitado: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  expirado: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300",
};

interface QuoteItemRow {
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total: number;
}

interface Quote {
  id: string;
  reference: string | null;
  client_id: string | null;
  client_name: string;
  client_nif: string | null;
  client_address: string | null;
  client_phone: string | null;
  client_email: string | null;
  work_order_id: string | null;
  status: string;
  requires_visit: boolean;
  items: QuoteItemRow[];
  subtotal: number;
  vat_rate: number;
  vat_amount: number;
  total: number;
  valid_days: number;
  valid_until: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  sent_at: string | null;
  accepted_at: string | null;
}

interface ItemForm {
  description: string;
  unit: string;
  quantity: string;
  unit_price: string;
}

interface ClientOption {
  id: string;
  label: string;
  name: string;
  phone: string | null;
  address: string | null;
}

interface WorkOrderOption {
  id: string;
  reference: string | null;
  title: string;
  client: string;
}

const emptyItem = (): ItemForm => ({ description: "", unit: "un", quantity: "1", unit_price: "" });

const emptyForm = () => ({
  clientMode: "existing" as "existing" | "manual",
  client_id: "",
  client_name: "",
  client_nif: "",
  client_address: "",
  client_phone: "",
  client_email: "",
  requires_visit: false,
  work_order_id: "",
  valid_days: 30,
  status: "rascunho",
  items: [emptyItem()],
  notes: "",
});

const money = (value: number) => `${value.toFixed(2)} €`;
const fmtDate = (iso?: string | null) => {
  if (!iso) return "-";
  const d = iso.slice(0, 10).split("-");
  return d.length === 3 ? `${d[2]}/${d[1]}/${d[0]}` : iso;
};

export default function Quotes() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("todos");
  const [search, setSearch] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Quote | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [logo, setLogo] = useState<string | null>(() => localStorage.getItem(LOGO_KEY));
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrderOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<Quote | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("quotes")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast({ title: "Erro ao carregar orçamentos", description: error.message, variant: "destructive" });
    setQuotes((data as unknown as Quote[]) ?? []);
    setLoading(false);
  }, [toast]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const loadClients = async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "client").eq("approved", true);
      const ids = (roles ?? []).map((r) => r.user_id);
      if (!ids.length) return;
      const { data } = await supabase.from("profiles").select("id, name, company_name, phone, address").in("id", ids);
      setClients(
        (data ?? [])
          .map((p) => ({ id: p.id, label: p.company_name || p.name, name: p.company_name || p.name, phone: p.phone, address: p.address }))
          .sort((a, b) => a.label.localeCompare(b.label)),
      );
    };
    const loadWorkOrders = async () => {
      const { data } = await supabase
        .from("work_orders")
        .select("id, reference, title, profiles!work_orders_client_id_fkey(name, company_name)")
        .order("created_at", { ascending: false })
        .limit(300);
      setWorkOrders(
        (data ?? []).map((w) => ({
          id: w.id,
          reference: w.reference,
          title: w.title,
          client: (w.profiles as { name: string; company_name: string | null } | null)?.company_name
            || (w.profiles as { name: string } | null)?.name
            || "",
        })),
      );
    };
    void loadClients();
    void loadWorkOrders();
  }, []);

  const stats = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const acceptedThisMonth = quotes.filter((q) => q.status === "aceite" && q.accepted_at && q.accepted_at >= monthStart);
    return {
      total: quotes.length,
      open: quotes.filter((q) => q.status === "rascunho" || q.status === "enviado").length,
      accepted: acceptedThisMonth.length,
      acceptedValue: acceptedThisMonth.reduce((sum, q) => sum + (q.total ?? 0), 0),
    };
  }, [quotes]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return quotes.filter((q) => {
      if (filter !== "todos" && q.status !== filter) return false;
      if (!term) return true;
      return [q.reference, q.client_name, q.client_nif, q.notes]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(term));
    });
  }, [quotes, filter, search]);

  const computed = useMemo(() => {
    const items = form.items.map((it) => {
      const quantity = parseFloat(it.quantity) || 0;
      const unit_price = parseFloat(it.unit_price) || 0;
      return { ...it, quantity, unit_price, total: quantity * unit_price };
    });
    const subtotal = items.reduce((sum, it) => sum + it.total, 0);
    const vat_amount = subtotal * VAT_RATE;
    return { items, subtotal, vat_amount, total: subtotal + vat_amount };
  }, [form.items]);

  const validUntil = useMemo(
    () => new Date(Date.now() + form.valid_days * 86400000).toISOString().split("T")[0],
    [form.valid_days],
  );

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setSheetOpen(true);
  };

  const openEdit = (q: Quote) => {
    setEditing(q);
    setForm({
      clientMode: q.client_id ? "existing" : "manual",
      client_id: q.client_id ?? "",
      client_name: q.client_name,
      client_nif: q.client_nif ?? "",
      client_address: q.client_address ?? "",
      client_phone: q.client_phone ?? "",
      client_email: q.client_email ?? "",
      requires_visit: q.requires_visit,
      work_order_id: q.work_order_id ?? "",
      valid_days: q.valid_days ?? 30,
      status: q.status,
      items: q.items.length
        ? q.items.map((it) => ({ description: it.description, unit: it.unit, quantity: String(it.quantity), unit_price: String(it.unit_price) }))
        : [emptyItem()],
      notes: q.notes ?? "",
    });
    setSheetOpen(true);
  };

  const pickClient = (id: string) => {
    const c = clients.find((cl) => cl.id === id);
    setForm((f) => ({
      ...f,
      client_id: id,
      client_name: c?.name ?? f.client_name,
      client_phone: c?.phone ?? "",
      client_address: c?.address ?? "",
    }));
    if (id) {
      void supabase
        .from("client_emails")
        .select("email")
        .eq("user_id", id)
        .limit(1)
        .then(({ data }) => {
          if (data?.[0]?.email) setForm((f) => (f.client_id === id ? { ...f, client_email: data[0].email } : f));
        });
    }
  };

  const changeLogo = (value: string | null) => {
    setLogo(value);
    if (value) localStorage.setItem(LOGO_KEY, value);
    else localStorage.removeItem(LOGO_KEY);
  };

  const buildPayload = (status: string) => ({
    client_id: form.clientMode === "existing" && form.client_id ? form.client_id : null,
    client_name: form.client_name.trim(),
    client_nif: form.client_nif.trim() || null,
    client_address: form.client_address.trim() || null,
    client_phone: form.client_phone.trim() || null,
    client_email: form.client_email.trim() || null,
    work_order_id: form.requires_visit && form.work_order_id ? form.work_order_id : null,
    status,
    requires_visit: form.requires_visit,
    items: computed.items.map(({ description, unit, quantity, unit_price, total }) => ({ description, unit, quantity, unit_price, total })),
    subtotal: computed.subtotal,
    vat_rate: VAT_RATE,
    vat_amount: computed.vat_amount,
    total: computed.total,
    valid_days: form.valid_days,
    valid_until: validUntil,
    notes: form.notes.trim() || null,
    ...(status === "enviado" ? { sent_at: new Date().toISOString() } : {}),
  });

  const validate = () => {
    if (!form.client_name.trim()) return "Indique o nome do cliente.";
    if (form.requires_visit && !form.work_order_id) return "Escolha a OT associada à visita.";
    if (!computed.items.some((it) => it.description.trim())) return "Adicione pelo menos um item com descrição.";
    return null;
  };

  const save = async (status: string) => {
    const problem = validate();
    if (problem) {
      toast({ title: problem, variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = buildPayload(status);
    const { error } = editing
      ? await supabase.from("quotes").update(payload).eq("id", editing.id)
      : await supabase.from("quotes").insert({ ...payload, created_by: user?.id ?? null });
    setSaving(false);
    if (error) {
      toast({ title: "Erro ao guardar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: status === "enviado" ? "Orçamento marcado como enviado" : "Orçamento guardado" });
    setSheetOpen(false);
    void load();
  };

  const setStatus = async (q: Quote, status: string) => {
    const patch: Record<string, unknown> = { status };
    if (status === "aceite") patch.accepted_at = new Date().toISOString();
    const { error } = await supabase.from("quotes").update(patch).eq("id", q.id);
    if (error) {
      toast({ title: "Erro ao atualizar estado", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: `Orçamento marcado como ${STATUS_LABELS[status].toLowerCase()}` });
    if (editing?.id === q.id) setEditing({ ...q, status });
    void load();
  };

  const remove = async () => {
    if (!deleting) return;
    const { error } = await supabase.from("quotes").delete().eq("id", deleting.id);
    if (error) toast({ title: "Erro ao eliminar", description: error.message, variant: "destructive" });
    else toast({ title: "Orçamento eliminado" });
    setDeleting(null);
    void load();
  };

  const downloadPDF = async (q: Quote) => {
    let workOrderReference: string | undefined;
    if (q.work_order_id) {
      const { data } = await supabase.from("work_orders").select("reference").eq("id", q.work_order_id).maybeSingle();
      workOrderReference = data?.reference ?? undefined;
    }
    const pdfData: QuoteData = {
      logo: localStorage.getItem(LOGO_KEY),
      reference: q.reference ?? "ORC",
      date: q.created_at.slice(0, 10),
      valid_until: q.valid_until ?? validUntil,
      requires_visit: q.requires_visit,
      client_name: q.client_name,
      client_nif: q.client_nif ?? undefined,
      client_address: q.client_address ?? undefined,
      client_phone: q.client_phone ?? undefined,
      client_email: q.client_email ?? undefined,
      items: q.items,
      subtotal: q.subtotal,
      vat_rate: q.vat_rate,
      vat_amount: q.vat_amount,
      total: q.total,
      notes: q.notes ?? undefined,
      work_order_reference: workOrderReference,
    };
    const blob = generateQuotePDF(pdfData);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${q.reference ?? "orcamento"}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadDraftPDF = () => {
    const problem = validate();
    if (problem) {
      toast({ title: problem, variant: "destructive" });
      return;
    }
    const pdfData: QuoteData = {
      logo,
      reference: editing?.reference ?? "ORC-RASCUNHO",
      date: new Date().toISOString().split("T")[0],
      valid_until: validUntil,
      requires_visit: form.requires_visit,
      client_name: form.client_name.trim(),
      client_nif: form.client_nif.trim() || undefined,
      client_address: form.client_address.trim() || undefined,
      client_phone: form.client_phone.trim() || undefined,
      client_email: form.client_email.trim() || undefined,
      items: computed.items.map(({ description, unit, quantity, unit_price, total }) => ({ description, unit, quantity, unit_price, total })),
      subtotal: computed.subtotal,
      vat_rate: VAT_RATE,
      vat_amount: computed.vat_amount,
      total: computed.total,
      notes: form.notes.trim() || undefined,
      work_order_reference: workOrders.find((w) => w.id === form.work_order_id)?.reference ?? undefined,
    };
    const blob = generateQuotePDF(pdfData);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${pdfData.reference}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <DashboardLayout title="Orçamentos">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-bold">Orçamentos</h1>
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Novo Orçamento
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Card className="p-4">
            <p className="text-sm text-muted-foreground">Total de orçamentos</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-muted-foreground">Em aberto</p>
            <p className="text-2xl font-bold">{stats.open}</p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-muted-foreground">Aceites (este mês)</p>
            <p className="text-2xl font-bold">{stats.accepted}</p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-muted-foreground">Valor total aceite</p>
            <p className="text-2xl font-bold">{money(stats.acceptedValue)}</p>
          </Card>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {["todos", "rascunho", "enviado", "aceite", "rejeitado", "expirado"].map((s) => (
            <Button key={s} size="sm" variant={filter === s ? "default" : "outline"} onClick={() => setFilter(s)}>
              {s === "todos" ? "Todos" : STATUS_LABELS[s]}
            </Button>
          ))}
          <Input
            className="ml-auto w-full sm:w-64"
            placeholder="Pesquisar referência, cliente ou NIF"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Referência</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Criado</TableHead>
                  <TableHead>Válido até</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground">A carregar orçamentos...</TableCell>
                  </TableRow>
                )}
                {!loading && filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground">Nenhum orçamento encontrado.</TableCell>
                  </TableRow>
                )}
                {filtered.map((q) => (
                  <TableRow key={q.id}>
                    <TableCell className="font-medium">{q.reference ?? "-"}</TableCell>
                    <TableCell>{q.client_name}</TableCell>
                    <TableCell>{money(q.total)}</TableCell>
                    <TableCell>
                      <Badge className={STATUS_CLASSES[q.status]} variant="secondary">{STATUS_LABELS[q.status] ?? q.status}</Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{q.requires_visit ? "Após visita" : "Direto"}</TableCell>
                    <TableCell>{fmtDate(q.created_at)}</TableCell>
                    <TableCell>{fmtDate(q.valid_until)}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" title="Ver/Editar" onClick={() => openEdit(q)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" title="Gerar PDF" onClick={() => void downloadPDF(q)}>
                          <Download className="h-4 w-4" />
                        </Button>
                        {q.status === "rascunho" && (
                          <Button size="icon" variant="ghost" title="Eliminar" onClick={() => setDeleting(q)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl">
          <SheetHeader>
            <SheetTitle>{editing ? `Orçamento ${editing.reference ?? ""}` : "Novo Orçamento"}</SheetTitle>
          </SheetHeader>

          <div className="mt-4 space-y-6 pb-6">
            <section className="space-y-3 border-b pb-5">
              <Label>Cliente</Label>
              <RadioGroup
                className="flex gap-4"
                value={form.clientMode}
                onValueChange={(v) => setForm({ ...form, clientMode: v as "existing" | "manual", client_id: "" })}
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="existing" id="cm-existing" />
                  <Label htmlFor="cm-existing" className="font-normal">Cliente existente</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="manual" id="cm-manual" />
                  <Label htmlFor="cm-manual" className="font-normal">Inserir manualmente</Label>
                </div>
              </RadioGroup>
              {form.clientMode === "existing" && (
                <Select value={form.client_id} onValueChange={pickClient}>
                  <SelectTrigger><SelectValue placeholder="Escolher cliente" /></SelectTrigger>
                  <SelectContent>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="q-name">Nome completo *</Label>
                  <Input id="q-name" value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="q-nif">NIF</Label>
                  <Input id="q-nif" value={form.client_nif} onChange={(e) => setForm({ ...form, client_nif: e.target.value })} />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label htmlFor="q-address">Morada</Label>
                  <Input id="q-address" value={form.client_address} onChange={(e) => setForm({ ...form, client_address: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="q-phone">Telefone</Label>
                  <Input id="q-phone" value={form.client_phone} onChange={(e) => setForm({ ...form, client_phone: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="q-email">Email</Label>
                  <Input id="q-email" type="email" value={form.client_email} onChange={(e) => setForm({ ...form, client_email: e.target.value })} />
                </div>
              </div>
            </section>

            <section className="space-y-3 border-b pb-5">
              <Label>Detalhes do orçamento</Label>
              <RadioGroup
                className="flex flex-col gap-2 sm:flex-row sm:gap-4"
                value={form.requires_visit ? "visit" : "direct"}
                onValueChange={(v) => setForm({ ...form, requires_visit: v === "visit" })}
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="direct" id="qt-direct" />
                  <Label htmlFor="qt-direct" className="font-normal">Orçamento direto</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="visit" id="qt-visit" />
                  <Label htmlFor="qt-visit" className="font-normal">Sujeito a visita prévia</Label>
                </div>
              </RadioGroup>
              {form.requires_visit && (
                <Select value={form.work_order_id} onValueChange={(v) => setForm({ ...form, work_order_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Escolher OT associada" /></SelectTrigger>
                  <SelectContent>
                    {workOrders.map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        {(w.reference ?? "Sem ref.")} — {w.client || w.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="q-valid">Validade (dias)</Label>
                  <Input
                    id="q-valid"
                    type="number"
                    min={1}
                    value={form.valid_days}
                    onChange={(e) => setForm({ ...form, valid_days: Math.max(1, parseInt(e.target.value) || 1) })}
                  />
                  <p className="text-xs text-muted-foreground">Válido até {fmtDate(validUntil)}</p>
                </div>
                {editing && (
                  <div className="space-y-1">
                    <Label>Estado</Label>
                    <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(STATUS_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </section>

            <section className="space-y-3 border-b pb-5">
              <Label>Itens</Label>
              <datalist id="quote-units">
                {UNIT_SUGGESTIONS.map((u) => (
                  <option key={u} value={u} />
                ))}
              </datalist>
              <div className="space-y-2">
                <div className="hidden grid-cols-[1fr_64px_72px_96px_88px_32px] gap-2 text-xs text-muted-foreground sm:grid">
                  <span>Descrição</span><span>Un.</span><span>Qtd</span><span>P. Unit. (€)</span><span className="text-right">Total (€)</span><span />
                </div>
                {form.items.map((it, index) => (
                  <div key={index} className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_64px_72px_96px_88px_32px]">
                    <Input
                      className="col-span-2 sm:col-span-1"
                      placeholder="Descrição"
                      value={it.description}
                      onChange={(e) => setForm({ ...form, items: form.items.map((x, i) => (i === index ? { ...x, description: e.target.value } : x)) })}
                    />
                    <Input
                      list="quote-units"
                      placeholder="Un."
                      value={it.unit}
                      onChange={(e) => setForm({ ...form, items: form.items.map((x, i) => (i === index ? { ...x, unit: e.target.value } : x)) })}
                    />
                    <Input
                      type="number"
                      min={0}
                      step="any"
                      placeholder="Qtd"
                      value={it.quantity}
                      onChange={(e) => setForm({ ...form, items: form.items.map((x, i) => (i === index ? { ...x, quantity: e.target.value } : x)) })}
                    />
                    <Input
                      type="number"
                      min={0}
                      step="any"
                      placeholder="0.00"
                      value={it.unit_price}
                      onChange={(e) => setForm({ ...form, items: form.items.map((x, i) => (i === index ? { ...x, unit_price: e.target.value } : x)) })}
                    />
                    <div className="flex items-center justify-end text-sm font-medium">
                      {money((parseFloat(it.quantity) || 0) * (parseFloat(it.unit_price) || 0))}
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      disabled={form.items.length === 1}
                      onClick={() => setForm({ ...form, items: form.items.filter((_, i) => i !== index) })}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button variant="outline" size="sm" onClick={() => setForm({ ...form, items: [...form.items, emptyItem()] })}>
                <Plus className="mr-2 h-4 w-4" />
                Adicionar linha
              </Button>
              <div className="space-y-1 border-t pt-3 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{money(computed.subtotal)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">IVA 22%</span><span>{money(computed.vat_amount)}</span></div>
                <div className="flex justify-between text-base font-bold"><span>TOTAL</span><span>{money(computed.total)}</span></div>
              </div>
            </section>

            <section className="space-y-2 border-b pb-5">
              <Label htmlFor="q-notes">Notas</Label>
              <Textarea
                id="q-notes"
                rows={3}
                placeholder="Observações internas ou condições especiais"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </section>

            <ReportLogoPicker
              value={logo}
              onChange={changeLogo}
              onError={(message) => toast({ title: message, variant: "destructive" })}
            />

            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap gap-2">
                <Button disabled={saving} onClick={() => void save("rascunho")}>
                  Guardar rascunho
                </Button>
                <Button variant="secondary" disabled={saving} onClick={() => void save("enviado")}>
                  Marcar como enviado
                </Button>
                <Button variant="outline" disabled={saving} onClick={downloadDraftPDF}>
                  <FileText className="mr-2 h-4 w-4" />
                  Gerar e descarregar PDF
                </Button>
              </div>
              {editing && editing.status === "enviado" && (
                <div className="flex flex-wrap gap-2 border-t pt-3">
                  <Button variant="outline" onClick={() => void setStatus(editing, "aceite")}>Marcar como aceite</Button>
                  <Button variant="outline" onClick={() => void setStatus(editing, "rejeitado")}>Marcar como rejeitado</Button>
                  <Button variant="outline" onClick={() => void setStatus(editing, "expirado")}>Marcar como expirado</Button>
                </div>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar orçamento</AlertDialogTitle>
            <AlertDialogDescription>
              Eliminar o orçamento {deleting?.reference}? Esta ação não pode ser anulada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void remove()}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
