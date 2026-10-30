import { beforeEach, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { z } from "zod";

// Run the real handler locally with an isolated database double, never live data.
let handler: (request: Request) => Promise<Response>;
let fixtures: Record<string, any[]> = {};
let calls: Array<{ table: string; method: string; args: any[] }> = [];
function createClient() {
  return { from(table: string) {
    const operations: Array<{ method: string; args: any[] }> = [];
    const query: any = {};
    for (const method of ["select", "in", "order", "limit", "gte", "lt", "range", "ilike", "update", "eq", "or", "insert", "delete", "single"]) {
      query[method] = (...args: any[]) => {
        operations.push({ method, args });
        calls.push({ table, method, args });
        return query;
      };
    }
    query.then = (resolve: any, reject: any) => {
      let data = [...(fixtures[table] ?? [])];
      const get = (row: any, path: string) => path.split(".").reduce((value, key) => value?.[key], row);
      for (const { method, args } of operations) {
        if (method === "eq") data = data.filter((row) => get(row, args[0]) === args[1]);
        if (method === "ilike") data = data.filter((row) => String(get(row, args[0])).toLowerCase().includes(args[1].replace(/%/g, "").toLowerCase()));
        if (method === "or") data = data.filter((row) => args[0].split(",").some((condition: string) => {
          const [field, , value] = condition.split(".");
          return String(row[field] ?? "").toLowerCase().includes(value.replace(/%/g, "").toLowerCase());
        }));
        if (method === "in") data = data.filter((row) => args[1].includes(get(row, args[0])));
        if (method === "gte") data = data.filter((row) => get(row, args[0]) >= args[1]);
        if (method === "lt") data = data.filter((row) => get(row, args[0]) < args[1]);
        if (method === "limit") data = data.slice(0, args[0]);
        if (method === "range") data = data.slice(args[0], args[1] + 1);
      }
      const update = operations.find((operation) => operation.method === "update");
      if (update) for (const row of data) Object.assign(row, update.args[0]);
      if (operations.some((operation) => operation.method === "delete")) fixtures[table] = (fixtures[table] ?? []).filter((row) => !data.includes(row));
      const insert = operations.find((operation) => operation.method === "insert");
      if (insert) {
        const row = { id: "new-id", ...(table === "work_orders" ? { reference: "WO-2026-0999" } : {}), ...insert.args[0] };
        fixtures[table] = [...(fixtures[table] ?? []), row];
        data = [row];
      }
      if (operations.some((operation) => operation.method === "single")) return Promise.resolve({ data: data[0] ?? null, error: null }).then(resolve, reject);
      return Promise.resolve({ data, error: null }).then(resolve, reject);
    };
    return query;
  } };
}
const source = readFileSync(new URL("./index.ts", import.meta.url), "utf8")
  .replace(/^import .*;\n/gm, "");
const Deno = {
  env: { get: (key: string) => key === "EMPREGADO_DIGITAL_SECRET" ? "test-only-secret" : "test-only-config" },
  serve: (callback: typeof handler) => { handler = callback; },
};
new Function("createClient", "corsHeaders", "Deno", "z", new Bun.Transpiler({ loader: "ts" }).transformSync(source))(
  createClient, { "Access-Control-Allow-Origin": "*" }, Deno, z);

beforeEach(() => { fixtures = {}; calls = []; });
async function request(action: string, params = {}, secret = "test-only-secret") {
  const response = await handler(new Request("https://example.invalid", {
    method: "POST", headers: { "x-agent-secret": secret, "Content-Type": "application/json" },
    body: JSON.stringify({ action, params }),
  }));
  return { status: response.status, body: await response.json() };
}

test("equipamentos_cliente matches name or company case-insensitively and caps query at 100", async () => {
  fixtures.work_orders = [
    { reference: "1", client: { name: "Rodrigo Miranda" }, work_order_equipments: [{ equipments: { name: "AC" } }] },
    { reference: "2", client: { name: "Outro", company_name: "MIRANDA Lda" } },
    { reference: "3", client: { name: "Outro" } },
  ];
  const { body } = await request("equipamentos_cliente", { client_search: "miranda" });
  expect(body.data.map((row: any) => row.reference)).toEqual(["1", "2"]);
  expect(body.count).toBe(2);
  expect(calls).toContainEqual({ table: "work_orders", method: "limit", args: [100] });
});
test("equipamentos_cliente requires client_search", async () => {
  expect((await request("equipamentos_cliente")).status).toBe(400);
});
test("materiais_usados includes the whole end day and excludes the next day", async () => {
  fixtures.work_order_materials = ["2026-10-26T23:59:00Z", "2026-10-27T00:00:00Z", "2026-10-27T23:59:59Z", "2026-10-28T00:00:00Z"]
    .map((scheduled_date, id) => ({ id, work_orders: { scheduled_date } }));
  const { body } = await request("materiais_usados", { date_from: "2026-10-27", date_to: "2026-10-27" });
  expect(body.data.map((row: any) => row.id)).toEqual([1, 2]);
  expect(body.count).toBe(2);
  expect(calls).toContainEqual({ table: "work_order_materials", method: "limit", args: [200] });
});
test("materiais_usados rejects invalid calendar dates and reversed ranges", async () => {
  expect((await request("materiais_usados", { date_to: "2026-02-30" })).status).toBe(400);
  expect((await request("materiais_usados", { date_from: "2026-10-28", date_to: "2026-10-27" })).status).toBe(400);
});
test("disponibilidade_equipa includes idle staff, excludes clients and counts only pending/in_progress", async () => {
  fixtures.user_roles = [{ user_id: "a", role: "employee" }, { user_id: "b", role: "manager" }, { user_id: "c", role: "client" }];
  fixtures.profiles = [{ id: "a", name: "Ana" }, { id: "b", name: "Bruno" }];
  fixtures.work_order_assignments = ["pending", "in_progress", "completed"]
    .map((status) => ({ user_id: "a", work_orders: { status } }));
  const { body } = await request("disponibilidade_equipa");
  expect(body.data).toEqual([
    { user_id: "a", name: "Ana", open_ots: 2, in_progress_ots: 1 },
    { user_id: "b", name: "Bruno", open_ots: 0, in_progress_ots: 0 },
  ]);
  expect(body.count).toBe(2);
});
test("disponibilidade_equipa counts assignments beyond the first 1000", async () => {
  fixtures.user_roles = [{ user_id: "a", role: "employee" }];
  fixtures.profiles = [{ id: "a", name: "Ana" }];
  fixtures.work_order_assignments = Array.from({ length: 1001 }, () => ({ user_id: "a", work_orders: { status: "in_progress" } }));
  const { body } = await request("disponibilidade_equipa");
  expect(body.data[0].open_ots).toBe(1001);
  expect(body.data[0].in_progress_ots).toBe(1001);
});
test("all new actions reject an incorrect agent secret", async () => {
  for (const action of ["equipamentos_cliente", "materiais_usados", "disponibilidade_equipa"]) {
    expect((await request(action, {}, "wrong")).status).toBe(401);
  }
  expect(calls.length).toBe(0);
});

test("atualizar_estado_ot changes only status, ignoring pause_reason", async () => {
  for (const status of ["paused", "pending"]) {
    fixtures.work_orders = [{ id: "test-ot", reference: "WO-2026-0688", status: "in_progress", notes: "Preservar" }];
    const result = await request("atualizar_estado_ot", { reference: "0688", status, pause_reason: "falta_material" });
    expect(result.status).toBe(200);
    expect(result.body.data).toEqual({ reference: "WO-2026-0688", status });
    expect(fixtures.work_orders[0]).toEqual({ id: "test-ot", reference: "WO-2026-0688", status, notes: "Preservar" });
    expect(calls.filter((call) => call.method === "update").at(-1)?.args).toEqual([{ status }]);
  }
});

const technicianId = "11111111-1111-4111-8111-111111111111";
function seedWriteFixtures() {
  fixtures.work_orders = [{ id: "ot1", reference: "WO-2026-0688", needs_scheduling: true }];
  fixtures.user_roles = [{ user_id: technicianId, role: "employee" }, { user_id: "client1", role: "client" }];
  fixtures.profiles = [{ id: technicianId, name: "Duarte" }, { id: "client1", name: "Cliente", company_name: "Empresa" }];
}
test("remover_tecnico_ot removes only the selected technician assignment", async () => {
  seedWriteFixtures();
  fixtures.work_order_assignments = [{ work_order_id: "ot1", user_id: technicianId }, { work_order_id: "ot2", user_id: technicianId }];
  expect((await request("remover_tecnico_ot", { reference: "0688", tecnico_nome: "Duarte" })).status).toBe(200);
  expect(fixtures.work_order_assignments).toEqual([{ work_order_id: "ot2", user_id: technicianId }]);
});
test("agendar_ot defaults to 09:00 UTC and clears needs_scheduling", async () => {
  seedWriteFixtures();
  expect((await request("agendar_ot", { reference: "0688", data: "2026-10-29" })).status).toBe(200);
  expect(fixtures.work_orders[0].scheduled_date).toBe("2026-10-29T09:00:00Z");
  expect(fixtures.work_orders[0].needs_scheduling).toBe(false);
});
test("agendar_ot rejects invalid dates and times before writing", async () => {
  for (const params of [{ date: "2026-02-30" }, { date: "2026-10-29", time: "24:00" }]) {
    expect((await request("agendar_ot", { reference: "0688", ...params })).status).toBe(400);
  }
  expect(calls).toHaveLength(0);
});
test("new write actions reject ambiguous references without mutation", async () => {
  seedWriteFixtures();
  fixtures.work_orders.push({ id: "ot2", reference: "WO-2025-0688" });
  expect((await request("agendar_ot", { reference: "0688", date: "2026-10-29" })).status).toBe(400);
  expect(calls.some((call) => call.method === "update")).toBe(false);
});
test("criar_ot uses pending/repair/medium defaults and leaves reference generation to database", async () => {
  seedWriteFixtures();
  const result = await request("criar_ot", { title: "Reparação", client_search: "Empresa", tecnico_nome: "Duarte" });
  expect(result.status).toBe(200);
  const ot = fixtures.work_orders.at(-1);
  expect(ot).toMatchObject({ title: "Reparação", client_id: "client1", status: "pending", service_type: "repair", priority: "medium", needs_scheduling: true, scheduled_date: null });
  expect(calls.find((call) => call.table === "work_orders" && call.method === "insert")?.args[0]).not.toHaveProperty("reference");
  expect(fixtures.work_order_assignments).toEqual([{ id: "new-id", work_order_id: "new-id", user_id: technicianId }]);
});
test("criar_ot rejects ambiguous technicians and invalid service/priority before insert", async () => {
  seedWriteFixtures();
  fixtures.user_roles.push({ user_id: "other", role: "manager" });
  fixtures.profiles.push({ id: "other", name: "Duarte Segundo" });
  expect((await request("criar_ot", { titulo: "Teste", client_search: "Empresa", tecnico_nome: "Duarte" })).status).toBe(400);
  for (const params of [{ service_type: "bad" }, { priority: "bad" }, { date: "2026-02-30" }]) {
    expect((await request("criar_ot", { titulo: "Teste", client_search: "Empresa", ...params })).status).toBe(400);
  }
  expect(calls.some((call) => call.method === "insert")).toBe(false);
});
test("registar_horas_ot stores hours at 08:00 with valid labor regime and handles day rollover", async () => {
  seedWriteFixtures();
  const result = await request("registar_horas_ot", { reference: "0688", user_id: technicianId, horas: 16.5, date: "2026-10-28" });
  expect(result.status).toBe(200);
  expect(fixtures.time_entries[0]).toMatchObject({ duration_hours: 16.5, start_time: "2026-10-28T08:00:00Z", end_time: "2026-10-29T00:30:00.000Z", work_regime: "labor" });
  expect(result.body.data.hours).toBe(16.5);
});
test("registar_horas_ot rejects nonpositive hours and invalid employee IDs", async () => {
  for (const horas of [0, -1, "2"]) {
    expect((await request("registar_horas_ot", { reference: "0688", user_id: technicianId, horas })).status).toBe(400);
  }
  expect((await request("registar_horas_ot", { reference: "0688", user_id: "invalid", horas: 2 })).status).toBe(400);
  expect(calls).toHaveLength(0);
});
test("four write actions reject wrong secret without database access", async () => {
  for (const action of ["remover_tecnico_ot", "agendar_ot", "criar_ot", "registar_horas_ot"]) {
    expect((await request(action, {}, "wrong")).status).toBe(401);
  }
  expect(calls).toHaveLength(0);
});

test("editar_ot updates Portuguese aliases and false flags without changing other fields", async () => {
  seedWriteFixtures();
  const result = await request("editar_ot", { reference: "0688", titulo: "Novo título", descricao: "Descrição",
    morada: "Rua 1", service_type: "maintenance", priority: "urgent", is_after_hours: "false", needs_scheduling: false, status: "completed" });
  expect(result.status).toBe(200);
  expect(fixtures.work_orders[0]).toEqual({ id: "ot1", reference: "WO-2026-0688", title: "Novo título",
    description: "Descrição", address: "Rua 1", service_type: "maintenance", priority: "urgent", is_after_hours: false, needs_scheduling: false });
  expect(result.body.data.updated).toEqual(["title", "description", "service_type", "priority", "address", "is_after_hours", "needs_scheduling"]);
});
test("editar_ot rejects invalid enums, flags and empty updates before database access", async () => {
  for (const fields of [{ priority: "invalid" }, { service_type: "invalid" }, { is_after_hours: "yes" }, {}, { title: " " }]) {
    expect((await request("editar_ot", { reference: "0688", ...fields })).status).toBe(400);
  }
  expect(calls).toHaveLength(0);
});
test("adicionar_material_ot defaults quantity to 1 and unit to un", async () => {
  seedWriteFixtures();
  const result = await request("adicionar_material_ot", { reference: "0688", descricao: "Cabo" });
  expect(result.status).toBe(200);
  expect(fixtures.work_order_materials).toEqual([{ id: "new-id", work_order_id: "ot1", description: "Cabo", quantity: 1, unit: "un" }]);
  expect(result.body.data).toEqual({ reference: "WO-2026-0688", material_id: "new-id" });
});
test("adicionar_material_ot accepts aliases and a verified creator", async () => {
  seedWriteFixtures();
  expect((await request("adicionar_material_ot", { reference: "0688", description: "Cabo", quantidade: "2.5", unidade: "m", created_by: technicianId })).status).toBe(200);
  expect(fixtures.work_order_materials[0]).toMatchObject({ quantity: 2.5, unit: "m", created_by: technicianId });
});
test("adicionar_material_ot rejects invalid quantities and creator IDs", async () => {
  for (const quantity of [0, -1, "invalid", ""]) {
    expect((await request("adicionar_material_ot", { reference: "0688", descricao: "Cabo", quantity })).status).toBe(400);
  }
  expect((await request("adicionar_material_ot", { reference: "0688", descricao: "Cabo", created_by: "bad" })).status).toBe(400);
  expect(calls).toHaveLength(0);
  seedWriteFixtures();
  expect((await request("adicionar_material_ot", { reference: "0688", descricao: "Cabo", created_by: "22222222-2222-4222-8222-222222222222" })).status).toBe(404);
  expect(calls.some((call) => call.method === "insert")).toBe(false);
});
test("remover_material_ot removes only the matching material from the selected OT", async () => {
  seedWriteFixtures();
  fixtures.work_order_materials = [{ id: "m1", work_order_id: "ot1", description: "Cabo elétrico" }, { id: "m2", work_order_id: "ot2", description: "Cabo elétrico" }];
  const result = await request("remover_material_ot", { reference: "0688", descricao: "cabo" });
  expect(result.status).toBe(200);
  expect(result.body.data.removed).toBe("Cabo elétrico");
  expect(fixtures.work_order_materials.map((material) => material.id)).toEqual(["m2"]);
});
test("remover_material_ot rejects missing and ambiguous materials without deleting", async () => {
  seedWriteFixtures();
  expect((await request("remover_material_ot", { reference: "0688", descricao: "Cabo" })).status).toBe(404);
  fixtures.work_order_materials = [{ id: "m1", work_order_id: "ot1", description: "Cabo A" }, { id: "m2", work_order_id: "ot1", description: "Cabo B" }];
  const result = await request("remover_material_ot", { reference: "0688", descricao: "Cabo" });
  expect(result.status).toBe(400);
  expect(result.body.matches).toEqual(["Cabo A", "Cabo B"]);
  expect(calls.some((call) => call.method === "delete")).toBe(false);
});
test("three new actions reject ambiguous references and honor exact references", async () => {
  seedWriteFixtures();
  fixtures.work_orders.push({ id: "ot2", reference: "WO-2025-0688" });
  for (const action of ["editar_ot", "adicionar_material_ot", "remover_material_ot"]) {
    expect((await request(action, { reference: "0688", title: "Title", description: "Cabo" })).status).toBe(400);
  }
  expect(calls.some((call) => ["update", "insert", "delete"].includes(call.method))).toBe(false);
  expect((await request("editar_ot", { reference: "WO-2026-0688", title: "Title" })).status).toBe(200);
  expect(fixtures.work_orders[1]).not.toHaveProperty("title");
});
test("three new actions reject wrong secrets and advertise supported actions", async () => {
  const actions = ["editar_ot", "adicionar_material_ot", "remover_material_ot"];
  for (const action of actions) expect((await request(action, {}, "wrong")).status).toBe(401);
  expect(calls).toHaveLength(0);
  const result = await request("unknown");
  for (const action of actions) expect(result.body.supported).toContain(action);
});