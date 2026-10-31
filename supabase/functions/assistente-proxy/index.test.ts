import { beforeEach, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

// Run the real handler locally with an isolated auth/roles double, never live data.
let handler: (request: Request) => Promise<Response>;
let roles: Array<{ role: string; approved: boolean }> = [];
let user: { id: string } | null = { id: "u1" };
const fetched: string[] = [];

function makeQuery(rows: any[]) {
  const query: any = {
    select: () => query,
    eq: () => query,
    then: (resolve: any) => resolve({ data: rows }),
    maybeSingle: async () => ({ data: rows[0] ?? null }),
  };
  return query;
}

function createClient() {
  return {
    auth: { getUser: async () => ({ data: { user } }) },
    from: () => makeQuery(roles),
  };
}

const source = readFileSync(new URL("./index.ts", import.meta.url), "utf8").replace(/^import .*;\n/gm, "");

new Function(
  "createClient",
  "Deno",
  "fetch",
  new Bun.Transpiler({ loader: "ts" }).transformSync(source)
)(
  createClient,
  {
    serve: (callback: typeof handler) => {
      handler = callback;
    },
    env: { get: () => "dummy-secret" },
  },
  async (url: string) => {
    fetched.push(String(url));
    return new Response(JSON.stringify({ reply: "ok" }));
  }
);

const post = (body: unknown) =>
  handler(
    new Request("http://localhost/assistente-proxy", {
      method: "POST",
      headers: { Authorization: "Bearer token" },
      body: JSON.stringify(body),
    })
  );

beforeEach(() => {
  roles = [];
  user = { id: "u1" };
  fetched.length = 0;
});

test("employee is refused the assistant", async () => {
  roles = [{ role: "employee", approved: true }];
  const res = await post({ message: "ola" });
  expect(res.status).toBe(403);
  expect(await res.json()).toEqual({ error: "Apenas gerentes podem usar o assistente" });
  expect(fetched.length).toBe(0);
});

test("client is refused the assistant", async () => {
  roles = [{ role: "client", approved: true }];
  const res = await post({ message: "ola" });
  expect(res.status).toBe(403);
  expect(fetched.length).toBe(0);
});

test("manager whose approval was revoked is refused", async () => {
  roles = [{ role: "manager", approved: false }];
  const res = await post({ message: "ola" });
  expect(res.status).toBe(403);
  expect(fetched.length).toBe(0);
});

test("without a session the request is rejected", async () => {
  user = null;
  const res = await post({ message: "ola" });
  expect(res.status).toBe(401);
  expect(fetched.length).toBe(0);
});

test("manager passes the role check and reaches message handling", async () => {
  roles = [{ role: "manager", approved: true }];
  const res = await post({ message: "" });
  expect(res.status).toBe(400);
  expect(await res.json()).toEqual({ error: "Mensagem vazia" });
});

test("manager chat reaches the agent", async () => {
  roles = [{ role: "manager", approved: true }];
  const res = await post({ message: "quantas ots hoje" });
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ reply: "ok" });
  expect(fetched).toEqual(["https://agent-production-29c8.up.railway.app/assistente/chat"]);
});
