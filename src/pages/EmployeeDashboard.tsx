import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ClipboardList, Clock, CheckCircle, CalendarDays, Pause, Play, PlayCircle, Circle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CompleteWorkOrderDialog } from "@/components/work-orders/CompleteWorkOrderDialog";
import { PauseWorkOrderDialog } from "@/components/work-orders/PauseWorkOrderDialog";
import { EditTimeEntriesDialog } from "@/components/work-orders/EditTimeEntriesDialog";
import { TimeTracker } from "@/components/work-orders/TimeTracker";
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
  active_time_entry_id?: string;
  active_time_entry_start?: string;
  has_been_started?: boolean;
  total_hours_worked?: number;
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
  const [pauseDialogOpen, setPauseDialogOpen] = useState(false);
  const [editTimeEntriesDialogOpen, setEditTimeEntriesDialogOpen] = useState(false);
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<{ 
    id: string; 
    reference: string;
    timeEntryId?: string;
  } | null>(null);
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
      // Get active time entries for in_progress orders
      const { data: activeTimeEntries } = await supabase
        .from("time_entries")
        .select("id, work_order_id, start_time")
        .eq("user_id", user.id)
        .is("end_time", null);

      const activeTimeEntriesMap = new Map(
        activeTimeEntries?.map(entry => [entry.work_order_id, { id: entry.id, start_time: entry.start_time }]) || []
      );

      // Get all work order IDs that have been started at least once (have any time entries)
      const workOrderIds = data
        .map((item: any) => item.work_orders?.id)
        .filter(Boolean);

      const { data: allTimeEntries } = await supabase
        .from("time_entries")
        .select("work_order_id, duration_hours")
        .eq("user_id", user.id)
        .in("work_order_id", workOrderIds);

      const startedWorkOrderIds = new Set(allTimeEntries?.map(entry => entry.work_order_id) || []);

      // Calculate total hours per work order
      const hoursPerWorkOrder = new Map<string, number>();
      allTimeEntries?.forEach(entry => {
        const current = hoursPerWorkOrder.get(entry.work_order_id) || 0;
        hoursPerWorkOrder.set(entry.work_order_id, current + (entry.duration_hours || 0));
      });

      const orders = data
        .map((item: any) => {
          const wo = item.work_orders;
          if (!wo) return null;
          const activeEntry = activeTimeEntriesMap.get(wo.id);
          return {
            ...wo,
            client_name: wo.profiles?.name || 'N/A',
            active_time_entry_id: activeEntry?.id,
            active_time_entry_start: activeEntry?.start_time,
            has_been_started: startedWorkOrderIds.has(wo.id),
            total_hours_worked: hoursPerWorkOrder.get(wo.id) || 0,
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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Create time entry
      const { error: timeEntryError } = await supabase
        .from("time_entries")
        .insert({
          work_order_id: workOrderId,
          user_id: user.id,
          start_time: new Date().toISOString(),
        });

      if (timeEntryError) throw timeEntryError;

      // Update work order status
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

  const handlePauseClick = (workOrderId: string, reference: string, timeEntryId: string) => {
    setSelectedWorkOrder({ id: workOrderId, reference, timeEntryId });
    setPauseDialogOpen(true);
  };

  const handlePauseSuccess = () => {
    fetchAssignedOrders();
    fetchStats();
  };

  const handleCompleteClick = (workOrderId: string, reference: string) => {
    setSelectedWorkOrder({ id: workOrderId, reference });
    setCompleteDialogOpen(true);
  };

  const handleCompleteSuccess = () => {
    fetchAssignedOrders();
    fetchStats();
  };

  const handleEditTimeEntriesClick = (workOrderId: string, reference: string) => {
    setSelectedWorkOrder({ id: workOrderId, reference });
    setEditTimeEntriesDialogOpen(true);
  };

  const handleEditTimeEntriesUpdate = () => {
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

  // Separate orders into categories
  const activeOrders = assignedOrders.filter(
    (order) => order.status === "in_progress" && order.active_time_entry_id
  );
  const startedOrders = assignedOrders.filter(
    (order) => order.has_been_started && order.status !== "completed" && !activeOrders.some(ao => ao.id === order.id)
  );
  const newOrders = assignedOrders.filter(
    (order) => !order.has_been_started && order.status !== "completed"
  );
  const completedOrders = assignedOrders.filter(
    (order) => order.status === "completed"
  );

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
                          {order.status === "in_progress" && order.active_time_entry_start && (
                            <TimeTracker startTime={order.active_time_entry_start} className="text-xs" />
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          {order.status === "pending" && (
                            <Button size="sm" onClick={() => handleStartWork(order.id, order.reference)}>
                              <Play className="h-4 w-4 mr-1" />
                              Iniciar
                            </Button>
                          )}
                          {order.status === "in_progress" && (
                            <>
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => handlePauseClick(order.id, order.reference, order.active_time_entry_id!)}
                                disabled={!order.active_time_entry_id}
                              >
                                <Pause className="h-4 w-4 mr-1" />
                                Pausar
                              </Button>
                              <Button size="sm" onClick={() => handleCompleteClick(order.id, order.reference)}>
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Concluir
                              </Button>
                            </>
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

        {/* Work Orders with Tabs */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Minhas Ordens de Trabalho</CardTitle>
          </CardHeader>
          <CardContent>
            {assignedOrders.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Nenhuma ordem de trabalho atribuída
              </p>
            ) : (
              <Tabs defaultValue={activeOrders.length > 0 ? "active" : startedOrders.length > 0 ? "paused" : "new"} className="w-full">
                <TabsList className="grid w-full grid-cols-4 mb-4">
                  <TabsTrigger value="active" className="flex items-center gap-1.5 text-xs sm:text-sm">
                    <PlayCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    <span className="hidden sm:inline">Em Execução</span>
                    <span className="sm:hidden">Ativas</span>
                    {activeOrders.length > 0 && (
                      <Badge variant="default" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-[10px] animate-pulse">
                        {activeOrders.length}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="paused" className="flex items-center gap-1.5 text-xs sm:text-sm">
                    <Pause className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    <span className="hidden sm:inline">Pausadas</span>
                    <span className="sm:hidden">Paus.</span>
                    {startedOrders.length > 0 && (
                      <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-[10px]">
                        {startedOrders.length}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="new" className="flex items-center gap-1.5 text-xs sm:text-sm">
                    <Circle className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    <span className="hidden sm:inline">Novas</span>
                    <span className="sm:hidden">Novas</span>
                    {newOrders.length > 0 && (
                      <Badge variant="outline" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-[10px]">
                        {newOrders.length}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="completed" className="flex items-center gap-1.5 text-xs sm:text-sm">
                    <CheckCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    <span className="hidden sm:inline">Concluídas</span>
                    <span className="sm:hidden">Concl.</span>
                    {completedOrders.length > 0 && (
                      <Badge variant="outline" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-[10px] bg-accent/20">
                        {completedOrders.length}
                      </Badge>
                    )}
                  </TabsTrigger>
                </TabsList>

                {/* Active Orders Tab */}
                <TabsContent value="active" className="mt-0">
                  {activeOrders.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <PlayCircle className="h-12 w-12 mx-auto mb-2 opacity-30" />
                      <p>Nenhuma ordem em execução</p>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                      {activeOrders.map((order) => (
                        <div key={order.id} className="flex flex-col gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
                          <div className="space-y-1 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-medium text-sm">{order.reference}</p>
                              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${getPriorityColor(order.priority)}`}>
                                {getPriorityLabel(order.priority)}
                              </span>
                              {order.active_time_entry_start && (
                                <TimeTracker startTime={order.active_time_entry_start} />
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground line-clamp-1">{order.title}</p>
                            {order.client_name && (
                              <p className="text-xs text-muted-foreground">Cliente: {order.client_name}</p>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Button size="sm" variant="outline" onClick={() => handlePauseClick(order.id, order.reference, order.active_time_entry_id!)}>
                              <Pause className="h-3.5 w-3.5 mr-1" />
                              Pausar
                            </Button>
                            <Button size="sm" onClick={() => handleCompleteClick(order.id, order.reference)}>
                              <CheckCircle className="h-3.5 w-3.5 mr-1" />
                              Concluir
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => navigate(`/work-orders/${order.id}`)}>
                              Detalhes
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                {/* Paused Orders Tab */}
                <TabsContent value="paused" className="mt-0">
                  {startedOrders.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Pause className="h-12 w-12 mx-auto mb-2 opacity-30" />
                      <p>Nenhuma ordem pausada</p>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                      {startedOrders.map((order) => (
                        <div key={order.id} className="flex flex-col gap-3 rounded-lg border border-warning/30 bg-warning/5 p-3">
                          <div className="space-y-1 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-medium text-sm">{order.reference}</p>
                              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${getPriorityColor(order.priority)}`}>
                                {getPriorityLabel(order.priority)}
                              </span>
                              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${getStatusColor(order.status)}`}>
                                {getStatusLabel(order.status)}
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground line-clamp-1">{order.title}</p>
                            {order.client_name && (
                              <p className="text-xs text-muted-foreground">Cliente: {order.client_name}</p>
                            )}
                            {order.scheduled_date && (
                              <p className="text-xs text-muted-foreground">
                                Agendado: {new Date(order.scheduled_date).toLocaleString("pt-BR")}
                              </p>
                            )}
                            {order.total_hours_worked !== undefined && order.total_hours_worked > 0 && (
                              <p className="text-xs font-medium text-primary">
                                <Clock className="h-3 w-3 inline mr-1" />
                                Horas trabalhadas: {Math.round(order.total_hours_worked * 10) / 10}h
                              </p>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Button size="sm" onClick={() => handleStartWork(order.id, order.reference)}>
                              <Play className="h-3.5 w-3.5 mr-1" />
                              Retomar
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleEditTimeEntriesClick(order.id, order.reference)}>
                              <Clock className="h-3.5 w-3.5 mr-1" />
                              Horas
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => navigate(`/work-orders/${order.id}`)}>
                              Detalhes
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                {/* New Orders Tab */}
                <TabsContent value="new" className="mt-0">
                  {newOrders.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Circle className="h-12 w-12 mx-auto mb-2 opacity-30" />
                      <p>Nenhuma nova ordem</p>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                      {newOrders.map((order) => (
                        <div key={order.id} className="flex flex-col gap-3 rounded-lg border p-3">
                          <div className="space-y-1 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-medium text-sm">{order.reference}</p>
                              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${getPriorityColor(order.priority)}`}>
                                {getPriorityLabel(order.priority)}
                              </span>
                              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${getStatusColor(order.status)}`}>
                                {getStatusLabel(order.status)}
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground line-clamp-1">{order.title}</p>
                            {order.client_name && (
                              <p className="text-xs text-muted-foreground">Cliente: {order.client_name}</p>
                            )}
                            {order.scheduled_date && (
                              <p className="text-xs text-muted-foreground">
                                Agendado: {new Date(order.scheduled_date).toLocaleString("pt-BR")}
                              </p>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Button size="sm" onClick={() => handleStartWork(order.id, order.reference)}>
                              <Play className="h-3.5 w-3.5 mr-1" />
                              Iniciar
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => navigate(`/work-orders/${order.id}`)}>
                              Detalhes
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                {/* Completed Orders Tab */}
                <TabsContent value="completed" className="mt-0">
                  {completedOrders.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <CheckCircle className="h-12 w-12 mx-auto mb-2 opacity-30" />
                      <p>Nenhuma ordem concluída</p>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                      {completedOrders.map((order) => (
                        <div key={order.id} className="flex flex-col gap-3 rounded-lg border border-accent/30 bg-accent/5 p-3">
                          <div className="space-y-1 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-medium text-sm">{order.reference}</p>
                              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${getPriorityColor(order.priority)}`}>
                                {getPriorityLabel(order.priority)}
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground line-clamp-1">{order.title}</p>
                            {order.client_name && (
                              <p className="text-xs text-muted-foreground">Cliente: {order.client_name}</p>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Button size="sm" variant="outline" onClick={() => handleEditTimeEntriesClick(order.id, order.reference)}>
                              <Clock className="h-3.5 w-3.5 mr-1" />
                              Ver Horas
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => navigate(`/work-orders/${order.id}`)}>
                              Detalhes
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>
      </div>

      {selectedWorkOrder && (
        <>
          <CompleteWorkOrderDialog
            open={completeDialogOpen}
            onOpenChange={setCompleteDialogOpen}
            workOrderId={selectedWorkOrder.id}
            workOrderReference={selectedWorkOrder.reference}
            onComplete={handleCompleteSuccess}
          />
          {selectedWorkOrder.timeEntryId && (
            <PauseWorkOrderDialog
              open={pauseDialogOpen}
              onOpenChange={setPauseDialogOpen}
              workOrderId={selectedWorkOrder.id}
              workOrderReference={selectedWorkOrder.reference}
              timeEntryId={selectedWorkOrder.timeEntryId}
              onPause={handlePauseSuccess}
            />
          )}
          <EditTimeEntriesDialog
            open={editTimeEntriesDialogOpen}
            onOpenChange={setEditTimeEntriesDialogOpen}
            workOrderId={selectedWorkOrder.id}
            workOrderReference={selectedWorkOrder.reference}
            onUpdate={handleEditTimeEntriesUpdate}
          />
        </>
      )}
    </DashboardLayout>
  );
}
