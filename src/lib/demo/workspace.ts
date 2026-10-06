import type { Proposal } from "../proposals";
import {
  prepareOrderCsv,
  preparedImportHash,
  planDecision,
  type CuratedProduct,
} from "../workflows";
export type DemoOrder = ReturnType<typeof prepareOrderCsv>[number] & {
  platform: string;
};
export interface Workspace {
  version: number;
  role: "reviewer" | "viewer";
  expires: number;
  orders: DemoOrder[];
  hashes: string[];
  products: CuratedProduct[];
  proposals: Proposal[];
  events: string[];
}
export function createWorkspace(now = Date.now()): Workspace {
  const products = [
    {
      id: "taipei",
      name: "Taipei food walk",
      platform: "kkday",
      externalId: "taipei",
      status: "active",
      recommendScore: 92,
      personas: [],
      category: "food",
    },
    {
      id: "kyoto",
      name: "Kyoto railway pass",
      platform: "kkday",
      externalId: "kyoto",
      status: "active",
      recommendScore: 55,
      personas: [],
      category: "transport",
    },
    {
      id: "seoul",
      name: "Seoul city tour",
      platform: "kkday",
      externalId: "seoul",
      status: "active",
      recommendScore: 70,
      personas: [],
      category: "tour",
    },
  ];
  const proposals: Proposal[] = [
    {
      id: "boost",
      kind: "boost",
      productId: "taipei",
      rationale: "Increase exposure for the food walk.",
      evidence:
        "Fixed sample: positive attributed orders. Score increases by 15, capped at 100.",
      status: "pending",
      createdAt: new Date(now).toISOString(),
      decidedAt: null,
    },
    {
      id: "pause",
      kind: "pause",
      productId: "seoul",
      rationale: "Pause a product while its destination link is reviewed.",
      evidence:
        "Fixed sample: a broken-link report. Approval pauses the product.",
      status: "pending",
      createdAt: new Date(now).toISOString(),
      decidedAt: null,
    },
    {
      id: "replace",
      kind: "replace",
      productId: "kyoto",
      rationale: "Consider an alternative railway pass.",
      evidence:
        "Advisory only: approval records a decision without replacing a product.",
      status: "pending",
      createdAt: new Date(now).toISOString(),
      decidedAt: null,
    },
  ];
  return {
    version: 0,
    role: "reviewer",
    expires: now + 60 * 60 * 1000,
    orders: [],
    hashes: [],
    products,
    proposals,
    events: [],
  };
}
export function importDemo(state: Workspace, platform: string, csv: string) {
  const rows = prepareOrderCsv(platform, csv);
  if (
    rows.some(
      (o) =>
        o.currency !== "TWD" ||
        (o.commissionCurrency && o.commissionCurrency !== "TWD"),
    )
  )
    throw new Error("Sample reports must use TWD");
  if (rows.length > 8)
    throw new Error("Use a report with at most 8 sample rows");
  const hash = platform + ":" + preparedImportHash(platform, csv);
  if (state.hashes.includes(hash))
    return {
      inserted: 0,
      updated: 0,
      duplicates: 0,
      skippedDuplicateFile: true,
    };
  let inserted = 0,
    updated = 0,
    duplicates = 0;
  for (const row of rows) {
    const index = state.orders.findIndex(
      (o) =>
        o.platform === platform && o.externalOrderId === row.externalOrderId,
    );
    const next = { ...row, platform };
    if (index < 0) {
      state.orders.push(next);
      inserted++;
    } else if (JSON.stringify(state.orders[index]) === JSON.stringify(next)) {
      duplicates++;
    } else {
      state.orders[index] = next;
      updated++;
    }
  }
  if (state.orders.length > 8)
    throw new Error("Reset the workspace before importing more sample orders");
  state.hashes.push(hash);
  state.hashes = state.hashes.slice(-6);
  return { inserted, updated, duplicates, skippedDuplicateFile: false };
}
export function decideDemo(
  state: Workspace,
  id: string,
  decision: "approved" | "rejected",
) {
  const p = state.proposals.find((p) => p.id === id);
  if (!p) throw new Error("Proposal not found");
  const product = state.products.find((p2) => p2.id === p.productId);
  const plan = planDecision(p, decision, product);
  if (p.status === "pending") {
    if (product) Object.assign(product, plan.patch);
    p.status = plan.status;
    p.decidedAt = new Date().toISOString();
  }
  return plan.effect;
}
