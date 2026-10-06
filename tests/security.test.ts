import { test } from "node:test";
import assert from "node:assert/strict";
import { createAdminGuard, verifyAdminKey } from "../src/lib/admin-auth";
import { decodeWorkspace, encodeWorkspace } from "../src/lib/demo/session";
import { createWorkspace } from "../src/lib/demo/workspace";
import { POST as importRoute } from "../src/app/api/admin/orders/import/route";
import { PATCH as decisionRoute } from "../src/app/api/admin/proposals/[id]/route";
const secret = "test-workspace-secret-with-more-than-32-characters";
test("missing admin configuration denies even a supplied key", () =>
  assert.equal(
    createAdminGuard("")(new Request("http://localhost/api/admin?key=example"))
      ?.status,
    403,
  ));
test("missing, wrong, blank, and similar-length admin keys are denied", () => {
  const gate = createAdminGuard("configured-test-key");
  for (const value of [null, "", "bad", "configured-test-kex"]) {
    const r = new Request("http://localhost/api/admin", {
      headers: value === null ? {} : { "x-admin-key": value },
    });
    assert.equal(gate(r)?.status, 403);
  }
});
test("exact header or query key grants the operations gate", () => {
  const gate = createAdminGuard("configured-test-key");
  assert.equal(
    gate(
      new Request("http://localhost/api/admin", {
        headers: { "x-admin-key": "configured-test-key" },
      }),
    ),
    null,
  );
  assert.equal(
    gate(new Request("http://localhost/api/admin?key=configured-test-key")),
    null,
  );
  assert.equal(
    verifyAdminKey("configured-test-key ", "configured-test-key"),
    false,
  );
});
test("incorrect query key cannot be rescued by a correct header", () =>
  assert.equal(
    createAdminGuard("x")(
      new Request("http://localhost/?key=y", {
        headers: { "x-admin-key": "x" },
      }),
    )?.status,
    403,
  ));
test("signed cookie tampering and expiry are rejected", () => {
  const s = createWorkspace(),
    v = encodeWorkspace(s, secret);
  assert.equal(decodeWorkspace(v, secret)?.role, "reviewer");
  assert.equal(decodeWorkspace(v + "x", secret), null);
  assert.equal(decodeWorkspace(v, "different-secret"), null);
  assert.equal(decodeWorkspace(v, secret, s.expires + 1), null);
});
test("public demo cookie never grants access to real admin imports or approval", async () => {
  const cookie = "affiliate_demo=" + encodeWorkspace(createWorkspace(), secret);
  const request = new Request("http://localhost/api/admin", {
    method: "POST",
    headers: { cookie, "content-type": "application/json" },
    body: "{}",
  });
  assert.equal((await importRoute(request)).status, 403);
  assert.equal(
    (
      await decisionRoute(
        new Request("http://localhost/api/admin", {
          method: "PATCH",
          headers: { cookie },
          body: "{}",
        }),
        { params: Promise.resolve({ id: "boost" }) },
      )
    ).status,
    403,
  );
});
