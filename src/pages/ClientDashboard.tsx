import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ClipboardList, Wrench, CheckCircle, Plus, Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CreateEquipmentDialog } from "@/components/equipments/CreateEquipmentDialog";
import { EditEquipmentDialog } from "@/components/equipments/EditEquipmentDialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";

interface WorkOrder {
  id: string;
  reference: string;
  title: string;
  status: string;
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
  const [stats, setStats] = useState<Stats>({ activeRequests: 0, myEquipments: 0, completedServices: 0 });
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [showEquipments, setShowEquipments] = useState(false);
  const [createEquipmentDialogOpen, setCreateEquipmentDialogOpen] = useState(false);
  const [editEquipmentDialogOpen, setEditEquipmentDialogOpen] = useState(false);
  const [deleteEquipmentDialogOpen, setDeleteEquipmentDialogOpen] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string>("");
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
    fetchStats();
    fetchEquipments();
  }, []);

  const fetchWorkOrders = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return;

    const { data } = await supabase
      .from("work_orders")
      .select("id, reference, title, status")
      .eq("client_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5);

    if (data) {
      setWorkOrders(data);
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

  return (
    <DashboardLayout title="Dashboard do Cliente">
      <div className="space-y-6">
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

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Ações Rápidas</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button>
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
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Meus Equipamentos</CardTitle>
              <Button onClick={() => setCreateEquipmentDialogOpen(true)}>
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
                        <div className="flex gap-2 pt-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1"
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
                            className="flex-1"
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
            <CardTitle>Minhas Solicitações</CardTitle>
          </CardHeader>
          <CardContent>
            {workOrders.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Nenhuma solicitação encontrada
              </p>
            ) : (
              <div className="space-y-4">
                {workOrders.map((order) => (
                  <div key={order.id} className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-1">
                      <p className="font-medium">{order.reference}</p>
                      <p className="text-sm text-muted-foreground">{order.title}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`rounded-full px-3 py-1 text-xs font-medium ${getStatusColor(order.status)}`}>
                        {getStatusLabel(order.status)}
                      </span>
                      <Button 
                        size="sm" 
                        variant={order.status === "completed" ? "outline" : "default"}
                        onClick={() => navigate(`/work-orders/${order.id}`)}
                      >
                        {order.status === "completed" ? "Ver Fatura" : "Ver"}
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
