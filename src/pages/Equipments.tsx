import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Pencil, Trash2, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
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

interface Equipment {
  id: string;
  name: string;
  model: string | null;
  serial_number: string | null;
  location: string | null;
  notes: string | null;
  client_id: string;
  profiles: {
    name: string;
  };
}

export default function Equipments() {
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [filteredEquipments, setFilteredEquipments] = useState<Equipment[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchEquipments();
  }, []);

  useEffect(() => {
    filterEquipments();
  }, [searchTerm, equipments]);

  const fetchEquipments = async () => {
    const { data, error } = await supabase
      .from("equipments")
      .select(`
        *,
        profiles!equipments_client_id_fkey (
          name
        )
      `)
      .order("created_at", { ascending: false });

    if (error) {
      toast({
        title: "Erro",
        description: "Erro ao carregar equipamentos",
        variant: "destructive",
      });
    } else if (data) {
      setEquipments(data as any);
    }
  };

  const filterEquipments = () => {
    if (!searchTerm) {
      setFilteredEquipments(equipments);
      return;
    }

    const filtered = equipments.filter(
      (eq) =>
        eq.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        eq.model?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        eq.serial_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        eq.profiles.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredEquipments(filtered);
  };

  const handleDelete = async () => {
    if (!selectedEquipment) return;

    const { error } = await supabase
      .from("equipments")
      .delete()
      .eq("id", selectedEquipment.id);

    if (error) {
      toast({
        title: "Erro",
        description: "Erro ao eliminar equipamento",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Sucesso",
        description: "Equipamento eliminado com sucesso",
      });
      fetchEquipments();
      setDeleteDialogOpen(false);
      setSelectedEquipment(null);
    }
  };

  return (
    <DashboardLayout title="Gerir Equipamentos">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Equipamentos</CardTitle>
              <Button onClick={() => setCreateDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Novo Equipamento
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Pesquisar por nome, modelo, série ou cliente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Equipments List */}
            {filteredEquipments.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Nenhum equipamento encontrado
              </p>
            ) : (
              <div className="space-y-4">
                {filteredEquipments.map((equipment) => (
                  <div
                    key={equipment.id}
                    className="flex items-center justify-between rounded-lg border p-4"
                  >
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{equipment.name}</p>
                        {equipment.model && (
                          <span className="text-sm text-muted-foreground">
                            ({equipment.model})
                          </span>
                        )}
                      </div>
                      {equipment.serial_number && (
                        <p className="text-sm text-muted-foreground">
                          Série: {equipment.serial_number}
                        </p>
                      )}
                      {equipment.location && (
                        <p className="text-sm text-muted-foreground">
                          Localização: {equipment.location}
                        </p>
                      )}
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <User className="h-3 w-3" />
                        Cliente: {equipment.profiles.name}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setSelectedEquipment(equipment);
                          setEditDialogOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setSelectedEquipment(equipment);
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

      <CreateEquipmentDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={fetchEquipments}
      />

      {selectedEquipment && (
        <EditEquipmentDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          equipment={selectedEquipment}
          onSuccess={fetchEquipments}
        />
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Eliminação</AlertDialogTitle>
            <AlertDialogDescription>
              Tem a certeza que deseja eliminar o equipamento{" "}
              <strong>{selectedEquipment?.name}</strong>? Esta ação não pode ser revertida.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedEquipment(null)}>
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
