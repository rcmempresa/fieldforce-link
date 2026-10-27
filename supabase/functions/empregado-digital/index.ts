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
        const clientSearch = str(p.client_search, 100);
        const unassigned = p.unassigned === true || p.unassigned === "true";
        const clientJoin = clientSearch ? "client:profiles!work_orders_client_id_fkey!inner(id, name, company_name)" : "client:profiles!work_orders_client_id_fkey(id, name, company_name)";
        let q = db.from("work_orders")
          .select(`id, reference, title, status, priority, service_type, scheduled_date, needs_scheduling, is_after_hours, total_hours, address, ${clientJoin}, work_order_assignments(user_id, profiles!work_order_assignments_user_id_fkey(name))`)
          .order("scheduled_date", { ascending: false, nullsFirst: false })
          .limit(limit);
        const priority = str(p.priority, 30);
        if (priority) q = q.eq("priority", priority);
        const bool = (v: unknown) => v === true || v === "true" ? true : v === false || v === "false" ? false : undefined;
        const ns = bool(p.needs_scheduling); if (ns !== undefined) q = q.eq("needs_scheduling", ns);
        const ah = bool(p.is_after_hours); if (ah !== undefined) q = q.eq("is_after_hours", ah);
        if (unassigned) q = q.is("work_order_assignments", null);
        if (clientSearch) {
          const s = clientSearch.replace(/[%,()]/g, " ");
          q = q.or(`name.ilike.%${s}%,company_name.ilike.%${s}%`, { referencedTable: "client" });
        }
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
        const { data: rows, error } = await db.from("work_orders")
          .select("*, client:profiles!work_orders_client_id_fkey(id, name, company_name, phone, address), work_order_assignments(user_id, profiles!work_order_assignments_user_id_fkey(name)), work_order_equipments(*, equipments(*)), work_order_materials(*), time_entries(id, user_id, start_time, end_time, duration_hours, work_regime, pause_reason, note)")
          .ilike("reference", `%${reference}%`)
          .order("reference", { ascending: true })
          .limit(6);
        if (error) throw error;
        const found = rows ?? [];
        if (!found.length) return json({ error: "OT não encontrada" }, 404);
        const exact = found.find((r: any) => r.reference?.toLowerCase() === reference.toLowerCase());
        const data = exact ?? found[0];
        const response: any = { data };
        if (!exact && found.length > 1) response.matches = found.map((r: any) => r.reference);
        return json(response);
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
      case "ots_atrasadas": {
        const today = new Date().toISOString().slice(0, 10);
        const { data, error } = await db.from("work_orders")
          .select("id, reference, title, status, priority, scheduled_date, client:profiles!work_orders_client_id_fkey(id, name, company_name), work_order_assignments(user_id, profiles!work_order_assignments_user_id_fkey(name))")
          .in("status", ["pending", "in_progress"])
          .lt("scheduled_date", today)
          .order("scheduled_date", { ascending: true })
          .limit(limit);
        if (error) throw error;
        return json({ data, count: data.length });
      }
      case "horas_equipa": {
        const from = str(p.date_from, 10), to = str(p.date_to, 10);
        if (from && !isDate(from)) return json({ error: "date_from must be YYYY-MM-DD" }, 400);
        if (to && !isDate(to)) return json({ error: "date_to must be YYYY-MM-DD" }, 400);
        const groups = new Map<string, { user_id: string; name: string | null; total_hours: number; registos: number }>();
        for (let off = 0; ; off += 1000) {
          let q = db.from("time_entries").select("user_id, duration_hours, profiles!time_entries_user_id_fkey(name)").order("id").range(off, off + 999);
          if (from) q = q.gte("start_time", from);
          if (to) q = q.lt("start_time", nextDay(to));
          const { data, error } = await q;
          if (error) throw error;
          for (const e of data as any[]) {
            const g = groups.get(e.user_id) ?? { user_id: e.user_id, name: e.profiles?.name ?? null, total_hours: 0, registos: 0 };
            g.total_hours += Number(e.duration_hours) || 0; g.registos++;
            groups.set(e.user_id, g);
          }
          if (data.length < 1000) break;
        }
        const data = [...groups.values()].map((g) => ({ ...g, total_hours: Math.round(g.total_hours * 100) / 100 })).sort((a, b) => b.total_hours - a.total_hours);
        return json({ data, count: data.length });
      }
      case "resumo_dia": {
        const date = str(p.date ?? p.data, 10);
        if (!isDate(date)) return json({ error: "date must be YYYY-MM-DD" }, 400);
        const counts: Record<string, number> = { pending: 0, in_progress: 0, completed: 0, paused: 0 };
        const { data, error } = await db.from("work_orders").select("status").gte("scheduled_date", date!).lt("scheduled_date", nextDay(date!)).limit(5000);
        if (error) throw error;
        for (const r of data as any[]) counts[r.status] = (counts[r.status] ?? 0) + 1;
        return json({ data: counts });
      }
      case "equipamentos_cliente": {
        if (typeof p.client_search !== "string" || !p.client_search.trim() || p.client_search.length > 100) {
          return json({ error: "client_search must be a non-empty string of at most 100 characters" }, 400);
        }
        const search = p.client_search.trim().toLocaleLowerCase("pt-PT");
        const { data: rows, error } = await db.from("work_orders")
          .select("reference, title, client:profiles!work_orders_client_id_fkey(id, name, company_name), work_order_equipments(*, equipments(id, name, brand, model, category, location))")
          .order("scheduled_date", { ascending: false, nullsFirst: false })
          .limit(100);
        if (error) throw error;
        const data = (rows ?? []).filter((row: any) =>
          [row.client?.name, row.client?.company_name].some((value) =>
            typeof value === "string" && value.toLocaleLowerCase("pt-PT").includes(search)));
        return json({ data, count: data.length });
      }
      case "materiais_usados": {
        for (const key of ["date_from", "date_to"]) {
          const value = p[key];
          if (value !== undefined && (typeof value !== "string" || !isDate(value) ||
              !Number.isFinite(Date.parse(value + "T00:00:00Z")) ||
              new Date(value + "T00:00:00Z").toISOString().slice(0, 10) !== value)) {
            return json({ error: `${key} must be a valid YYYY-MM-DD date` }, 400);
          }
        }
        const from = str(p.date_from, 10), to = str(p.date_to, 10);
        if (from && to && from > to) return json({ error: "date_from must not be after date_to" }, 400);
        let q = db.from("work_order_materials")
          .select("*, work_orders!inner(id, reference, title, scheduled_date)")
          .order("id", { ascending: false })
          .limit(200);
        if (from) q = q.gte("work_orders.scheduled_date", from);
        if (to) q = q.lt("work_orders.scheduled_date", nextDay(to));
        const { data, error } = await q;
        if (error) throw error;
        return json({ data, count: data.length });
      }
      case "disponibilidade_equipa": {
        // The app uses employee/manager, not technician/admin. user_roles has
        // no direct profiles FK, so names are fetched through their shared IDs.
        const { data: roles, error: rolesError } = await db.from("user_roles")
          .select("user_id").in("role", ["employee", "manager"]);
        if (rolesError) throw rolesError;
        const ids = [...new Set((roles ?? []).map((role) => role.user_id))];
        if (!ids.length) return json({ data: [], count: 0 });
        const { data: profiles, error: profilesError } = await db.from("profiles")
          .select("id, name").in("id", ids).order("name", { ascending: true });
        if (profilesError) throw profilesError;
        const groups = new Map<string, { user_id: string; name: string | null; open_ots: number; in_progress_ots: number }>(
          ids.map((id) => [id, { user_id: id, name: profiles?.find((profile) => profile.id === id)?.name ?? null, open_ots: 0, in_progress_ots: 0 }]));
        for (let offset = 0; ; offset += 1000) {
          const { data: assignments, error } = await db.from("work_order_assignments")
            .select("user_id, work_orders!inner(status)")
            .in("work_orders.status", ["pending", "in_progress"])
            .order("id", { ascending: true }).range(offset, offset + 999);
          if (error) throw error;
          for (const assignment of assignments as any[]) {
            const group = groups.get(assignment.user_id);
            if (!group) continue;
            group.open_ots++;
            if (assignment.work_orders?.status === "in_progress") group.in_progress_ots++;
          }
          if (assignments.length < 1000) break;
        }
        const data = [...groups.values()].sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "", "pt-PT"));
        return json({ data, count: data.length });
      }
      default:
        return json({ error: `Unknown action '${action}'`, supported: ["listar_ots", "detalhe_ot", "listar_clientes", "registos_horas", "ots_atrasadas", "horas_equipa", "resumo_dia", "equipamentos_cliente", "materiais_usados", "disponibilidade_equipa"] }, 400);
    }
  } catch (e: any) {
    console.error(action, e);
    return json({ error: e?.message ?? "Internal error" }, 500);
  }
});
