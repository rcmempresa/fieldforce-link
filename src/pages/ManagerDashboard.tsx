import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ClipboardList, Users, CheckCircle, UserCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
}

interface Stats {
  pending: number;
  inProgress: number;
  completed: number;
  activeEmployees: number;
}

export default function ManagerDashboard() {
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<Record<string, string>>({});
  const [stats, setStats] = useState<Stats>({ pending: 0, inProgress: 0, completed: 0, activeEmployees: 0 });
  const [recentOrders, setRecentOrders] = useState<WorkOrder[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    fetchPendingUsers();
    fetchStats();
    fetchRecentOrders();
  }, []);

  const fetchPendingUsers = async () => {
    // First, get all user IDs that have roles
    const { data: usersWithRoles } = await supabase
      .from("user_roles")
      .select("user_id");

    const userIdsWithRoles = usersWithRoles?.map(r => r.user_id) || [];

    // Then get all profiles
    const { data: allProfiles } = await supabase
      .from("profiles")
      .select("id, name, created_at");

    // Filter profiles that don't have roles
    const usersWithoutRoles = allProfiles?.filter(
      profile => !userIdsWithRoles.includes(profile.id)
    ) || [];

    if (usersWithoutRoles.length > 0) {
      // Get user list to find emails
      const { data } = await supabase.auth.admin.listUsers();
      const authUsers = data?.users || [];
      
      const usersWithEmails = usersWithoutRoles.map((user) => {
        const authUser = authUsers.find(u => u.id === user.id);
        return {
          ...user,
          email: authUser?.email || "N/A",
        };
      });
      
      setPendingUsers(usersWithEmails as PendingUser[]);
    } else {
      setPendingUsers([]);
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

    setStats({
      pending: pendingCount || 0,
      inProgress: inProgressCount || 0,
      completed: completedCount || 0,
      activeEmployees: employeesCount || 0,
    });
  };

  const fetchRecentOrders = async () => {
    const { data } = await supabase
      .from("work_orders")
      .select("id, reference, title, status")
      .order("created_at", { ascending: false })
      .limit(5);

    if (data) {
      setRecentOrders(data);
    }
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
      toast({
        title: "Sucesso",
        description: "Utilizador aprovado com sucesso",
      });
      fetchPendingUsers();
      fetchStats();
    }
  };

  const rejectUser = async (userId: string) => {
    const { error } = await supabase.auth.admin.deleteUser(userId);

    if (error) {
      toast({
        title: "Erro",
        description: "Erro ao rejeitar utilizador",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Sucesso",
        description: "Utilizador rejeitado",
      });
      fetchPendingUsers();
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

  return (
    <DashboardLayout title="Dashboard do Gerente">
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ordens Pendentes</CardTitle>
              <ClipboardList className="h-4 w-4 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pending}</div>
              <p className="text-xs text-muted-foreground">Aguardam aprovação</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Em Progresso</CardTitle>
              <ClipboardList className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.inProgress}</div>
              <p className="text-xs text-muted-foreground">Em execução</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Concluídas</CardTitle>
              <CheckCircle className="h-4 w-4 text-accent" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.completed}</div>
              <p className="text-xs text-muted-foreground">Este mês</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Funcionários</CardTitle>
              <Users className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activeEmployees}</div>
              <p className="text-xs text-muted-foreground">Ativos</p>
            </CardContent>
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
                  <div key={user.id} className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-1">
                      <p className="font-medium">{user.name}</p>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                      <p className="text-xs text-muted-foreground">
                        Registado em: {new Date(user.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Select
                        value={selectedRoles[user.id] || ""}
                        onValueChange={(value) =>
                          setSelectedRoles({ ...selectedRoles, [user.id]: value })
                        }
                      >
                        <SelectTrigger className="w-[150px]">
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

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Ações Rápidas</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button onClick={() => window.location.href = '/work-orders'}>
              <ClipboardList className="mr-2 h-4 w-4" />
              Gerir Ordens de Trabalho
            </Button>
            <Button variant="outline" onClick={() => window.location.href = '/employees'}>
              <Users className="mr-2 h-4 w-4" />
              Gerir Funcionários
            </Button>
            <Button variant="outline" onClick={() => window.location.href = '/clients'}>
              <Users className="mr-2 h-4 w-4" />
              Gerir Clientes
            </Button>
          </CardContent>
        </Card>

        {/* Recent Work Orders */}
        <Card>
          <CardHeader>
            <CardTitle>Ordens de Trabalho Recentes</CardTitle>
          </CardHeader>
          <CardContent>
            {recentOrders.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Nenhuma ordem de trabalho encontrada
              </p>
            ) : (
              <div className="space-y-4">
                {recentOrders.map((order) => (
                  <div key={order.id} className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-1">
                      <p className="font-medium">{order.reference}</p>
                      <p className="text-sm text-muted-foreground">{order.title}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`rounded-full px-3 py-1 text-xs font-medium ${getStatusColor(order.status)}`}>
                        {getStatusLabel(order.status)}
                      </span>
                      <Button size="sm">Ver Detalhes</Button>
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
