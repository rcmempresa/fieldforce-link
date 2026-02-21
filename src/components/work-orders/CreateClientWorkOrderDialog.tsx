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

interface CreateClientWorkOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  clientId: string;
}

interface Equipment {
  id: string;
  name: string;
  model: string | null;
  serial_number: string | null;
  location: string | null;
}

export function CreateClientWorkOrderDialog({
  open,
  onOpenChange,
  onSuccess,
  clientId,
}: CreateClientWorkOrderDialogProps) {
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    equipment_ids: [] as string[],
    service_type: "repair",
    priority: "medium",
    address: "",
  });
  const { toast } = useToast();

  useEffect(() => {
    if (open && clientId) {
      fetchEquipments();
    }
  }, [open, clientId]);

  const fetchEquipments = async () => {
    const { data } = await supabase
      .from("equipments")
      .select("id, name, model, serial_number, location")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });

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
    if (!user) {
      setLoading(false);
      return;
    }

    // Create work order
    const { data: workOrder, error: workOrderError } = await supabase
      .from("work_orders")
      .insert({
        title: formData.title,
        description: formData.description,
        client_id: user.id, // Use authenticated user ID to satisfy RLS policy
        service_type: formData.service_type as "repair" | "maintenance" | "installation" | "warranty",
        priority: formData.priority as "low" | "medium" | "high",
        address: formData.address || null,
        created_by: user.id,
        status: "awaiting_approval" as const,
      })
      .select()
      .single();

    if (workOrderError) {
      setLoading(false);
      toast({
        title: "Erro",
        description: "Erro ao criar solicitação",
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

    // Get client name for notifications
    const { data: clientProfile } = await supabase
      .from("profiles")
      .select("name")
      .eq("id", user.id)
      .single();

    // Send notification emails to managers via edge function (bypasses RLS)
    supabase.functions.invoke("send-notification-email", {
      body: {
        type: "work_order_created_notify_managers",
        userId: user.id,
        data: {
          workOrderId: workOrder.id,
          workOrderReference: workOrder.reference || "",
          workOrderTitle: formData.title,
          clientName: clientProfile?.name || "Cliente",
        },
      },
    });

    // Send confirmation email to client
    supabase.functions.invoke("send-notification-email", {
      body: {
        type: "work_order_request_received",
        userId: user.id,
        data: {
          recipientName: clientProfile?.name || "Cliente",
          workOrderReference: workOrder.reference || "",
          workOrderTitle: formData.title,
        },
      },
    });

    setLoading(false);

    toast({
      title: "Sucesso",
      description: "Solicitação enviada! Aguarde a aprovação do gerente.",
    });
    
    setFormData({
      title: "",
      description: "",
      equipment_ids: [],
      service_type: "repair",
      priority: "medium",
      address: "",
    });
    onOpenChange(false);
    onSuccess();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Solicitação de Serviço</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Título *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Ex: Ar condicionado não está a arrefecer"
              required
              maxLength={100}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição do Problema *</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Descreva o problema em detalhe..."
              rows={4}
              required
              maxLength={1000}
            />
          </div>

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
            <Label htmlFor="priority">Urgência</Label>
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
            <Label htmlFor="address">Morada do Local</Label>
            <Input
              id="address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="Ex: Rua do Exemplo, 123, Lisboa"
            />
          </div>

          {equipments.length > 0 && (
            <div className="space-y-2">
              <Label>Equipamentos Relacionados</Label>
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

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "A criar..." : "Enviar Solicitação"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
