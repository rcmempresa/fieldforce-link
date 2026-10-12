import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DataPagination } from "@/components/ui/data-pagination";
import { Search, History, Clock, CheckCircle, ClipboardList, FileText } from "lucide-react";
import { formatDate } from "@/lib/formatDate";
import { formatHoursDetailed } from "@/lib/formatHours";

interface HistoryOrder {
  id: string;
  reference: string;
  title: string;
  status: string;
  scheduled_date: string | null;
  created_at: string;
  client_name: string;
  my_hours: number;
  reports_count: number;
}

const STATUS_OPTIONS = [
  { value: "all", label: "Todas" },
  { value: "completed", label: "Concluídas" },
  { value: "in_progress", label: "Em Progresso" },
  { value: "pending", label: "Pendentes" },
  { value: "awaiting_approval", label: "Aguarda Aprovação" },
  { value: "cancelled", label: "Canceladas" },
];

const ITEMS_PER_PAGE = 10;

const getStatusLabel = (status: string) => {
  switch (status) {
    case "awaiting_approval":
      return "Aguarda Aprovação";
    case "pending":
      return "Pendente";
    case "in_progress":
      return "Em Progresso";
    case "completed":
      return "Concluída";
    case "cancelled":
      return "Cancelada";
    case "invoiced":
      return "Faturada";
    case "approved":
      return "Aprovada";
    default:
      return status;
  }
};

const getStatusClass = (status: string) => {
  switch (status) {
    case "completed":
    case "invoiced":
      return "bg-accent/10 text-accent";
    case "in_progress":
      return "bg-primary/10 text-primary";
    case "cancelled":
      return "bg-destructive/10 text-destructive";
    case "awaiting_approval":
      return "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400";
    default:
      return "bg-muted text-muted-foreground";
  }
};

export default function Profile() {
  const { profile, roles } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<HistoryOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);

  const role = roles[0] ?? "";

  useEffect(() => {
    loadHistory();
  }, [role]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  const loadHistory = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const select = `
      id,
      reference,
      title,
      status,
      scheduled_date,
      created_at,
      profiles:client_id ( name, company_name )
    `;

    let data: any[] | null = null;

    if (role === "employee") {
      const res = await supabase
        .from("work_order_assignments")
        .select(`assigned_at, work_orders (${select})`)
        .eq("user_id", user.id)
        .order("assigned_at", { ascending: false });
      data = (res.data || []).map((a: any) => a.work_orders).filter(Boolean);
    } else if (role === "client") {
      const res = await supabase
        .from("work_orders")
        .select(select)
        .eq("client_id", user.id)
        .order("created_at", { ascending: false });
      data = res.data || [];
    } else {
      const res = await supabase
        .from("work_orders")
        .select(select)
        .eq("created_by", user.id)
        .order("created_at", { ascending: false });
      data = res.data || [];
    }

    const base = data || [];
    const ids = base.map((o: any) => o.id);

    // Own hours per work order
    const hoursMap = new Map<string, number>();
    if (ids.length > 0) {
      const { data: entries } = await supabase
        .from("time_entries")
        .select("work_order_id, duration_hours")
        .eq("user_id", user.id)
        .in("work_order_id", ids);
      entries?.forEach((e: any) => {
        hoursMap.set(
          e.work_order_id,
          (hoursMap.get(e.work_order_id) || 0) + (e.duration_hours || 0)
        );
      });
    }

    // Maintenance reports per work order
    const reportsMap = new Map<string, number>();
    if (ids.length > 0) {
      const { data: reports } = await supabase
        .from("maintenance_reports")
        .select("id, work_order_id")
        .in("work_order_id", ids);
      reports?.forEach((r: any) => {
        reportsMap.set(r.work_order_id, (reportsMap.get(r.work_order_id) || 0) + 1);
      });
    }

    setOrders(
      base.map((o: any) => ({
        id: o.id,
        reference: o.reference,
        title: o.title,
        status: o.status,
        scheduled_date: o.scheduled_date,
        created_at: o.created_at,
        client_name:
          (o.profiles as any)?.company_name || (o.profiles as any)?.name || "—",
        my_hours: hoursMap.get(o.id) || 0,
        reports_count: reportsMap.get(o.id) || 0,
      }))
    );
    setLoading(false);
  };

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return orders.filter((o) => {
      if (statusFilter !== "all" && o.status !== statusFilter) return false;
      if (!term) return true;
      return (
        (o.reference || "").toLowerCase().includes(term) ||
        (o.title || "").toLowerCase().includes(term) ||
        o.client_name.toLowerCase().includes(term)
      );
    });
  }, [orders, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const pageOrders = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const totalHours = orders.reduce((sum, o) => sum + o.my_hours, 0);
  const completedCount = orders.filter((o) => o.status === "completed").length;

  const getInitials = (name?: string) =>
    (name || "")
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

  const getRoleName = (r: string) => {
    switch (r) {
      case "manager":
        return "Gerente";
      case "employee":
        return "Funcionário";
      case "client":
        return "Cliente";
      default:
        return r;
    }
  };

  return (
    <DashboardLayout title="Meu Perfil">
      <div className="space-y-6 max-w-5xl mx-auto">
        {/* Profile info */}
        <Card>
          <CardContent className="flex flex-col sm:flex-row items-center gap-4 py-6">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="bg-primary text-primary-foreground text-xl font-semibold">
                {getInitials(profile?.name)}
              </AvatarFallback>
            </Avatar>
            <div className="text-center sm:text-left space-y-1">
              <h2 className="text-xl font-semibold">{profile?.name}</h2>
              <p className="text-sm text-muted-foreground">
                {getRoleName(role)}
                {profile?.company_name ? ` · ${profile.company_name}` : ""}
                {profile?.phone ? ` · ${profile.phone}` : ""}
              </p>
            </div>
            <div className="flex gap-3 sm:ml-auto">
              <div className="text-center px-4 py-2 rounded-lg bg-muted/50">
                <p className="text-2xl font-semibold">{orders.length}</p>
                <p className="text-xs text-muted-foreground">Intervenções</p>
              </div>
              <div className="text-center px-4 py-2 rounded-lg bg-muted/50">
                <p className="text-2xl font-semibold">{completedCount}</p>
                <p className="text-xs text-muted-foreground">Concluídas</p>
              </div>
              <div className="text-center px-4 py-2 rounded-lg bg-muted/50">
                <p className="text-2xl font-semibold">{formatHoursDetailed(totalHours)}</p>
                <p className="text-xs text-muted-foreground">Minhas horas</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* History */}
        <Card>
          <CardContent className="py-6">
            <div className="flex items-center gap-2 mb-4">
              <History className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold">Histórico de Intervenções</h3>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Pesquisar por referência, descrição ou cliente..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="sm:w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {loading ? (
              <p className="text-sm text-muted-foreground py-8 text-center">A carregar histórico...</p>
            ) : pageOrders.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <ClipboardList className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Nenhuma intervenção encontrada.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pageOrders.map((o) => (
                  <div
                    key={o.id}
                    onClick={() => navigate(`/work-orders/${o.id}`)}
                    className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/40 transition-colors cursor-pointer"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-primary">{o.reference}</span>
                        <Badge className={`${getStatusClass(o.status)} border-0 text-xs`}>
                          {getStatusLabel(o.status)}
                        </Badge>
                        {o.reports_count > 0 && (
                          <Badge variant="outline" className="text-xs gap-1">
                            <FileText className="h-3 w-3" />
                            {o.reports_count} {o.reports_count === 1 ? "relatório" : "relatórios"}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm font-medium truncate mt-1">{o.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Cliente: {o.client_name} · Data: {o.scheduled_date ? formatDate(o.scheduled_date) : "Sem data"}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground shrink-0 sm:justify-end">
                      <Clock className="h-4 w-4" />
                      {o.my_hours > 0 ? formatHoursDetailed(o.my_hours) : "0 min"}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <DataPagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={setPage}
              itemsPerPage={ITEMS_PER_PAGE}
              totalItems={filtered.length}
            />
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
