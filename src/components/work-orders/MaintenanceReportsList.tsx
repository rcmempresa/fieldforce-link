import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { FileText, Plus, Zap, Wind, Eye, Trash2, Download, Cog } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MaintenanceReportForm } from "./MaintenanceReportForm";
import { GeneratorReportForm } from "./GeneratorReportForm";

interface MaintenanceReport {
  id: string;
  report_type: string;
  report_date: string;
  technician_name: string | null;
  status: string;
  created_at: string;
  pdf_url: string | null;
}

interface Props {
  workOrderId: string;
  canEdit: boolean;
}

export function MaintenanceReportsList({ workOrderId, canEdit }: Props) {
  const [reports, setReports] = useState<MaintenanceReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editReportId, setEditReportId] = useState<string | null>(null);
  const [newReportType, setNewReportType] = useState<"electricity" | "hvac" | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchReports();
  }, [workOrderId]);

  const fetchReports = async () => {
    const { data, error } = await supabase
      .from("maintenance_reports")
      .select("id, report_type, report_date, technician_name, status, created_at, pdf_url")
      .eq("work_order_id", workOrderId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching reports:", error);
    } else {
      setReports(data || []);
    }
    setLoading(false);
  };

  const handleDelete = async (reportId: string) => {
    const { error } = await supabase
      .from("maintenance_reports")
      .delete()
      .eq("id", reportId);

    if (error) {
      toast({ title: "Erro", description: "Erro ao eliminar relatório", variant: "destructive" });
    } else {
      toast({ title: "Sucesso", description: "Relatório eliminado" });
      fetchReports();
    }
  };

  const handleCreateReport = (type: "electricity" | "hvac") => {
    setNewReportType(type);
    setEditReportId(null);
    setShowForm(true);
  };

  const handleViewReport = (reportId: string) => {
    setEditReportId(reportId);
    setNewReportType(null);
    setShowForm(true);
  };

  const handleDownloadPdf = async (pdfUrl: string) => {
    const { data } = await supabase.storage
      .from("work-order-attachments")
      .createSignedUrl(pdfUrl, 300);
    
    if (data?.signedUrl) {
      window.open(data.signedUrl, "_blank");
    }
  };

  if (showForm) {
    return (
      <MaintenanceReportForm
        workOrderId={workOrderId}
        reportId={editReportId}
        reportType={newReportType}
        canEdit={canEdit}
        onClose={() => {
          setShowForm(false);
          setEditReportId(null);
          setNewReportType(null);
          fetchReports();
        }}
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Relatórios de Manutenção
          </CardTitle>
          {canEdit && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Novo Relatório
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-popover">
                <DropdownMenuItem onClick={() => handleCreateReport("electricity")}>
                  <Zap className="h-4 w-4 mr-2 text-yellow-500" />
                  Eletricidade
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleCreateReport("hvac")}>
                  <Wind className="h-4 w-4 mr-2 text-blue-500" />
                  Climatização
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : reports.length === 0 ? (
          <p className="text-center text-muted-foreground py-6">
            Nenhum relatório de manutenção criado
          </p>
        ) : (
          <div className="space-y-3">
            {reports.map((report) => (
              <div
                key={report.id}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div className="flex items-center gap-3">
                  {report.report_type === "electricity" ? (
                    <Zap className="h-5 w-5 text-yellow-500" />
                  ) : (
                    <Wind className="h-5 w-5 text-blue-500" />
                  )}
                  <div>
                    <p className="font-medium text-sm">
                      {report.report_type === "electricity" ? "Eletricidade" : "Climatização"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {report.report_date
                        ? new Date(report.report_date).toLocaleDateString("pt-PT")
                        : new Date(report.created_at).toLocaleDateString("pt-PT")}
                      {report.technician_name && ` • ${report.technician_name}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={report.status === "completed" ? "default" : "secondary"}>
                    {report.status === "completed" ? "Concluído" : "Rascunho"}
                  </Badge>
                  {report.pdf_url && (
                    <Button size="icon" variant="ghost" onClick={() => handleDownloadPdf(report.pdf_url!)}>
                      <Download className="h-4 w-4" />
                    </Button>
                  )}
                  <Button size="icon" variant="ghost" onClick={() => handleViewReport(report.id)}>
                    <Eye className="h-4 w-4" />
                  </Button>
                  {canEdit && report.status === "draft" && (
                    <Button size="icon" variant="ghost" onClick={() => handleDelete(report.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
