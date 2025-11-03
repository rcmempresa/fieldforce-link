import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Calendar, User, Clock, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface WorkOrderDetails {
  id: string;
  reference: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  scheduled_date: string | null;
  created_at: string;
  total_hours: number;
  notes: string;
  profiles: {
    name: string;
    email: string;
  };
}

export default function WorkOrderDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [workOrder, setWorkOrder] = useState<WorkOrderDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchWorkOrderDetails();
  }, [id]);

  const fetchWorkOrderDetails = async () => {
    const { data, error } = await supabase
      .from("work_orders")
      .select(`
        *,
        profiles!work_orders_client_id_fkey (
          name
        )
      `)
      .eq("id", id)
      .single();

    setLoading(false);

    if (error) {
      toast({
        title: "Erro",
        description: "Erro ao carregar detalhes da ordem de trabalho",
        variant: "destructive",
      });
      navigate("/work-orders");
    } else if (data) {
      setWorkOrder(data as any);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-warning/10 text-warning";
      case "in_progress":
        return "bg-primary/10 text-primary";
      case "completed":
        return "bg-accent/10 text-accent";
      case "cancelled":
        return "bg-destructive/10 text-destructive";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "pending":
        return "Pendente";
      case "in_progress":
        return "Em Progresso";
      case "completed":
        return "Concluída";
      case "cancelled":
        return "Cancelada";
      default:
        return status;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "bg-destructive/10 text-destructive";
      case "medium":
        return "bg-warning/10 text-warning";
      case "low":
        return "bg-accent/10 text-accent";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case "high":
        return "Alta";
      case "medium":
        return "Média";
      case "low":
        return "Baixa";
      default:
        return priority;
    }
  };

  if (loading) {
    return (
      <DashboardLayout title="Detalhes da Ordem">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </DashboardLayout>
    );
  }

  if (!workOrder) {
    return null;
  }

  return (
    <DashboardLayout title="Detalhes da Ordem">
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => navigate("/work-orders")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-2xl">{workOrder.reference}</CardTitle>
                <p className="text-muted-foreground mt-1">{workOrder.title}</p>
              </div>
              <div className="flex gap-2">
                <span
                  className={`rounded-full px-3 py-1 text-sm font-medium ${getStatusColor(
                    workOrder.status
                  )}`}
                >
                  {getStatusLabel(workOrder.status)}
                </span>
                <span
                  className={`rounded-full px-3 py-1 text-sm font-medium ${getPriorityColor(
                    workOrder.priority
                  )}`}
                >
                  {getPriorityLabel(workOrder.priority)}
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <User className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Cliente</p>
                    <p className="text-sm text-muted-foreground">{workOrder.profiles.name}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Data Criada</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(workOrder.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>

                {workOrder.scheduled_date && (
                  <div className="flex items-start gap-3">
                    <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Data Agendada</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(workOrder.scheduled_date).toLocaleString()}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Total de Horas</p>
                    <p className="text-sm text-muted-foreground">
                      {workOrder.total_hours || 0}h
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {workOrder.description && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <p className="text-sm font-medium">Descrição</p>
                </div>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {workOrder.description}
                </p>
              </div>
            )}

            {workOrder.notes && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <p className="text-sm font-medium">Notas</p>
                </div>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {workOrder.notes}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
