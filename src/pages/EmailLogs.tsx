import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useState, useMemo, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataPagination } from "@/components/ui/data-pagination";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import { Mail, AlertCircle, CheckCircle2, ArrowLeft, Search } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function EmailLogs() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"recent" | "oldest" | "recipient">("recent");
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 15;

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
        .limit(500);

      if (error) throw error;
      return data;
    },
  });

  const filteredLogs = useMemo(() => {
    if (!emailLogs) return [];
    const q = search.toLowerCase().trim();
    const filtered = q
      ? emailLogs.filter((log: any) =>
          (log.profiles?.name || "").toLowerCase().includes(q) ||
          (log.email || "").toLowerCase().includes(q) ||
          (log.subject || "").toLowerCase().includes(q) ||
          (log.work_orders?.reference || "").toLowerCase().includes(q) ||
          (log.notification_type || "").toLowerCase().includes(q)
        )
      : [...emailLogs];
    return filtered.sort((a: any, b: any) => {
      if (sortBy === "oldest") return new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime();
      if (sortBy === "recipient") return (a.profiles?.name || "").localeCompare(b.profiles?.name || "");
      return new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime();
    });
  }, [emailLogs, search, sortBy]);

  const totalPages = Math.ceil(filteredLogs.length / ITEMS_PER_PAGE);
  const paginatedLogs = filteredLogs.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [search, sortBy]);

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
              Histórico de emails enviados com informações de entrega
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Pesquisar por destinatário, email, assunto, referência..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
                <SelectTrigger className="sm:w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  <SelectItem value="recent">Mais recentes</SelectItem>
                  <SelectItem value="oldest">Mais antigos</SelectItem>
                  <SelectItem value="recipient">Por destinatário (A-Z)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {isLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : filteredLogs.length > 0 ? (
              <>
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
                    {paginatedLogs.map((log: any) => (
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
              <DataPagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                itemsPerPage={ITEMS_PER_PAGE}
                totalItems={filteredLogs.length}
              />
              </>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum email encontrado</p>
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
