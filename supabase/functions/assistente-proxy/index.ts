import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const BASE = "https://agent-production-29c8.up.railway.app/assistente";
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const auth = req.headers.get("Authorization") ?? "";
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: u } = await admin.auth.getUser(auth.replace("Bearer ", ""));
    const user = u?.user;
    if (!user) return json({ error: "Não autenticado" }, 401);

    const { data: roles } = await admin.from("user_roles").select("role, approved").eq("user_id", user.id);
    const ok = (roles ?? []).filter((r: any) => r.approved !== false).map((r: any) => r.role);
    const role = ok.includes("manager") ? "manager" : null;
    if (!role) return json({ error: "Apenas gerentes podem usar o assistente" }, 403);

    const body = await req.json().catch(() => ({}));
    const headers = { "Content-Type": "application/json", "x-agent-secret": Deno.env.get("AGENT_ASSISTANT_SECRET")! };

    if (body.action === "reset") {
      const r = await fetch(`${BASE}/reset`, { method: "POST", headers, body: JSON.stringify({ user_id: user.id }) });
      return json({ ok: r.ok }, r.ok ? 200 : 502);
    }

    const message = String(body.message ?? "").trim();
    if (!message) return json({ error: "Mensagem vazia" }, 400);
    const { data: profile } = await admin.from("profiles").select("name").eq("id", user.id).maybeSingle();
    const r = await fetch(`${BASE}/chat`, {
      method: "POST",
      headers,
      body: JSON.stringify({ message, user_id: user.id, user_name: profile?.name ?? "", role }),
    });
    if (!r.ok) return json({ error: `Agente respondeu ${r.status}` }, 502);
    const data = await r.json();
    return json({ reply: data.reply ?? "" });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
