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
import { Search, UserX, Eye, Loader2, UserPlus } from "lucide-react";

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

  const assign = async (orderId: string) => {
    const userId = picked[orderId];
    if (!userId) return;
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("work_order_assignments").insert({ work_order_id: orderId, user_id: userId, assigned_by: user?.id });
    if (error) {
      toast({ title: "Erro", description: "Não foi possível atribuir o técnico.", variant: "destructive" });
      return;
    }
    toast({ title: "Técnico atribuído" });
    setRows((prev) => prev.filter((r) => r.id !== orderId));
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
                        <SelectTrigger className="sm:w-64"><SelectValue placeholder="Escolher técnico" /></SelectTrigger>
                        <SelectContent>
                          {employees.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <div className="flex gap-2">
                        <Button size="sm" className="flex-1 sm:flex-none" disabled={!picked[r.id]} onClick={() => assign(r.id)}>
                          <UserPlus className="mr-1 h-4 w-4" /> Atribuir
                        </Button>
                        <Button size="sm" variant="outline" className="flex-1 sm:flex-none" onClick={() => navigate(`/work-orders/${r.id}`)}>
                          <Eye className="mr-1 h-4 w-4" /> Abrir
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            <DataPagination currentPage={page} totalPages={totalPages} onPageChange={setPage} itemsPerPage={PER_PAGE} totalItems={filtered.length} />
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
