import { Fragment, KeyboardEvent, ReactNode, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Bot, Lock, Pencil, Send } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Msg {
  id: string;
  from: "user" | "bot";
  text: string;
  at: Date;
}

const inline = (t: string): ReactNode[] =>
  t.split(/(\*\*[^*]+\*\*)/g).map((p, i) =>
    p.startsWith("**") && p.endsWith("**") && p.length > 4 ? <strong key={i}>{p.slice(2, -2)}</strong> : <Fragment key={i}>{p}</Fragment>
  );

function Markdown({ text }: { text: string }) {
  const out: ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  const flush = () => {
    if (!list) return;
    const Tag = list.ordered ? "ol" : "ul";
    out.push(
      <Tag key={out.length} className={cn("ml-5 space-y-0.5", list.ordered ? "list-decimal" : "list-disc")}>
        {list.items.map((it, i) => <li key={i}>{inline(it)}</li>)}
      </Tag>
    );
    list = null;
  };
  text.split("\n").forEach((line) => {
    const ul = line.match(/^\s*[-*•]\s+(.*)/);
    const ol = line.match(/^\s*\d+[.)]\s+(.*)/);
    if (ul || ol) {
      const ordered = !!ol;
      if (list && list.ordered !== ordered) flush();
      if (!list) list = { ordered, items: [] };
      list.items.push((ul || ol)![1]);
    } else {
      flush();
      out.push(line.trim() ? <p key={out.length}>{inline(line)}</p> : <div key={out.length} className="h-2" />);
    }
  });
  flush();
  return <div className="space-y-1 break-words">{out}</div>;
}

const time = (d: Date) => d.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });

export default function AssistenteDigital() {
  const { profile, roles, loading: authLoading } = useAuth();
  const isManager = roles.includes("manager");
  const name = profile?.name ?? "";
  const welcome = (): Msg => ({
    id: crypto.randomUUID(),
    from: "bot",
    text: `Olá ${name}! Sou o Empregado Digital. Como posso ajudar?`,
    at: new Date(),
  });
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (profile && msgs.length === 0) setMsgs([welcome()]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, loading]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setMsgs((m) => [...m, { id: crypto.randomUUID(), from: "user", text, at: new Date() }]);
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("assistente-proxy", { body: { message: text } });
    setLoading(false);
    const reply = error || data?.error ? "Desculpa, não consegui responder agora. Tenta novamente." : data.reply;
    setMsgs((m) => [...m, { id: crypto.randomUUID(), from: "bot", text: reply, at: new Date() }]);
  };

  const reset = async () => {
    setMsgs([welcome()]);
    const { error, data } = await supabase.functions.invoke("assistente-proxy", { body: { action: "reset" } });
    if (error || data?.ok === false) toast.error("Não foi possível reiniciar a conversa no assistente");
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const initial = (name.trim()[0] ?? "U").toUpperCase();

  if (!loading && !isManager) {
    return (
      <DashboardLayout title="Assistente Digital">
        <Card className="flex min-h-[320px] flex-col items-center justify-center gap-3 p-8 text-center">
          <Lock className="h-8 w-8 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Acesso restrito</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            O Empregado Digital está disponível apenas para gerentes.
          </p>
          <Button asChild variant="outline">
            <Link to="/">Voltar ao painel</Link>
          </Button>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Assistente Digital">
      <Card className="flex h-[calc(100dvh-10rem)] min-h-[420px] flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Empregado Digital</h2>
          </div>
          <Button variant="outline" size="sm" onClick={reset} disabled={loading}>
            <Pencil className="mr-2 h-4 w-4" /> Nova conversa
          </Button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {msgs.map((m) => {
            const mine = m.from === "user";
            return (
              <div key={m.id} className={cn("flex items-end gap-2", mine && "flex-row-reverse")}>
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarFallback className={mine ? "bg-primary text-primary-foreground" : "bg-muted"}>
                    {mine ? initial : <Bot className="h-4 w-4" />}
                  </AvatarFallback>
                </Avatar>
                <div
                  className={cn(
                    "max-w-[80%] rounded-2xl px-3 py-2 text-sm",
                    mine ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm bg-muted text-foreground"
                  )}
                >
                  {mine ? <p className="whitespace-pre-wrap break-words">{m.text}</p> : <Markdown text={m.text} />}
                  <p className={cn("mt-1 text-right text-[10px]", mine ? "text-primary-foreground/70" : "text-muted-foreground")}>
                    {time(m.at)}
                  </p>
                </div>
              </div>
            );
          })}
          {loading && (
            <div className="flex items-end gap-2">
              <Avatar className="h-8 w-8"><AvatarFallback className="bg-muted"><Bot className="h-4 w-4" /></AvatarFallback></Avatar>
              <div className="rounded-2xl rounded-bl-sm bg-muted px-3 py-2 text-sm italic text-muted-foreground">a escrever...</div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        <div className="flex items-end gap-2 border-t p-3">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKey}
            placeholder="Escreve a tua mensagem..."
            rows={1}
            className="max-h-40 min-h-[44px] resize-none"
          />
          <Button onClick={send} disabled={loading || !input.trim()} size="icon" className="h-11 w-11 shrink-0" aria-label="Enviar">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </Card>
    </DashboardLayout>
  );
}
