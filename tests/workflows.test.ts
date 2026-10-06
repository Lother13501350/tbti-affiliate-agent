import { test } from "node:test";
import assert from "node:assert/strict";
import {
  prepareOrderCsv,
  prepareOrderImport,
  planDecision,
} from "../src/lib/workflows";
import { normalizeOrderStatus } from "../src/lib/taxonomy";
import { PERSONA_CODES } from "../src/lib/personas";
import {
  createWorkspace,
  importDemo,
  decideDemo,
} from "../src/lib/demo/workspace";
import { SAMPLE_CSV, UPDATE_CSV } from "../src/lib/demo/fixtures";
import type { Proposal } from "../src/lib/proposals";

for (const [input, expected] of [
  ["invalid", "rejected"],
  ["unconfirmed", "pending"],
  ["not confirmed", "pending"],
  ["refunded", "refunded"],
  ["cancelled", "cancelled"],
  ["completed", "completed"],
  ["confirmed", "confirmed"],
  ["unknown-status", "unknown"],
])
  test(`normalizes ${input} without treating invalid as valid`, () =>
    assert.equal(normalizeOrderStatus(input), expected));
test("CSV adapters preserve duplicate IDs for the importer to classify", () =>
  assert.equal(prepareOrderCsv("kkday", SAMPLE_CSV).length, 4));
test("invalid or missing order ID rejects the whole report", () =>
  assert.throws(() => prepareOrderCsv("kkday", "order id,status\n,confirmed")));
test("invalid date or negative order amount rejects import before persistence", () => {
  assert.throws(() =>
    prepareOrderImport("kkday", [
      { externalOrderId: "a", orderedAt: "yesterday" },
    ]),
  );
  assert.throws(() =>
    prepareOrderImport("kkday", [{ externalOrderId: "a", orderAmount: -1 }]),
  );
});
test("date-only partner reports normalize to ISO timestamps", () =>
  assert.equal(
    prepareOrderImport("kkday", [
      { externalOrderId: "a", orderedAt: "2026-10-01" },
    ])[0].orderedAt,
    "2026-10-01T00:00:00.000Z",
  ));
test("unknown platform is rejected instead of silently using generic adapter", () =>
  assert.throws(() => prepareOrderImport("unknown", [])));
test("sample import deduplicates rows and then the whole report", () => {
  const s = createWorkspace();
  assert.deepEqual(importDemo(s, "kkday", SAMPLE_CSV), {
    inserted: 3,
    updated: 0,
    duplicates: 1,
    skippedDuplicateFile: false,
  });
  assert.equal(importDemo(s, "kkday", SAMPLE_CSV).skippedDuplicateFile, true);
  assert.equal(s.orders.length, 3);
});
test("status updates change existing records and different platforms remain distinct", () => {
  const s = createWorkspace();
  importDemo(s, "kkday", SAMPLE_CSV);
  assert.equal(importDemo(s, "kkday", UPDATE_CSV).updated, 2);
  assert.equal(s.orders.length, 3);
  assert.equal(s.orders[0].status, "refunded");
  importDemo(s, "klook", SAMPLE_CSV);
  assert.equal(s.orders.length, 6);
});
test("pending AI suggestions have no product effect until approved", () => {
  const s = createWorkspace();
  assert.equal(s.products[0].recommendScore, 92);
  decideDemo(s, "boost", "approved");
  assert.equal(s.products[0].recommendScore, 100);
  decideDemo(s, "boost", "approved");
  assert.equal(s.products[0].recommendScore, 100);
});
test("rejection and advisory approval leave product state unchanged", () => {
  const s = createWorkspace(),
    before = structuredClone(s.products);
  decideDemo(s, "pause", "rejected");
  decideDemo(s, "replace", "approved");
  assert.deepEqual(s.products, before);
  assert.equal(s.proposals[2].status, "approved");
});
test("missing target fails instead of marking an executable proposal applied", () => {
  const s = createWorkspace();
  assert.throws(() => planDecision(s.proposals[0], "approved"));
  assert.equal(s.proposals[0].status, "pending");
});
test("retag filters invalid and duplicate persona codes", () => {
  const s = createWorkspace();
  const p = {
    ...s.proposals[0],
    kind: "retag" as const,
    personas: [PERSONA_CODES[0], "bad", PERSONA_CODES[0].toLowerCase()],
  };
  assert.deepEqual(planDecision(p, "approved", s.products[0]).patch.personas, [
    PERSONA_CODES[0],
  ]);
});

test("malformed quoted CSV and nonnumeric amounts are rejected", () => {
  assert.throws(() =>
    prepareOrderCsv("kkday", 'order id,status\n"unfinished,confirmed'),
  );
  assert.throws(() => prepareOrderCsv("kkday", "order id,amount\nA,nonsense"));
});

test("unknown runtime proposal kind cannot fall through to retag", () => {
  const s = createWorkspace();
  const before = structuredClone(s.products);
  const p = { ...s.proposals[0], kind: "execute" } as unknown as Proposal;
  assert.throws(
    () => planDecision(p, "approved", s.products[0]),
    /Unsupported/,
  );
  assert.deepEqual(s.products, before);
});
