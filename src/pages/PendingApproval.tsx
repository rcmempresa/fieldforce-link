import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export default function PendingApproval() {
  const { signOut } = useAuth();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Clock className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Conta Criada com Sucesso!</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p className="text-muted-foreground">
            A sua conta foi criada com sucesso. Por favor, aguarde que o gerente aprove o seu acesso ao sistema.
          </p>
          <p className="text-sm text-muted-foreground">
            Será notificado assim que tiver acesso. Por favor, tente fazer login novamente mais tarde.
          </p>
          <Button onClick={signOut} className="w-full">
            Terminar Sessão
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
