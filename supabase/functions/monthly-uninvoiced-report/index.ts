import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const TO = "geral@nrtechsolucion.pt";
const STATUS: Record<string, string> = {
  pending: "Pendente", approved: "Aprovada", in_progress: "Em execução", completed: "Concluída",
  awaiting_approval: "A aguardar aprovação", cancelled: "Cancelada", invoiced: "Faturada",
};
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
const fmtH = (h: number) => { const m = Math.round(h * 60); return m < 60 ? `${m} min` : `${Math.floor(m / 60)}h ${m % 60}min`; };

function isLastDayOfMonth(d: Date) {
  const t = new Date(d); t.setUTCDate(t.getUTCDate() + 1);
  return t.getUTCDate() === 1;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // A manager can force a send (test); otherwise only runs on the last day of the month.
  let force = false;
  const auth = req.headers.get("Authorization") || "";
  try {
    const body = await req.json().catch(() => ({}));
    if (body?.force === true && auth.startsWith("Bearer ")) {
      const { data } = await admin.auth.getUser(auth.slice(7));
      if (data?.user) {
        const { data: ok } = await admin.rpc("has_role", { _user_id: data.user.id, _role: "manager" });
        force = ok === true;
      }
      if (!force) return json({ error: "Unauthorized" }, 401);
    }
  } catch { /* ignore */ }

  if (!force && !isLastDayOfMonth(new Date())) return json({ skipped: "not last day of month" });

  const all: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin
      .from("work_orders")
      .select("reference, title, status, scheduled_date, total_hours, client:profiles!work_orders_client_id_fkey(name, company_name)")
      .not("status", "in", "(invoiced,cancelled)")
      .order("reference")
      .range(from, from + 999);
    if (error) return json({ error: error.message }, 500);
    all.push(...(data || []));
    if (!data || data.length < 1000) break;
  }

  const groups = new Map<string, any[]>();
  for (const w of all) {
    const k = w.client?.company_name || w.client?.name || "Sem cliente";
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(w);
  }
  const month = new Date().toLocaleDateString("pt-PT", { month: "long", year: "numeric", timeZone: "Atlantic/Madeira" });
  const sections = [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([client, wos]) => `
    <h3 style="margin:24px 0 8px;color:#111">${esc(client)} (${wos.length})</h3>
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <tr style="background:#f3f4f6"><th align="left" style="padding:6px">Ref.</th><th align="left" style="padding:6px">OT</th><th align="left" style="padding:6px">Estado</th><th align="left" style="padding:6px">Data</th><th align="right" style="padding:6px">Horas</th></tr>
      ${wos.map((w) => `<tr style="border-top:1px solid #e5e7eb">
        <td style="padding:6px">${esc(w.reference)}</td><td style="padding:6px">${esc(w.title)}</td>
        <td style="padding:6px">${esc(STATUS[w.status] || w.status)}</td>
        <td style="padding:6px">${w.scheduled_date ? new Date(w.scheduled_date).toLocaleDateString("pt-PT") : "Sem data"}</td>
        <td align="right" style="padding:6px">${fmtH(Number(w.total_hours || 0))}</td></tr>`).join("")}
    </table>`).join("");

  const html = `<div style="font-family:Arial,sans-serif;max-width:760px;margin:auto;padding:20px;background:#fff">
    <h2>OTs por faturar — ${esc(month)}</h2>
    <p>Total: <b>${all.length}</b> OTs em ${groups.size} clientes que ainda não estão no estado Faturado.</p>
    ${sections || "<p>Todas as OTs estão faturadas.</p>"}
  </div>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}` },
    body: JSON.stringify({ from: "Ordens de Trabalho <geral@nrtechsolucion.pt>", to: [TO], subject: `OTs por faturar — ${month}`, html }),
  });
  const out = await res.text();
  if (!res.ok) return json({ error: out }, 500);
  return json({ sent: true, count: all.length, clients: groups.size });
});
