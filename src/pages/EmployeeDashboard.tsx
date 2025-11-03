import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ClipboardList, Clock, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface WorkOrder {
  id: string;
  reference: string;
  title: string;
  priority: string;
  scheduled_date: string;
}

interface Stats {
  assignedOrders: number;
  hoursToday: number;
  completedOrders: number;
}

export default function EmployeeDashboard() {
  const [assignedOrders, setAssignedOrders] = useState<WorkOrder[]>([]);
  const [stats, setStats] = useState<Stats>({ assignedOrders: 0, hoursToday: 0, completedOrders: 0 });

  useEffect(() => {
    fetchAssignedOrders();
    fetchStats();
  }, []);

  const fetchAssignedOrders = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return;

    const { data } = await supabase
      .from("work_order_assignments")
      .select(`
        work_order_id,
        work_orders (
          id,
          reference,
          title,
          priority,
          scheduled_date
        )
      `)
      .eq("user_id", user.id);

    if (data) {
      const orders = data
        .map((item: any) => item.work_orders)
        .filter(Boolean);
      setAssignedOrders(orders);
    }
  };

  const fetchStats = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return;

    // Assigned orders count
    const { count: assignedCount } = await supabase
      .from("work_order_assignments")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id);

    // Hours today
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const { data: timeEntries } = await supabase
      .from("time_entries")
      .select("duration_hours")
      .eq("user_id", user.id)
      .gte("start_time", startOfDay.toISOString());

    const hoursToday = timeEntries?.reduce((sum, entry) => sum + (entry.duration_hours || 0), 0) || 0;

    // Completed orders
    const { data: completedAssignments } = await supabase
      .from("work_order_assignments")
      .select(`
        work_order_id,
        work_orders!inner (
          status
        )
      `)
      .eq("user_id", user.id)
      .eq("work_orders.status", "completed");

    setStats({
      assignedOrders: assignedCount || 0,
      hoursToday: Math.round(hoursToday * 10) / 10,
      completedOrders: completedAssignments?.length || 0,
    });
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "bg-destructive/10 text-destructive";
      case "medium":
        return "bg-warning/10 text-warning";
      case "low":
        return "bg-accent/10 text-accent";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case "high":
        return "Alta";
      case "medium":
        return "Média";
      case "low":
        return "Baixa";
      default:
        return priority;
    }
  };

  return (
    <DashboardLayout title="Dashboard do Funcionário">
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ordens Atribuídas</CardTitle>
              <ClipboardList className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.assignedOrders}</div>
              <p className="text-xs text-muted-foreground">Tarefas ativas</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Horas Hoje</CardTitle>
              <Clock className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.hoursToday}h</div>
              <p className="text-xs text-muted-foreground">Tempo trabalhado</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Concluídas</CardTitle>
              <CheckCircle className="h-4 w-4 text-accent" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.completedOrders}</div>
              <p className="text-xs text-muted-foreground">Total</p>
            </CardContent>
          </Card>
        </div>

        {/* Assigned Work Orders */}
        <Card>
          <CardHeader>
            <CardTitle>Minhas Ordens de Trabalho</CardTitle>
          </CardHeader>
          <CardContent>
            {assignedOrders.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Nenhuma ordem de trabalho atribuída
              </p>
            ) : (
              <div className="space-y-4">
                {assignedOrders.map((order) => (
                  <div key={order.id} className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{order.reference}</p>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${getPriorityColor(order.priority)}`}>
                          {getPriorityLabel(order.priority)}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">{order.title}</p>
                      {order.scheduled_date && (
                        <p className="text-xs text-muted-foreground">
                          Agendado: {new Date(order.scheduled_date).toLocaleString()}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm">Iniciar</Button>
                      <Button size="sm" variant="outline">
                        Ver Detalhes
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
