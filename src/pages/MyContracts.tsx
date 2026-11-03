import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { FileSignature } from "lucide-react";
import { CONTRACT_TYPE_LABEL, FREQUENCY_LABEL } from "./Contracts";

const fmt = (d: string) => d.split("-").reverse().join("/");

export default function MyContracts() {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("maintenance_contracts")
      .select("*, maintenance_contract_equipments(equipments(name))")
      .eq("client_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => { setRows(data || []); setLoading(false); });
  }, [user]);

  return (
    <DashboardLayout title="Os meus contratos">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><FileSignature className="h-5 w-5" /> Contratos de manutenção</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading ? <p className="text-sm text-muted-foreground">A carregar...</p> : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Não tem contratos de manutenção.</p>
          ) : rows.map((c) => (
            <div key={c.id} className="rounded-lg border p-3 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{CONTRACT_TYPE_LABEL[c.contract_type]}</Badge>
                <Badge variant="outline">{FREQUENCY_LABEL[c.frequency]}</Badge>
                <Badge variant={c.status === "active" ? "default" : "outline"}>{c.status === "active" ? "Ativo" : "Terminado"}</Badge>
              </div>
              <p className="text-sm text-muted-foreground break-words">
                {c.maintenance_contract_equipments.map((e: any) => e.equipments?.name).filter(Boolean).join(", ") || "Sem equipamentos"}
              </p>
              <p className="text-xs text-muted-foreground">
                Início {fmt(c.start_date)}{c.status === "active" && <> • Próxima intervenção {fmt(c.next_date)}</>}
              </p>
              {c.notes && <p className="text-sm whitespace-pre-wrap">{c.notes}</p>}
            </div>
          ))}
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
