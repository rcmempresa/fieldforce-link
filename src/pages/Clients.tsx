import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Mail, Phone, Trash2, Edit, Building2, MapPin, Package, ChevronDown, ChevronUp, Plus } from "lucide-react";
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
  const { toast } = useToast();

  useEffect(() => {
    fetchClients();
  }, []);

  useEffect(() => {
    filterClients();
  }, [searchTerm, clients]);

  const fetchClients = async () => {
    try {
      // Ensure we have a valid session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        console.error('Session error:', sessionError);
        // Try to refresh the session
        const { data: { session: newSession }, error: refreshError } = await supabase.auth.refreshSession();
        
        if (refreshError || !newSession) {
          toast({
            title: "Erro de Autenticação",
            description: "Por favor, faça login novamente",
            variant: "destructive",
          });
          return;
        }
      }

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

  return (
    <DashboardLayout title="Gerir Clientes">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Clientes</CardTitle>
              <div className="flex items-center gap-4">
                <div className="text-sm text-muted-foreground">
                  Total: {clients.length}
                </div>
                <CreateEmployeeDialog onSuccess={fetchClients} />
              </div>
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
                    <div className="rounded-lg border">
                      <div className="flex items-center justify-between p-4">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{client.name}</p>
                            {!client.approved && (
                              <span className="rounded-full bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">
                                Não Aprovado
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {client.email}
                            </div>
                            {client.phone && (
                              <div className="flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                {client.phone}
                              </div>
                            )}
                            {client.company_name && (
                              <div className="flex items-center gap-1">
                                <Building2 className="h-3 w-3" />
                                {client.company_name}
                              </div>
                            )}
                            {client.address && (
                              <div className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {client.address}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-4">
                            <p className="text-xs text-muted-foreground">
                              Registado: {new Date(client.created_at).toLocaleDateString()}
                            </p>
                            {client.equipments && client.equipments.length > 0 && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Package className="h-3 w-3" />
                                {client.equipments.length} equipamento{client.equipments.length !== 1 ? 's' : ''}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {client.equipments && client.equipments.length > 0 && (
                            <CollapsibleTrigger asChild>
                              <Button size="sm" variant="ghost">
                                {expandedClients.has(client.id) ? (
                                  <ChevronUp className="h-4 w-4" />
                                ) : (
                                  <ChevronDown className="h-4 w-4" />
                                )}
                              </Button>
                            </CollapsibleTrigger>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setCurrentClientId(client.id);
                              setCreateEquipmentDialogOpen(true);
                            }}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setSelectedClient(client);
                              setEditDialogOpen(true);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setSelectedClient(client);
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>

                      <CollapsibleContent>
                        <div className="border-t bg-muted/30 p-4">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="font-medium flex items-center gap-2">
                              <Package className="h-4 w-4" />
                              Equipamentos
                            </h4>
                            <Button
                              size="sm"
                              onClick={() => {
                                setCurrentClientId(client.id);
                                setCreateEquipmentDialogOpen(true);
                              }}
                            >
                              <Plus className="h-4 w-4 mr-1" />
                              Adicionar
                            </Button>
                          </div>
                          {client.equipments && client.equipments.length > 0 ? (
                            <div className="space-y-2">
                              {client.equipments.map((equipment) => (
                                <div
                                  key={equipment.id}
                                  className="flex items-start justify-between rounded bg-background p-3 text-sm"
                                >
                                  <div className="flex-1 space-y-1">
                                    <div className="font-medium">{equipment.name}</div>
                                    <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                                      {equipment.model && (
                                        <div>Modelo: {equipment.model}</div>
                                      )}
                                      {equipment.serial_number && (
                                        <div>Nº Série: {equipment.serial_number}</div>
                                      )}
                                      {equipment.location && (
                                        <div>Localização: {equipment.location}</div>
                                      )}
                                    </div>
                                    {equipment.notes && (
                                      <div className="text-xs text-muted-foreground mt-1">
                                        Notas: {equipment.notes}
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex gap-1 ml-2">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => {
                                        setSelectedEquipment(equipment);
                                        setEditEquipmentDialogOpen(true);
                                      }}
                                    >
                                      <Edit className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={async () => {
                                        try {
                                          const { error } = await supabase
                                            .from('equipments')
                                            .delete()
                                            .eq('id', equipment.id);

                                          if (error) throw error;

                                          toast({
                                            title: "Sucesso",
                                            description: "Equipamento eliminado com sucesso",
                                          });
                                          fetchClients();
                                        } catch (error) {
                                          console.error('Error deleting equipment:', error);
                                          toast({
                                            title: "Erro",
                                            description: "Erro ao eliminar equipamento",
                                            variant: "destructive",
                                          });
                                        }
                                      }}
                                    >
                                      <Trash2 className="h-3 w-3 text-destructive" />
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground text-center py-4">
                              Nenhum equipamento registado
                            </p>
                          )}
                        </div>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
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
        clientId={currentClientId}
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
