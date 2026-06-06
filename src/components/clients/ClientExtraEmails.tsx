import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Plus, Mail } from "lucide-react";

interface ClientEmail {
  id: string;
  email: string;
  label: string | null;
}

interface Props {
  userId: string;
  /** Mostra um título compacto interno (default: true). */
  showTitle?: boolean;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ClientExtraEmails({ userId, showTitle = true }: Props) {
  const { toast } = useToast();
  const [emails, setEmails] = useState<ClientEmail[]>([]);
  const [loading, setLoading] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchEmails = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("client_emails")
      .select("id, email, label")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });
    if (error) {
      console.error(error);
    } else {
      setEmails(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (userId) fetchEmails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const handleAdd = async () => {
    const email = newEmail.trim().toLowerCase();
    if (!EMAIL_REGEX.test(email)) {
      toast({ title: "Email inválido", description: "Indique um email válido.", variant: "destructive" });
      return;
    }
    if (emails.some((e) => e.email.toLowerCase() === email)) {
      toast({ title: "Duplicado", description: "Este email já está adicionado.", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("client_emails").insert({
      user_id: userId,
      email,
      label: newLabel.trim() || null,
    });
    setSaving(false);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    setNewEmail("");
    setNewLabel("");
    fetchEmails();
    toast({ title: "Email adicionado" });
  };

  const handleRemove = async (id: string) => {
    const { error } = await supabase.from("client_emails").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    fetchEmails();
    toast({ title: "Email removido" });
  };

  return (
    <div className="space-y-3">
      {showTitle && (
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-muted-foreground" />
          <Label className="text-sm font-medium">Emails adicionais para notificações</Label>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        As notificações enviadas para este cliente irão também para estes emails. O email principal de
        login continua a receber normalmente.
      </p>

      {loading ? (
        <p className="text-xs text-muted-foreground">A carregar...</p>
      ) : emails.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">Sem emails adicionais.</p>
      ) : (
        <ul className="space-y-2">
          {emails.map((e) => (
            <li
              key={e.id}
              className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/30 px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{e.email}</p>
                {e.label && <p className="truncate text-xs text-muted-foreground">{e.label}</p>}
              </div>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => handleRemove(e.id)}
                aria-label="Remover email"
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_140px_auto]">
        <Input
          type="email"
          placeholder="email@exemplo.com"
          value={newEmail}
          onChange={(ev) => setNewEmail(ev.target.value)}
        />
        <Input
          placeholder="Rótulo (opcional)"
          value={newLabel}
          onChange={(ev) => setNewLabel(ev.target.value)}
        />
        <Button type="button" onClick={handleAdd} disabled={saving || !newEmail.trim()}>
          <Plus className="h-4 w-4 mr-1" />
          Adicionar
        </Button>
      </div>
    </div>
  );
}