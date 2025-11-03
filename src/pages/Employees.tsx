import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Mail, Phone, Trash2, Edit } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
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
}

export default function Employees() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchEmployees();
  }, []);

  useEffect(() => {
    filterEmployees();
  }, [searchTerm, employees]);

  const fetchEmployees = async () => {
    // Get all employees and clients from user_roles
    const { data: userRoles } = await supabase
      .from("user_roles")
      .select(`
        user_id,
        role,
        approved,
        created_at,
        profiles!user_roles_user_id_fkey (
          id,
          name,
          phone,
          company_name,
          address
        )
      `)
      .in("role", ["employee", "client"]);

    if (userRoles) {
      // Get emails from auth
      const { data } = await supabase.auth.admin.listUsers();
      const users = data?.users || [];
      
      const employeesWithEmails = userRoles.map((item: any) => {
        const authUser = users.find(u => u.id === item.profiles.id);
        return {
          id: item.profiles.id,
          name: item.profiles.name,
          email: authUser?.email || "N/A",
          phone: item.profiles.phone,
          company_name: item.profiles.company_name,
          address: item.profiles.address,
          role: item.role,
          approved: item.approved,
          created_at: item.created_at,
        };
      });

      setEmployees(employeesWithEmails);
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

    // Delete user from auth (will cascade to user_roles and profiles)
    const { error } = await supabase.auth.admin.deleteUser(selectedEmployee.id);

    if (error) {
      toast({
        title: "Erro",
        description: "Erro ao eliminar utilizador",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Sucesso",
        description: "Utilizador eliminado com sucesso",
      });
      fetchEmployees();
      setDeleteDialogOpen(false);
      setSelectedEmployee(null);
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

  return (
    <DashboardLayout title="Gerir Utilizadores">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Funcionários e Clientes</CardTitle>
              <div className="flex items-center gap-4">
                <div className="text-sm text-muted-foreground">
                  Total: {employees.length}
                </div>
                <CreateEmployeeDialog onSuccess={fetchEmployees} />
              </div>
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
                Nenhum utilizador encontrado
              </p>
            ) : (
              <div className="space-y-4">
                {filteredEmployees.map((employee) => (
                  <div
                    key={employee.id}
                    className="flex items-center justify-between rounded-lg border p-4"
                  >
                    <div className="flex-1 space-y-1">
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
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
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
                      <p className="text-xs text-muted-foreground">
                        Registado: {new Date(employee.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex gap-2">
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
              Tem a certeza que deseja eliminar o utilizador{" "}
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
