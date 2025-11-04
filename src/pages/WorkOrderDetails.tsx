import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Calendar, User, Clock, FileText, Users, Plus, X, Wrench } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface WorkOrderDetails {
  id: string;
  reference: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  scheduled_date: string | null;
  created_at: string;
  total_hours: number;
  notes: string;
  profiles: {
    name: string;
    email: string;
  };
}

interface Employee {
  id: string;
  name: string;
  email: string;
}

interface Assignment {
  id: string;
  user_id: string;
  assigned_at: string;
  profiles: {
    name: string;
  };
}

export default function WorkOrderDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, roles } = useAuth();
  const [workOrder, setWorkOrder] = useState<WorkOrderDetails | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const isClient = roles.includes("client");

  useEffect(() => {
    fetchWorkOrderDetails();
    if (!isClient) {
      fetchAssignments();
      fetchEmployees();
    }
  }, [id, isClient]);

  const fetchWorkOrderDetails = async () => {
    const { data, error } = await supabase
      .from("work_orders")
      .select(`
        *,
        profiles!work_orders_client_id_fkey (
          name
        )
      `)
      .eq("id", id)
      .single();

    setLoading(false);

    if (error) {
      toast({
        title: "Erro",
        description: "Erro ao carregar detalhes da ordem de trabalho",
        variant: "destructive",
      });
      navigate("/work-orders");
    } else if (data) {
      setWorkOrder(data as any);
    }
  };

  const fetchAssignments = async () => {
    const { data } = await supabase
      .from("work_order_assignments")
      .select(`
        id,
        user_id,
        assigned_at,
        profiles!work_order_assignments_user_id_fkey (
          name
        )
      `)
      .eq("work_order_id", id);

    if (data) {
      setAssignments(data as any);
    }
  };

  const fetchEmployees = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('list-users', {
        body: { role: 'employee' },
      });

      if (error) {
        console.error('Error fetching employees:', error);
        return;
      }

      if (data?.users) {
        setEmployees(data.users.map((user: any) => ({
          id: user.id,
          name: user.name,
          email: user.email,
        })));
      }
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  const handleAssignEmployee = async () => {
    if (!selectedEmployee) {
      toast({
        title: "Erro",
        description: "Selecione um funcionário",
        variant: "destructive",
      });
      return;
    }

    // Check if already assigned
    if (assignments.some(a => a.user_id === selectedEmployee)) {
      toast({
        title: "Aviso",
        description: "Este funcionário já está atribuído",
        variant: "destructive",
      });
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from("work_order_assignments")
      .insert({
        work_order_id: id,
        user_id: selectedEmployee,
        assigned_by: user.id,
      });

    if (error) {
      toast({
        title: "Erro",
        description: "Erro ao atribuir funcionário",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Sucesso",
        description: "Funcionário atribuído com sucesso",
      });
      setSelectedEmployee("");
      fetchAssignments();
    }
  };

  const handleRemoveAssignment = async (assignmentId: string) => {
    const { error } = await supabase
      .from("work_order_assignments")
      .delete()
      .eq("id", assignmentId);

    if (error) {
      toast({
        title: "Erro",
        description: "Erro ao remover atribuição",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Sucesso",
        description: "Atribuição removida com sucesso",
      });
      fetchAssignments();
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
      case "cancelled":
        return "bg-destructive/10 text-destructive";
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
      case "cancelled":
        return "Cancelada";
      default:
        return status;
    }
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

  if (loading) {
    return (
      <DashboardLayout title="Detalhes da Ordem">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </DashboardLayout>
    );
  }

  if (!workOrder) {
    return null;
  }

  return (
    <DashboardLayout title="Detalhes da Ordem">
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => navigate("/work-orders")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-2xl">{workOrder.reference}</CardTitle>
                <p className="text-muted-foreground mt-1">{workOrder.title}</p>
              </div>
              <div className="flex gap-2">
                <span
                  className={`rounded-full px-3 py-1 text-sm font-medium ${getStatusColor(
                    workOrder.status
                  )}`}
                >
                  {getStatusLabel(workOrder.status)}
                </span>
                <span
                  className={`rounded-full px-3 py-1 text-sm font-medium ${getPriorityColor(
                    workOrder.priority
                  )}`}
                >
                  {getPriorityLabel(workOrder.priority)}
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <User className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Cliente</p>
                    <p className="text-sm text-muted-foreground">{workOrder.profiles.name}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Data Criada</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(workOrder.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>

                {workOrder.scheduled_date && (
                  <div className="flex items-start gap-3">
                    <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Data Agendada</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(workOrder.scheduled_date).toLocaleString()}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Total de Horas</p>
                    <p className="text-sm text-muted-foreground">
                      {workOrder.total_hours || 0}h
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {workOrder.description && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <p className="text-sm font-medium">Descrição</p>
                </div>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {workOrder.description}
                </p>
              </div>
            )}

            {workOrder.notes && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <p className="text-sm font-medium">Notas</p>
                </div>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {workOrder.notes}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {!isClient && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Funcionários Atribuídos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Selecionar funcionário" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover z-50">
                    {employees.map((employee) => (
                      <SelectItem key={employee.id} value={employee.id}>
                        {employee.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={handleAssignEmployee}>
                  <Plus className="h-4 w-4 mr-1" />
                  Atribuir
                </Button>
              </div>

              {assignments.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">
                  Nenhum funcionário atribuído
                </p>
              ) : (
                <div className="space-y-2">
                  {assignments.map((assignment) => (
                    <div
                      key={assignment.id}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div>
                        <p className="font-medium text-sm">{assignment.profiles.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Atribuído em: {new Date(assignment.assigned_at).toLocaleString()}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRemoveAssignment(assignment.id)}
                      >
                        <X className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
