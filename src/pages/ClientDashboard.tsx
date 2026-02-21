import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ClipboardList, Wrench, CheckCircle, Plus, Pencil, Trash2, Clock, User, CalendarDays } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CreateEquipmentDialog } from "@/components/equipments/CreateEquipmentDialog";
import { EditEquipmentDialog } from "@/components/equipments/EditEquipmentDialog";
import { CreateClientWorkOrderDialog } from "@/components/work-orders/CreateClientWorkOrderDialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Notifications } from "@/components/Notifications";
import { Calendar } from "@/components/ui/calendar";
import { format, isSameDay, startOfMonth, endOfMonth, isSameMonth, startOfWeek, endOfWeek, startOfYear, endOfYear } from "date-fns";
import { pt } from "date-fns/locale";

interface WorkOrder {
  id: string;
  reference: string;
  title: string;
  status: string;
  scheduled_date: string | null;
  total_hours: number | null;
}

interface WorkOrderWithDetails extends WorkOrder {
  assignments: {
    user_id: string;
    profiles: {
      name: string;
    } | null;
  }[];
  time_entries: {
    duration_hours: number | null;
    start_time: string;
  }[];
}

interface Equipment {
  id: string;
  name: string;
  model: string | null;
  serial_number: string | null;
  location: string | null;
  notes: string | null;
}

interface Stats {
  activeRequests: number;
  myEquipments: number;
  completedServices: number;
}

export default function ClientDashboard() {
  const navigate = useNavigate();
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [allWorkOrders, setAllWorkOrders] = useState<WorkOrderWithDetails[]>([]);
  const [stats, setStats] = useState<Stats>({ activeRequests: 0, myEquipments: 0, completedServices: 0 });
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [showEquipments, setShowEquipments] = useState(false);
  const [createEquipmentDialogOpen, setCreateEquipmentDialogOpen] = useState(false);
  const [createWorkOrderDialogOpen, setCreateWorkOrderDialogOpen] = useState(false);
  const [editEquipmentDialogOpen, setEditEquipmentDialogOpen] = useState(false);
  const [deleteEquipmentDialogOpen, setDeleteEquipmentDialogOpen] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const { toast } = useToast();

  useEffect(() => {
    const initUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
      }
    };
    initUser();
    fetchWorkOrders();
    fetchAllWorkOrders();
    fetchStats();
    fetchEquipments();
  }, []);

  const fetchWorkOrders = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return;

    const { data } = await supabase
      .from("work_orders")
      .select("id, reference, title, status, scheduled_date, total_hours")
      .eq("client_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5);

    if (data) {
      setWorkOrders(data);
    }
  };

  const fetchAllWorkOrders = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return;

    const { data } = await supabase
      .from("work_orders")
      .select(`
        id, reference, title, status, scheduled_date, total_hours,
        assignments:work_order_assignments(
          user_id,
          profiles!work_order_assignments_user_id_fkey(name)
        ),
        time_entries(duration_hours, start_time)
      `)
      .eq("client_id", user.id)
      .order("scheduled_date", { ascending: true });

    if (data) {
      setAllWorkOrders(data as unknown as WorkOrderWithDetails[]);
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
      case "awaiting_approval":
        return "bg-orange-500/10 text-orange-500";
      case "pending":
        return "bg-warning/10 text-warning";
      case "in_progress":
        return "bg-primary/10 text-primary";
      case "completed":
        return "bg-accent/10 text-accent";
      case "cancelled":
        return "bg-destructive/10 text-destructive";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

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
      default:
        return status;
    }
  };

  const fetchEquipments = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return;

    const { data } = await supabase
      .from("equipments")
      .select("*")
      .eq("client_id", user.id)
      .order("created_at", { ascending: false });

    if (data) {
      setEquipments(data);
    }
  };

  const handleDeleteEquipment = async () => {
    if (!selectedEquipment) return;

    const { error } = await supabase
      .from("equipments")
      .delete()
      .eq("id", selectedEquipment.id);

    if (error) {
      toast({
        title: "Erro ao eliminar equipamento",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Equipamento eliminado",
      description: "O equipamento foi eliminado com sucesso.",
    });

    setDeleteEquipmentDialogOpen(false);
    setSelectedEquipment(null);
    fetchEquipments();
    fetchStats();
  };

  const handleEquipmentCreated = () => {
    fetchEquipments();
    fetchStats();
  };

  const handleEquipmentUpdated = () => {
    fetchEquipments();
  };

  // Get work orders for the selected calendar month (with scheduled date)
  const workOrdersForMonth = useMemo(() => {
    const monthStart = startOfMonth(calendarMonth);
    const monthEnd = endOfMonth(calendarMonth);
    
    return allWorkOrders.filter(wo => {
      if (!wo.scheduled_date) return false;
      const date = new Date(wo.scheduled_date);
      return date >= monthStart && date <= monthEnd;
    });
  }, [allWorkOrders, calendarMonth]);

  // Get work orders without scheduled date (these have hours but no date)
  const workOrdersWithoutDate = useMemo(() => {
    return allWorkOrders.filter(wo => !wo.scheduled_date);
  }, [allWorkOrders]);

  // Build work order hours grouped by scheduled_date
  const workOrderHoursByDate = useMemo(() => {
    return allWorkOrders
      .filter(wo => wo.scheduled_date)
      .map(wo => ({
        date: new Date(wo.scheduled_date!),
        hours: (wo.time_entries || []).reduce((sum, te) => sum + (te.duration_hours || 0), 0),
      }));
  }, [allWorkOrders]);

  // Calculate total hours for the calendar month (based on work order scheduled_date)
  const totalHoursForMonth = useMemo(() => {
    const monthStart = startOfMonth(calendarMonth);
    const monthEnd = endOfMonth(calendarMonth);
    return workOrderHoursByDate
      .filter(wo => wo.date >= monthStart && wo.date <= monthEnd)
      .reduce((sum, wo) => sum + wo.hours, 0);
  }, [workOrderHoursByDate, calendarMonth]);

  // Calculate total hours for orders without date
  const totalHoursWithoutDate = useMemo(() => {
    return workOrdersWithoutDate.reduce((sum, wo) => sum + (wo.total_hours || 0), 0);
  }, [workOrdersWithoutDate]);

  // Weekly hours (based on work order scheduled_date)
  const totalHoursThisWeek = useMemo(() => {
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
    return workOrderHoursByDate
      .filter(wo => wo.date >= weekStart && wo.date <= weekEnd)
      .reduce((sum, wo) => sum + wo.hours, 0);
  }, [workOrderHoursByDate]);

  // Monthly hours (based on work order scheduled_date)
  const totalHoursThisMonth = useMemo(() => {
    const now = new Date();
    const mStart = startOfMonth(now);
    const mEnd = endOfMonth(now);
    return workOrderHoursByDate
      .filter(wo => wo.date >= mStart && wo.date <= mEnd)
      .reduce((sum, wo) => sum + wo.hours, 0);
  }, [workOrderHoursByDate]);

  // Yearly hours (based on work order scheduled_date)
  const totalHoursThisYear = useMemo(() => {
    const now = new Date();
    const yStart = startOfYear(now);
    const yEnd = endOfYear(now);
    return workOrderHoursByDate
      .filter(wo => wo.date >= yStart && wo.date <= yEnd)
      .reduce((sum, wo) => sum + wo.hours, 0);
  }, [workOrderHoursByDate]);

  // Get work orders for the selected date
  const workOrdersForSelectedDate = useMemo(() => {
    if (!selectedDate) return [];
    return allWorkOrders.filter(wo => {
      if (!wo.scheduled_date) return false;
      return isSameDay(new Date(wo.scheduled_date), selectedDate);
    });
  }, [allWorkOrders, selectedDate]);

  // Get dates that have work orders
  const datesWithWorkOrders = useMemo(() => {
    return allWorkOrders
      .filter(wo => wo.scheduled_date)
      .map(wo => new Date(wo.scheduled_date!));
  }, [allWorkOrders]);

  return (
    <DashboardLayout title="Dashboard do Cliente">
      <div className="space-y-6">
        {/* Notifications */}
        <Notifications />

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

        {/* Hours Summary Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Horas Semanais</CardTitle>
              <Clock className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalHoursThisWeek.toFixed(1)}h</div>
              <p className="text-xs text-muted-foreground">Esta semana</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Horas Mensais</CardTitle>
              <CalendarDays className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalHoursThisMonth.toFixed(1)}h</div>
              <p className="text-xs text-muted-foreground">{format(new Date(), "MMMM", { locale: pt })}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Horas Anuais</CardTitle>
              <CalendarDays className="h-4 w-4 text-accent" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalHoursThisYear.toFixed(1)}h</div>
              <p className="text-xs text-muted-foreground">{new Date().getFullYear()}</p>
            </CardContent>
          </Card>
        </div>

        {/* Calendar Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5" />
              Calendário de Ordens de Trabalho
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Calendar */}
              <div className="flex flex-col items-center">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  month={calendarMonth}
                  onMonthChange={setCalendarMonth}
                  locale={pt}
                  className="rounded-md border pointer-events-auto"
                  modifiers={{
                    hasWorkOrder: datesWithWorkOrders,
                  }}
                  modifiersClassNames={{
                    hasWorkOrder: "bg-primary/20 font-bold",
                  }}
                />
                <div className="mt-4 text-center">
                  <p className="text-lg font-semibold capitalize">
                    {format(calendarMonth, "MMMM yyyy", { locale: pt })}
                  </p>
                  <div className="flex items-center justify-center gap-2 mt-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      Total de horas: <span className="font-bold text-foreground">{totalHoursForMonth.toFixed(1)}h</span>
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {workOrdersForMonth.length} ordem(ns) de trabalho
                  </p>
                </div>
              </div>

              {/* Work Orders for Selected Date or Month */}
              <div className="space-y-4">
                <h4 className="font-medium">
                  {selectedDate 
                    ? `Ordens de ${format(selectedDate, "d 'de' MMMM", { locale: pt })}`
                    : `Ordens de ${format(calendarMonth, "MMMM", { locale: pt })}`
                  }
                </h4>
                
                <div className="max-h-[350px] overflow-y-auto space-y-3 pr-2">
                  {(selectedDate ? workOrdersForSelectedDate : workOrdersForMonth).length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      {selectedDate 
                        ? "Nenhuma ordem de trabalho para esta data"
                        : "Nenhuma ordem de trabalho este mês"
                      }
                    </p>
                  ) : (
                    (selectedDate ? workOrdersForSelectedDate : workOrdersForMonth).map((wo) => {
                      const assignedEmployees = wo.assignments?.map(a => a.profiles?.name).filter(Boolean) || [];
                      const woTotalHours = wo.total_hours || 0;
                      
                      return (
                        <div 
                          key={wo.id} 
                          className="rounded-lg border p-3 hover:bg-muted/50 cursor-pointer transition-colors"
                          onClick={() => navigate(`/work-orders/${wo.id}`)}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">{wo.reference}</p>
                              <p className="text-xs text-muted-foreground truncate">{wo.title}</p>
                            </div>
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium shrink-0 ${getStatusColor(wo.status)}`}>
                              {getStatusLabel(wo.status)}
                            </span>
                          </div>
                          
                          <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                            {assignedEmployees.length > 0 && (
                              <div className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                <span>{assignedEmployees.join(", ")}</span>
                              </div>
                            )}
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              <span>{woTotalHours.toFixed(1)}h</span>
                            </div>
                            {wo.scheduled_date && (
                              <span>
                                {format(new Date(wo.scheduled_date), "dd/MM/yyyy")}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {selectedDate && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setSelectedDate(undefined)}
                    className="w-full"
                  >
                    Ver todas do mês
                  </Button>
                )}
              </div>
            </div>

            {/* Work Orders Without Scheduled Date */}
            {workOrdersWithoutDate.length > 0 && (
              <div className="mt-6 pt-6 border-t">
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <ClipboardList className="h-4 w-4" />
                  Ordens Sem Data Agendada
                  <span className="text-sm font-normal text-muted-foreground">
                    ({totalHoursWithoutDate.toFixed(1)}h total)
                  </span>
                </h4>
                <div className="max-h-[250px] overflow-y-auto space-y-3 pr-2">
                  {workOrdersWithoutDate.map((wo) => {
                    const assignedEmployees = wo.assignments?.map(a => a.profiles?.name).filter(Boolean) || [];
                    const woTotalHours = wo.total_hours || 0;
                    
                    return (
                      <div 
                        key={wo.id} 
                        className="rounded-lg border p-3 hover:bg-muted/50 cursor-pointer transition-colors"
                        onClick={() => navigate(`/work-orders/${wo.id}`)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{wo.reference}</p>
                            <p className="text-xs text-muted-foreground truncate">{wo.title}</p>
                          </div>
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium shrink-0 ${getStatusColor(wo.status)}`}>
                            {getStatusLabel(wo.status)}
                          </span>
                        </div>
                        
                        <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                          {assignedEmployees.length > 0 && (
                            <div className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              <span>{assignedEmployees.join(", ")}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            <span>{woTotalHours.toFixed(1)}h</span>
                          </div>
                          <span className="text-orange-500">Sem data agendada</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Ações Rápidas</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button onClick={() => setCreateWorkOrderDialogOpen(true)}>
              <ClipboardList className="mr-2 h-4 w-4" />
              Nova Solicitação
            </Button>
            <Button variant="outline" onClick={() => setShowEquipments(!showEquipments)}>
              <Wrench className="mr-2 h-4 w-4" />
              {showEquipments ? "Ocultar Equipamentos" : "Gerir Equipamentos"}
            </Button>
          </CardContent>
        </Card>

        {/* Equipment Management */}
        {showEquipments && (
          <Card>
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle>Meus Equipamentos</CardTitle>
              <Button className="w-full sm:w-auto" onClick={() => setCreateEquipmentDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Adicionar Equipamento
              </Button>
            </CardHeader>
            <CardContent>
              {equipments.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Nenhum equipamento encontrado
                </p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {equipments.map((equipment) => (
                    <Card key={equipment.id} className="shadow-sm">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">{equipment.name}</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {equipment.model && (
                          <div className="text-sm">
                            <span className="text-muted-foreground">Modelo:</span>
                            <p className="font-medium">{equipment.model}</p>
                          </div>
                        )}
                        {equipment.serial_number && (
                          <div className="text-sm">
                            <span className="text-muted-foreground">Nº Série:</span>
                            <p className="font-medium">{equipment.serial_number}</p>
                          </div>
                        )}
                        {equipment.location && (
                          <div className="text-sm">
                            <span className="text-muted-foreground">Localização:</span>
                            <p className="font-medium">{equipment.location}</p>
                          </div>
                        )}
                        {equipment.notes && (
                          <div className="text-sm">
                            <span className="text-muted-foreground">Notas:</span>
                            <p className="text-xs mt-1">{equipment.notes}</p>
                          </div>
                        )}
                        <div className="flex flex-col sm:flex-row gap-2 pt-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full"
                            onClick={() => {
                              setSelectedEquipment(equipment);
                              setEditEquipmentDialogOpen(true);
                            }}
                          >
                            <Pencil className="h-3 w-3 mr-1" />
                            Editar
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="w-full"
                            onClick={() => {
                              setSelectedEquipment(equipment);
                              setDeleteEquipmentDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-3 w-3 mr-1" />
                            Eliminar
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* My Requests */}
        <Card>
          <CardHeader>
            <CardTitle>Últimas Solicitações</CardTitle>
          </CardHeader>
          <CardContent>
            {workOrders.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Nenhuma solicitação encontrada
              </p>
            ) : (
              <div className="space-y-4">
                {workOrders.map((order) => (
                  <div key={order.id} className="flex flex-col gap-3 rounded-lg border p-4">
                    <div className="space-y-1">
                      <p className="font-medium">{order.reference}</p>
                      <p className="text-sm text-muted-foreground">{order.title}</p>
                    </div>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                      <span className={`rounded-full px-3 py-1 text-xs font-medium text-center ${getStatusColor(order.status)}`}>
                        {getStatusLabel(order.status)}
                      </span>
                      {(order.total_hours != null && order.total_hours > 0) && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {order.total_hours.toFixed(1)}h
                        </span>
                      )}
                      <Button 
                        size="sm" 
                        className="w-full sm:w-auto"
                        variant={order.status === "completed" ? "outline" : "default"}
                        onClick={() => navigate(`/work-orders/${order.id}`)}
                      >
                        {order.status === "completed" ? "Ver Documento" : "Ver"}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialogs */}
      <CreateClientWorkOrderDialog
        open={createWorkOrderDialogOpen}
        onOpenChange={setCreateWorkOrderDialogOpen}
        onSuccess={() => { fetchWorkOrders(); fetchAllWorkOrders(); }}
        clientId={currentUserId}
      />

      <CreateEquipmentDialog
        open={createEquipmentDialogOpen}
        onOpenChange={setCreateEquipmentDialogOpen}
        onSuccess={handleEquipmentCreated}
        clientId={currentUserId}
      />

      {selectedEquipment && (
        <EditEquipmentDialog
          open={editEquipmentDialogOpen}
          onOpenChange={setEditEquipmentDialogOpen}
          equipment={selectedEquipment}
          onSuccess={handleEquipmentUpdated}
        />
      )}

      <AlertDialog open={deleteEquipmentDialogOpen} onOpenChange={setDeleteEquipmentDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tem a certeza?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser revertida. O equipamento "{selectedEquipment?.name}" será eliminado permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteEquipment}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}