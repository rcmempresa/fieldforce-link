import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ClipboardList, Users, CheckCircle, UserCheck, Calendar as CalendarIcon, Mail, Clock } from "lucide-react";
import { formatHours } from "@/lib/formatHours";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Calendar } from "@/components/ui/calendar";
import { format, isSameDay } from "date-fns";
import { pt } from "date-fns/locale";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Notifications } from "@/components/Notifications";

interface PendingUser {
  id: string;
  email: string;
  name: string;
  created_at: string;
}

interface WorkOrder {
  id: string;
  reference: string;
  title: string;
  status: string;
  scheduled_date?: string | null;
  client_name?: string;
  client_id?: string;
  service_type?: string;
  priority?: string;
  created_at?: string;
  total_hours?: number;
}

interface Stats {
  pending: number;
  inProgress: number;
  completed: number;
  activeEmployees: number;
  activeClients: number;
}

export default function ManagerDashboard() {
  const navigate = useNavigate();
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [pendingRequests, setPendingRequests] = useState<WorkOrder[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<Record<string, string>>({});
  const [scheduledDates, setScheduledDates] = useState<Record<string, string>>({});
  const [stats, setStats] = useState<Stats>({ pending: 0, inProgress: 0, completed: 0, activeEmployees: 0, activeClients: 0 });
  const [recentOrders, setRecentOrders] = useState<WorkOrder[]>([]);
  const [calendarOrders, setCalendarOrders] = useState<WorkOrder[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const { toast } = useToast();

  useEffect(() => {
    fetchPendingUsers();
    fetchPendingRequests();
    fetchStats();
    fetchRecentOrders();
    fetchCalendarOrders();
  }, []);

  const fetchPendingUsers = async () => {
    try {
      // Call the secure edge function to list pending users
      const { data, error } = await supabase.functions.invoke("list-pending-users");
      
      if (error) {
        console.error("Error fetching pending users:", error);
        setPendingUsers([]);
        return;
      }
      
      if (data?.users) {
        setPendingUsers(data.users as PendingUser[]);
      } else {
        setPendingUsers([]);
      }
    } catch (error) {
      console.error("Error fetching pending users:", error);
      setPendingUsers([]);
    }
  };

  const fetchPendingRequests = async () => {
    const { data } = await supabase
      .from("work_orders")
      .select(`
        id,
        reference,
        title,
        status,
        service_type,
        priority,
        created_at,
        profiles!work_orders_client_id_fkey (
          name,
          company_name
        )
      `)
      .eq("status", "awaiting_approval")
      .order("created_at", { ascending: false });

    if (data) {
      const formattedData = data.map((order: any) => ({
        ...order,
        client_name: order.profiles?.company_name || order.profiles?.name || "N/A",
      }));
      setPendingRequests(formattedData);
    }
  };

  const fetchStats = async () => {
    // Pending orders
    const { count: pendingCount } = await supabase
      .from("work_orders")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending");

    // In progress orders
    const { count: inProgressCount } = await supabase
      .from("work_orders")
      .select("*", { count: "exact", head: true })
      .eq("status", "in_progress");

    // Completed orders this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { count: completedCount } = await supabase
      .from("work_orders")
      .select("*", { count: "exact", head: true })
      .eq("status", "completed")
      .gte("updated_at", startOfMonth.toISOString());

    // Active employees
    const { count: employeesCount } = await supabase
      .from("user_roles")
      .select("*", { count: "exact", head: true })
      .eq("role", "employee")
      .eq("approved", true);

    // Active clients
    const { count: clientsCount } = await supabase
      .from("user_roles")
      .select("*", { count: "exact", head: true })
      .eq("role", "client")
      .eq("approved", true);

    setStats({
      pending: pendingCount || 0,
      inProgress: inProgressCount || 0,
      completed: completedCount || 0,
      activeEmployees: employeesCount || 0,
      activeClients: clientsCount || 0,
    });
  };

  const fetchRecentOrders = async () => {
    const { data } = await supabase
      .from("work_orders")
      .select("id, reference, title, status, scheduled_date")
      .order("created_at", { ascending: false })
      .limit(5);

    if (data) {
      setRecentOrders(data);
    }
  };

  const fetchCalendarOrders = async () => {
    const { data } = await supabase
      .from("work_orders")
      .select(`
        id, 
        reference, 
        title, 
        status, 
        scheduled_date,
        client_id,
        total_hours,
        profiles!work_orders_client_id_fkey (
          name,
          company_name
        )
      `)
      .not("scheduled_date", "is", null)
      .order("scheduled_date", { ascending: true });

    if (data) {
      const formattedOrders = data.map((order: any) => ({
        ...order,
        client_name: order.profiles?.company_name || order.profiles?.name || "N/A",
      }));
      setCalendarOrders(formattedOrders);
    }
  };

  const getOrdersForDate = (date: Date) => {
    return calendarOrders.filter(order => 
      order.scheduled_date && isSameDay(new Date(order.scheduled_date), date)
    );
  };

  const hasOrdersOnDate = (date: Date) => {
    return calendarOrders.some(order => 
      order.scheduled_date && isSameDay(new Date(order.scheduled_date), date)
    );
  };

  const approveUser = async (userId: string) => {
    const role = selectedRoles[userId];
    if (!role) {
      toast({
        title: "Erro",
        description: "Por favor, selecione um papel para o utilizador",
        variant: "destructive",
      });
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    
    // Get user profile for email
    const pendingUser = pendingUsers.find(u => u.id === userId);
    
    const { error } = await supabase
      .from("user_roles")
      .insert({
        user_id: userId,
        role: role as "manager" | "employee" | "client",
        approved: true,
        approved_by: user?.id,
        approved_at: new Date().toISOString(),
      });

    if (error) {
      toast({
        title: "Erro",
        description: "Erro ao aprovar utilizador",
        variant: "destructive",
      });
    } else {
      // Send approval email
      if (pendingUser) {
        supabase.functions.invoke("send-notification-email", {
          body: {
            type: "account_approved",
            userId: userId,
            data: {
              recipientName: pendingUser.name,
              role: role,
            },
          },
        });
      }
      
      toast({
        title: "Sucesso",
        description: "Utilizador aprovado com sucesso",
      });
      fetchPendingUsers();
      fetchStats();
    }
  };

  const rejectUser = async (userId: string) => {
    try {
      // Get user info before deletion for email
      const pendingUser = pendingUsers.find(u => u.id === userId);
      
      // Send rejection email before deleting (since user will be deleted)
      if (pendingUser) {
        await supabase.functions.invoke("send-notification-email", {
          body: {
            type: "account_rejected",
            userId: userId,
            data: {
              recipientName: pendingUser.name,
            },
          },
        });
      }
      
      // Call the secure edge function to delete user
      const { data, error } = await supabase.functions.invoke("delete-user", {
        body: { userId },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: "Sucesso",
        description: "Utilizador rejeitado",
      });
      fetchPendingUsers();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao rejeitar utilizador",
        variant: "destructive",
      });
    }
  };

  const approveRequest = async (requestId: string) => {
    const scheduledDate = scheduledDates[requestId];
    const request = pendingRequests.find(r => r.id === requestId);
    
    const updateData: any = { status: "pending" };
    if (scheduledDate) {
      updateData.scheduled_date = new Date(scheduledDate).toISOString();
    }

    // Get client info for email
    const { data: workOrderData } = await supabase
      .from("work_orders")
      .select("client_id, reference, title, profiles!work_orders_client_id_fkey(name)")
      .eq("id", requestId)
      .single();

    const { error } = await supabase
      .from("work_orders")
      .update(updateData)
      .eq("id", requestId);

    if (error) {
      toast({
        title: "Erro",
        description: "Erro ao aprovar solicitação",
        variant: "destructive",
      });
    } else {
      // Send approval email to client
      if (workOrderData) {
        const clientProfile = workOrderData.profiles as any;
        const formattedDate = scheduledDate 
          ? format(new Date(scheduledDate), "dd/MM/yyyy 'às' HH:mm", { locale: pt })
          : undefined;
          
        supabase.functions.invoke("send-notification-email", {
          body: {
            type: "work_order_approved",
            userId: workOrderData.client_id,
            data: {
              recipientName: clientProfile?.name || "Cliente",
              workOrderReference: workOrderData.reference || "",
              workOrderTitle: workOrderData.title || "",
              scheduledDate: formattedDate,
              isClient: true,
            },
          },
        });
      }
      
      toast({
        title: "Sucesso",
        description: scheduledDate ? "Solicitação aprovada e agendada" : "Solicitação aprovada",
      });
      fetchPendingRequests();
      fetchStats();
      fetchRecentOrders();
      fetchCalendarOrders();
    }
  };

  const rejectRequest = async (requestId: string) => {
    // Get client info for email
    const { data: workOrderData } = await supabase
      .from("work_orders")
      .select("client_id, reference, title, profiles!work_orders_client_id_fkey(name)")
      .eq("id", requestId)
      .single();

    const { error } = await supabase
      .from("work_orders")
      .update({ status: "cancelled" })
      .eq("id", requestId);

    if (error) {
      toast({
        title: "Erro",
        description: "Erro ao rejeitar solicitação",
        variant: "destructive",
      });
    } else {
      // Send rejection email to client
      if (workOrderData) {
        const clientProfile = workOrderData.profiles as any;
        supabase.functions.invoke("send-notification-email", {
          body: {
            type: "work_order_rejected",
            userId: workOrderData.client_id,
            data: {
              recipientName: clientProfile?.name || "Cliente",
              workOrderReference: workOrderData.reference || "",
              workOrderTitle: workOrderData.title || "",
              isClient: true,
            },
          },
        });
      }
      
      toast({
        title: "Sucesso",
        description: "Solicitação rejeitada",
      });
      fetchPendingRequests();
      fetchStats();
    }
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

  return (
    <DashboardLayout title="Dashboard do Gerente">
      <div className="space-y-8 pb-8">
        {/* Header Section */}
        <div className="space-y-2">
          <h2 className="text-3xl font-bold tracking-tight">Visão Geral</h2>
          <p className="text-muted-foreground">
            Acompanhe as métricas principais e gerencie as operações
          </p>
        </div>

        {/* Notifications */}
        <Notifications />

        {/* Stats Cards */}
        <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          <Card className="bg-gradient-to-br from-warning/5 via-background to-background border-warning/20 hover:shadow-lg transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Ordens Pendentes</CardTitle>
              <div className="h-10 w-10 rounded-full bg-warning/10 flex items-center justify-center">
                <ClipboardList className="h-5 w-5 text-warning" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-warning">{stats.pending}</div>
              <p className="text-xs text-muted-foreground mt-1">Aguardam aprovação</p>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-primary/5 via-background to-background border-primary/20 hover:shadow-lg transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Em Progresso</CardTitle>
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <ClipboardList className="h-5 w-5 text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">{stats.inProgress}</div>
              <p className="text-xs text-muted-foreground mt-1">Em execução</p>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-accent/5 via-background to-background border-accent/20 hover:shadow-lg transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Concluídas</CardTitle>
              <div className="h-10 w-10 rounded-full bg-accent/10 flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-accent" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-accent">{stats.completed}</div>
              <p className="text-xs text-muted-foreground mt-1">Este mês</p>
            </CardContent>
          </Card>
        </div>

        {/* Team Stats */}
        <div className="grid gap-6 grid-cols-1 sm:grid-cols-2">
          <Card className="hover:shadow-md transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-base font-semibold">Equipa</CardTitle>
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Funcionários Ativos</span>
                  <span className="text-2xl font-bold text-primary">{stats.activeEmployees}</span>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="hover:shadow-md transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-base font-semibold">Clientes</CardTitle>
              <div className="h-10 w-10 rounded-full bg-accent/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-accent" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Clientes Ativos</span>
                  <span className="text-2xl font-bold text-accent">{stats.activeClients}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="hover:shadow-md transition-all duration-300 cursor-pointer" onClick={() => navigate("/work-orders")}>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <ClipboardList className="h-5 w-5 text-primary" />
                </div>
                <CardTitle className="text-base">Ordens de Trabalho</CardTitle>
              </div>
            </CardHeader>
          </Card>
          
          <Card className="hover:shadow-md transition-all duration-300 cursor-pointer" onClick={() => navigate("/employees")}>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <CardTitle className="text-base">Funcionários</CardTitle>
              </div>
            </CardHeader>
          </Card>
          
          <Card className="hover:shadow-md transition-all duration-300 cursor-pointer" onClick={() => navigate("/clients")}>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-accent/10 flex items-center justify-center">
                  <Users className="h-5 w-5 text-accent" />
                </div>
                <CardTitle className="text-base">Clientes</CardTitle>
              </div>
            </CardHeader>
          </Card>

          <Card className="hover:shadow-md transition-all duration-300 cursor-pointer" onClick={() => navigate("/email-logs")}>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-orange-500/10 flex items-center justify-center">
                  <Mail className="h-5 w-5 text-orange-500" />
                </div>
                <CardTitle className="text-base">Histórico de Emails</CardTitle>
              </div>
            </CardHeader>
          </Card>
        </div>

        {/* Pending Users */}
        {pendingUsers.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCheck className="h-5 w-5" />
                Utilizadores Pendentes de Aprovação
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {pendingUsers.map((user) => (
                  <div key={user.id} className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 rounded-lg border p-4">
                    <div className="space-y-1">
                      <p className="font-medium">{user.name}</p>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                      <p className="text-xs text-muted-foreground">
                        Registado em: {new Date(user.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                       <Select
                        value={selectedRoles[user.id] || ""}
                        onValueChange={(value) =>
                          setSelectedRoles({ ...selectedRoles, [user.id]: value })
                        }
                      >
                        <SelectTrigger className="w-full sm:w-[150px]">
                          <SelectValue placeholder="Selecionar papel" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="manager">Gerente</SelectItem>
                          <SelectItem value="employee">Funcionário</SelectItem>
                          <SelectItem value="client">Cliente</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button size="sm" onClick={() => approveUser(user.id)}>
                        Aprovar
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => rejectUser(user.id)}
                      >
                        Rejeitar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Pending Service Requests */}
        {pendingRequests.length > 0 && (
          <Card className="border-orange-500/20 bg-gradient-to-br from-orange-500/5 via-background to-background">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-orange-500">
                <ClipboardList className="h-5 w-5" />
                Solicitações Aguardando Aprovação
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {pendingRequests.map((request) => (
                  <div key={request.id} className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 rounded-lg border border-orange-500/20 bg-orange-500/5 p-4">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{request.reference}</p>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${getStatusColor(request.status)}`}>
                          {getStatusLabel(request.status)}
                        </span>
                      </div>
                      <p className="text-sm">{request.title}</p>
                      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mt-2">
                        <span>Cliente: {request.client_name}</span>
                        {request.service_type && (
                          <span>Tipo: {
                            request.service_type === 'repair' ? 'Reparação' :
                            request.service_type === 'maintenance' ? 'Manutenção' :
                            request.service_type === 'installation' ? 'Instalação' :
                            request.service_type === 'warranty' ? 'Garantia' : request.service_type
                          }</span>
                        )}
                        {request.priority && (
                          <span className={`font-medium ${
                            request.priority === 'high' ? 'text-destructive' :
                            request.priority === 'medium' ? 'text-warning' :
                            'text-accent'
                          }`}>
                            Prioridade: {
                              request.priority === 'high' ? 'Alta' :
                              request.priority === 'medium' ? 'Média' : 'Baixa'
                            }
                          </span>
                        )}
                        {request.created_at && (
                          <span>Criado: {new Date(request.created_at).toLocaleString()}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                      <div className="flex flex-col gap-1">
                        <Label htmlFor={`date-${request.id}`} className="text-xs text-muted-foreground">
                          Data Agendada
                        </Label>
                        <Input
                          id={`date-${request.id}`}
                          type="datetime-local"
                          value={scheduledDates[request.id] || ""}
                          onChange={(e) => setScheduledDates({ ...scheduledDates, [request.id]: e.target.value })}
                          className="w-full sm:w-auto"
                        />
                      </div>
                      <Button 
                        size="sm" 
                        onClick={() => approveRequest(request.id)}
                        className="bg-accent hover:bg-accent/90"
                      >
                        Aprovar
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => rejectRequest(request.id)}
                      >
                        Rejeitar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quick Actions */}
        <Card className="border-2 hover:shadow-lg transition-all duration-300">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-primary" />
              Ações Rápidas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Button 
                onClick={() => navigate('/work-orders')}
                className="h-20 flex flex-col gap-2"
                size="lg"
              >
                <ClipboardList className="h-6 w-6" />
                <span>Gerir Ordens</span>
              </Button>
              <Button 
                variant="outline" 
                onClick={() => navigate('/employees')}
                className="h-20 flex flex-col gap-2 hover:bg-primary hover:text-primary-foreground"
                size="lg"
              >
                <Users className="h-6 w-6" />
                <span>Funcionários</span>
              </Button>
              <Button 
                variant="outline" 
                onClick={() => navigate('/clients')}
                className="h-20 flex flex-col gap-2 hover:bg-accent hover:text-accent-foreground"
                size="lg"
              >
                <Users className="h-6 w-6" />
                <span>Clientes</span>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Recent Work Orders */}
        <Card className="hover:shadow-md transition-all duration-300">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-primary" />
              Ordens de Trabalho Recentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentOrders.length === 0 ? (
              <div className="text-center py-12">
                <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground">Nenhuma ordem de trabalho encontrada</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentOrders.map((order) => (
                  <div 
                    key={order.id} 
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-lg border p-4 hover:bg-muted/50 hover:shadow-sm transition-all duration-200 cursor-pointer"
                    onClick={() => navigate(`/work-orders/${order.id}`)}
                  >
                    <div className="space-y-1 flex-1">
                      <p className="font-semibold text-foreground">{order.reference}</p>
                      <p className="text-sm text-muted-foreground">{order.title}</p>
                    </div>
                    <div className="flex items-center gap-3 justify-between sm:justify-end">
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusColor(order.status)}`}>
                        {getStatusLabel(order.status)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Calendar View */}
        <Card className="hover:shadow-md transition-all duration-300">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5 text-primary" />
              Calendário de Ordens de Trabalho
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="flex justify-center">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  locale={pt}
                  className="rounded-md border shadow-sm"
                  modifiers={{
                    hasOrders: (date) => hasOrdersOnDate(date)
                  }}
                  modifiersStyles={{
                    hasOrders: { 
                      fontWeight: 'bold',
                      backgroundColor: 'hsl(var(--primary) / 0.15)',
                      color: 'hsl(var(--primary))',
                      borderRadius: '0.375rem'
                    }
                  }}
                />
              </div>
              <div>
                <div className="mb-4 pb-3 border-b">
                  <h4 className="font-semibold text-lg">
                    {selectedDate ? format(selectedDate, "dd 'de' MMMM, yyyy", { locale: pt }) : "Selecione uma data"}
                  </h4>
                  {selectedDate && getOrdersForDate(selectedDate).length > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {getOrdersForDate(selectedDate).length} {getOrdersForDate(selectedDate).length === 1 ? 'ordem agendada' : 'ordens agendadas'}
                    </p>
                  )}
                </div>
                {selectedDate && getOrdersForDate(selectedDate).length > 0 ? (
                  <div className="space-y-3">
                    {getOrdersForDate(selectedDate).map((order) => (
                      <div
                        key={order.id}
                        className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50 hover:shadow-sm cursor-pointer transition-all duration-200"
                        onClick={() => navigate(`/work-orders/${order.id}`)}
                      >
                        <div className="flex-1">
                          <p className="font-semibold text-sm">{order.reference}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{order.title}</p>
                          {order.client_name && (
                            <p className="text-xs text-muted-foreground">
                              Cliente: {order.client_name}
                            </p>
                          )}
                          <div className="flex items-center gap-3 mt-1">
                            {order.scheduled_date && (
                              <p className="text-xs font-semibold text-primary">
                                {format(new Date(order.scheduled_date), "HH:mm", { locale: pt })}
                              </p>
                            )}
                            {order.total_hours !== undefined && order.total_hours > 0 && (
                              <p className="text-xs font-medium text-accent flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatHours(order.total_hours)} trabalhadas
                              </p>
                            )}
                          </div>
                        </div>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusColor(order.status)}`}>
                          {getStatusLabel(order.status)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <CalendarIcon className="h-10 w-10 mx-auto text-muted-foreground/50 mb-2" />
                    <p className="text-sm text-muted-foreground">
                      {selectedDate 
                        ? "Nenhuma ordem agendada para esta data" 
                        : "Selecione uma data no calendário"}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
