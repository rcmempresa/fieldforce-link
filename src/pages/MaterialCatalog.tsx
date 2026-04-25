import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Package, Plus, Trash2, Edit2, Check, X, ArrowLeft } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { DataPagination } from "@/components/ui/data-pagination";

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

interface CatalogItem {
  id: string;
  name: string;
  default_unit: string;
  reference: string | null;
  active: boolean;
  created_at: string;
}

export default function MaterialCatalog() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [defaultUnit, setDefaultUnit] = useState("un");
  const [reference, setReference] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editUnit, setEditUnit] = useState("");
  const [editReference, setEditReference] = useState("");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"recent" | "alpha" | "reference">("alpha");
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    const { data, error } = await supabase
      .from("material_catalog")
      .select("*")
      .order("name");

    if (error) {
      console.error("Error fetching catalog:", error);
    } else {
      setItems(data || []);
    }
    setLoading(false);
  };

  const handleAdd = async () => {
    if (!name.trim()) {
      toast({ title: "Erro", description: "Indique o nome do material", variant: "destructive" });
      return;
    }
    setAdding(true);
    const { error } = await supabase.from("material_catalog").insert({
      name: name.trim(),
      default_unit: defaultUnit,
      reference: reference.trim() || null,
      created_by: user!.id,
    });

    if (error) {
      toast({ title: "Erro", description: "Erro ao adicionar material", variant: "destructive" });
    } else {
      toast({ title: "Sucesso", description: "Material adicionado ao catálogo" });
      setName("");
      setDefaultUnit("un");
      setReference("");
      setShowForm(false);
      fetchItems();
    }
    setAdding(false);
  };

  const handleToggleActive = async (item: CatalogItem) => {
    const { error } = await supabase
      .from("material_catalog")
      .update({ active: !item.active })
      .eq("id", item.id);

    if (error) {
      toast({ title: "Erro", description: "Erro ao atualizar material", variant: "destructive" });
    } else {
      fetchItems();
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("material_catalog").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro", description: "Erro ao eliminar material", variant: "destructive" });
    } else {
      toast({ title: "Sucesso", description: "Material eliminado" });
      fetchItems();
    }
  };

  const startEdit = (item: CatalogItem) => {
    setEditingId(item.id);
    setEditName(item.name);
    setEditUnit(item.default_unit);
    setEditReference(item.reference || "");
  };

  const saveEdit = async () => {
    if (!editName.trim()) return;
    const { error } = await supabase
      .from("material_catalog")
      .update({ name: editName.trim(), default_unit: editUnit, reference: editReference.trim() || null })
      .eq("id", editingId!);

    if (error) {
      toast({ title: "Erro", description: "Erro ao atualizar", variant: "destructive" });
    } else {
      setEditingId(null);
      fetchItems();
    }
  };

  const getUnitLabel = (v: string) => units.find((u) => u.value === v)?.label || v;

  const filteredItems = items
    .filter((i) => {
      const q = search.toLowerCase().trim();
      if (!q) return true;
      return (
        i.name.toLowerCase().includes(q) ||
        (i.reference || "").toLowerCase().includes(q) ||
        getUnitLabel(i.default_unit).toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      if (sortBy === "recent") {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      if (sortBy === "reference") {
        const ra = a.reference || "";
        const rb = b.reference || "";
        return ra.localeCompare(rb, undefined, { numeric: true });
      }
      return a.name.localeCompare(b.name);
    });

  const totalPages = Math.ceil(filteredItems.length / ITEMS_PER_PAGE);
  const paginatedItems = filteredItems.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Reset to page 1 when filters/sort change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, sortBy]);

  return (
    <DashboardLayout title="Catálogo de Materiais">
      <div className="space-y-6">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-1">
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Materiais Disponíveis
              </CardTitle>
              <Button size="sm" onClick={() => setShowForm(!showForm)}>
                <Plus className="h-4 w-4 mr-1" />
                Novo Material
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {showForm && (
              <div className="rounded-lg border p-4 space-y-3 bg-muted/30">
                <div className="space-y-2">
                  <Label>Nome do Material *</Label>
                  <Input
                    placeholder="Ex: Filtro de ar, Parafusos M8..."
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Unidade Padrão</Label>
                  <Select value={defaultUnit} onValueChange={setDefaultUnit}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover z-50">
                      {units.map((u) => (
                        <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Referência (número)</Label>
                  <Input
                    type="number"
                    placeholder="Ex: 12345"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>Cancelar</Button>
                  <Button size="sm" onClick={handleAdd} disabled={adding}>
                    {adding ? "A adicionar..." : "Adicionar"}
                  </Button>
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                placeholder="Pesquisar por nome, referência ou unidade..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1"
              />
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
                <SelectTrigger className="sm:w-56">
                  <SelectValue placeholder="Ordenar por..." />
                </SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  <SelectItem value="alpha">Ordem alfabética</SelectItem>
                  <SelectItem value="recent">Mais recentes</SelectItem>
                  <SelectItem value="reference">Por referência</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {loading ? (
              <div className="flex justify-center py-4">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : filteredItems.length === 0 ? (
              <p className="text-center text-muted-foreground py-4 text-sm">
                Nenhum material no catálogo.
              </p>
            ) : (
              <>
              <div className="space-y-2">
                {paginatedItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    {editingId === item.id ? (
                      <div className="flex-1 flex flex-wrap items-center gap-2">
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="h-8 flex-1 min-w-[120px]"
                          placeholder="Nome"
                        />
                        <Input
                          type="number"
                          value={editReference}
                          onChange={(e) => setEditReference(e.target.value)}
                          className="h-8 w-24"
                          placeholder="Ref."
                        />
                        <Select value={editUnit} onValueChange={setEditUnit}>
                          <SelectTrigger className="w-32 h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-popover z-50">
                            {units.map((u) => (
                              <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button size="sm" variant="ghost" onClick={saveEdit}>
                          <Check className="h-4 w-4 text-green-600" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm">{item.name}</p>
                            {!item.active && (
                              <Badge variant="secondary" className="text-xs">Inativo</Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {item.reference && <span>Ref: {item.reference} · </span>}
                            Unidade padrão: {getUnitLabel(item.default_unit)}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button size="sm" variant="ghost" onClick={() => startEdit(item)}>
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => handleToggleActive(item)}>
                            {item.active ? (
                              <span className="text-xs text-muted-foreground">Desativar</span>
                            ) : (
                              <span className="text-xs text-green-600">Ativar</span>
                            )}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => handleDelete(item.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
              <DataPagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                itemsPerPage={ITEMS_PER_PAGE}
                totalItems={filteredItems.length}
              />
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
