import { beforeEach, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { z } from "zod";

// Run the real handler locally with an isolated database double, never live data.
let handler: (request: Request) => Promise<Response>;
let fixtures: Record<string, any[]> = {};
let calls: Array<{ table: string; method: string; args: any[] }> = [];
let authCalls: Array<{ method: string; input: any }> = [];
let authError: any = null;
let failingTable: string | undefined;
const newClientId = "33333333-3333-4333-8333-333333333333";
function createClient() {
  return { auth: { admin: {
    async createUser(input: any) {
      authCalls.push({ method: "createUser", input });
      if (authError) return { data: null, error: authError };
      fixtures.profiles = [...(fixtures.profiles ?? []), { id: newClientId, name: input.user_metadata.name }];
      fixtures.user_roles = [...(fixtures.user_roles ?? []), { user_id: newClientId, role: "client", approved: false }];
      return { data: { user: { id: newClientId } }, error: null };
    },
    async deleteUser(id: string) {
      authCalls.push({ method: "deleteUser", input: id });
      for (const table of ["profiles", "user_roles"]) fixtures[table] = (fixtures[table] ?? []).filter(row => row.id !== id && row.user_id !== id);
      return { error: null };
    },
  } }, from(table: string) {
    const operations: Array<{ method: string; args: any[] }> = [];
    const query: any = {};
    for (const method of ["select", "in", "order", "limit", "gte", "lt", "range", "ilike", "update", "eq", "or", "insert", "upsert", "delete", "single"]) {
      query[method] = (...args: any[]) => {
        operations.push({ method, args });
        calls.push({ table, method, args });
        return query;
      };
    }
    query.then = (resolve: any, reject: any) => {
      if (table === failingTable) return Promise.resolve({ data: null, error: { message: "Test persistence failure" } }).then(resolve, reject);
      let data = [...(fixtures[table] ?? [])];
      const get = (row: any, path: string) => path.split(".").reduce((value, key) => value?.[key], row);
      for (const { method, args } of operations) {
        if (method === "eq") data = data.filter((row) => get(row, args[0]) === args[1]);
        if (method === "ilike") data = data.filter((row) => String(get(row, args[0])).toLowerCase().includes(args[1].replace(/%/g, "").toLowerCase()));
        if (method === "or") data = data.filter((row) => args[0].split(",").some((condition: string) => {
          const [field, , value] = condition.split(".");
          const target = args[1]?.referencedTable ? get(row, args[1].referencedTable) : row;
          return String(target?.[field] ?? "").toLowerCase().includes(value.replace(/%/g, "").toLowerCase());
        }));
        if (method === "in") data = data.filter((row) => args[1].includes(get(row, args[0])));
        if (method === "gte") data = data.filter((row) => get(row, args[0]) >= args[1]);
        if (method === "lt") data = data.filter((row) => get(row, args[0]) < args[1]);
      }
      data.sort((a, b) => {
        for (const { args } of operations.filter(op => op.method === "order")) {
          const left = get(a, args[0]), right = get(b, args[0]);
          const result = left == null || right == null
            ? (left == right ? 0 : (left == null ? 1 : -1) * (args[1]?.nullsFirst ? -1 : 1))
            : String(left).localeCompare(String(right)) * (args[1]?.ascending === false ? -1 : 1);
          if (result) return result;
        }
        return 0;
      });
      const range = operations.filter(op => op.method === "range").at(-1);
      if (range) data = data.slice(range.args[0], range.args[1] + 1);
      const limit = operations.filter(op => op.method === "limit").at(-1);
      if (limit) data = data.slice(0, limit.args[0]);
      const update = operations.find((operation) => operation.method === "update");
      if (update) for (const row of data) Object.assign(row, update.args[0]);
      const upsert = operations.find(operation => operation.method === "upsert");
      if (upsert) {
        const row = data.find(row => row.user_id === upsert.args[0].user_id && row.role === upsert.args[0].role);
        if (row) Object.assign(row, upsert.args[0]);
        else fixtures[table] = [...(fixtures[table] ?? []), upsert.args[0]];
      }
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

beforeEach(() => { fixtures = {}; calls = []; authCalls = []; authError = null; failingTable = undefined; });
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
  expect(body.data.map((row: any) => row.id)).toEqual([2, 1]);
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

test("atualizar_estado_ot accepts invoiced and changes only status", async () => {
  fixtures.work_orders = [{ id: "ot1", reference: "WO-2026-0688", status: "completed", notes: "Preservar" }];
  const result = await request("atualizar_estado_ot", { reference: "0688", status: "invoiced" });
  expect(result.status).toBe(200);
  expect(fixtures.work_orders[0]).toEqual({ id: "ot1", reference: "WO-2026-0688", status: "invoiced", notes: "Preservar" });
});
test("editar_cliente updates aliases and returns the updated company name without modifying staff", async () => {
  seedWriteFixtures();
  fixtures.profiles[0].name = "Empresa técnico";
  const result = await request("editar_cliente", { client_search: "Empresa", telefone: "123456789", morada: "Rua Nova", nome: "Nome novo", empresa: "Empresa nova", role: "manager" });
  expect(result.status).toBe(200);
  expect(fixtures.profiles[1]).toEqual({ id: "client1", name: "Nome novo", company_name: "Empresa nova", phone: "123456789", address: "Rua Nova" });
  expect(fixtures.profiles[0].name).toBe("Empresa técnico");
  expect(result.body.data).toEqual({ id: "client1", name: "Empresa nova", updated: ["phone", "address", "name", "company_name"] });
});
test("editar_cliente rejects ambiguous and missing clients without writing", async () => {
  seedWriteFixtures();
  expect((await request("editar_cliente", { client_search: "Duarte", phone: "123" })).status).toBe(404);
  fixtures.user_roles.push({ user_id: "client2", role: "client" });
  fixtures.profiles.push({ id: "client2", name: "Outro", company_name: "Empresa dois" });
  const result = await request("editar_cliente", { client_search: "Empresa", phone: "123" });
  expect(result.status).toBe(400);
  expect(result.body.matches).toEqual(["Empresa", "Empresa dois"]);
  expect(calls.some((call) => call.method === "update")).toBe(false);
});
test("editar_cliente rejects empty updates, missing searches and oversized fields", async () => {
  for (const params of [{ client_search: "Empresa" }, { phone: "123" }, { client_search: "Empresa", phone: "x".repeat(51) }]) {
    expect((await request("editar_cliente", params)).status).toBe(400);
  }
  expect(calls).toHaveLength(0);
});
test("apagar_registo_horas deletes only the selected employee entry within the full date", async () => {
  seedWriteFixtures();
  fixtures.time_entries = [
    { id: "e1", work_order_id: "ot1", user_id: technicianId, start_time: "2026-10-30T23:59:59Z", duration_hours: 2 },
    { id: "e2", work_order_id: "ot1", user_id: "other", start_time: "2026-10-30T08:00:00Z", duration_hours: 3 },
    { id: "e3", work_order_id: "ot1", user_id: technicianId, start_time: "2026-10-31T00:00:00Z", duration_hours: 4 },
    { id: "e4", work_order_id: "ot2", user_id: technicianId, start_time: "2026-10-30T08:00:00Z", duration_hours: 5 },
  ];
  const result = await request("apagar_registo_horas", { reference: "0688", data: "2026-10-30", user_id: technicianId });
  expect(result.status).toBe(200);
  expect(result.body.data).toEqual({ reference: "WO-2026-0688", deleted_hours: 2, date: "2026-10-30" });
  expect(fixtures.time_entries.map((entry) => entry.id)).toEqual(["e2", "e3", "e4"]);
});
test("apagar_registo_horas defaults to today", async () => {
  seedWriteFixtures();
  const date = new Date().toISOString().slice(0, 10);
  fixtures.time_entries = [{ id: "e1", work_order_id: "ot1", start_time: `${date}T08:00:00Z`, duration_hours: 1 }];
  const result = await request("apagar_registo_horas", { reference: "0688" });
  expect(result.status).toBe(200);
  expect(result.body.data.date).toBe(date);
  expect(fixtures.time_entries).toEqual([]);
});
test("apagar_registo_horas refuses multiple entries and missing records without deletion", async () => {
  seedWriteFixtures();
  expect((await request("apagar_registo_horas", { reference: "0688", date: "2026-10-30" })).status).toBe(404);
  fixtures.time_entries = [1, 2].map((id) => ({ id, work_order_id: "ot1", start_time: "2026-10-30T08:00:00Z", duration_hours: id, profiles: { name: "Duarte" } }));
  const result = await request("apagar_registo_horas", { reference: "0688", date: "2026-10-30" });
  expect(result.status).toBe(400);
  expect(result.body.entries).toEqual([1, 2].map((id) => ({ id, hours: id, time: "2026-10-30T08:00:00Z", technician: "Duarte" })));
  expect(calls.some((call) => call.method === "delete")).toBe(false);
});
test("apagar_registo_horas rejects invalid input and ambiguous references", async () => {
  for (const params of [{ date: "2026-02-30" }, { user_id: "invalid" }]) {
    expect((await request("apagar_registo_horas", { reference: "0688", ...params })).status).toBe(400);
  }
  expect(calls).toHaveLength(0);
  seedWriteFixtures();
  fixtures.work_orders.push({ id: "ot2", reference: "WO-2025-0688" });
  expect((await request("apagar_registo_horas", { reference: "0688" })).status).toBe(400);
  expect(calls.some((call) => call.method === "delete")).toBe(false);
});
test("client editing and hour deletion require agent secret and appear in supported actions", async () => {
  for (const action of ["editar_cliente", "apagar_registo_horas"]) {
    expect((await request(action, {}, "wrong")).status).toBe(401);
  }
  expect(calls).toHaveLength(0);
  const result = await request("unknown");
  expect(result.body.supported).toContain("editar_cliente");
  expect(result.body.supported).toContain("apagar_registo_horas");
});
test("criar_orcamento calcula totais com IVA 22% e insere como rascunho", async () => {
  seedWriteFixtures();
  fixtures.profiles[1] = { id: "client1", name: "Cliente", company_name: "Empresa", phone: "910000000", address: "Rua 1" };
  fixtures.client_emails = [{ user_id: "client1", email: "c@x.pt", created_at: "2026-01-01" }];
  const result = await request("criar_orcamento", { client_search: "Empresa",
    items: [{ description: "Mão de obra", quantity: 2, unit: "h", unit_price: 25 }, { description: "Filtro", quantity: "1", unit_price: 10.5 }] });
  expect(result.status).toBe(200);
  const insert = calls.find((call) => call.table === "quotes" && call.method === "insert")?.args[0];
  expect(insert).toMatchObject({ client_id: "client1", client_name: "Empresa", client_phone: "910000000",
    client_address: "Rua 1", client_email: "c@x.pt", status: "rascunho", requires_visit: false, valid_days: 30,
    subtotal: 60.5, vat_rate: 0.22, vat_amount: 13.31, total: 73.81 });
  expect(insert.items[0].total).toBe(50);
  expect(insert.items[1].total).toBe(10.5);
  expect(insert).not.toHaveProperty("reference");
  expect(result.body.data.reference).toBeUndefined();
});
test("criar_orcamento rejeita cliente desconhecido, ambíguo e itens inválidos sem inserir", async () => {
  seedWriteFixtures();
  expect((await request("criar_orcamento", { client_search: "Ninguém", items: [{ description: "X", quantity: 1, unit_price: 1 }] })).status).toBe(404);
  fixtures.user_roles.push({ user_id: "client2", role: "client" });
  fixtures.profiles.push({ id: "client2", name: "Outro", company_name: "Empresa Dois" });
  expect((await request("criar_orcamento", { client_search: "Empresa", items: [{ description: "X", quantity: 1, unit_price: 1 }] })).status).toBe(400);
  for (const items of [[], [{ description: "X", quantity: 0, unit_price: 1 }], [{ description: "X", quantity: 1, unit_price: -5 }]]) {
    expect((await request("criar_orcamento", { client_search: "Empresa", items })).status).toBe(400);
  }
  expect(calls.some((call) => call.table === "quotes" && call.method === "insert")).toBe(false);
});
test("listar_orcamentos devolve ordenado por created_at desc com limite 10 e filtro de estado", async () => {
  fixtures.quotes = [
    { reference: "ORC-2026-0002", client_name: "B", total: 20, status: "enviado", created_at: "2026-10-02" },
    { reference: "ORC-2026-0001", client_name: "A", total: 10, status: "rascunho", created_at: "2026-10-01" },
  ];
  const { body } = await request("listar_orcamentos", { status: "enviado" });
  expect(body.data).toEqual([{ reference: "ORC-2026-0002", client_name: "B", total: 20, status: "enviado", created_at: "2026-10-02" }]);
  expect(calls).toContainEqual({ table: "quotes", method: "limit", args: [10] });
  expect(calls).toContainEqual({ table: "quotes", method: "order", args: ["created_at", { ascending: false }] });
});
test("criar_orcamento e listar_orcamentos rejeitam segredo errado sem acesso à base de dados", async () => {
  for (const action of ["criar_orcamento", "listar_orcamentos"]) {
    expect((await request(action, {}, "wrong")).status).toBe(401);
  }
  expect(calls).toHaveLength(0);
});

test("criar_cliente saves trimmed contact fields and assigns approved client only", async () => {
  const result = await request("criar_cliente", { name: " Ana ", company_name: " Empresa ", phone: " 910000000 ",
    email: " ana@example.pt ", address: " Rua 1 ", role: "manager" });
  expect(result.status).toBe(200);
  expect(result.body.data).toEqual({ id: newClientId, name: "Ana", company_name: "Empresa" });
  expect(authCalls[0].input).toEqual({ email: "ana@example.pt", email_confirm: true, user_metadata: { name: "Ana" } });
  expect(fixtures.profiles[0]).toMatchObject({ name: "Ana", company_name: "Empresa", phone: "910000000", address: "Rua 1" });
  expect(fixtures.user_roles).toEqual([{ user_id: newClientId, role: "client", approved: true }]);
  expect(fixtures.client_emails[0]).toMatchObject({ user_id: newClientId, email: "ana@example.pt" });
});
test("criar_cliente without email creates distinct placeholders but no contact email", async () => {
  await request("criar_cliente", { name: "Cliente" });
  await request("criar_cliente", { name: "Outro" });
  expect(authCalls[0].input.email).toMatch(/^cliente_[a-f0-9-]+@placeholder\.nrtechsolucion\.pt$/);
  expect(authCalls[0].input.email).not.toBe(authCalls[1].input.email);
  expect(fixtures.client_emails).toBeUndefined();
  expect(fixtures.profiles[0]).toMatchObject({ company_name: null, phone: null, address: null });
});
test("criar_cliente rejects missing names and invalid or oversized fields before account creation", async () => {
  for (const params of [{}, { name: " " }, { name: "Cliente", email: "invalid" }, { name: "Cliente", company_name: "x".repeat(201) },
    { name: "Cliente", phone: "x".repeat(51) }, { name: "Cliente", address: "x".repeat(501) }]) {
    expect((await request("criar_cliente", params)).status).toBe(400);
  }
  expect(authCalls).toHaveLength(0);
  expect(calls).toHaveLength(0);
});
test("criar_cliente returns 409 for an existing email without modifying profiles", async () => {
  authError = { code: "email_exists", message: "Email already registered" };
  expect((await request("criar_cliente", { name: "Cliente", email: "ana@example.pt" })).status).toBe(409);
  expect(calls.some(call => ["insert", "update", "upsert"].includes(call.method))).toBe(false);
});
test("criar_cliente removes its new account if profile, role or email persistence fails", async () => {
  for (const table of ["profiles", "user_roles", "client_emails"]) {
    failingTable = table;
    expect((await request("criar_cliente", { name: "Cliente", email: "ana@example.pt" })).status).toBe(500);
    expect(authCalls.at(-1)).toEqual({ method: "deleteUser", input: newClientId });
    expect(fixtures.profiles ?? []).toEqual([]);
    expect(fixtures.user_roles ?? []).toEqual([]);
  }
});
test("criar_cliente requires the agent secret and is advertised in supported actions", async () => {
  expect((await request("criar_cliente", { name: "Cliente" }, "wrong")).status).toBe(401);
  expect(authCalls).toHaveLength(0);
  expect((await request("unknown")).body.supported).toContain("criar_cliente");
});

test("listar_contratos filters active/ended and searches client company or name", async () => {
  fixtures.maintenance_contracts = [
    { id: "a", status: "active", next_date: "2026-11-10", client: { name: "Ana", company_name: "NR Lda" }, maintenance_contract_equipments: [{ equipments: { name: "AC" } }] },
    { id: "b", status: "ended", next_date: "2026-11-01", client: { name: "NR Pessoa" } },
    { id: "c", status: "active", client: { name: "Outro" } },
  ];
  expect((await request("listar_contratos", { status: "active", client_search: "nr" })).body.data.map((r: any) => r.id)).toEqual(["a"]);
  expect((await request("listar_contratos", { status: "ended", client_search: "nr" })).body.data.map((r: any) => r.id)).toEqual(["b"]);
  expect((await request("listar_contratos", { client_search: "nr" })).body.data).toHaveLength(2);
});
test("listar_contratos reads past 1000 contracts and rejects invalid status", async () => {
  fixtures.maintenance_contracts = Array.from({ length: 1001 }, (_, id) => ({ id: String(id), status: "active" }));
  expect((await request("listar_contratos")).body.data).toHaveLength(1001);
  expect((await request("listar_contratos", { status: "invalid" })).status).toBe(400);
});
const equipmentId = "44444444-4444-4444-8444-444444444444";
function seedHistory() {
  fixtures.equipments = [{ id: equipmentId, name: "Ar condicionado" }];
  fixtures.work_order_equipments = Array.from({ length: 25 }, (_, id) => ({ id: String(id), equipment_id: equipmentId, work_order_id: `ot${id}`, work_orders: { client: { name: "Ana", company_name: "Empresa NR" } } }));
  fixtures.work_orders = Array.from({ length: 25 }, (_, id) => ({ id: `ot${id}`, reference: `WO-${id}`, created_at: `2026-11-${String(id + 1).padStart(2, "0")}` }));
  fixtures.maintenance_reports = Array.from({ length: 25 }, (_, id) => ({ id: String(id), work_order_id: `ot${id}`, report_type: "climatizacao", report_date: `2026-11-${String(id + 1).padStart(2, "0")}`, technician_name: "Duarte" }));
}
test("historico_equipamento by UUID returns latest 20 orders and reports", async () => {
  seedHistory();
  const result = await request("historico_equipamento", { equipment_id: equipmentId });
  expect(result.status).toBe(200);
  expect(result.body.data.equipment_name).toBe("Ar condicionado");
  expect(result.body.data.orders).toHaveLength(20);
  expect(result.body.data.orders[0].reference).toBe("WO-24");
  expect(result.body.data.orders.at(-1).reference).toBe("WO-5");
  expect(result.body.data.reports).toHaveLength(20);
  expect(result.body.data.reports[0].report_date).toBe("2026-11-25");
  expect(calls.filter(c => c.table === "maintenance_reports" && c.method === "in")[0].args[0]).toBe("work_order_id");
});
test("historico_equipamento supports equipment name and client via linked OTs", async () => {
  seedHistory();
  expect((await request("historico_equipamento", { equipment_search: "CONDICIONADO" })).body.data.orders).toHaveLength(20);
  expect((await request("historico_equipamento", { client_search: "empresa nr" })).body.data.equipment_name).toBe("Ar condicionado");
  expect((await request("historico_equipamento", { client_search: "ana" })).status).toBe(200);
  expect((await request("historico_equipamento", { equipment_id: equipmentId, client_search: "outro" })).status).toBe(404);
});
test("historico_equipamento rejects missing parameters and invalid UUID", async () => {
  const result = await request("historico_equipamento");
  expect(result.status).toBe(400);
  expect(result.body.error).toBe("Fornece equipment_id, equipment_search ou client_search");
  expect((await request("historico_equipamento", { equipment_id: "bad" })).status).toBe(400);
  expect((await request("historico_equipamento", { equipment_search: " " })).status).toBe(400);
  expect(calls).toHaveLength(0);
});
test("historico_equipamento returns empty history and rejects ambiguous searches", async () => {
  fixtures.equipments = [{ id: equipmentId, name: "AC" }];
  expect((await request("historico_equipamento", { equipment_id: equipmentId })).body.data).toEqual({ equipment_name: "AC", orders: [], reports: [] });
  fixtures.equipments.push({ id: "other", name: "AC segundo" });
  expect((await request("historico_equipamento", { equipment_search: "AC" })).status).toBe(409);
});
test("criar_cliente rejects existing contact email case-insensitively before creating account", async () => {
  fixtures.client_emails = [{ id: "email1", email: "ANA@example.pt" }];
  expect((await request("criar_cliente", { name: "Ana", email: "ana@example.pt" })).status).toBe(409);
  expect(authCalls).toHaveLength(0);
});
test("criar_cliente rejects existing client phone only when email is absent", async () => {
  fixtures.user_roles = [{ user_id: "client1", role: "client" }, { user_id: "employee1", role: "employee" }];
  fixtures.profiles = [{ id: "client1", phone: "910000000" }, { id: "employee1", phone: "920000000" }];
  expect((await request("criar_cliente", { name: "Ana", phone: "910000000" })).status).toBe(409);
  expect(authCalls).toHaveLength(0);
  expect((await request("criar_cliente", { name: "Ana", phone: "910000000", email: "new@example.pt" })).status).toBe(200);
  expect((await request("criar_cliente", { name: "Bruno", phone: "920000000" })).status).toBe(200);
});
test("uploaded actions require secret and are advertised", async () => {
  for (const action of ["listar_contratos", "historico_equipamento", "criar_cliente"]) {
    expect((await request(action, {}, "wrong")).status).toBe(401);
    expect((await request("unknown")).body.supported).toContain(action);
  }
  expect(calls).toHaveLength(0);
});
