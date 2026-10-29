import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataPagination } from "@/components/ui/data-pagination";
import { formatDateTime } from "@/lib/formatDate";
import { Search, UserX, Eye, Loader2, UserPlus, Pencil, CalendarIcon } from "lucide-react";
import { EditWorkOrderDialog } from "@/components/work-orders/EditWorkOrderDialog";
import { SlotDateTimePicker } from "@/components/work-orders/SlotDateTimePicker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getLisbonDateKey, getSlot } from "@/lib/employeeAvailability";

interface Row {
  id: string;
  reference: string | null;
  title: string;
  status: string;
  priority: string;
  scheduled_date: string | null;
  created_at: string;
  client_name: string;
}

const PER_PAGE = 10;
const STATUS: Record<string, string> = { pending: "Pendente", approved: "Aprovada", in_progress: "Em progresso" };

export default function UnassignedWorkOrders() {
  const [rows, setRows] = useState<Row[]>([]);
  const [employees, setEmployees] = useState<{ id: string; name: string }[]>([]);
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("recent");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Row | null>(null);
  const [dates, setDates] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("work_orders")
      .select("id, reference, title, status, priority, scheduled_date, created_at, profiles!work_orders_client_id_fkey ( name, company_name )")
      .in("status", ["pending", "approved", "in_progress"])
      .order("created_at", { ascending: false });
    const ids = (data || []).map((o: any) => o.id);
    let assigned = new Set<string>();
    if (ids.length) {
      const { data: a } = await supabase.from("work_order_assignments").select("work_order_id").in("work_order_id", ids);
      assigned = new Set((a || []).map((x: any) => x.work_order_id));
    }
    setRows(
      (data || [])
        .filter((o: any) => !assigned.has(o.id))
        .map((o: any) => ({ ...o, client_name: o.profiles?.company_name || o.profiles?.name || "N/A" })),
    );

    const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "employee").eq("approved", true);
    const empIds = (roles || []).map((r: any) => r.user_id);
    if (empIds.length) {
      const { data: profs } = await supabase.from("profiles").select("id, name").in("id", empIds).order("name");
      setEmployees(profs || []);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);
  useEffect(() => setPage(1), [search, sortBy]);

  const filtered = useMemo(() => {
    const t = search.trim().toLowerCase();
    const list = rows.filter((r) => !t || [r.reference, r.title, r.client_name].filter(Boolean).join(" ").toLowerCase().includes(t));
    return [...list].sort((a, b) => {
      if (sortBy === "client") return a.client_name.localeCompare(b.client_name, "pt");
      if (sortBy === "scheduled") {
        const da = a.scheduled_date ? new Date(a.scheduled_date).getTime() : Infinity;
        const db = b.scheduled_date ? new Date(b.scheduled_date).getTime() : Infinity;
        return da - db;
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [rows, search, sortBy]);

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const pageItems = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const toInputValue = (iso: string) => {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const assignAndSchedule = async (orderId: string) => {
    const userId = picked[orderId];
    const date = dates[orderId];
    if (!userId && !date) return;
    setSaving(orderId);

    let dateChanged = false;
    if (date) {
      const original = rows.find((x) => x.id === orderId)?.scheduled_date;
      const unchanged =
        !!original &&
        getLisbonDateKey(new Date(original)) === getLisbonDateKey(new Date(date)) &&
        getSlot(new Date(original)) === getSlot(new Date(date));
      if (!unchanged) {
        const { error: dateErr } = await supabase
          .from("work_orders")
          .update({ scheduled_date: date, needs_scheduling: false })
          .eq("id", orderId);
        if (dateErr) {
          setSaving(null);
          toast({ title: "Erro", description: "Não foi possível marcar a data.", variant: "destructive" });
          return;
        }
        dateChanged = true;
      }
    }

    if (userId) {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("work_order_assignments")
        .insert({ work_order_id: orderId, user_id: userId, assigned_by: user?.id });
      setSaving(null);
      if (error) {
        toast({ title: "Erro", description: "Não foi possível atribuir o técnico.", variant: "destructive" });
        return;
      }
      toast({ title: dateChanged ? "Técnico atribuído e OT agendada" : "Técnico atribuído" });
      load();
      return;
    }

    setSaving(null);
    if (dateChanged) {
      toast({ title: "OT agendada" });
      load();
    } else {
      toast({ title: "Sem alterações", description: "Escolhe um técnico ou uma data diferente." });
    }
  };

  return (
    <DashboardLayout title="OT sem técnico">
      <div className="space-y-6">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold">
            <UserX className="h-6 w-6 text-destructive" /> OT sem técnico
            <Badge variant="secondary">{rows.length}</Badge>
          </h2>
          <p className="text-sm text-muted-foreground">Ordens de trabalho abertas que ainda não têm técnico atribuído.</p>
        </div>

        <Card>
          <CardContent className="grid gap-3 pt-6 sm:grid-cols-[1fr_200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" placeholder="Pesquisar por referência, equipamento ou cliente..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Mais recentes</SelectItem>
                <SelectItem value="scheduled">Data agendada</SelectItem>
                <SelectItem value="client">Cliente (A-Z)</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : filtered.length === 0 ? (
          <Card><CardContent className="py-16 text-center text-muted-foreground">Todas as OT abertas têm técnico atribuído.</CardContent></Card>
        ) : (
          <>
            <div className="space-y-3">
              {pageItems.map((r) => (
                <Card key={r.id}>
                  <CardContent className="space-y-3 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{r.reference}</span>
                      <Badge variant="outline">{STATUS[r.status] || r.status}</Badge>
                      {!r.scheduled_date && <Badge variant="secondary">Sem data</Badge>}
                    </div>
                    <p className="break-words text-sm">{r.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.client_name}{r.scheduled_date && ` • ${formatDateTime(r.scheduled_date)}`}
                    </p>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <Select value={picked[r.id] || ""} onValueChange={(v) => setPicked((p) => ({ ...p, [r.id]: v }))}>
                        <SelectTrigger className="sm:w-56"><SelectValue placeholder="Escolher técnico" /></SelectTrigger>
                        <SelectContent>
                          {employees.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button size="sm" variant="outline" className="justify-start sm:w-56">
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {dates[r.id]
                              ? formatDateTime(dates[r.id])
                              : r.scheduled_date
                                ? formatDateTime(r.scheduled_date)
                                : "Escolher data e hora"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="max-h-[80vh] w-auto overflow-y-auto p-3" align="start">
                          <SlotDateTimePicker
                            value={dates[r.id] ?? (r.scheduled_date ? toInputValue(r.scheduled_date) : "")}
                            onChange={(v) => setDates((d) => ({ ...d, [r.id]: v }))}
                            excludeWorkOrderId={r.id}
                            label="Data e hora da OT"
                          />
                        </PopoverContent>
                      </Popover>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="flex-1 sm:flex-none"
                          disabled={(!picked[r.id] && !dates[r.id]) || saving === r.id}
                          onClick={() => assignAndSchedule(r.id)}
                        >
                          {saving === r.id ? (
                            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                          ) : (
                            <UserPlus className="mr-1 h-4 w-4" />
                          )}
                          Atribuir e agendar
                        </Button>
                        <Button size="icon" variant="outline" aria-label="Ver OT" title="Ver" onClick={() => navigate(`/work-orders/${r.id}`)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="outline" aria-label="Editar OT" title="Editar" onClick={() => setEditing(r)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            {editing && <EditWorkOrderDialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)} workOrder={editing} onSuccess={() => { setEditing(null); load(); }} />}
            <DataPagination currentPage={page} totalPages={totalPages} onPageChange={setPage} itemsPerPage={PER_PAGE} totalItems={filtered.length} />
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
