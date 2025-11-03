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
}

export function CreateWorkOrderDialog({
  open,
  onOpenChange,
  onSuccess,
}: CreateWorkOrderDialogProps) {
  const [clients, setClients] = useState<Client[]>([]);
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    client_id: "",
    equipment_ids: [] as string[],
    service_type: "repair",
    priority: "medium",
    scheduled_date: "",
  });
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchClients();
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

  const fetchClients = async () => {
    try {
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
      .select("id, name, model, serial_number")
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
      service_type: "repair",
      priority: "medium",
      scheduled_date: "",
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
                      {(equipment.model || equipment.serial_number) && (
                        <div className="text-xs text-muted-foreground">
                          {equipment.model && `Modelo: ${equipment.model}`}
                          {equipment.model && equipment.serial_number && " • "}
                          {equipment.serial_number && `S/N: ${equipment.serial_number}`}
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
    </Dialog>
  );
}
