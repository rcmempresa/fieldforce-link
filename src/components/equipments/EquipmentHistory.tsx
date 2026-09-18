import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  History,
  ChevronDown,
  ChevronUp,
  FileText,
  Download,
  Loader2,
  ExternalLink,
} from "lucide-react";

interface WorkOrderRow {
  id: string;
  reference: string | null;
  title: string;
  status: string;
  scheduled_date: string | null;
  created_at: string;
}

interface ReportRow {
  id: string;
  work_order_id: string;
  report_type: string;
  report_date: string | null;
  technician_name: string | null;
  status: string | null;
  pdf_url: string | null;
  created_at: string;
}

interface AttachmentRow {
  id: string;
  work_order_id: string;
  filename: string;
  url: string;
  uploaded_at: string;
}

const statusLabels: Record<string, string> = {
  pending: "Pendente",
  approved: "Aprovada",
  in_progress: "Em Curso",
  completed: "Concluída",
  cancelled: "Cancelada",
  awaiting_approval: "Aguarda Aprovação",
  invoiced: "Faturada",
};

const reportTypeLabels: Record<string, string> = {
  electricity: "Eletricidade",
  hvac: "Climatização",
  generator: "Grupo Gerador",
  cctv: "CCTV",
};

interface Props {
  equipmentId: string;
}

export function EquipmentHistory({ equipmentId }: Props) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState<WorkOrderRow[]>([]);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [attachments, setAttachments] = useState<AttachmentRow[]>([]);
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);

    const { data: links } = await supabase
      .from("work_order_equipments")
      .select("work_order_id")
      .eq("equipment_id", equipmentId);

    const ids = (links || []).map((l: any) => l.work_order_id);

    if (ids.length === 0) {
      setOrders([]);
      setReports([]);
      setAttachments([]);
      setLoaded(true);
      setLoading(false);
      return;
    }

    const [ordersRes, reportsRes, attachmentsRes] = await Promise.all([
      supabase
        .from("work_orders")
        .select("id, reference, title, status, scheduled_date, created_at")
        .in("id", ids)
        .order("created_at", { ascending: false }),
      supabase
        .from("maintenance_reports")
        .select(
          "id, work_order_id, report_type, report_date, technician_name, status, pdf_url, created_at"
        )
        .in("work_order_id", ids)
        .order("created_at", { ascending: false }),
      supabase
        .from("attachments")
        .select("id, work_order_id, filename, url, uploaded_at")
        .in("work_order_id", ids)
        .order("uploaded_at", { ascending: false }),
    ]);

    setOrders((ordersRes.data as any) || []);
    setReports((reportsRes.data as any) || []);
    setAttachments(
      ((attachmentsRes.data as any) || []).filter((a: AttachmentRow) =>
        a.filename.toLowerCase().endsWith(".pdf")
      )
    );
    setLoaded(true);
    setLoading(false);
  };

  const handleToggle = (next: boolean) => {
    setOpen(next);
    if (next && !loaded && !loading) load();
  };

  const openFile = async (path: string) => {
    const { data, error } = await supabase.storage
      .from("work-order-attachments")
      .createSignedUrl(path, 300);

    if (error || !data?.signedUrl) {
      toast({
        title: "Erro",
        description: "Não foi possível abrir o ficheiro",
        variant: "destructive",
      });
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  const formatDate = (value: string | null) =>
    value ? new Date(value).toLocaleDateString("pt-PT") : "Sem data";

  return (
    <Collapsible open={open} onOpenChange={handleToggle}>
      <CollapsibleTrigger asChild>
        <Button variant="outline" size="sm" className="w-full justify-between">
          <span className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Histórico de intervenções
          </span>
          {open ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-3 space-y-4">
        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                Ordens de trabalho ({orders.length})
              </p>
              {orders.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Ainda não há ordens de trabalho neste equipamento.
                </p>
              ) : (
                orders.map((order) => (
                  <Link
                    key={order.id}
                    to={`/work-orders/${order.id}`}
                    className="flex items-center justify-between gap-3 rounded-md border p-2 text-sm hover:bg-muted/50 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="font-medium truncate">
                        {order.reference ? `${order.reference} · ` : ""}
                        {order.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(order.scheduled_date || order.created_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="secondary">
                        {statusLabels[order.status] || order.status}
                      </Badge>
                      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                  </Link>
                ))
              )}
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                Relatórios de manutenção ({reports.length})
              </p>
              {reports.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Ainda não há relatórios para este equipamento.
                </p>
              ) : (
                reports.map((report) => {
                  const order = orders.find((o) => o.id === report.work_order_id);
                  return (
                    <div
                      key={report.id}
                      className="flex items-center justify-between gap-3 rounded-md border p-2 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="font-medium truncate">
                          {reportTypeLabels[report.report_type] || report.report_type}
                          {order?.reference ? ` · ${order.reference}` : ""}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(report.report_date || report.created_at)}
                          {report.technician_name ? ` • ${report.technician_name}` : ""}
                        </p>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        disabled={!report.pdf_url}
                        title={report.pdf_url ? "Abrir PDF" : "PDF não disponível"}
                        onClick={() => report.pdf_url && openFile(report.pdf_url)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })
              )}
            </div>

            {attachments.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase text-muted-foreground">
                  Folhas de OT e documentos ({attachments.length})
                </p>
                {attachments.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center justify-between gap-3 rounded-md border p-2 text-sm"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <p className="font-medium truncate">{file.filename}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(file.uploaded_at)}
                        </p>
                      </div>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      title="Abrir"
                      onClick={() => openFile(file.url)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
