import { test } from "node:test";
import assert from "node:assert/strict";
import { createDemoHandler } from "../src/lib/demo/handler";
import { SAMPLE_CSV, UPDATE_CSV } from "../src/lib/demo/fixtures";
const handler = createDemoHandler(
  "test-workspace-secret-with-more-than-32-characters",
);
async function workspace() {
  let cookie = "";
  return async (body?: object, origin = "http://localhost") => {
    const r = await handler(
      new Request("http://localhost/api/demo", {
        method: body ? "POST" : "GET",
        headers: { cookie, origin, "content-type": "application/json" },
        ...(body ? { body: JSON.stringify(body) } : {}),
      }),
    );
    const c = r.headers.get("set-cookie");
    if (c) cookie = c.split(";")[0];
    return { response: r, body: await r.json() };
  };
}
test("sample server API imports, skips a replay, and updates orders", async () => {
  const call = await workspace();
  await call();
  let r = await call({ action: "import", platform: "kkday", csv: SAMPLE_CSV });
  assert.equal(r.response.status, 200);
  assert.equal(r.body.state.orders.length, 3);
  assert.match(r.body.note, /3 inserted.*1 duplicate/);
  r = await call({ action: "import", platform: "kkday", csv: SAMPLE_CSV });
  assert.match(r.body.note, /skipped/);
  r = await call({ action: "import", platform: "kkday", csv: UPDATE_CSV });
  assert.match(r.body.note, /2 updated/);
  assert.equal(r.body.state.orders.length, 3);
});
test("viewer imports and approvals are rejected server-side even with forged body role", async () => {
  const call = await workspace();
  await call();
  await call({ action: "role", role: "viewer" });
  for (const cmd of [
    { action: "import", platform: "kkday", csv: SAMPLE_CSV, role: "reviewer" },
    { action: "decide", id: "boost", decision: "approved", role: "reviewer" },
  ])
    assert.equal((await call(cmd)).response.status, 403);
  const r = await call();
  assert.equal(r.body.state.products[0].recommendScore, 92);
  assert.equal(r.body.state.orders.length, 0);
});
test("approval applies bounded action and ignores caller-supplied model patch", async () => {
  const call = await workspace();
  await call();
  let r = await call({
    action: "decide",
    id: "boost",
    decision: "approved",
    score: 999,
    commission: 999,
  });
  assert.equal(r.body.state.products[0].recommendScore, 100);
  r = await call({ action: "decide", id: "boost", decision: "approved" });
  assert.equal(r.body.state.products[0].recommendScore, 100);
  assert.match(r.body.note, /already decided/);
});
test("reject and advisory actions keep products unchanged", async () => {
  const call = await workspace();
  const initial = (await call()).body.state.products;
  await call({ action: "decide", id: "pause", decision: "rejected" });
  const r = await call({
    action: "decide",
    id: "replace",
    decision: "approved",
  });
  assert.deepEqual(r.body.state.products, initial);
});
test("reset affects only the current visitor", async () => {
  const a = await workspace(),
    b = await workspace();
  await a();
  await b();
  await a({ action: "decide", id: "boost", decision: "approved" });
  assert.equal((await b()).body.state.products[0].recommendScore, 92);
  await b({ action: "reset" });
  assert.equal((await a()).body.state.products[0].recommendScore, 100);
});
test("cross-origin mutations, absent sessions, malformed bodies, and unknown actions fail closed", async () => {
  const call = await workspace();
  assert.equal(
    (await call({ action: "import", platform: "kkday", csv: SAMPLE_CSV }))
      .response.status,
    401,
  );
  await call();
  assert.equal(
    (await call({ action: "reset" }, "https://foreign.example")).response
      .status,
    403,
  );
  assert.equal(
    (await call({ action: "execute_raw_sql" })).response.status,
    400,
  );
  assert.equal(
    (
      await handler(
        new Request("http://localhost/api/demo", {
          method: "POST",
          headers: { origin: "http://localhost" },
          body: "{",
        }),
      )
    ).status,
    400,
  );
});
test("invalid CSV returns no replacement cookie and preserves state", async () => {
  const call = await workspace();
  await call();
  const r = await call({
    action: "import",
    platform: "kkday",
    csv: "order id,status\n,confirmed",
  });
  assert.equal(r.response.status, 400);
  assert.equal(r.response.headers.get("set-cookie"), null);
  assert.equal((await call()).body.state.orders.length, 0);
});
test("production without a stable signing secret is unavailable rather than forgeable", async () =>
  assert.equal(
    (await createDemoHandler("")(new Request("http://localhost/api/demo")))
      .status,
    503,
  ));
test("oversized mutation body is rejected", async () => {
  const r = await handler(
    new Request("http://localhost/api/demo", {
      method: "POST",
      headers: { origin: "http://localhost" },
      body: "x".repeat(9000),
    }),
  );
  assert.equal(r.status, 413);
});

test("origin check uses the public Host and forwarded protocol behind the Next server", async () => {
  const h = createDemoHandler(
    "test-workspace-secret-with-more-than-32-characters",
  );
  const r = await h(
    new Request("http://internal-server/api/demo", {
      method: "POST",
      headers: {
        origin: "https://public.example",
        host: "public.example",
        "x-forwarded-proto": "https",
      },
      body: JSON.stringify({ action: "reset" }),
    }),
  );
  assert.equal(r.status, 200);
});
