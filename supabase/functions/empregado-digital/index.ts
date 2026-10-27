import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const str = (v: unknown, max = 200) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined);
const isDate = (v?: string) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);
const nextDay = (d: string) => { const t = new Date(d + "T00:00:00Z"); t.setUTCDate(t.getUTCDate() + 1); return t.toISOString().slice(0, 10); };

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const expected = Deno.env.get("EMPREGADO_DIGITAL_SECRET");
  const provided = req.headers.get("x-agent-secret") ?? "";
  if (!expected || !safeEqual(provided, expected)) return json({ error: "Unauthorized" }, 401);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON body" }, 400); }
  const action = str(body?.action, 50);
  const p = body?.params && typeof body.params === "object" && !Array.isArray(body.params) ? body.params : {};
  if (!action) return json({ error: "Missing 'action'" }, 400);

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const limit = Math.min(Math.max(Number(p.limit) || 50, 1), 500);

  try {
    switch (action) {
      case "listar_ots": {
        let q = db.from("work_orders")
          .select("id, reference, title, status, priority, service_type, scheduled_date, total_hours, address, client:profiles!work_orders_client_id_fkey(id, name, company_name), work_order_assignments(user_id, profiles(name))")
          .order("scheduled_date", { ascending: false, nullsFirst: false })
          .limit(limit);
        const status = str(p.status, 30);
        if (status) q = q.eq("status", status);
        const date = str(p.scheduled_date, 10);
        const from = str(p.date_from, 10), to = str(p.date_to, 10);
        if (date) {
          if (!isDate(date)) return json({ error: "scheduled_date must be YYYY-MM-DD" }, 400);
          q = q.gte("scheduled_date", date).lt("scheduled_date", nextDay(date));
        }
        if (from) { if (!isDate(from)) return json({ error: "date_from must be YYYY-MM-DD" }, 400); q = q.gte("scheduled_date", from); }
        if (to) { if (!isDate(to)) return json({ error: "date_to must be YYYY-MM-DD" }, 400); q = q.lt("scheduled_date", nextDay(to)); }
        const { data, error } = await q;
        if (error) throw error;
        return json({ data, count: data.length });
      }
      case "detalhe_ot": {
        const reference = str(p.reference, 50);
        if (!reference) return json({ error: "Missing params.reference" }, 400);
        const { data, error } = await db.from("work_orders")
          .select("*, client:profiles!work_orders_client_id_fkey(id, name, company_name, phone, address), work_order_assignments(user_id, profiles(name)), work_order_equipments(*, equipments(*)), work_order_materials(*), time_entries(id, user_id, start_time, end_time, duration_hours, work_regime, pause_reason, note)")
          .ilike("reference", reference)
          .maybeSingle();
        if (error) throw error;
        if (!data) return json({ error: "OT não encontrada" }, 404);
        return json({ data });
      }
      case "listar_clientes": {
        const { data: roles, error: rErr } = await db.from("user_roles").select("user_id").eq("role", "client");
        if (rErr) throw rErr;
        const ids = (roles ?? []).map((r) => r.user_id);
        if (!ids.length) return json({ data: [], count: 0 });
        let q = db.from("profiles").select("id, name, company_name, phone, address").in("id", ids).order("company_name", { ascending: true, nullsFirst: false }).limit(limit);
        const search = str(p.search ?? p.nome ?? p.query, 100);
        if (search) {
          const s = search.replace(/[%,()]/g, " ");
          q = q.or(`name.ilike.%${s}%,company_name.ilike.%${s}%`);
        }
        const { data, error } = await q;
        if (error) throw error;
        return json({ data, count: data.length });
      }
      case "registos_horas": {
        let q = db.from("time_entries")
          .select("id, user_id, start_time, end_time, duration_hours, work_regime, pause_reason, note, profiles!time_entries_user_id_fkey(name), work_orders(reference, title, status)")
          .order("start_time", { ascending: false })
          .limit(limit);
        const userId = str(p.user_id, 40);
        if (userId) q = q.eq("user_id", userId);
        const date = str(p.date ?? p.data, 10);
        const from = str(p.date_from, 10), to = str(p.date_to, 10);
        if (date) { if (!isDate(date)) return json({ error: "date must be YYYY-MM-DD" }, 400); q = q.gte("start_time", date).lt("start_time", nextDay(date)); }
        if (from) { if (!isDate(from)) return json({ error: "date_from must be YYYY-MM-DD" }, 400); q = q.gte("start_time", from); }
        if (to) { if (!isDate(to)) return json({ error: "date_to must be YYYY-MM-DD" }, 400); q = q.lt("start_time", nextDay(to)); }
        const { data, error } = await q;
        if (error) throw error;
        const total_hours = data.reduce((s, e: any) => s + (Number(e.duration_hours) || 0), 0);
        return json({ data, count: data.length, total_hours });
      }
      default:
        return json({ error: `Unknown action '${action}'`, supported: ["listar_ots", "detalhe_ot", "listar_clientes", "registos_horas"] }, 400);
    }
  } catch (e: any) {
    console.error(action, e);
    return json({ error: e?.message ?? "Internal error" }, 500);
  }
});
