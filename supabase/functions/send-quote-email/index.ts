import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const Body = z.object({
  quote_id: z.string().uuid(),
  to: z.string().trim().email(),
  pdf_base64: z.string().min(10).max(15_000_000),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "Sem sessão" }, 401);
    const url = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await userClient.auth.getUser(auth.replace("Bearer ", ""));
    if (!user) return json({ error: "Sessão inválida" }, 401);
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: isManager } = await admin.rpc("has_role", { _user_id: user.id, _role: "manager" });
    if (!isManager) return json({ error: "Só gerentes" }, 403);

    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400);
    const { quote_id, to, pdf_base64 } = parsed.data;
    const { data: q } = await admin.from("quotes").select("*").eq("id", quote_id).maybeSingle();
    if (!q) return json({ error: "Orçamento não encontrado" }, 404);

    const key = Deno.env.get("RESEND_API_KEY");
    if (!key) return json({ error: "Serviço de email não configurado" }, 500);
    const esc = (v: string) => v.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
    const eur = (v: number | null) => (v == null ? "-" : `${Number(v).toFixed(2).replace(".", ",")} €`);
    const ref = q.reference ?? "Orçamento";
    const subject = `Orçamento ${ref} — NR Tech Solution`;
    const html = `<div style="font-family:Arial,sans-serif;color:#222">
<p>Olá ${esc(q.client_name || "")},</p>
<p>Segue em anexo o orçamento <strong>${esc(ref)}</strong>.</p>
<table style="border-collapse:collapse">
<tr><td style="padding:4px 12px 4px 0">Subtotal</td><td>${eur(q.subtotal)}</td></tr>
<tr><td style="padding:4px 12px 4px 0">IVA</td><td>${eur(q.vat_amount)}</td></tr>
<tr><td style="padding:4px 12px 4px 0"><strong>Total</strong></td><td><strong>${eur(q.total)}</strong></td></tr>
${q.valid_until ? `<tr><td style="padding:4px 12px 4px 0">Válido até</td><td>${esc(String(q.valid_until).split("-").reverse().join("/"))}</td></tr>` : ""}
</table>
<p>Para qualquer esclarecimento, responda a este email.</p>
<p>Cumprimentos,<br/>NR Tech Solution</p></div>`;
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "NR Tech Solution <geral@nrtechsolucion.pt>",
        to: [to],
        reply_to: "geral@nrtechsolucion.pt",
        subject,
        html,
        attachments: [{ filename: `${ref.replace(/[^\w.\-]/g, "_")}.pdf`, content: pdf_base64.replace(/^data:[^,]*,/, "") }],
      }),
    });
    const ok = res.ok;
    const errText = ok ? null : (await res.text()).slice(0, 300);
    await admin.from("email_logs").insert({
      user_id: q.client_id ?? user.id, email: to, subject, notification_type: "quote_sent",
      status: ok ? "sent" : "failed", error_message: errText, work_order_id: q.work_order_id,
    });
    if (!ok) return json({ error: `Falha no envio: ${errText}` }, 502);
    await admin.from("quotes").update({ status: q.status === "rascunho" ? "enviado" : q.status, sent_at: new Date().toISOString() }).eq("id", quote_id);
    return json({ sent: true });
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message }, 500);
  }
});
