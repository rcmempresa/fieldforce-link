import { createClient } from "npm:@supabase/supabase-js@2";
import { generateResponse, GatewayError } from "npm:@lovable.dev/ai-gateway";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "Sem autorização" }, 401);
    const url = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Sem autorização" }, 401);

    const { equipmentId, fault } = await req.json();
    const desc = typeof fault === "string" ? fault.trim().slice(0, 2000) : "";
    if (!equipmentId || desc.length < 5) return json({ error: "Descreva a avaria (mínimo 5 caracteres)." }, 400);

    // Authorization check happens inside the RPC (manager, owner client or assigned technician)
    const { data: hist, error: hErr } = await userClient.rpc("get_equipment_history", { _equipment_id: equipmentId } as never);
    if (hErr) return json({ error: "Sem acesso ao histórico deste equipamento." }, 403);

    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: eq } = await admin.from("equipments").select("name, brand, model, category, manufacture_year").eq("id", equipmentId).maybeSingle();
    const orderIds = ((hist as any)?.orders ?? []).map((o: any) => o.id).slice(0, 30);
    let orders: any[] = [];
    if (orderIds.length) {
      const { data } = await admin.from("work_orders")
        .select("reference, title, description, notes, status, scheduled_date, created_at")
        .in("id", orderIds).order("created_at", { ascending: false });
      orders = data ?? [];
    }
    const historyText = orders.length
      ? orders.map((o) => `- ${o.reference ?? ""} (${(o.scheduled_date ?? o.created_at ?? "").slice(0, 10)}, ${o.status}): ${o.title}. Descricao: ${o.description ?? "-"}. Observacoes: ${o.notes ?? "-"}`).join("\n")
      : "Sem intervencoes anteriores registadas.";

    const response = await generateResponse({
      model: "openai/gpt-6-astra",
      reasoning: { effort: "low" },
      instructions:
        "Es um tecnico senior de manutencao (AVAC, eletricidade, refrigeracao, automatismos). Responde em portugues de Portugal, de forma pratica e concisa. Com base na avaria descrita e no historico do equipamento, sugere verificacoes uteis por ordem de prioridade, causas provaveis e cuidados de seguranca. Refere padroes do historico quando existirem.",
      input: `Equipamento: ${eq?.name ?? "-"} | Marca: ${eq?.brand ?? "-"} | Modelo: ${eq?.model ?? "-"} | Categoria: ${eq?.category ?? "-"} | Ano: ${eq?.manufacture_year ?? "-"}\n\nHistorico de intervencoes:\n${historyText}\n\nAvaria descrita pelo tecnico:\n${desc}\n\nFormato: secoes "Causas provaveis", "Verificacoes sugeridas" (lista numerada), "Padroes no historico", "Seguranca". Usa markdown simples.`,
    });
    const text = (response as any).output_text ??
      ((response as any).output ?? []).flatMap((o: any) => o.content ?? []).filter((c: any) => c.type === "output_text").map((c: any) => c.text).join("\n");
    return json({ suggestion: text || "Sem sugestões." });
  } catch (e) {
    console.error(e);
    if (e instanceof GatewayError) {
      if (e.httpStatus === 429) return json({ error: "Muitos pedidos. Tente daqui a pouco." }, 429);
      if (e.httpStatus === 402) return json({ error: "Créditos de IA esgotados." }, 402);
    }
    return json({ error: "Não foi possível gerar sugestões." }, 500);
  }
});
