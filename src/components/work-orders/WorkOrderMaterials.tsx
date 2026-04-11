import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Package, Plus, Trash2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Material {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  created_by: string;
  created_at: string;
  profiles?: { name: string };
}

interface CatalogItem {
  id: string;
  name: string;
  default_unit: string;
}

interface WorkOrderMaterialsProps {
  workOrderId: string;
  canEdit: boolean;
  currentUserId?: string;
  isManager?: boolean;
}

const units = [
  { value: "un", label: "Unidade(s)" },
  { value: "m", label: "Metro(s)" },
  { value: "m2", label: "m²" },
  { value: "kg", label: "Kg" },
  { value: "l", label: "Litro(s)" },
  { value: "cx", label: "Caixa(s)" },
  { value: "rolo", label: "Rolo(s)" },
  { value: "pc", label: "Peça(s)" },
];

export function WorkOrderMaterials({ workOrderId, canEdit, currentUserId, isManager }: WorkOrderMaterialsProps) {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [selectedCatalogId, setSelectedCatalogId] = useState("");
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unit, setUnit] = useState("un");
  const { toast } = useToast();

  useEffect(() => {
    fetchMaterials();
    fetchCatalog();
  }, [workOrderId]);

  const fetchMaterials = async () => {
    const { data, error } = await supabase
      .from("work_order_materials")
      .select(`
        *,
        profiles!work_order_materials_created_by_fkey (name)
      `)
      .eq("work_order_id", workOrderId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching materials:", error);
    } else {
      setMaterials((data as any) || []);
    }
    setLoading(false);
  };

  const fetchCatalog = async () => {
    const { data, error } = await supabase
      .from("material_catalog")
      .select("id, name, default_unit")
      .eq("active", true)
      .order("name");

    if (error) {
      console.error("Error fetching catalog:", error);
    } else {
      setCatalog(data || []);
    }
  };

  const handleCatalogSelect = (catalogId: string) => {
    setSelectedCatalogId(catalogId);
    const item = catalog.find((c) => c.id === catalogId);
    if (item) {
      setDescription(item.name);
      setUnit(item.default_unit);
    }
  };

  const handleAdd = async () => {
    if (!description.trim()) {
      toast({ title: "Erro", description: "Selecione ou descreva o material", variant: "destructive" });
      return;
    }

    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) {
      toast({ title: "Erro", description: "Quantidade inválida", variant: "destructive" });
      return;
    }

    setAdding(true);
    const { error } = await supabase.from("work_order_materials").insert({
      work_order_id: workOrderId,
      description: description.trim(),
      quantity: qty,
      unit,
      created_by: currentUserId!,
    });

    if (error) {
      console.error("Error adding material:", error);
      toast({ title: "Erro", description: "Erro ao adicionar material", variant: "destructive" });
    } else {
      toast({ title: "Sucesso", description: "Material adicionado" });
      setDescription("");
      setQuantity("1");
      setUnit("un");
      setSelectedCatalogId("");
      setShowForm(false);
      fetchMaterials();
    }
    setAdding(false);
  };

  const handleDelete = async (materialId: string) => {
    const { error } = await supabase.from("work_order_materials").delete().eq("id", materialId);

    if (error) {
      toast({ title: "Erro", description: "Erro ao remover material", variant: "destructive" });
    } else {
      toast({ title: "Sucesso", description: "Material removido" });
      fetchMaterials();
    }
  };

  const getUnitLabel = (unitValue: string) => {
    return units.find((u) => u.value === unitValue)?.label || unitValue;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Materiais Utilizados
          </CardTitle>
          {canEdit && (
            <Button size="sm" variant="outline" onClick={() => setShowForm(!showForm)}>
              <Plus className="h-4 w-4 mr-1" />
              Adicionar
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {showForm && canEdit && (
          <div className="rounded-lg border p-4 space-y-3 bg-muted/30">
            {catalog.length > 0 && (
              <div className="space-y-2">
                <Label>Selecionar do Catálogo</Label>
                <Select value={selectedCatalogId} onValueChange={handleCatalogSelect}>
                  <SelectTrigger>
                    <SelectValue placeholder="Escolher material..." />
                  </SelectTrigger>
                  <SelectContent className="bg-popover z-50">
                    {catalog.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Manager can also type free text, employees only select from catalog */}
            {isManager && (
              <div className="space-y-2">
                <Label>Ou descrever manualmente</Label>
                <Input
                  placeholder="Ex: Filtro de ar, Parafusos M8..."
                  value={description}
                  onChange={(e) => {
                    setDescription(e.target.value);
                    setSelectedCatalogId("");
                  }}
                />
              </div>
            )}

            {/* Show selected material name for employees */}
            {!isManager && description && (
              <div className="space-y-2">
                <Label>Material selecionado</Label>
                <Input value={description} readOnly className="bg-muted" />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Quantidade</Label>
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Unidade</Label>
                <Select value={unit} onValueChange={setUnit}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover z-50">
                    {units.map((u) => (
                      <SelectItem key={u.value} value={u.value}>
                        {u.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>
                Cancelar
              </Button>
              <Button size="sm" onClick={handleAdd} disabled={adding}>
                {adding ? "A adicionar..." : "Adicionar"}
              </Button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-4">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : materials.length === 0 ? (
          <p className="text-center text-muted-foreground py-4 text-sm">
            Nenhum material registado nesta ordem de trabalho.
          </p>
        ) : (
          <div className="space-y-2">
            {materials.map((material) => (
              <div
                key={material.id}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div className="flex-1">
                  <p className="font-medium text-sm">{material.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {material.quantity} {getUnitLabel(material.unit)} • Adicionado por{" "}
                    {material.profiles?.name || "N/A"} •{" "}
                    {new Date(material.created_at).toLocaleDateString()}
                  </p>
                </div>
                {canEdit && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDelete(material.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
