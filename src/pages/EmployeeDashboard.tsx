import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { ClipboardList, Clock, CheckCircle, CalendarDays } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CompleteWorkOrderDialog } from "@/components/work-orders/CompleteWorkOrderDialog";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Notifications } from "@/components/Notifications";

interface WorkOrder {
  id: string;
  reference: string;
  title: string;
  priority: string;
  scheduled_date: string;
  status: string;
  client_name?: string;
}

interface Stats {
  assignedOrders: number;
  hoursToday: number;
  hoursWeek: number;
  hoursMonth: number;
  completedOrders: number;
}

export default function EmployeeDashboard() {
  const [assignedOrders, setAssignedOrders] = useState<WorkOrder[]>([]);
  const [stats, setStats] = useState<Stats>({ 
    assignedOrders: 0, 
    hoursToday: 0, 
    hoursWeek: 0, 
    hoursMonth: 0, 
    completedOrders: 0 
  });
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<{ id: string; reference: string } | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

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
          scheduled_date,
          status,
          profiles:client_id (
            name
          )
        )
      `)
      .eq("user_id", user.id);

    if (data) {
      const orders = data
        .map((item: any) => {
          const wo = item.work_orders;
          if (!wo) return null;
          return {
            ...wo,
            client_name: wo.profiles?.name || 'N/A'
          };
        })
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

    const { data: timeTodayEntries } = await supabase
      .from("time_entries")
      .select("duration_hours")
      .eq("user_id", user.id)
      .gte("start_time", startOfDay.toISOString());

    const hoursToday = timeTodayEntries?.reduce((sum, entry) => sum + (entry.duration_hours || 0), 0) || 0;

    // Hours this week
    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const { data: timeWeekEntries } = await supabase
      .from("time_entries")
      .select("duration_hours")
      .eq("user_id", user.id)
      .gte("start_time", startOfWeek.toISOString());

    const hoursWeek = timeWeekEntries?.reduce((sum, entry) => sum + (entry.duration_hours || 0), 0) || 0;

    // Hours this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { data: timeMonthEntries } = await supabase
      .from("time_entries")
      .select("duration_hours")
      .eq("user_id", user.id)
      .gte("start_time", startOfMonth.toISOString());

    const hoursMonth = timeMonthEntries?.reduce((sum, entry) => sum + (entry.duration_hours || 0), 0) || 0;

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
      hoursWeek: Math.round(hoursWeek * 10) / 10,
      hoursMonth: Math.round(hoursMonth * 10) / 10,
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

  const handleStartWork = async (workOrderId: string, reference: string) => {
    try {
      const { error } = await supabase
        .from("work_orders")
        .update({ status: "in_progress" })
        .eq("id", workOrderId);

      if (error) throw error;

      toast({
        title: "Trabalho Iniciado",
        description: `Ordem ${reference} está agora em progresso`,
      });

      await fetchAssignedOrders();
      await fetchStats();
    } catch (error) {
      console.error("Error starting work:", error);
      toast({
        title: "Erro",
        description: "Erro ao iniciar trabalho",
        variant: "destructive",
      });
    }
  };

  const handleCompleteClick = (workOrderId: string, reference: string) => {
    setSelectedWorkOrder({ id: workOrderId, reference });
    setCompleteDialogOpen(true);
  };

  const handleCompleteSuccess = () => {
    fetchAssignedOrders();
    fetchStats();
  };

  const getDatesWithOrders = () => {
    return assignedOrders
      .filter((order) => order.scheduled_date)
      .map((order) => new Date(order.scheduled_date));
  };

  const getOrdersForSelectedDate = () => {
    if (!selectedDate) return [];
    
    return assignedOrders.filter((order) => {
      if (!order.scheduled_date) return false;
      const orderDate = new Date(order.scheduled_date);
      return (
        orderDate.getDate() === selectedDate.getDate() &&
        orderDate.getMonth() === selectedDate.getMonth() &&
        orderDate.getFullYear() === selectedDate.getFullYear()
      );
    });
  };

  const ordersForSelectedDate = getOrdersForSelectedDate();

  return (
    <DashboardLayout title="Dashboard do Funcionário">
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
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
              <p className="text-xs text-muted-foreground">Hoje</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Horas Semana</CardTitle>
              <Clock className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.hoursWeek}h</div>
              <p className="text-xs text-muted-foreground">Esta semana</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Horas Mês</CardTitle>
              <Clock className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.hoursMonth}h</div>
              <p className="text-xs text-muted-foreground">Este mês</p>
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

        {/* Notifications */}
        <Notifications />

        {/* Calendar */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5" />
                Calendário de Ordens
              </CardTitle>
            </CardHeader>
            <CardContent className="flex justify-center">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                locale={ptBR}
                modifiers={{
                  scheduled: getDatesWithOrders(),
                }}
                modifiersStyles={{
                  scheduled: {
                    fontWeight: "bold",
                    textDecoration: "underline",
                    color: "hsl(var(--primary))",
                  },
                }}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>
                Ordens para {selectedDate ? format(selectedDate, "dd 'de' MMMM", { locale: ptBR }) : ""}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {ordersForSelectedDate.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Nenhuma ordem agendada para este dia
                </p>
              ) : (
                <div className="space-y-3">
                  {ordersForSelectedDate.map((order) => (
                    <div key={order.id} className="rounded-lg border p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm">{order.reference}</p>
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${getStatusColor(order.status)}`}>
                            {getStatusLabel(order.status)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          {order.status === "pending" && (
                            <Button size="sm" onClick={() => handleStartWork(order.id, order.reference)}>
                              Iniciar
                            </Button>
                          )}
                          {order.status === "in_progress" && (
                            <Button size="sm" onClick={() => handleCompleteClick(order.id, order.reference)}>
                              Concluir
                            </Button>
                          )}
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">{order.title}</p>
                      {order.client_name && (
                        <p className="text-xs text-muted-foreground">
                          Cliente: {order.client_name}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(order.scheduled_date), "HH:mm")}
                      </p>
                    </div>
                  ))}
                </div>
              )}
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
                  <div key={order.id} className="flex flex-col gap-4 rounded-lg border p-4">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium">{order.reference}</p>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${getPriorityColor(order.priority)}`}>
                          {getPriorityLabel(order.priority)}
                        </span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${getStatusColor(order.status)}`}>
                          {getStatusLabel(order.status)}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">{order.title}</p>
                      {order.client_name && (
                        <p className="text-xs text-muted-foreground">
                          Cliente: {order.client_name}
                        </p>
                      )}
                      {order.scheduled_date && (
                        <p className="text-xs text-muted-foreground">
                          Agendado: {new Date(order.scheduled_date).toLocaleString("pt-BR")}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                      {order.status === "pending" && (
                        <Button className="w-full sm:w-auto" size="sm" onClick={() => handleStartWork(order.id, order.reference)}>
                          Iniciar
                        </Button>
                      )}
                      {order.status === "in_progress" && (
                        <Button className="w-full sm:w-auto" size="sm" onClick={() => handleCompleteClick(order.id, order.reference)}>
                          Concluir
                        </Button>
                      )}
                      <Button className="w-full sm:w-auto" size="sm" variant="outline" onClick={() => navigate(`/work-orders/${order.id}`)}>
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

      {selectedWorkOrder && (
        <CompleteWorkOrderDialog
          open={completeDialogOpen}
          onOpenChange={setCompleteDialogOpen}
          workOrderId={selectedWorkOrder.id}
          workOrderReference={selectedWorkOrder.reference}
          onComplete={handleCompleteSuccess}
        />
      )}
    </DashboardLayout>
  );
}
