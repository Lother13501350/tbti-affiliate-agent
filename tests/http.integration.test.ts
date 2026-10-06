import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { randomBytes } from "node:crypto";
import { SAMPLE_CSV, UPDATE_CSV } from "../src/lib/demo/fixtures";
const origin = "http://127.0.0.1:43189";
let server: ChildProcess,
  output = "";
before(async () => {
  server = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      "43189",
    ],
    {
      env: {
        ...process.env,
        NODE_ENV: "production",
        DATABASE_URL: "",
        ADMIN_KEY: "",
        OPENAI_API_KEY: "",
        ANTHROPIC_API_KEY: "",
        CLAUDE_CODE_OAUTH_TOKEN: "",
        DISCORD_WEBHOOK_URL: "",
        DEMO_SESSION_SECRET: randomBytes(48).toString("base64url"),
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  server.stdout?.on("data", (d) => {
    output += d.toString();
  });
  server.stderr?.on("data", (d) => {
    output += d.toString();
  });
  for (let i = 0; i < 60; i++) {
    if (server.exitCode !== null)
      throw new Error("Test server stopped: " + output);
    try {
      const r = await fetch(origin + "/api/demo");
      if (r.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("Test server did not become ready: " + output);
});
after(() => {
  server?.kill("SIGTERM");
});
async function session() {
  let cookie = "";
  return async (body?: object) => {
    const r = await fetch(origin + "/api/demo", {
      method: body ? "POST" : "GET",
      headers: { origin, cookie, "content-type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const c = r.headers.get("set-cookie");
    if (c) cookie = c.split(";")[0];
    return { r, j: await r.json() };
  };
}
test("built Next server handles signed cookies and the full sample workflow", async () => {
  const call = await session();
  const initial = await call();
  assert.match(
    initial.r.headers.get("set-cookie") ?? "",
    /HttpOnly.*SameSite=Strict.*Secure/,
  );
  let out = await call({
    action: "import",
    platform: "kkday",
    csv: SAMPLE_CSV,
  });
  assert.equal(out.r.status, 200);
  assert.equal(out.j.state.orders.length, 3);
  out = await call({ action: "import", platform: "kkday", csv: SAMPLE_CSV });
  assert.match(out.j.note, /skipped/);
  out = await call({ action: "import", platform: "kkday", csv: UPDATE_CSV });
  assert.equal(out.j.state.orders[0].status, "refunded");
  out = await call({ action: "decide", id: "boost", decision: "approved" });
  assert.equal(out.j.state.products[0].recommendScore, 100);
  await call({ action: "role", role: "viewer" });
  assert.equal(
    (await call({ action: "decide", id: "pause", decision: "approved" })).r
      .status,
    403,
  );
  assert.equal(
    (
      await fetch(origin + "/api/admin/orders/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      })
    ).status,
    403,
  );
});
test("built server refuses cross-origin and missing-session mutations", async () => {
  const r = await fetch(origin + "/api/demo", {
    method: "POST",
    headers: {
      origin: "https://foreign.example",
      "content-type": "application/json",
    },
    body: JSON.stringify({ action: "reset" }),
  });
  assert.equal(r.status, 403);
  const missing = await fetch(origin + "/api/demo", {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify({
      action: "decide",
      id: "boost",
      decision: "approved",
    }),
  });
  assert.equal(missing.status, 401);
});
