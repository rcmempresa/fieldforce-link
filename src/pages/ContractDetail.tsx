import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Eye, FileSignature, Pencil, Plus, Trash2, Unlink } from "lucide-react";
import { DaysOpenBadge } from "@/components/work-orders/DaysOpenBadge";
import { EditWorkOrderDialog } from "@/components/work-orders/EditWorkOrderDialog";
import { CONTRACT_TYPE_LABEL, FREQUENCY_LABEL } from "./Contracts";

const fmt = (d: string) => d.split("-").reverse().join("/");
const STATUS: Record<string, string> = {
  pending: "Pendente", approved: "Aprovada", in_progress: "Em execução", completed: "Concluída",
  cancelled: "Cancelada", awaiting_approval: "A aguardar aprovação", invoiced: "Faturada",
  awaiting_purchase_order: "Aguarda nota de encomenda",
};

export default function ContractDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { roles } = useAuth();
  const isManager = roles.includes("manager");
  const [contract, setContract] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any>(null);
  const [unlink, setUnlink] = useState<any>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const [{ data: c }, { data: wos }] = await Promise.all([
      supabase.from("maintenance_contracts")
        .select("*, profiles!maintenance_contracts_client_id_fkey(name, company_name), maintenance_contract_equipments(equipments(name))")
        .eq("id", id).maybeSingle(),
      supabase.from("work_orders")
        .select("id, reference, title, status, priority, scheduled_date, created_at, work_order_assignments(profiles!work_order_assignments_user_id_fkey(name))")
        .eq("contract_id", id).order("created_at", { ascending: false }),
    ]);
    setContract(c); setOrders(wos || []); setLoading(false);
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const doUnlink = async () => {
    const { error } = await supabase.from("work_orders").update({ contract_id: null, contract_decision_pending: false }).eq("id", unlink.id);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else toast({ title: "OT removida do contrato", description: "A OT continua a existir." });
    setUnlink(null); load();
  };
  const createNow = async () => {
    setCreating(true);
    const { error } = await supabase.rpc("create_contract_work_order", { _contract: id, _scheduled: null, _technician: null } as any);
    setCreating(false);
    if (error) toast({ title: "Erro ao criar OT", description: error.message, variant: "destructive" });
    else toast({ title: "OT criada", description: "Fica pendente até lhe dar data e técnico." });
    load();
  };

  const back = isManager ? "/contracts" : "/my-contracts";

  return (
    <DashboardLayout title="Contrato">
      <Button variant="ghost" size="sm" className="mb-2" onClick={() => navigate(back)}><ArrowLeft className="h-4 w-4 mr-1" /> Contratos</Button>
      {loading ? <p className="text-sm text-muted-foreground">A carregar...</p> : !contract ? <p className="text-sm text-muted-foreground">Contrato não encontrado.</p> : (
        <div className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
              <CardTitle className="flex items-center gap-2"><FileSignature className="h-5 w-5" /> {contract.profiles?.company_name || contract.profiles?.name}</CardTitle>
              {isManager && (
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => navigate(`/contracts?edit=${contract.id}`)}><Pencil className="h-4 w-4 mr-1" /> Editar</Button>
                  <Button size="sm" variant="outline" className="text-destructive" onClick={() => navigate(`/contracts?delete=${contract.id}`)}><Trash2 className="h-4 w-4 mr-1" /> Eliminar</Button>
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{CONTRACT_TYPE_LABEL[contract.contract_type]}</Badge>
                <Badge variant="outline">{FREQUENCY_LABEL[contract.frequency]}</Badge>
                <Badge variant={contract.status === "active" ? "default" : "outline"}>{contract.status === "active" ? "Ativo" : "Terminado"}</Badge>
              </div>
              <p className="text-sm text-muted-foreground break-words">
                {contract.maintenance_contract_equipments.map((e: any) => e.equipments?.name).filter(Boolean).join(", ") || "Sem equipamentos"}
              </p>
              <p className="text-xs text-muted-foreground">Início {fmt(contract.start_date)}{contract.status === "active" && <> • Próxima intervenção {fmt(contract.next_date)}</>}</p>
              {contract.notes && <p className="text-sm whitespace-pre-wrap">{contract.notes}</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
              <CardTitle className="text-base">OTs do contrato ({orders.length})</CardTitle>
              {isManager && contract.status === "active" && (
                <Button size="sm" onClick={createNow} disabled={creating}><Plus className="h-4 w-4 mr-1" /> Criar OT agora</Button>
              )}
            </CardHeader>
            <CardContent className="space-y-2">
              {orders.length === 0 ? <p className="text-sm text-muted-foreground">Ainda não há OTs ligadas a este contrato.</p> : orders.map((o) => (
                <div key={o.id} className="rounded-lg border p-3 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{o.reference}</span>
                    <Badge variant="outline">{STATUS[o.status] || o.status}</Badge>
                    <DaysOpenBadge createdAt={o.created_at} status={o.status} />
                    <div className="ml-auto flex gap-1">
                      <Button size="sm" variant="outline" onClick={() => navigate(`/work-orders/${o.id}`)}><Eye className="h-4 w-4 sm:mr-1" /><span className="hidden sm:inline">Ver</span></Button>
                      {isManager && <>
                        <Button size="sm" variant="outline" onClick={() => setEditing(o)}><Pencil className="h-4 w-4 sm:mr-1" /><span className="hidden sm:inline">Editar</span></Button>
                        <Button size="sm" variant="outline" className="text-destructive" onClick={() => setUnlink(o)}><Unlink className="h-4 w-4 sm:mr-1" /><span className="hidden sm:inline">Remover</span></Button>
                      </>}
                    </div>
                  </div>
                  <p className="text-sm break-words">{o.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {o.scheduled_date ? new Date(o.scheduled_date).toLocaleString("pt-PT", { dateStyle: "short", timeStyle: "short" }) : "Sem data"}
                    {" • "}{(o.work_order_assignments || []).map((a: any) => a.profiles?.name).filter(Boolean).join(", ") || "Sem técnico"}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {editing && <EditWorkOrderDialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)} workOrder={editing} onSuccess={() => { setEditing(null); load(); }} />}
      <AlertDialog open={!!unlink} onOpenChange={(o) => !o && setUnlink(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover a OT do contrato?</AlertDialogTitle>
            <AlertDialogDescription>A {unlink?.reference} continua a existir, só deixa de estar ligada a este contrato.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={doUnlink}>Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
