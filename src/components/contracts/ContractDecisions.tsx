import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { FileSignature } from "lucide-react";
import { ContractScheduleFields, scheduleToIso } from "./ContractScheduleFields";

const TYPE: Record<string, string> = { hvac: "AVAC", heat_pump: "Bomba de Calor", electricity: "Eletricidade" };
const FREQ: Record<string, string> = { monthly: "mensal", quarterly: "trimestral", yearly: "anual" };
const MONTHS: Record<string, number> = { monthly: 1, quarterly: 3, yearly: 12 };

/** Data sugerida (YYYY-MM-DDTHH:00) = data da OT concluída + frequência, mesma hora. */
function suggest(w: any): string {
  const base = w.scheduled_date ? new Date(w.scheduled_date) : new Date();
  const d = new Date(base);
  d.setMonth(d.getMonth() + (MONTHS[w.maintenance_contracts?.frequency] || 1));
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:00`;
}

/** Manager-only: after a contract OT is completed, asks whether to create (and schedule) the next maintenance OT. */
export function ContractDecisions({ workOrderId }: { workOrderId?: string }) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [items, setItems] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [current, setCurrent] = useState<any | null>(null);
  const [schedule, setSchedule] = useState("");
  const [technician, setTechnician] = useState("");
  const autoOpened = useRef(false);

  const load = async () => {
    let q = supabase
      .from("work_orders")
      .select("id, reference, title, scheduled_date, client:profiles!work_orders_client_id_fkey(name, company_name), maintenance_contracts(contract_type, frequency), work_order_assignments(user_id)")
      .eq("contract_decision_pending", true);
    if (workOrderId) q = q.eq("id", workOrderId);
    const { data } = await q;
    setItems(data || []);
    if (workOrderId && data?.length && !autoOpened.current) {
      autoOpened.current = true;
      openFor(data[0]);
    }
  };
  useEffect(() => { load(); }, [workOrderId]);

  const openFor = (w: any) => {
    setCurrent(w);
    setSchedule(suggest(w));
    setTechnician((w.work_order_assignments as any[])?.[0]?.user_id || "");
  };

  const decide = async (cont: boolean) => {
    if (!current) return;
    if (cont && !schedule) return toast({ title: "Escolha o dia e a hora da próxima OT", variant: "destructive" });
    setBusy(true);
    const { error } = await supabase.rpc("decide_contract", {
      _wo: current.id, _continue: cont,
      _scheduled: cont ? scheduleToIso(schedule) : null,
      _technician: cont && technician ? technician : null,
    } as any);
    setBusy(false);
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    toast({ title: cont ? "Próxima OT de manutenção criada e agendada" : "Contrato terminado" });
    setCurrent(null);
    load();
  };

  return (
    <>
      {items.length > 0 && (
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
                    {w.client?.company_name || w.client?.name} • Contrato {TYPE[w.maintenance_contracts?.contract_type] || ""} {FREQ[w.maintenance_contracts?.frequency] || ""}. OT concluída: criar a próxima OT de manutenção?
                  </p>
                </div>
                <Button size="sm" className="shrink-0" onClick={() => openFor(w)}>Decidir</Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Dialog open={!!current} onOpenChange={(o) => !o && setCurrent(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Criar a próxima OT de manutenção?</DialogTitle>
            <DialogDescription>
              {current?.reference} — {current?.client?.company_name || current?.client?.name}. Contrato {FREQ[current?.maintenance_contracts?.frequency] || ""}: a data sugerida já está escolhida, podes alterá-la.
            </DialogDescription>
          </DialogHeader>
          {current && (
            <ContractScheduleFields
              label="Data e hora da próxima OT"
              value={schedule}
              onChange={setSchedule}
              technician={technician}
              onTechnicianChange={setTechnician}
            />
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setCurrent(null)} disabled={busy}>Decidir depois</Button>
            <Button variant="outline" onClick={() => decide(false)} disabled={busy}>Terminar contrato</Button>
            <Button onClick={() => decide(true)} disabled={busy}>Criar próxima OT</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
