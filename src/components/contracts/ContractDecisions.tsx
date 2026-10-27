import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { FileSignature } from "lucide-react";

const TYPE: Record<string, string> = { hvac: "AVAC", heat_pump: "Bomba de Calor", electricity: "Eletricidade" };
const FREQ: Record<string, string> = { monthly: "mensal", quarterly: "trimestral", yearly: "anual" };

/** Manager-only: asks whether a maintenance contract continues after its OT is completed. */
export function ContractDecisions({ workOrderId }: { workOrderId?: string }) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [items, setItems] = useState<any[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    let q = supabase
      .from("work_orders")
      .select("id, reference, title, client:profiles!work_orders_client_id_fkey(name, company_name), maintenance_contracts(contract_type, frequency)")
      .eq("contract_decision_pending", true);
    if (workOrderId) q = q.eq("id", workOrderId);
    const { data } = await q;
    setItems(data || []);
  };
  useEffect(() => { load(); }, [workOrderId]);

  const decide = async (id: string, cont: boolean) => {
    setBusy(id);
    const { error } = await supabase.rpc("decide_contract", { _wo: id, _continue: cont });
    setBusy(null);
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    toast({ title: cont ? "Contrato continua — próxima OT criada" : "Contrato terminado" });
    load();
  };

  if (!items.length) return null;
  return (
    <Card className="border-primary/40">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base"><FileSignature className="h-4 w-4" /> Contratos a decidir</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.map((w) => (
          <div key={w.id} className="flex flex-col gap-2 rounded border p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm min-w-0">
              <button className="font-medium hover:underline text-left" onClick={() => navigate(`/work-orders/${w.id}`)}>{w.reference} — {w.title}</button>
              <p className="text-muted-foreground">
                {w.client?.company_name || w.client?.name} • Contrato {TYPE[w.maintenance_contracts?.contract_type] || ""} {FREQ[w.maintenance_contracts?.frequency] || ""}. OT concluída: continuar o contrato ou terminar?
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button size="sm" disabled={busy === w.id} onClick={() => decide(w.id, true)}>Continuar</Button>
              <Button size="sm" variant="outline" disabled={busy === w.id} onClick={() => decide(w.id, false)}>Terminar</Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
