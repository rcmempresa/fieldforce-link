import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PackageX } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchMissingMaterialIds } from "@/lib/missingMaterial";

interface Row {
  id: string;
  reference: string | null;
  title: string;
  client: string;
  note: string | null;
}

/** OTs stopped for missing material that are (or were) assigned to the current technician. */
export function EmployeeMissingMaterial() {
  const [rows, setRows] = useState<Row[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const [missing, prev, cur] = await Promise.all([
        fetchMissingMaterialIds(),
        supabase.from("work_order_previous_assignments").select("work_order_id").eq("user_id", user.id),
        supabase.from("work_order_assignments").select("work_order_id").eq("user_id", user.id),
      ]);
      const mine = new Set([...(prev.data || []), ...(cur.data || [])].map((r: any) => r.work_order_id));
      const ids = [...missing].filter((id) => mine.has(id));
      if (!ids.length) return setRows([]);
      const [{ data: wos }, { data: notes }] = await Promise.all([
        supabase.from("work_orders").select("id, reference, title, profiles!work_orders_client_id_fkey(name, company_name)").in("id", ids),
        supabase.from("time_entries").select("work_order_id, note, start_time").in("work_order_id", ids).eq("pause_reason", "falta_material").order("start_time", { ascending: false }),
      ]);
      const noteMap = new Map<string, string | null>();
      for (const n of (notes || []) as any[]) if (!noteMap.has(n.work_order_id)) noteMap.set(n.work_order_id, n.note);
      setRows(((wos || []) as any[]).map((w) => ({
        id: w.id,
        reference: w.reference,
        title: w.title,
        client: w.profiles?.company_name || w.profiles?.name || "N/A",
        note: noteMap.get(w.id) ?? null,
      })));
    })();
  }, []);

  if (!rows.length) return null;

  return (
    <Card className="border-destructive/40">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-destructive">
          <PackageX className="h-5 w-5" /> Sem material <Badge variant="destructive">{rows.length}</Badge>
        </CardTitle>
        <p className="text-sm text-muted-foreground">OTs que lhe foram atribuídas e estão paradas à espera de material.</p>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.map((r) => (
          <button
            key={r.id}
            onClick={() => navigate(`/work-orders/${r.id}`)}
            className="w-full rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-left hover:bg-destructive/10"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-sm">{r.reference}</span>
              <span className="rounded-full border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">Sem material</span>
            </div>
            <p className="break-words text-sm text-muted-foreground">{r.title}</p>
            <p className="text-xs text-muted-foreground">{r.client}</p>
            {r.note && <p className="mt-1 break-words text-xs">{r.note}</p>}
          </button>
        ))}
      </CardContent>
    </Card>
  );
}
