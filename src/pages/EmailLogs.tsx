import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import { Mail, AlertCircle, CheckCircle2, ArrowLeft } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function EmailLogs() {
  const navigate = useNavigate();
  const { data: emailLogs, isLoading } = useQuery({
    queryKey: ["email-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_logs")
        .select(`
          *,
          profiles!email_logs_user_id_fkey(name),
          work_orders(reference, title)
        `)
        .order("sent_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      return data;
    },
  });

  const getStatusBadge = (status: string) => {
    if (status === "sent") {
      return (
        <Badge variant="default" className="gap-1">
          <CheckCircle2 className="h-3 w-3" />
          Enviado
        </Badge>
      );
    }
    return (
      <Badge variant="destructive" className="gap-1">
        <AlertCircle className="h-3 w-3" />
        Falhou
      </Badge>
    );
  };

  const getNotificationTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      work_order_assigned: "Ordem Atribuída",
      work_order_completed: "Ordem Concluída",
      work_order_created: "Ordem Criada",
      work_order_updated: "Ordem Atualizada",
      work_order_assignment_removed: "Atribuição Removida",
      error: "Erro",
    };
    return types[type] || type;
  };

  return (
    <DashboardLayout title="Histórico de Emails">
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Histórico de Emails</h1>
            <p className="text-muted-foreground">
              Visualize todos os emails enviados pelo sistema
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Emails Enviados
            </CardTitle>
            <CardDescription>
              Últimos 100 emails enviados com informações de entrega
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : emailLogs && emailLogs.length > 0 ? (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data/Hora</TableHead>
                      <TableHead>Destinatário</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Assunto</TableHead>
                      <TableHead>Ordem</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {emailLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="font-mono text-sm">
                          {format(new Date(log.sent_at), "dd/MM/yyyy HH:mm", {
                            locale: pt,
                          })}
                        </TableCell>
                        <TableCell className="font-medium">
                          {log.profiles?.name || "N/A"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {log.email}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {getNotificationTypeLabel(log.notification_type)}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-xs truncate">
                          {log.subject}
                        </TableCell>
                        <TableCell>
                          {log.work_orders?.reference || "-"}
                        </TableCell>
                        <TableCell>{getStatusBadge(log.status)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum email enviado ainda</p>
              </div>
            )}
          </CardContent>
        </Card>

        {emailLogs && emailLogs.some((log) => log.status === "failed") && (
          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertCircle className="h-5 w-5" />
                Emails com Falha
              </CardTitle>
              <CardDescription>
                Emails que falharam ao enviar com detalhes do erro
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data/Hora</TableHead>
                      <TableHead>Destinatário</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Erro</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {emailLogs
                      .filter((log) => log.status === "failed")
                      .map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="font-mono text-sm">
                            {format(new Date(log.sent_at), "dd/MM/yyyy HH:mm", {
                              locale: pt,
                            })}
                          </TableCell>
                          <TableCell className="font-medium">
                            {log.profiles?.name || "N/A"}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {getNotificationTypeLabel(log.notification_type)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-destructive text-sm">
                            {log.error_message || "Erro desconhecido"}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
