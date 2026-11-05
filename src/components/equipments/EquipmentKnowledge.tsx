import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookOpen, ChevronDown, ExternalLink, Pencil, Plus, Trash2, Upload, Wrench } from "lucide-react";
import { equipmentModelKey, parseCauses } from "@/lib/equipmentModelKey";

type Manual = { id: string; kind: string; filename: string; url: string };
type Fault = { id: string; symptom: string; causes: string[] };

export function EquipmentKnowledge({ brand, model }: { brand?: string | null; model?: string | null }) {
  const { user, roles } = useAuth();
  const { toast } = useToast();
  const isManager = roles.includes("manager");
  const isStaff = isManager || roles.includes("employee");
  const key = useMemo(() => equipmentModelKey(brand, model), [brand, model]);
  const [manuals, setManuals] = useState<Manual[]>([]);
  const [faults, setFaults] = useState<Fault[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id?: string; symptom: string; causes: string } | null>(null);
  const [uploading, setUploading] = useState(false);

  const load = async () => {
    if (!key) return;
    const [m, f] = await Promise.all([
      supabase.from("equipment_model_manuals").select("id,kind,filename,url").eq("brand_key", key.brand_key).eq("model_key", key.model_key).order("created_at"),
      supabase.from("equipment_model_faults").select("id,symptom,causes").eq("brand_key", key.brand_key).eq("model_key", key.model_key).order("symptom"),
    ]);
    setManuals((m.data as Manual[]) || []);
    setFaults((f.data as Fault[]) || []);
  };
  useEffect(() => { load(); }, [key?.brand_key, key?.model_key]);

  if (!isStaff) return null;
  if (!key) return <p className="text-sm text-muted-foreground">Preenche a marca e o modelo para ver manuais e avarias.</p>;

  const upload = async (kind: "parts" | "technical", file?: File) => {
    if (!file || !user) return;
    setUploading(true);
    try {
      const path = `${user.id}/manuals/${crypto.randomUUID()}.${file.name.split(".").pop()}`;
      const { error } = await supabase.storage.from("equipment-attachments").upload(path, file);
      if (error) throw error;
      const { error: e2 } = await supabase.from("equipment_model_manuals").insert({ ...key, kind, filename: file.name, url: path, uploaded_by: user.id });
      if (e2) throw e2;
      toast({ title: "Manual adicionado" });
      load();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro ao enviar manual", description: e.message });
    } finally { setUploading(false); }
  };

  const openManual = async (m: Manual) => {
    const { data, error } = await supabase.storage.from("equipment-attachments").createSignedUrl(m.url, 600);
    if (error || !data) return toast({ variant: "destructive", title: "Erro ao abrir manual" });
    window.open(data.signedUrl, "_blank");
  };

  const removeManual = async (m: Manual) => {
    if (!confirm("Apagar este manual?")) return;
    await supabase.storage.from("equipment-attachments").remove([m.url]);
    await supabase.from("equipment_model_manuals").delete().eq("id", m.id);
    load();
  };

  const saveFault = async () => {
    if (!editing || !user) return;
    const causes = parseCauses(editing.causes);
    if (!editing.symptom.trim() || causes.length === 0)
      return toast({ variant: "destructive", title: "Preenche a avaria e pelo menos uma causa" });
    const { error } = editing.id
      ? await supabase.from("equipment_model_faults").update({ symptom: editing.symptom.trim(), causes }).eq("id", editing.id)
      : await supabase.from("equipment_model_faults").insert({ ...key, symptom: editing.symptom.trim(), causes, created_by: user.id });
    if (error) return toast({ variant: "destructive", title: "Erro ao guardar", description: error.message });
    setEditing(null);
    load();
  };

  const removeFault = async (id: string) => {
    if (!confirm("Apagar esta avaria?")) return;
    await supabase.from("equipment_model_faults").delete().eq("id", id);
    load();
  };

  const q = search.trim().toLowerCase();
  const shown = faults.filter((f) => !q || f.symptom.toLowerCase().includes(q) || f.causes.some((c) => c.toLowerCase().includes(q)));

  const ManualGroup = ({ kind, label }: { kind: "parts" | "technical"; label: string }) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold">{label}</h4>
        {isManager && (
          <label className="inline-flex cursor-pointer items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-accent">
            <Upload className="h-3 w-3" /> {uploading ? "A enviar..." : "Enviar"}
            <input type="file" accept=".pdf,image/*" className="hidden" disabled={uploading}
              onChange={(e) => { upload(kind, e.target.files?.[0]); e.target.value = ""; }} />
          </label>
        )}
      </div>
      {manuals.filter((m) => m.kind === kind).length === 0 ? (
        <p className="text-xs text-muted-foreground">Sem {label.toLowerCase()}.</p>
      ) : manuals.filter((m) => m.kind === kind).map((m) => (
        <div key={m.id} className="flex items-center justify-between gap-2 rounded-md border p-2">
          <span className="min-w-0 truncate text-sm">{m.filename}</span>
          <div className="flex shrink-0 gap-1">
            <Button size="icon" variant="ghost" onClick={() => openManual(m)} aria-label="Abrir"><ExternalLink className="h-4 w-4" /></Button>
            {isManager && <Button size="icon" variant="ghost" onClick={() => removeManual(m)} aria-label="Apagar"><Trash2 className="h-4 w-4 text-destructive" /></Button>}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="rounded-lg border p-3">
      <p className="mb-2 text-xs text-muted-foreground">Partilhado por todos os equipamentos {brand} {model}</p>
      <Tabs defaultValue="faults">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="manuals"><BookOpen className="mr-1 h-4 w-4" />Manuais</TabsTrigger>
          <TabsTrigger value="faults"><Wrench className="mr-1 h-4 w-4" />Avarias ({faults.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="manuals" className="space-y-4 pt-2">
          <ManualGroup kind="parts" label="Manual de peças" />
          <ManualGroup kind="technical" label="Manual técnico" />
        </TabsContent>
        <TabsContent value="faults" className="space-y-2 pt-2">
          <div className="flex gap-2">
            <Input placeholder="Pesquisar avaria ou causa..." value={search} onChange={(e) => setSearch(e.target.value)} />
            <Button size="sm" onClick={() => setEditing({ symptom: "", causes: "" })}><Plus className="mr-1 h-4 w-4" />Avaria</Button>
          </div>
          {editing && (
            <div className="space-y-2 rounded-md border bg-muted/40 p-2">
              <Input placeholder="Avaria (ex.: água do tanque está fria)" value={editing.symptom} onChange={(e) => setEditing({ ...editing, symptom: e.target.value })} />
              <Textarea rows={4} placeholder={"Possíveis causas, uma por linha\nTermóstato de segurança ativo\nResistência fundida"} value={editing.causes} onChange={(e) => setEditing({ ...editing, causes: e.target.value })} />
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
                <Button size="sm" onClick={saveFault}>Guardar</Button>
              </div>
            </div>
          )}
          {shown.length === 0 ? (
            <p className="text-xs text-muted-foreground">Sem avarias registadas.</p>
          ) : shown.map((f) => (
            <div key={f.id} className="rounded-md border">
              <div className="flex items-center gap-2 p-2">
                <button className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm font-medium" onClick={() => setOpen(open === f.id ? null : f.id)}>
                  <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${open === f.id ? "rotate-180" : ""}`} />
                  <span className="min-w-0">{f.symptom}</span>
                </button>
                {isStaff && (
                  <Button size="icon" variant="ghost" onClick={() => setEditing({ id: f.id, symptom: f.symptom, causes: f.causes.join("\n") })} aria-label="Editar"><Pencil className="h-4 w-4" /></Button>
                )}
                {isManager && (
                  <Button size="icon" variant="ghost" onClick={() => removeFault(f.id)} aria-label="Apagar"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                )}
              </div>
              {open === f.id && (
                <div className="border-t px-3 py-2">
                  <p className="mb-1 text-xs font-semibold text-muted-foreground">Possíveis causas</p>
                  <ul className="list-disc space-y-0.5 pl-5 text-sm">{f.causes.map((c, i) => <li key={i}>{c}</li>)}</ul>
                </div>
              )}
            </div>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
