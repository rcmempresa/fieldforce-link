import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ClipboardList, Wrench, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface WorkOrder {
  id: string;
  reference: string;
  title: string;
  status: string;
}

interface Stats {
  activeRequests: number;
  myEquipments: number;
  completedServices: number;
}

export default function ClientDashboard() {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [stats, setStats] = useState<Stats>({ activeRequests: 0, myEquipments: 0, completedServices: 0 });

  useEffect(() => {
    fetchWorkOrders();
    fetchStats();
  }, []);

  const fetchWorkOrders = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return;

    const { data } = await supabase
      .from("work_orders")
      .select("id, reference, title, status")
      .eq("client_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5);

    if (data) {
      setWorkOrders(data);
    }
  };

  const fetchStats = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return;

    // Active requests
    const { count: activeCount } = await supabase
      .from("work_orders")
      .select("*", { count: "exact", head: true })
      .eq("client_id", user.id)
      .in("status", ["pending", "in_progress"]);

    // My equipments
    const { count: equipmentsCount } = await supabase
      .from("equipments")
      .select("*", { count: "exact", head: true })
      .eq("client_id", user.id);

    // Completed services
    const { count: completedCount } = await supabase
      .from("work_orders")
      .select("*", { count: "exact", head: true })
      .eq("client_id", user.id)
      .eq("status", "completed");

    setStats({
      activeRequests: activeCount || 0,
      myEquipments: equipmentsCount || 0,
      completedServices: completedCount || 0,
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-warning/10 text-warning";
      case "in_progress":
        return "bg-primary/10 text-primary";
      case "completed":
        return "bg-accent/10 text-accent";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "pending":
        return "Pendente";
      case "in_progress":
        return "Em Progresso";
      case "completed":
        return "Concluída";
      default:
        return status;
    }
  };

  return (
    <DashboardLayout title="Dashboard do Cliente">
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Solicitações Ativas</CardTitle>
              <ClipboardList className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activeRequests}</div>
              <p className="text-xs text-muted-foreground">Em andamento</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Meus Equipamentos</CardTitle>
              <Wrench className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.myEquipments}</div>
              <p className="text-xs text-muted-foreground">Registados</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Serviços Concluídos</CardTitle>
              <CheckCircle className="h-4 w-4 text-accent" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.completedServices}</div>
              <p className="text-xs text-muted-foreground">Total</p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Ações Rápidas</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button>
              <ClipboardList className="mr-2 h-4 w-4" />
              Nova Solicitação
            </Button>
            <Button variant="outline">
              <Wrench className="mr-2 h-4 w-4" />
              Gerir Equipamentos
            </Button>
          </CardContent>
        </Card>

        {/* My Requests */}
        <Card>
          <CardHeader>
            <CardTitle>Minhas Solicitações</CardTitle>
          </CardHeader>
          <CardContent>
            {workOrders.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Nenhuma solicitação encontrada
              </p>
            ) : (
              <div className="space-y-4">
                {workOrders.map((order) => (
                  <div key={order.id} className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-1">
                      <p className="font-medium">{order.reference}</p>
                      <p className="text-sm text-muted-foreground">{order.title}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`rounded-full px-3 py-1 text-xs font-medium ${getStatusColor(order.status)}`}>
                        {getStatusLabel(order.status)}
                      </span>
                      <Button size="sm" variant={order.status === "completed" ? "outline" : "default"}>
                        {order.status === "completed" ? "Ver Fatura" : "Ver"}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
