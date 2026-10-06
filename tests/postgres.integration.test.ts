import { before, beforeEach, after, test } from "node:test";
import assert from "node:assert/strict";
import { Pool } from "pg";
import { randomUUID } from "node:crypto";
import { PRODUCT_TABLE_SQL } from "../src/lib/products";
import { AUDIT_TABLE_SQL } from "../src/lib/audit";
import { BATCH_TABLE_SQL, ORDER_TABLE_SQL } from "../src/lib/orders";
import { PROPOSAL_TABLE_SQL } from "../src/lib/proposals";
import {
  ORDER_IMPORT_SQL,
  PROPOSAL_DECISION_SQL,
} from "../src/lib/workflow-sql";
import { prepareOrderCsv, preparedImportHash } from "../src/lib/workflows";
import { PERSONA_CODES } from "../src/lib/personas";
import { SAMPLE_CSV, UPDATE_CSV } from "../src/lib/demo/fixtures";
const connectionString = process.env.TEST_DATABASE_URL;
if (!connectionString)
  throw new Error(
    "TEST_DATABASE_URL is required for integration tests (no silent skips).",
  );
const url = new URL(connectionString);
if (
  !["127.0.0.1", "localhost"].includes(url.hostname) ||
  !url.pathname.endsWith("_test") ||
  connectionString === process.env.DATABASE_URL
)
  throw new Error(
    "Use an exclusive local PostgreSQL database ending in _test; never DATABASE_URL.",
  );
const db = new Pool({ connectionString, max: 4 });
before(async () => {
  for (const sql of [
    PRODUCT_TABLE_SQL,
    AUDIT_TABLE_SQL,
    BATCH_TABLE_SQL,
    ORDER_TABLE_SQL,
    PROPOSAL_TABLE_SQL,
    ORDER_IMPORT_SQL,
    PROPOSAL_DECISION_SQL,
  ])
    await db.query(sql);
});
beforeEach(async () => {
  await db.query(
    "TRUNCATE affiliate_audit_log,affiliate_proposals,affiliate_import_batches,affiliate_orders,affiliate_products RESTART IDENTITY",
  );
  await db.query(
    "INSERT INTO affiliate_products(id,platform,external_product_id,product_name,status,recommend_score,category) VALUES('taipei','kkday','taipei','Sample food walk','active',92,'food'),('kyoto','kkday','kyoto','Sample rail pass','active',55,'transport'),('seoul','kkday','seoul','Sample city tour','active',70,'tour')",
  );
});
after(async () => {
  await db.end();
});
async function importReport(platform = "kkday", csv = SAMPLE_CSV) {
  const orders = prepareOrderCsv(platform, csv);
  const r = await db.query(
    "SELECT affiliate_import_orders($1,$2::jsonb,$3,$4,$5) result",
    [
      platform,
      JSON.stringify(orders),
      preparedImportHash(platform, csv),
      randomUUID(),
      "test-fixture",
    ],
  );
  return r.rows[0].result;
}
async function proposal(
  id = "p",
  kind = "boost",
  productId: string | null = "taipei",
  payload: object = { rationale: "Test suggestion" },
) {
  await db.query(
    "INSERT INTO affiliate_proposals(id,kind,product_id,payload)VALUES($1,$2,$3,$4::jsonb)",
    [id, kind, productId, JSON.stringify(payload)],
  );
}
async function decide(id = "p", decision = "approved") {
  return (
    await db.query("SELECT affiliate_decide_proposal($1,$2) result", [
      id,
      decision,
    ])
  ).rows[0].result;
}
async function product(id = "taipei") {
  return (await db.query("SELECT * FROM affiliate_products WHERE id=$1", [id]))
    .rows[0];
}
test("PostgreSQL classifies duplicate rows and skips identical file", async () => {
  const r = await importReport();
  assert.equal(r.inserted, 3);
  assert.equal(r.duplicates, 1);
  assert.equal((await importReport()).skippedDuplicateFile, true);
  assert.equal(
    (await db.query("SELECT count(*)::int n FROM affiliate_orders")).rows[0].n,
    3,
  );
});
test("same bytes on another platform do not share file/order identity", async () => {
  await importReport();
  assert.equal((await importReport("klook")).inserted, 3);
  assert.equal(
    (await db.query("SELECT count(*)::int n FROM affiliate_orders")).rows[0].n,
    6,
  );
});
test("same order in a different report is a duplicate, not new revenue", async () => {
  await importReport();
  const r = await importReport("kkday", SAMPLE_CSV + "\n");
  assert.equal(r.inserted, 0);
  assert.equal(r.updated, 0);
  assert.equal(r.duplicates, 4);
});
test("refund and completion update orders without increasing record count", async () => {
  await importReport();
  const r = await importReport("kkday", UPDATE_CSV);
  assert.equal(r.updated, 2);
  const rows = await db.query(
    "SELECT status,commission_amount FROM affiliate_orders WHERE external_order_id='DEMO-101'",
  );
  assert.equal(rows.rows[0].status, "refunded");
  assert.equal(Number(rows.rows[0].commission_amount), 0);
  assert.equal(
    (
      await db.query(
        "SELECT SUM(commission_amount)::float n FROM affiliate_orders WHERE status IN ('confirmed','completed')",
      )
    ).rows[0].n,
    250,
  );
});
test("simultaneous file imports serialize to one committed batch", async () => {
  const results = await Promise.all([importReport(), importReport()]);
  assert.equal(results.filter((r) => r.skippedDuplicateFile).length, 1);
  assert.equal(
    (await db.query("SELECT count(*)::int n FROM affiliate_import_batches"))
      .rows[0].n,
    1,
  );
});
test("mid-import database error rolls back earlier rows and never marks file complete", async () => {
  const rows = prepareOrderCsv("kkday", SAMPLE_CSV);
  const bad = [rows[0], { ...rows[1], orderAmount: "not-a-number" }];
  await assert.rejects(
    db.query("SELECT affiliate_import_orders($1,$2::jsonb,$3,$4,$5)", [
      "kkday",
      JSON.stringify(bad),
      preparedImportHash("kkday", SAMPLE_CSV),
      randomUUID(),
      "fault-injection",
    ]),
  );
  assert.equal(
    (await db.query("SELECT count(*)::int n FROM affiliate_orders")).rows[0].n,
    0,
  );
  assert.equal((await importReport()).inserted, 3);
});
test("pending proposal is inert; approval applies bounded boost and audit atomically", async () => {
  await proposal();
  assert.equal(Number((await product()).recommend_score), 92);
  const r = await decide();
  assert.equal(r.proposal.status, "applied");
  assert.equal(Number((await product()).recommend_score), 100);
  assert.equal(
    (
      await db.query(
        "SELECT count(*)::int n FROM affiliate_audit_log WHERE approved=true",
      )
    ).rows[0].n,
    1,
  );
});
test("replayed approval has no second effect or audit", async () => {
  await proposal();
  await decide();
  assert.equal((await decide()).effect, "already decided");
  assert.equal(
    (await db.query("SELECT count(*)::int n FROM affiliate_audit_log")).rows[0]
      .n,
    1,
  );
});
test("simultaneous approval of one proposal applies only once", async () => {
  await db.query(
    "UPDATE affiliate_products SET recommend_score=50 WHERE id='taipei'",
  );
  await proposal();
  await Promise.all([decide(), decide()]);
  assert.equal(Number((await product()).recommend_score), 65);
  assert.equal(
    (await db.query("SELECT count(*)::int n FROM affiliate_audit_log")).rows[0]
      .n,
    1,
  );
});
test("two proposals on one product serialize without losing an increment", async () => {
  await db.query(
    "UPDATE affiliate_products SET recommend_score=50 WHERE id='taipei'",
  );
  await proposal("a");
  await proposal("b");
  await Promise.all([decide("a"), decide("b")]);
  assert.equal(Number((await product()).recommend_score), 80);
});
test("rejection and subsequent approval leave the product unchanged", async () => {
  await proposal();
  assert.equal((await decide("p", "rejected")).proposal.status, "rejected");
  await decide();
  assert.equal(Number((await product()).recommend_score), 92);
});
test("advisory proposals acknowledge review without automatic replacement", async () => {
  await proposal("p", "replace");
  assert.equal((await decide()).proposal.status, "approved");
  assert.equal(Number((await product()).recommend_score), 92);
});
test("pause changes only status and retag filters unsupported personas", async () => {
  await proposal("pause", "pause");
  await decide("pause");
  assert.equal((await product()).status, "paused");
  assert.equal(Number((await product()).recommend_score), 92);
  await proposal("tag", "retag", "taipei", {
    personas: [PERSONA_CODES[0], PERSONA_CODES[0].toLowerCase(), "bogus"],
    category: "culture",
  });
  await decide("tag");
  assert.deepEqual((await product()).personas, [PERSONA_CODES[0]]);
  assert.equal((await product()).category, "culture");
});
test("missing target rejects approval and keeps the proposal pending", async () => {
  await proposal("p", "boost", "missing");
  await assert.rejects(decide());
  assert.equal(
    (await db.query("SELECT status FROM affiliate_proposals")).rows[0].status,
    "pending",
  );
  assert.equal(
    (await db.query("SELECT count(*)::int n FROM affiliate_audit_log")).rows[0]
      .n,
    0,
  );
});
test("audit persistence failure rolls back product and proposal changes", async () => {
  await proposal();
  await db.query(
    "ALTER TABLE affiliate_audit_log ADD CONSTRAINT reject_test_audit CHECK (action='test-reject-all')",
  );
  try {
    await assert.rejects(decide());
    assert.equal(Number((await product()).recommend_score), 92);
    assert.equal(
      (await db.query("SELECT status FROM affiliate_proposals")).rows[0].status,
      "pending",
    );
  } finally {
    await db.query(
      "ALTER TABLE affiliate_audit_log DROP CONSTRAINT reject_test_audit",
    );
  }
});
test("unknown decision or kind never executes a write", async () => {
  await proposal("bad", "arbitrary_write");
  await assert.rejects(decide("bad"));
  await assert.rejects(decide("bad", "execute"));
  assert.equal(Number((await product()).recommend_score), 92);
});
