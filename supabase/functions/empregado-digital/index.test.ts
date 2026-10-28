import { beforeEach, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

// Run the real handler locally with an isolated database double, never live data.
let handler: (request: Request) => Promise<Response>;
let fixtures: Record<string, any[]> = {};
let calls: Array<{ table: string; method: string; args: any[] }> = [];
function createClient() {
  return { from(table: string) {
    const operations: Array<{ method: string; args: any[] }> = [];
    const query: any = {};
    for (const method of ["select", "in", "order", "limit", "gte", "lt", "range", "ilike", "update", "eq"]) {
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
        if (method === "in") data = data.filter((row) => args[1].includes(get(row, args[0])));
        if (method === "gte") data = data.filter((row) => get(row, args[0]) >= args[1]);
        if (method === "lt") data = data.filter((row) => get(row, args[0]) < args[1]);
        if (method === "limit") data = data.slice(0, args[0]);
        if (method === "range") data = data.slice(args[0], args[1] + 1);
      }
      const update = operations.find((operation) => operation.method === "update");
      if (update) for (const row of data) Object.assign(row, update.args[0]);
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
new Function("createClient", "corsHeaders", "Deno", new Bun.Transpiler({ loader: "ts" }).transformSync(source))(
  createClient, { "Access-Control-Allow-Origin": "*" }, Deno);

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