import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Sparkles, Loader2 } from "lucide-react";

function renderLine(line: string, i: number) {
  const bold = (s: string) =>
    s.split(/(\*\*[^*]+\*\*)/g).map((p, j) =>
      p.startsWith("**") && p.endsWith("**") ? <strong key={j}>{p.slice(2, -2)}</strong> : p
    );
  const t = line.trim();
  if (!t) return <div key={i} className="h-2" />;
  if (/^#{1,4}\s/.test(t)) return <p key={i} className="font-semibold mt-2">{bold(t.replace(/^#+\s/, ""))}</p>;
  if (/^[-*]\s/.test(t)) return <p key={i} className="pl-4">• {bold(t.slice(2))}</p>;
  if (/^\d+[.)]\s/.test(t)) return <p key={i} className="pl-4">{bold(t)}</p>;
  return <p key={i}>{bold(t)}</p>;
}

export function FaultAssistant({ equipmentId }: { equipmentId: string }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [fault, setFault] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");

  const analyse = async () => {
    if (fault.trim().length < 5) {
      toast({ title: "Descreva a avaria", description: "Escreva pelo menos alguns detalhes.", variant: "destructive" });
      return;
    }
    setLoading(true);
    setResult("");
    try {
      const { data, error } = await supabase.functions.invoke("sugerir-verificacoes", {
        body: { equipmentId, fault },
      });
      if (error || data?.error) throw new Error(data?.error || "Não foi possível gerar sugestões.");
      setResult(data.suggestion);
    } catch (e) {
      toast({ title: "Erro", description: (e as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (!open)
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Sparkles className="h-4 w-4 mr-2" /> Diagnóstico assistido (IA)
      </Button>
    );

  return (
    <div className="rounded-lg border bg-muted/40 p-3 space-y-3">
      <div className="flex items-center gap-2 font-medium text-sm">
        <Sparkles className="h-4 w-4 text-primary" /> Diagnóstico assistido
      </div>
      <Textarea
        value={fault}
        onChange={(e) => setFault(e.target.value)}
        placeholder="Descreva a avaria (ex.: não arranca, dá erro E4, faz ruído no compressor...)"
        rows={3}
        maxLength={2000}
      />
      <div className="flex gap-2">
        <Button size="sm" onClick={analyse} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
          {loading ? "A analisar histórico..." : "Sugerir verificações"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Fechar</Button>
      </div>
      {result && (
        <div className="rounded-md bg-background border p-3 text-sm space-y-1">
          {result.split("\n").map(renderLine)}
          <p className="text-xs text-muted-foreground pt-2">Sugestões geradas por IA — confirme sempre no local.</p>
        </div>
      )}
    </div>
  );
}
