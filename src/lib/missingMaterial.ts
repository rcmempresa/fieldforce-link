import { supabase } from "@/integrations/supabase/client";

/** IDs of open work orders currently flagged as "sem material". */
export async function fetchMissingMaterialIds(): Promise<Set<string>> {
  const { data } = await supabase
    .from("work_orders")
    .select("id")
    .not("missing_material_since", "is", null)
    .limit(5000);
  return new Set((data || []).map((r: any) => r.id));
}
