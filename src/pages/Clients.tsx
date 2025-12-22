import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Mail, Phone, Trash2, Edit, Building2, MapPin, Package, ChevronDown, ChevronUp, Plus, CalendarIcon, Briefcase, ArrowLeft, Clock } from "lucide-react";
import { EquipmentAttachments } from "@/components/equipments/EquipmentAttachments";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { CreateEmployeeDialog } from "@/components/employees/CreateEmployeeDialog";
import { EditEmployeeDialog } from "@/components/employees/EditEmployeeDialog";
import { CreateEquipmentDialog } from "@/components/equipments/CreateEquipmentDialog";
import { EditEquipmentDialog } from "@/components/equipments/EditEquipmentDialog";
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Calendar } from "@/components/ui/calendar";
import { format, isSameDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfDay, endOfDay } from "date-fns";
import { pt } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Equipment {
  id: string;
  name: string;
  model: string | null;
  serial_number: string | null;
  location: string | null;
  notes: string | null;
}

interface Client {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  approved: boolean;
  created_at: string;
  company_name?: string | null;
  address?: string | null;
  equipments?: Equipment[];
}

interface WorkOrder {
  id: string;
  reference: string | null;
  title: string;
  status: string;
  priority: string;
  scheduled_date?: string | null;
  total_hours?: number;
}

interface HoursStats {
  today: number;
  thisWeek: number;
  thisMonth: number;
  byWorkOrder: { [key: string]: { hours: number; reference: string; title: string } };
}

export default function Clients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [filteredClients, setFilteredClients] = useState<Client[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());
  const [createEquipmentDialogOpen, setCreateEquipmentDialogOpen] = useState(false);
  const [editEquipmentDialogOpen, setEditEquipmentDialogOpen] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);
  const [currentClientId, setCurrentClientId] = useState<string | null>(null);
  const [selectedCalendarClient, setSelectedCalendarClient] = useState<Client | null>(null);
  const [calendarOrders, setCalendarOrders] = useState<WorkOrder[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [isManager, setIsManager] = useState(false);
  const [hoursStats, setHoursStats] = useState<HoursStats | null>(null);
  const [loadingHours, setLoadingHours] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    fetchClients();
    fetchCurrentUser();
  }, []);

  const fetchCurrentUser = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setCurrentUserId(session.user.id);
        
        const { data: userRoles } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', session.user.id)
          .eq('role', 'manager')
          .eq('approved', true)
          .single();
        
        setIsManager(!!userRoles);
      }
    } catch (error) {
      console.error('Error fetching current user:', error);
    }
  };

  useEffect(() => {
    filterClients();
  }, [searchTerm, clients]);

  const fetchClients = async () => {
    try {
      // Ensure we have a valid session with fresh token
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        console.error('Session error:', sessionError);
        toast({
          title: "Erro de Autenticação",
          description: "Por favor, faça login novamente",
          variant: "destructive",
        });
        return;
      }

      // Check if user has manager role
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

      console.log('Calling list-users with valid session');
      
      const { data, error } = await supabase.functions.invoke('list-users', {
        body: { role: 'client' },
      });

      if (error) {
        console.error('Edge function error:', error);
        throw error;
      }

      // Fetch equipments for each client
      const clientsWithEquipments = await Promise.all(
        (data.users || []).map(async (client: Client) => {
          const { data: equipments } = await supabase
            .from('equipments')
            .select('*')
            .eq('client_id', client.id);
          
          return {
            ...client,
            equipments: equipments || []
          };
        })
      );

      setClients(clientsWithEquipments);
      setFilteredClients(clientsWithEquipments);
    } catch (error) {
      console.error('Error fetching clients:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os clientes",
        variant: "destructive",
      });
    }
  };

  const filterClients = () => {
    if (!searchTerm) {
      setFilteredClients(clients);
      return;
    }

    const filtered = clients.filter(
      (client) =>
        client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (client.company_name && client.company_name.toLowerCase().includes(searchTerm.toLowerCase()))
    );
    setFilteredClients(filtered);
  };

  const handleDelete = async () => {
    if (!selectedClient) return;

    try {
      const { data, error } = await supabase.functions.invoke('delete-user', {
        body: { userId: selectedClient.id },
      });

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Cliente eliminado com sucesso",
      });
      fetchClients();
      setDeleteDialogOpen(false);
      setSelectedClient(null);
    } catch (error) {
      console.error('Error deleting client:', error);
      toast({
        title: "Erro",
        description: "Erro ao eliminar cliente",
        variant: "destructive",
      });
    }
  };

  const toggleClientExpanded = (clientId: string) => {
    const newExpanded = new Set(expandedClients);
    if (newExpanded.has(clientId)) {
      newExpanded.delete(clientId);
    } else {
      newExpanded.add(clientId);
    }
    setExpandedClients(newExpanded);
  };

  const fetchClientOrders = async (clientId: string) => {
    try {
      const { data, error } = await supabase
        .from('work_orders')
        .select('id, reference, title, status, priority, scheduled_date, total_hours')
        .eq('client_id', clientId)
        .order('scheduled_date', { ascending: true });

      if (error) throw error;

      setCalendarOrders(data || []);
    } catch (error) {
      console.error('Error fetching client orders:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as ordens de trabalho",
        variant: "destructive",
      });
    }
  };

  const fetchClientHours = async (clientId: string) => {
    setLoadingHours(true);
    try {
      // Get all work orders for this client
      const { data: workOrders, error: woError } = await supabase
        .from('work_orders')
        .select('id, reference, title')
        .eq('client_id', clientId);

      if (woError) throw woError;

      if (!workOrders || workOrders.length === 0) {
        setHoursStats({
          today: 0,
          thisWeek: 0,
          thisMonth: 0,
          byWorkOrder: {},
        });
        setLoadingHours(false);
        return;
      }

      const workOrderIds = workOrders.map(wo => wo.id);

      // Get all time entries for those work orders
      const { data: timeEntries, error: teError } = await supabase
        .from('time_entries')
        .select('id, duration_hours, created_at, work_order_id')
        .in('work_order_id', workOrderIds);

      if (teError) throw teError;

      const now = new Date();
      const todayStart = startOfDay(now);
      const todayEnd = endOfDay(now);
      const weekStart = startOfWeek(now, { locale: pt });
      const weekEnd = endOfWeek(now, { locale: pt });
      const monthStart = startOfMonth(now);
      const monthEnd = endOfMonth(now);

      let todayHours = 0;
      let weekHours = 0;
      let monthHours = 0;
      const workOrderHours: { [key: string]: { hours: number; reference: string; title: string } } = {};

      // Initialize workOrderHours with all work orders
      workOrders.forEach(wo => {
        workOrderHours[wo.id] = {
          hours: 0,
          reference: wo.reference || 'N/A',
          title: wo.title || 'N/A',
        };
      });

      timeEntries?.forEach((entry: any) => {
        const entryDate = new Date(entry.created_at);
        const hours = Number(entry.duration_hours) || 0;

        if (entryDate >= todayStart && entryDate <= todayEnd) {
          todayHours += hours;
        }
        if (entryDate >= weekStart && entryDate <= weekEnd) {
          weekHours += hours;
        }
        if (entryDate >= monthStart && entryDate <= monthEnd) {
          monthHours += hours;
        }

        const woId = entry.work_order_id;
        if (workOrderHours[woId]) {
          workOrderHours[woId].hours += hours;
        }
      });

      // Filter out work orders with 0 hours
      const filteredWorkOrderHours: { [key: string]: { hours: number; reference: string; title: string } } = {};
      Object.entries(workOrderHours).forEach(([id, data]) => {
        if (data.hours > 0) {
          filteredWorkOrderHours[id] = data;
        }
      });

      setHoursStats({
        today: todayHours,
        thisWeek: weekHours,
        thisMonth: monthHours,
        byWorkOrder: filteredWorkOrderHours,
      });
    } catch (error) {
      console.error('Error fetching client hours:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as horas trabalhadas",
        variant: "destructive",
      });
    } finally {
      setLoadingHours(false);
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

  const getOrdersForDate = (date: Date) => {
    return calendarOrders.filter((order) => {
      if (!order.scheduled_date) return false;
      return isSameDay(new Date(order.scheduled_date), date);
    });
  };

  const hasOrdersOnDate = (date: Date) => {
    return getOrdersForDate(date).length > 0;
  };

  const handleViewClientCalendar = (client: Client) => {
    setSelectedCalendarClient(client);
    fetchClientOrders(client.id);
    fetchClientHours(client.id);
  };

  return (
    <DashboardLayout title="Gerir Clientes">
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-3xl font-bold">Clientes</h1>
        </div>
        
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center justify-between sm:justify-start gap-4">
                <CardTitle>Clientes</CardTitle>
                <div className="text-sm text-muted-foreground">
                  Total: {clients.length}
                </div>
              </div>
              <CreateEmployeeDialog onSuccess={fetchClients} />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Pesquisar por nome, email ou empresa..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>

            {filteredClients.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Nenhum cliente encontrado
              </p>
            ) : (
              <div className="space-y-4">
                {filteredClients.map((client) => (
                  <Collapsible
                    key={client.id}
                    open={expandedClients.has(client.id)}
                    onOpenChange={() => toggleClientExpanded(client.id)}
                  >
                    <div className="rounded-lg border overflow-hidden">
                      <div className="flex flex-col gap-3 p-4">
                        <div className="flex-1 space-y-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-base">{client.name}</p>
                            {!client.approved && (
                              <span className="rounded-full bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">
                                Não Aprovado
                              </span>
                            )}
                          </div>
                          <div className="flex flex-col gap-2 text-sm text-muted-foreground">
                            <div className="flex items-center gap-2">
                              <Mail className="h-4 w-4 flex-shrink-0" />
                              <span className="break-all">{client.email}</span>
                            </div>
                            {client.phone && (
                              <div className="flex items-center gap-2">
                                <Phone className="h-4 w-4 flex-shrink-0" />
                                <span>{client.phone}</span>
                              </div>
                            )}
                            {client.company_name && (
                              <div className="flex items-center gap-2">
                                <Building2 className="h-4 w-4 flex-shrink-0" />
                                <span>{client.company_name}</span>
                              </div>
                            )}
                            {client.address && (
                              <div className="flex items-center gap-2">
                                <MapPin className="h-4 w-4 flex-shrink-0" />
                                <span>{client.address}</span>
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-xs text-muted-foreground pt-2 border-t">
                            <span>Registado: {new Date(client.created_at).toLocaleDateString()}</span>
                            {client.equipments && client.equipments.length > 0 && (
                              <div className="flex items-center gap-1">
                                <Package className="h-3 w-3" />
                                <span>{client.equipments.length} equipamento{client.equipments.length !== 1 ? 's' : ''}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2 pt-2 border-t sm:border-0 sm:pt-0">
                          {client.equipments && client.equipments.length > 0 && (
                            <CollapsibleTrigger asChild>
                              <Button size="sm" variant="outline" className="flex-1 sm:flex-none">
                                {expandedClients.has(client.id) ? (
                                  <>
                                    <ChevronUp className="h-4 w-4 mr-1" />
                                    <span className="sm:hidden">Equipamentos</span>
                                  </>
                                ) : (
                                  <>
                                    <ChevronDown className="h-4 w-4 mr-1" />
                                    <span className="sm:hidden">Equipamentos</span>
                                  </>
                                )}
                              </Button>
                            </CollapsibleTrigger>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleViewClientCalendar(client)}
                            className="flex-1 sm:flex-none"
                          >
                            <CalendarIcon className="h-4 w-4 sm:mr-0" />
                            <span className="ml-1 sm:hidden">Calendário</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setCurrentClientId(client.id);
                              setCreateEquipmentDialogOpen(true);
                            }}
                            className="flex-1 sm:flex-none"
                          >
                            <Plus className="h-4 w-4 sm:mr-0" />
                            <span className="ml-1 sm:hidden">Equipamento</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setSelectedClient(client);
                              setEditDialogOpen(true);
                            }}
                            className="flex-1 sm:flex-none"
                          >
                            <Edit className="h-4 w-4 sm:mr-0" />
                            <span className="ml-1 sm:hidden">Editar</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setSelectedClient(client);
                              setDeleteDialogOpen(true);
                            }}
                            className="flex-1 sm:flex-none"
                          >
                            <Trash2 className="h-4 w-4 text-destructive sm:mr-0" />
                            <span className="ml-1 sm:hidden">Eliminar</span>
                          </Button>
                        </div>
                      </div>

                      <CollapsibleContent>
                        <div className="border-t bg-muted/30 p-4">
                          <div className="mb-4">
                            <h4 className="font-semibold flex items-center gap-2">
                              <Package className="h-4 w-4" />
                              Equipamentos
                            </h4>
                          </div>
                          {client.equipments && client.equipments.length > 0 ? (
                            <div className="space-y-3">
                              {client.equipments.map((equipment) => (
                                <div
                                  key={equipment.id}
                                  className="rounded-lg bg-background p-3 shadow-sm"
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1 space-y-2">
                                      <div className="font-semibold">{equipment.name}</div>
                                      <div className="flex flex-col gap-1.5 text-sm text-muted-foreground">
                                        {equipment.model && (
                                          <div className="flex items-start gap-2">
                                            <span className="font-medium min-w-[80px]">Modelo:</span>
                                            <span className="flex-1">{equipment.model}</span>
                                          </div>
                                        )}
                                        {equipment.serial_number && (
                                          <div className="flex items-start gap-2">
                                            <span className="font-medium min-w-[80px]">Nº Série:</span>
                                            <span className="flex-1">{equipment.serial_number}</span>
                                          </div>
                                        )}
                                        {equipment.location && (
                                          <div className="flex items-start gap-2">
                                            <span className="font-medium min-w-[80px]">Localização:</span>
                                            <span className="flex-1">{equipment.location}</span>
                                          </div>
                                        )}
                                        {equipment.notes && (
                                          <div className="flex items-start gap-2">
                                            <span className="font-medium min-w-[80px]">Notas:</span>
                                            <span className="flex-1">{equipment.notes}</span>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex flex-col gap-2">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                          setSelectedEquipment(equipment);
                                          setEditEquipmentDialogOpen(true);
                                        }}
                                      >
                                        <Edit className="h-4 w-4" />
                                      </Button>
                                     </div>
                                   </div>
                                   {currentUserId && (
                                     <div className="mt-4">
                            <EquipmentAttachments 
                              equipmentId={equipment.id}
                              currentUserId={currentUserId}
                              canEdit={isManager}
                            />
                                     </div>
                                   )}
                                 </div>
                               ))}
                             </div>
                          ) : (
                            <p className="text-sm text-muted-foreground text-center py-4">
                              Nenhum equipamento registado
                            </p>
                          )}
                          <div className="mt-4 flex justify-center">
                            <Button
                              size="sm"
                              onClick={() => {
                                setCurrentClientId(client.id);
                                setCreateEquipmentDialogOpen(true);
                              }}
                              className="w-full sm:w-auto"
                            >
                              <Plus className="h-4 w-4 mr-1" />
                              Adicionar Equipamento
                            </Button>
                          </div>
                        </div>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {selectedCalendarClient && (
          <div className="space-y-6">
            {/* Hours Statistics Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Estatísticas de Horas - {selectedCalendarClient.name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingHours ? (
                  <p className="text-center text-muted-foreground py-4">A carregar...</p>
                ) : hoursStats ? (
                  <Tabs defaultValue="summary" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="summary">Resumo</TabsTrigger>
                      <TabsTrigger value="by-order">Por OT</TabsTrigger>
                    </TabsList>
                    <TabsContent value="summary" className="space-y-4 mt-4">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="rounded-lg border p-4 bg-primary/5">
                          <p className="text-sm text-muted-foreground mb-1">Hoje</p>
                          <p className="text-2xl font-bold text-primary">
                            {hoursStats.today.toFixed(1)}h
                          </p>
                        </div>
                        <div className="rounded-lg border p-4 bg-accent/5">
                          <p className="text-sm text-muted-foreground mb-1">Esta Semana</p>
                          <p className="text-2xl font-bold text-accent">
                            {hoursStats.thisWeek.toFixed(1)}h
                          </p>
                        </div>
                        <div className="rounded-lg border p-4 bg-green-500/5">
                          <p className="text-sm text-muted-foreground mb-1">Este Mês</p>
                          <p className="text-2xl font-bold text-green-600">
                            {hoursStats.thisMonth.toFixed(1)}h
                          </p>
                        </div>
                      </div>
                    </TabsContent>
                    <TabsContent value="by-order" className="mt-4">
                      {Object.keys(hoursStats.byWorkOrder).length === 0 ? (
                        <p className="text-center text-muted-foreground py-8">
                          Nenhuma hora registada
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {Object.entries(hoursStats.byWorkOrder)
                            .sort(([, a], [, b]) => b.hours - a.hours)
                            .map(([woId, data]) => (
                              <div
                                key={woId}
                                className="flex items-center justify-between rounded-lg border p-3 cursor-pointer hover:bg-accent/50 transition-colors"
                                onClick={() => navigate(`/work-orders/${woId}`)}
                              >
                                <div className="flex-1">
                                  <p className="font-medium text-sm">{data.reference}</p>
                                  <p className="text-xs text-muted-foreground">{data.title}</p>
                                </div>
                                <div className="text-right">
                                  <p className="text-lg font-bold text-primary">
                                    {data.hours.toFixed(1)}h
                                  </p>
                                </div>
                              </div>
                            ))}
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>
                ) : null}
              </CardContent>
            </Card>

            {/* Calendar and Orders */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Calendário - {selectedCalendarClient.name}</CardTitle>
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
                        backgroundColor: 'hsl(var(--primary) / 0.1)',
                        color: 'hsl(var(--primary))'
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
                            <div className="flex items-center gap-3 mt-1">
                              {order.scheduled_date && (
                                <p className="text-xs font-medium text-primary">
                                  {format(new Date(order.scheduled_date), "HH:mm", { locale: pt })}
                                </p>
                              )}
                              {order.total_hours !== undefined && order.total_hours > 0 && (
                                <p className="text-xs font-medium text-accent flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {Math.round(order.total_hours * 10) / 10}h
                                </p>
                              )}
                            </div>
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
          </div>
        )}
      </div>

      <EditEmployeeDialog
        employee={selectedClient}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSuccess={fetchClients}
      />

      <CreateEquipmentDialog
        open={createEquipmentDialogOpen}
        onOpenChange={setCreateEquipmentDialogOpen}
        onSuccess={() => {
          fetchClients();
          setCreateEquipmentDialogOpen(false);
        }}
        clientId={currentClientId!}
      />

      <EditEquipmentDialog
        equipment={selectedEquipment}
        open={editEquipmentDialogOpen}
        onOpenChange={setEditEquipmentDialogOpen}
        onSuccess={() => {
          fetchClients();
          setEditEquipmentDialogOpen(false);
        }}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Eliminação</AlertDialogTitle>
            <AlertDialogDescription>
              Tem a certeza que deseja eliminar o cliente{" "}
              <strong>{selectedClient?.name}</strong>? Esta ação não pode ser revertida e
              todos os dados associados serão eliminados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedClient(null)}>
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
