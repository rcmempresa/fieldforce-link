import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Mail, Phone, Trash2, Edit, CalendarIcon, Briefcase } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Calendar } from "@/components/ui/calendar";
import { format, isSameDay } from "date-fns";
import { pt } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { CreateEmployeeDialog } from "@/components/employees/CreateEmployeeDialog";
import { EditEmployeeDialog } from "@/components/employees/EditEmployeeDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Employee {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  approved: boolean;
  created_at: string;
  company_name?: string | null;
  address?: string | null;
  workOrdersCount?: number;
}

interface WorkOrder {
  id: string;
  reference: string | null;
  title: string;
  status: string;
  priority: string;
  scheduled_date?: string | null;
}

export default function Employees() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [selectedCalendarEmployee, setSelectedCalendarEmployee] = useState<Employee | null>(null);
  const [calendarOrders, setCalendarOrders] = useState<WorkOrder[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    fetchEmployees();
  }, []);

  useEffect(() => {
    filterEmployees();
  }, [searchTerm, employees]);

  const fetchEmployees = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: "Erro",
          description: "Sessão não encontrada",
          variant: "destructive",
        });
        return;
      }

      const { data, error } = await supabase.functions.invoke('list-users', {
        body: { role: 'employee' },
      });

      if (error) throw error;

      const employeesWithCount = await Promise.all(
        (data.users || []).map(async (employee: Employee) => {
          const { count } = await supabase
            .from('work_order_assignments')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', employee.id);
          
          return {
            ...employee,
            workOrdersCount: count || 0,
          };
        })
      );

      setEmployees(employeesWithCount);
      setFilteredEmployees(employeesWithCount);
    } catch (error) {
      console.error('Error fetching employees:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os funcionários",
        variant: "destructive",
      });
    }
  };

  const fetchEmployeeOrders = async (employeeId: string) => {
    try {
      const { data, error } = await supabase
        .from('work_order_assignments')
        .select(`
          work_order_id,
          work_orders (
            id,
            reference,
            title,
            status,
            priority,
            scheduled_date
          )
        `)
        .eq('user_id', employeeId);

      if (error) throw error;

      const orders = data
        ?.map((assignment: any) => assignment.work_orders)
        .filter((order: any) => order !== null) || [];

      setCalendarOrders(orders);
    } catch (error) {
      console.error('Error fetching employee orders:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as ordens de trabalho",
        variant: "destructive",
      });
    }
  };

  const filterEmployees = () => {
    if (!searchTerm) {
      setFilteredEmployees(employees);
      return;
    }

    const filtered = employees.filter(
      (emp) =>
        emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.email.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredEmployees(filtered);
  };

  const handleDelete = async () => {
    if (!selectedEmployee) return;

    try {
      const { data, error } = await supabase.functions.invoke('delete-user', {
        body: { userId: selectedEmployee.id },
      });

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Funcionário eliminado com sucesso",
      });
      fetchEmployees();
      setDeleteDialogOpen(false);
      setSelectedEmployee(null);
    } catch (error) {
      console.error('Error deleting employee:', error);
      toast({
        title: "Erro",
        description: "Erro ao eliminar funcionário",
        variant: "destructive",
      });
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "employee":
        return "Funcionário";
      case "client":
        return "Cliente";
      default:
        return role;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case "employee":
        return "bg-primary/10 text-primary";
      case "client":
        return "bg-accent/10 text-accent";
      default:
        return "bg-muted text-muted-foreground";
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
        return "bg-success/10 text-success";
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

  const getOrdersForDate = (date: Date) => {
    return calendarOrders.filter((order) => {
      if (!order.scheduled_date) return false;
      return isSameDay(new Date(order.scheduled_date), date);
    });
  };

  const hasOrdersOnDate = (date: Date) => {
    return getOrdersForDate(date).length > 0;
  };

  const handleViewEmployee = (employee: Employee) => {
    setSelectedCalendarEmployee(employee);
    fetchEmployeeOrders(employee.id);
  };

  return (
    <DashboardLayout title="Gerir Funcionários">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center justify-between sm:justify-start gap-4">
                <CardTitle>Funcionários</CardTitle>
                <div className="text-sm text-muted-foreground">
                  Total: {employees.length}
                </div>
              </div>
              <CreateEmployeeDialog onSuccess={fetchEmployees} />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Pesquisar por nome ou email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Employees List */}
            {filteredEmployees.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Nenhum funcionário encontrado
              </p>
            ) : (
              <div className="space-y-4">
                {filteredEmployees.map((employee) => (
                  <div
                    key={employee.id}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-lg border p-4"
                  >
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{employee.name}</p>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${getRoleColor(
                            employee.role
                          )}`}
                        >
                          {getRoleLabel(employee.role)}
                        </span>
                        {!employee.approved && (
                          <span className="rounded-full bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">
                            Não Aprovado
                          </span>
                        )}
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {employee.email}
                        </div>
                        {employee.phone && (
                          <div className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {employee.phone}
                          </div>
                        )}
                      </div>
                       <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Briefcase className="h-3 w-3" />
                          <span>{employee.workOrdersCount || 0} OT atribuídas</span>
                        </div>
                       <p className="text-xs text-muted-foreground">
                        Registado: {new Date(employee.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex gap-2 justify-end sm:justify-start">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleViewEmployee(employee)}
                      >
                        <CalendarIcon className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setSelectedEmployee(employee);
                          setEditDialogOpen(true);
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setSelectedEmployee(employee);
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {selectedCalendarEmployee && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Calendário - {selectedCalendarEmployee.name}</CardTitle>
              </CardHeader>
              <CardContent className="flex justify-center">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => date && setSelectedDate(date)}
                  locale={pt}
                  modifiers={{
                    hasOrders: (date) => hasOrdersOnDate(date),
                  }}
                  modifiersStyles={{
                    hasOrders: {
                      fontWeight: 'bold',
                      textDecoration: 'underline',
                    },
                  }}
                  className="rounded-md border pointer-events-auto"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>
                  Ordens de Trabalho - {format(selectedDate, "dd 'de' MMMM 'de' yyyy", { locale: pt })}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {getOrdersForDate(selectedDate).length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhuma ordem de trabalho agendada para este dia
                  </p>
                ) : (
                  <div className="space-y-3">
                    {getOrdersForDate(selectedDate).map((order) => (
                      <div
                        key={order.id}
                        className="flex items-center justify-between rounded-lg border p-3 cursor-pointer hover:bg-accent/50 transition-colors"
                        onClick={() => navigate(`/work-orders/${order.id}`)}
                      >
                        <div className="flex-1">
                          <p className="font-medium text-sm">{order.reference}</p>
                          <p className="text-xs text-muted-foreground">{order.title}</p>
                          {order.scheduled_date && (
                            <p className="text-xs font-medium text-primary mt-1">
                              {format(new Date(order.scheduled_date), "HH:mm", { locale: pt })}
                            </p>
                          )}
                        </div>
                        <span className={`rounded-full px-2 py-1 text-xs font-medium ${getStatusColor(order.status)}`}>
                          {getStatusLabel(order.status)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      <EditEmployeeDialog
        employee={selectedEmployee}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSuccess={fetchEmployees}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Eliminação</AlertDialogTitle>
            <AlertDialogDescription>
              Tem a certeza que deseja eliminar o funcionário{" "}
              <strong>{selectedEmployee?.name}</strong>? Esta ação não pode ser revertida e
              todos os dados associados serão eliminados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedEmployee(null)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
