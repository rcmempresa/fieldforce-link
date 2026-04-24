import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
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
import { getBusyEmployeeIds, getShift, getShiftLabel, MAX_PER_SHIFT } from "@/lib/employeeAvailability";

interface CreateWorkOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface Client {
  id: string;
  name: string;
}

interface Equipment {
  id: string;
  name: string;
  model: string | null;
  serial_number: string | null;
  location: string | null;
}

interface EmployeeOption {
  id: string;
  name: string;
}

export function CreateWorkOrderDialog({
  open,
  onOpenChange,
  onSuccess,
}: CreateWorkOrderDialogProps) {
  const [clients, setClients] = useState<Client[]>([]);
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [busyEmployeeIds, setBusyEmployeeIds] = useState<Set<string>>(new Set());
  const [overbookingConfirm, setOverbookingConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    client_id: "",
    equipment_ids: [] as string[],
    employee_ids: [] as string[],
    service_type: "repair",
    priority: "medium",
    scheduled_date: "",
    address: "",
  });
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchClients();
      fetchEmployees();
    }
  }, [open]);

  useEffect(() => {
    if (formData.client_id) {
      fetchEquipments(formData.client_id);
    } else {
      setEquipments([]);
      setFormData(prev => ({ ...prev, equipment_ids: [] }));
    }
  }, [formData.client_id]);

  // Recompute busy employees when scheduled_date changes
  useEffect(() => {
    const loadBusy = async () => {
      if (!formData.scheduled_date || employees.length === 0) {
        setBusyEmployeeIds(new Set());
        return;
      }
      const ids = await getBusyEmployeeIds(
        new Date(formData.scheduled_date),
        employees.map((e) => e.id)
      );
      setBusyEmployeeIds(ids);
    };
    loadBusy();
  }, [formData.scheduled_date, employees]);

  const fetchEmployees = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("list-users", {
        body: { role: "employee" },
      });
      if (error) return;
      if (data?.users) {
        setEmployees(
          data.users.map((u: any) => ({ id: u.id, name: u.name }))
        );
      }
    } catch (e) {
      console.error("Error fetching employees:", e);
    }
  };

  const toggleEmployee = (employeeId: string) => {
    setFormData((prev) => ({
      ...prev,
      employee_ids: prev.employee_ids.includes(employeeId)
        ? prev.employee_ids.filter((id) => id !== employeeId)
        : [...prev.employee_ids, employeeId],
    }));
  };

  const fetchClients = async () => {
    try {
      // Check if user has manager role
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: userRoles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', session.user.id)
        .eq('role', 'manager')
        .eq('approved', true)
        .single();

      if (!userRoles) {
        console.error('User is not a manager');
        return;
      }

      const { data, error } = await supabase.functions.invoke('list-users', {
        body: { role: 'client' },
      });

      if (error) {
        console.error('Error fetching clients:', error);
        toast({
          title: "Erro",
          description: "Não foi possível carregar os clientes",
          variant: "destructive",
        });
        return;
      }

      if (data?.users) {
        const clientList = data.users.map((user: any) => ({
          id: user.id,
          name: user.name,
        }));
        setClients(clientList);
      }
    } catch (error) {
      console.error('Error fetching clients:', error);
    }
  };

  const fetchEquipments = async (clientId: string) => {
    const { data } = await supabase
      .from("equipments")
      .select("id, name, model, serial_number, location")
      .eq("client_id", clientId);

    if (data) {
      setEquipments(data);
    }
  };

  const toggleEquipment = (equipmentId: string) => {
    setFormData(prev => ({
      ...prev,
      equipment_ids: prev.equipment_ids.includes(equipmentId)
        ? prev.equipment_ids.filter(id => id !== equipmentId)
        : [...prev.equipment_ids, equipmentId]
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Overbooking check before creating
    if (
      formData.scheduled_date &&
      formData.employee_ids.some((id) => busyEmployeeIds.has(id))
    ) {
      setOverbookingConfirm(true);
      return;
    }

    await submitWorkOrder();
  };

  const submitWorkOrder = async () => {
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Create work order
    const { data: workOrder, error: workOrderError } = await supabase
      .from("work_orders")
      .insert({
        title: formData.title,
        description: formData.description,
        client_id: formData.client_id,
        service_type: formData.service_type as "repair" | "maintenance" | "installation" | "warranty",
        priority: formData.priority as "low" | "medium" | "high",
        scheduled_date: formData.scheduled_date || null,
        address: formData.address || null,
        created_by: user.id,
        status: "pending" as const,
      })
      .select()
      .single();

    if (workOrderError) {
      setLoading(false);
      toast({
        title: "Erro",
        description: "Erro ao criar ordem de trabalho",
        variant: "destructive",
      });
      return;
    }

    // Link equipments to work order
    if (formData.equipment_ids.length > 0) {
      const equipmentLinks = formData.equipment_ids.map(equipmentId => ({
        work_order_id: workOrder.id,
        equipment_id: equipmentId,
      }));

      const { error: equipmentError } = await supabase
        .from("work_order_equipments")
        .insert(equipmentLinks);

      if (equipmentError) {
        console.error("Error linking equipments:", equipmentError);
      }
    }

    // Link employees (assignments) to work order
    if (formData.employee_ids.length > 0) {
      const assignmentLinks = formData.employee_ids.map((employeeId) => ({
        work_order_id: workOrder.id,
        user_id: employeeId,
        assigned_by: user.id,
      }));
      const { error: assignmentError } = await supabase
        .from("work_order_assignments")
        .insert(assignmentLinks);
      if (assignmentError) {
        console.error("Error assigning employees:", assignmentError);
      }
    }

    // Get client name for notifications
    const { data: clientProfile } = await supabase
      .from("profiles")
      .select("name")
      .eq("id", formData.client_id)
      .single();

    // Notify client
    await supabase.from("notifications").insert({
      user_id: formData.client_id,
      work_order_id: workOrder.id,
      type: "work_order_created",
      channel: "email",
      payload: JSON.stringify({
        reference: workOrder.reference,
        message: `Nova ordem de trabalho ${workOrder.reference} foi criada`,
      }),
    });

    if (clientProfile) {
      supabase.functions.invoke("send-notification-email", {
        body: {
          type: "work_order_created",
          userId: formData.client_id,
          data: {
            recipientName: clientProfile.name,
            workOrderReference: workOrder.reference || "",
            workOrderTitle: formData.title,
            clientName: clientProfile.name,
          },
        },
      });
    }

    // Notify all managers
    const { data: managers } = await supabase
      .from("user_roles")
      .select("user_id, profiles!user_roles_user_id_fkey(name)")
      .eq("role", "manager")
      .eq("approved", true);

    if (managers && managers.length > 0) {
      const managerNotifications = managers.map((manager: any) => ({
        user_id: manager.user_id,
        work_order_id: workOrder.id,
        type: "work_order_created",
        channel: "email" as const,
        payload: JSON.stringify({
          reference: workOrder.reference,
          client_name: clientProfile?.name || "Cliente",
          message: `Nova ordem ${workOrder.reference} criada`,
        }),
      }));
      await supabase.from("notifications").insert(managerNotifications);

      for (const manager of managers) {
        const managerProfile = manager.profiles as any;
        if (managerProfile) {
          supabase.functions.invoke("send-notification-email", {
            body: {
              type: "work_order_created",
              userId: manager.user_id,
              data: {
                recipientName: managerProfile.name,
                workOrderReference: workOrder.reference || "",
                workOrderTitle: formData.title,
                clientName: clientProfile?.name || "Cliente",
                isManager: true,
              },
            },
          });
        }
      }
    }

    setLoading(false);

    toast({
      title: "Sucesso",
      description: "Ordem de trabalho criada com sucesso",
    });
    
    setFormData({
      title: "",
      description: "",
      client_id: "",
      equipment_ids: [],
      employee_ids: [],
      service_type: "repair",
      priority: "medium",
      scheduled_date: "",
      address: "",
    });
    onOpenChange(false);
    onSuccess();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Ordem de Trabalho</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Título *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="client">Cliente *</Label>
            <Select
              value={formData.client_id}
              onValueChange={(value) => setFormData({ ...formData, client_id: value })}
              required
            >
              <SelectTrigger id="client">
                <SelectValue placeholder="Selecionar cliente" />
              </SelectTrigger>
              <SelectContent className="bg-popover z-50">
                {clients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {formData.client_id && equipments.length > 0 && (
            <div className="space-y-2">
              <Label>Equipamentos</Label>
              <div className="border rounded-lg p-3 space-y-2 max-h-48 overflow-y-auto">
                {equipments.map((equipment) => (
                  <label
                    key={equipment.id}
                    className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 p-2 rounded"
                  >
                    <input
                      type="checkbox"
                      checked={formData.equipment_ids.includes(equipment.id)}
                      onChange={() => toggleEquipment(equipment.id)}
                      className="h-4 w-4"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-sm">{equipment.name}</div>
                      {(equipment.model || equipment.serial_number || equipment.location) && (
                        <div className="text-xs text-muted-foreground">
                          {equipment.model && `Modelo: ${equipment.model}`}
                          {equipment.model && (equipment.serial_number || equipment.location) && " • "}
                          {equipment.serial_number && `S/N: ${equipment.serial_number}`}
                          {equipment.serial_number && equipment.location && " • "}
                          {equipment.location && `📍 ${equipment.location}`}
                        </div>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="service_type">Tipo de Serviço *</Label>
            <Select
              value={formData.service_type}
              onValueChange={(value) => setFormData({ ...formData, service_type: value })}
              required
            >
              <SelectTrigger id="service_type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover z-50">
                <SelectItem value="repair">Reparação</SelectItem>
                <SelectItem value="maintenance">Manutenção</SelectItem>
                <SelectItem value="installation">Instalação</SelectItem>
                <SelectItem value="warranty">Garantia</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="priority">Prioridade</Label>
            <Select
              value={formData.priority}
              onValueChange={(value) => setFormData({ ...formData, priority: value })}
            >
              <SelectTrigger id="priority">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover z-50">
                <SelectItem value="low">Baixa</SelectItem>
                <SelectItem value="medium">Média</SelectItem>
                <SelectItem value="high">Alta</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="scheduled_date">Data Agendada</Label>
            <Input
              id="scheduled_date"
              type="datetime-local"
              value={formData.scheduled_date}
              onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Morada do Local</Label>
            <Input
              id="address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="Ex: Rua do Exemplo, 123, Lisboa"
            />
          </div>

          {employees.length > 0 && (
            <div className="space-y-2">
              <Label>Atribuir Funcionários (opcional)</Label>
              <div className="border rounded-lg p-3 space-y-2 max-h-48 overflow-y-auto">
                {employees.map((employee) => {
                  const busy = busyEmployeeIds.has(employee.id);
                  return (
                    <label
                      key={employee.id}
                      className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 p-2 rounded"
                    >
                      <input
                        type="checkbox"
                        checked={formData.employee_ids.includes(employee.id)}
                        onChange={() => toggleEmployee(employee.id)}
                        className="h-4 w-4"
                      />
                      <span className="font-medium text-sm flex-1">{employee.name}</span>
                      {formData.scheduled_date && (
                        busy ? (
                          <Badge variant="destructive" className="text-[10px] py-0 h-5">Ocupado</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px] py-0 h-5">Disponível</Badge>
                        )
                      )}
                    </label>
                  );
                })}
              </div>
              {formData.scheduled_date && busyEmployeeIds.size === employees.length && (
                <p className="text-xs text-destructive">
                  Todos os funcionários já têm {MAX_PER_SHIFT} OTs no turno da {getShiftLabel(getShift(new Date(formData.scheduled_date)))}. Pode confirmar overbooking ou alterar o turno/dia.
                </p>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "A criar..." : "Criar Ordem"}
            </Button>
          </div>
        </form>
      </DialogContent>

      <AlertDialog open={overbookingConfirm} onOpenChange={setOverbookingConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar overbooking</AlertDialogTitle>
            <AlertDialogDescription>
              Selecionou funcionários que já têm outra OT agendada dentro de ±1h
              do horário escolhido. Deseja criar a OT mesmo assim (overbooking)
              ou cancelar para escolher outro horário/funcionário?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                setOverbookingConfirm(false);
                await submitWorkOrder();
              }}
            >
              Confirmar overbooking
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
