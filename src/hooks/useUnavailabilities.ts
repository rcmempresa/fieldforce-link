import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Unavailability } from "@/lib/unavailability";

/** Unavailabilities that end on or after `fromDay` (YYYY-MM-DD). */
export function useUnavailabilities(fromDay?: string) {
  const [data, setData] = useState<Unavailability[]>([]);
  const reload = useCallback(async () => {
    let q = supabase.from("profile_unavailabilities")
      .select("id, user_id, start_date, end_date, reason, notes")
      .order("start_date", { ascending: true }).limit(1000);
    if (fromDay) q = q.gte("end_date", fromDay);
    const { data } = await q;
    setData((data ?? []) as Unavailability[]);
  }, [fromDay]);
  useEffect(() => { reload(); }, [reload]);
  return { data, reload };
}
