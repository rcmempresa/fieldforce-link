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
import {
  getBusyEmployeeIds,
  getSlot,
  getSlotLabel,
  MAX_PER_SLOT,
} from "@/lib/employeeAvailability";
import { SlotDateTimePicker } from "./SlotDateTimePicker";

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
    setSelectedDate(undefined);
    setSelectedSlot("");
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
            <Label>Data Agendada</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !selectedDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? (
                    format(selectedDate, "PPP", { locale: pt })
                  ) : (
                    <span>Escolher data</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-popover z-50" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  month={calendarMonth}
                  onMonthChange={setCalendarMonth}
                  locale={pt}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                  modifiers={{
                    hasOrders: monthOrders
                      .map((o) => new Date(o.scheduled_date))
                      .filter((d) => !isNaN(d.getTime())),
                  }}
                  modifiersClassNames={{
                    hasOrders:
                      "relative after:content-[''] after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:h-1 after:w-1 after:rounded-full after:bg-primary",
                  }}
                />
              </PopoverContent>
            </Popover>

            {selectedDate && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">
                  Horário (slots de 2 horas)
                </Label>
                <div className="grid grid-cols-4 gap-2">
                  {WORK_ORDER_SLOTS.map((slot) => {
                    const dayKey = getLisbonDateKey(selectedDate);
                    const slotOrders = monthOrders.filter((o) => {
                      const d = new Date(o.scheduled_date);
                      return getLisbonDateKey(d) === dayKey && getSlot(d) === slot;
                    });
                    const count = slotOrders.length;
                    const isSelected = selectedSlot === slot;
                    return (
                      <Button
                        key={slot}
                        type="button"
                        variant={isSelected ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSelectedSlot(slot)}
                        className="flex flex-col h-auto py-2"
                      >
                        <span className="font-medium">{getSlotLabel(slot)}</span>
                        <span className="text-[10px] opacity-75">
                          {count === 0 ? "livre" : `${count} OT${count > 1 ? "s" : ""}`}
                        </span>
                      </Button>
                    );
                  })}
                </div>

                {(() => {
                  const dayKey = getLisbonDateKey(selectedDate);
                  const dayOrders = monthOrders
                    .filter((o) => getLisbonDateKey(new Date(o.scheduled_date)) === dayKey)
                    .sort(
                      (a, b) =>
                        new Date(a.scheduled_date).getTime() -
                        new Date(b.scheduled_date).getTime()
                    );
                  if (dayOrders.length === 0) {
                    return (
                      <p className="text-xs text-muted-foreground italic">
                        Sem OTs agendadas neste dia.
                      </p>
                    );
                  }
                  return (
                    <div className="border rounded-lg p-2 max-h-40 overflow-y-auto space-y-1 bg-muted/30">
                      <p className="text-xs font-medium text-muted-foreground px-1">
                        OTs já agendadas:
                      </p>
                      {dayOrders.map((o) => {
                        const d = new Date(o.scheduled_date);
                        const slot = getSlot(d);
                        return (
                          <div
                            key={o.id}
                            className="text-xs flex items-start gap-2 p-1.5 rounded hover:bg-background"
                          >
                            <Badge variant="outline" className="text-[10px] py-0 h-5 shrink-0">
                              {slot !== null ? getSlotLabel(slot) : "—"}
                            </Badge>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate">
                                {o.reference} · {o.title}
                              </div>
                              <div className="text-muted-foreground truncate">
                                {o.client_name || "—"}
                                {o.assignees.length > 0 && (
                                  <> · {o.assignees.map((a) => a.name).join(", ")}</>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            )}
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
              {formData.scheduled_date && busyEmployeeIds.size === employees.length && (() => {
                const slot = getSlot(new Date(formData.scheduled_date));
                return (
                  <p className="text-xs text-destructive">
                    Todos os funcionários já têm uma OT no slot das{" "}
                    {slot !== null ? getSlotLabel(slot) : "—"}. Pode confirmar
                    overbooking ou escolher outro horário/dia.
                  </p>
                );
              })()}
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
              Selecionou funcionários que já têm {MAX_PER_SLOT} OT no mesmo
              slot horário do dia escolhido. Deseja criar mesmo assim
              (overbooking) ou cancelar para escolher outro horário/funcionário?
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
