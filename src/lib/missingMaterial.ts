import { supabase } from "@/integrations/supabase/client";

/** IDs of open work orders whose most recent pause was "falta de material". */
export async function fetchMissingMaterialIds(): Promise<Set<string>> {
  const { data } = await supabase
    .from("time_entries")
    .select("work_order_id, pause_reason, start_time, work_orders!inner(status)")
    .order("start_time", { ascending: false })
    .limit(5000);
  const seen = new Set<string>();
  const ids = new Set<string>();
  for (const row of (data || []) as any[]) {
    if (seen.has(row.work_order_id)) continue;
    seen.add(row.work_order_id);
    const status = row.work_orders?.status;
    if (row.pause_reason === "falta_material" && !["completed", "invoiced", "cancelled", "in_progress"].includes(status)) {
      ids.add(row.work_order_id);
    }
  }
  return ids;
}
