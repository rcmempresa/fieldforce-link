import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Calendar, User, Clock, FileText, Users, Plus, X, Wrench, Package } from "lucide-react";
import { formatHoursDetailed } from "@/lib/formatHours";
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
import { WorkOrderAttachments } from "@/components/work-orders/WorkOrderAttachments";
import { EquipmentAttachments } from "@/components/equipments/EquipmentAttachments";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

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
    company_name?: string;
    phone?: string;
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

interface Equipment {
  id: string;
  name: string;
  model: string | null;
  serial_number: string | null;
}

export default function WorkOrderDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, roles } = useAuth();
  const [workOrder, setWorkOrder] = useState<WorkOrderDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const isManager = roles.includes("manager");
  
  // Manager only states
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<string>("");
  
  // Equipment states
  const [equipments, setEquipments] = useState<Equipment[]>([]);

  useEffect(() => {
    fetchWorkOrderDetails();
    fetchEquipments();
    if (isManager) {
      fetchAssignments();
      fetchEmployees();
    }
  }, [id, isManager]);

  const fetchWorkOrderDetails = async () => {
    const { data, error } = await supabase
      .from("work_orders")
      .select(`
        *,
        profiles!work_orders_client_id_fkey (
          name,
          company_name,
          phone
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

  const fetchEquipments = async () => {
    const { data, error } = await supabase
      .from("work_order_equipments")
      .select(`
        equipment_id,
        equipments (
          id,
          name,
          model,
          serial_number
        )
      `)
      .eq("work_order_id", id);

    if (error) {
      console.error("Error fetching equipments:", error);
      return;
    }

    if (data) {
      const equipmentsList = data
        .map((item: any) => item.equipments)
        .filter(Boolean);
      setEquipments(equipmentsList);
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
      // Create notification for assigned employee
      await supabase
        .from("notifications")
        .insert({
          user_id: selectedEmployee,
          work_order_id: id,
          type: "work_order_assigned",
          channel: "email",
          payload: JSON.stringify({
            message: `Foi atribuído à ordem de trabalho ${workOrder?.reference}`,
            work_order_reference: workOrder?.reference,
            work_order_title: workOrder?.title,
          }),
          status: "queued",
        });

      // Get employee details for email
      const { data: employeeData } = await supabase
        .from("profiles")
        .select("name, id")
        .eq("id", selectedEmployee)
        .single();

      // Send email notification
      if (employeeData) {
        supabase.functions.invoke("send-notification-email", {
          body: {
            type: "work_order_assigned",
            userId: selectedEmployee,
            data: {
              recipientName: employeeData.name,
              workOrderReference: workOrder?.reference || "",
              workOrderTitle: workOrder?.title || "",
              clientName: workOrder?.profiles?.name || "N/A",
            },
          },
        });
      }

      toast({
        title: "Sucesso",
        description: "Funcionário atribuído com sucesso",
      });
      setSelectedEmployee("");
      fetchAssignments();
    }
  };

  const handleRemoveAssignment = async (assignmentId: string) => {
    // Get assignment details before deleting
    const { data: assignmentData } = await supabase
      .from("work_order_assignments")
      .select("user_id, profiles!work_order_assignments_user_id_fkey(name)")
      .eq("id", assignmentId)
      .single();

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
      // Notify removed employee
      if (assignmentData) {
        await supabase.from("notifications").insert({
          user_id: assignmentData.user_id,
          work_order_id: id,
          type: "work_order_assignment_removed",
          channel: "email",
          payload: JSON.stringify({
            reference: workOrder?.reference,
            message: `Foi removido da ordem de trabalho ${workOrder?.reference}`,
          }),
        });

        const employeeProfile = assignmentData.profiles as any;
        if (employeeProfile) {
          supabase.functions.invoke("send-notification-email", {
            body: {
              type: "work_order_assignment_removed",
              userId: assignmentData.user_id,
              data: {
                recipientName: employeeProfile.name,
                workOrderReference: workOrder?.reference || "",
                workOrderTitle: workOrder?.title || "",
              },
            },
          });
        }
      }

      toast({
        title: "Sucesso",
        description: "Atribuição removida com sucesso",
      });
      fetchAssignments();
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
            {/* Client Info Card - Highlighted */}
            <Card className="bg-muted/50 border-primary/20">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <User className="h-5 w-5 text-primary mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-primary">Cliente</p>
                    <p className="text-lg font-semibold">{workOrder.profiles?.name || 'N/A'}</p>
                    {workOrder.profiles?.company_name && (
                      <p className="text-sm text-muted-foreground mt-1">
                        Empresa: {workOrder.profiles.company_name}
                      </p>
                    )}
                    {workOrder.profiles?.phone && (
                      <p className="text-sm text-muted-foreground">
                        Tel: {workOrder.profiles.phone}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-4">

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
                      {formatHoursDetailed(workOrder.total_hours)}
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

        {isManager && (
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
                        <p className="font-medium text-sm">{assignment.profiles?.name || 'N/A'}</p>
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

        {equipments.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Equipamentos Associados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="w-full">
                {equipments.map((equipment) => (
                  <AccordionItem key={equipment.id} value={equipment.id}>
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center gap-2">
                        <Wrench className="h-4 w-4" />
                        <div className="text-left">
                          <p className="font-medium">{equipment.name}</p>
                          {(equipment.model || equipment.serial_number) && (
                            <p className="text-xs text-muted-foreground">
                              {equipment.model && `Modelo: ${equipment.model}`}
                              {equipment.model && equipment.serial_number && " | "}
                              {equipment.serial_number && `S/N: ${equipment.serial_number}`}
                            </p>
                          )}
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <EquipmentAttachments
                        equipmentId={equipment.id}
                        currentUserId={user?.id || ""}
                        canEdit={roles.includes("manager") || roles.includes("employee")}
                      />
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        )}

        <WorkOrderAttachments 
          workOrderId={id!} 
          isManager={isManager}
          currentUserId={user?.id}
        />
      </div>
    </DashboardLayout>
  );
}
