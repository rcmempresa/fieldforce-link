import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Wrench, ClipboardList, FileText } from "lucide-react";

export default function ClientDashboard() {
  return (
    <DashboardLayout title="Dashboard do Cliente">
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Solicitações Ativas</CardTitle>
              <ClipboardList className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">3</div>
              <p className="text-xs text-muted-foreground">Em andamento</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Meus Equipamentos</CardTitle>
              <Wrench className="h-4 w-4 text-accent" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">7</div>
              <p className="text-xs text-muted-foreground">Registados</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Serviços Concluídos</CardTitle>
              <FileText className="h-4 w-4 text-accent" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">18</div>
              <p className="text-xs text-muted-foreground">Total</p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Ações Rápidas</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nova Solicitação
            </Button>
            <Button variant="outline">
              <Wrench className="mr-2 h-4 w-4" />
              Gerir Equipamentos
            </Button>
          </CardContent>
        </Card>

        {/* My Work Orders */}
        <Card>
          <CardHeader>
            <CardTitle>Minhas Solicitações</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-1">
                  <p className="font-medium">WO-2025-0001</p>
                  <p className="text-sm text-muted-foreground">Manutenção preventiva - Equipamento A</p>
                  <p className="text-xs text-muted-foreground">Criado em 01/11/2025</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="rounded-full bg-warning/10 px-3 py-1 text-xs font-medium text-warning">
                    Aguarda Aprovação
                  </span>
                  <Button size="sm" variant="outline">Ver</Button>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-1">
                  <p className="font-medium">WO-2025-0010</p>
                  <p className="text-sm text-muted-foreground">Reparação - Equipamento B</p>
                  <p className="text-xs text-muted-foreground">Criado em 28/10/2025</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                    Em Progresso
                  </span>
                  <Button size="sm" variant="outline">Ver</Button>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-1">
                  <p className="font-medium">WO-2025-0008</p>
                  <p className="text-sm text-muted-foreground">Instalação - Equipamento C</p>
                  <p className="text-xs text-muted-foreground">Concluído em 25/10/2025</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
                    Concluída
                  </span>
                  <Button size="sm" variant="outline">Ver Fatura</Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
