import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DataPagination } from "@/components/ui/data-pagination";
import { EquipmentHistory } from "@/components/equipments/EquipmentHistory";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Loader2, HardDrive, MapPin, Building2 } from "lucide-react";

interface EquipmentRow {
  id: string;
  client_id: string;
  name: string;
  brand: string | null;
  model: string | null;
  serial_number: string | null;
  location: string | null;
  notes: string | null;
  created_at: string;
}

interface ClientRow {
  id: string;
  name: string;
  company_name: string | null;
  address: string | null;
}

const PER_PAGE = 10;

export default function Equipments() {
  const [loading, setLoading] = useState(true);
  const [equipments, setEquipments] = useState<EquipmentRow[]>([]);
  const [clients, setClients] = useState<Record<string, ClientRow>>({});
  const [search, setSearch] = useState("");
  const [clientFilter, setClientFilter] = useState("all");
  const [sortBy, setSortBy] = useState("recent");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [eqRes, clientRolesRes] = await Promise.all([
        supabase
          .from("equipments")
          .select(
            "id, client_id, name, brand, model, serial_number, location, notes, created_at"
          )
          .order("created_at", { ascending: false }),
        supabase.from("user_roles").select("user_id").eq("role", "client"),
      ]);

      const clientIds = (clientRolesRes.data || []).map((r: any) => r.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, name, company_name, address")
        .in("id", clientIds.length ? clientIds : ["00000000-0000-0000-0000-000000000000"]);

      const map: Record<string, ClientRow> = {};
      (profiles || []).forEach((p: any) => (map[p.id] = p));

      setClients(map);
      setEquipments((eqRes.data as any) || []);
      setLoading(false);
    };
    load();
  }, []);

  const clientLabel = (id: string) => {
    const c = clients[id];
    if (!c) return "Cliente desconhecido";
    return c.company_name || c.name;
  };

  const clientOptions = useMemo(() => {
    const ids = Array.from(new Set(equipments.map((e) => e.client_id)));
    return ids
      .map((id) => ({ id, label: clientLabel(id) }))
      .sort((a, b) => a.label.localeCompare(b.label, "pt"));
  }, [equipments, clients]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    let list = equipments.filter((e) => {
      if (clientFilter !== "all" && e.client_id !== clientFilter) return false;
      if (!term) return true;
      const haystack = [
        e.name,
        e.brand,
        e.model,
        e.serial_number,
        e.location,
        clientLabel(e.client_id),
        clients[e.client_id]?.address,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });

    list = [...list].sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name, "pt");
      if (sortBy === "client")
        return clientLabel(a.client_id).localeCompare(clientLabel(b.client_id), "pt");
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    return list;
  }, [equipments, clients, search, clientFilter, sortBy]);

  useEffect(() => {
    setPage(1);
  }, [search, clientFilter, sortBy]);

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const pageItems = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  return (
    <DashboardLayout title="Equipamentos">
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">Equipamentos</h2>
          <p className="text-sm text-muted-foreground">
            Pesquise por cliente ou equipamento e consulte o histórico de intervenções.
          </p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Pesquisar por nome, marca, nº série, morada ou cliente..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Select value={clientFilter} onValueChange={setClientFilter}>
                <SelectTrigger className="md:w-[240px]">
                  <SelectValue placeholder="Cliente" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os clientes</SelectItem>
                  {clientOptions.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="md:w-[180px]">
                  <SelectValue placeholder="Ordenar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recent">Mais recentes</SelectItem>
                  <SelectItem value="name">Nome (A-Z)</SelectItem>
                  <SelectItem value="client">Cliente (A-Z)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center text-muted-foreground">
              <HardDrive className="mx-auto mb-3 h-8 w-8 opacity-50" />
              Nenhum equipamento encontrado.
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="space-y-3">
              {pageItems.map((eq) => (
                <Card key={eq.id}>
                  <CardHeader className="pb-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <CardTitle className="text-base">{eq.name}</CardTitle>
                        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Building2 className="h-3.5 w-3.5" />
                            {clientLabel(eq.client_id)}
                          </span>
                          {eq.location && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3.5 w-3.5" />
                              {eq.location}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {eq.brand && <Badge variant="secondary">{eq.brand}</Badge>}
                        {eq.model && <Badge variant="outline">{eq.model}</Badge>}
                        {eq.serial_number && (
                          <Badge variant="outline">Nº {eq.serial_number}</Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {eq.notes && (
                      <p className="mb-3 text-sm text-muted-foreground">{eq.notes}</p>
                    )}
                    <EquipmentHistory equipmentId={eq.id} />
                  </CardContent>
                </Card>
              ))}
            </div>

            <DataPagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={setPage}
              itemsPerPage={PER_PAGE}
              totalItems={filtered.length}
            />
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
