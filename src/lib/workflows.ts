import { createHash } from "node:crypto";
import { z } from "zod";
import { money, DEFAULT_CANDIDATES } from "./adapters/base";
import { pick } from "./csv";
import { parseCsv } from "./csv";
import { adapterById } from "./adapters";
import { PLACEMENT_CODES, normalizeOrderStatus } from "./taxonomy";
import { isPersonaCode, cleanPersonaCodes } from "./personas";
import type { NormalizedOrder } from "./adapters/types";
import type { Proposal } from "./proposals";

export const BOOST_INCREMENT = 15;
export const SCORE_MAX = 100;
const date = z
  .union([z.iso.datetime({ offset: true }), z.iso.date()])
  .transform((v) => new Date(v).toISOString())
  .nullable()
  .optional();
const OrderSchema = z.object({
  externalOrderId: z.string().trim().min(1).max(100),
  statusRaw: z.string().max(100).nullable().optional(),
  orderedAt: date,
  completedAt: date,
  cancelledAt: date,
  productExternalId: z.string().max(100).nullable().optional(),
  productType: z.string().max(100).nullable().optional(),
  subId: z.string().max(200).nullable().optional(),
  campaign: z.string().max(200).nullable().optional(),
  orderAmount: z.number().finite().nonnegative().nullable().optional(),
  currency: z.string().max(10).nullable().optional(),
  commissionAmount: z.number().finite().nullable().optional(),
  commissionCurrency: z.string().max(10).nullable().optional(),
});
export function preparedImportHash(platform: string, raw?: string) {
  if (!platform) throw new Error("Missing platform");
  return raw ? createHash("sha256").update(raw).digest("hex") : null;
}
export function prepareOrderImport(
  platform: string,
  orders: NormalizedOrder[],
  raw?: string,
) {
  if (!["kkday", "klook", "trip", "other"].includes(platform))
    throw new Error("Unsupported platform");
  if (orders.length > 2000 || (raw?.length ?? 0) > 1_000_000)
    throw new Error("Report too large");
  return orders.map((input) => {
    const o = OrderSchema.parse(input);
    const tokens = (o.subId ?? "").split(/[_\-:|]/).filter(Boolean);
    const personaCode =
      tokens.map((t) => t.toUpperCase()).find(isPersonaCode) ?? null;
    const sub = (o.subId ?? "").toLowerCase();
    const placement =
      PLACEMENT_CODES.find(
        (p) => sub.includes(p) || sub.includes(p.replace(/_/g, "")),
      ) ?? null;
    return {
      ...o,
      status: normalizeOrderStatus(o.statusRaw ?? ""),
      personaCode,
      placement,
      attributed: !!o.subId?.trim(),
    };
  });
}
export function prepareOrderCsv(platform: string, csv: string) {
  if (csv.length > 1_000_000) throw new Error("Report too large");
  const rawRows = parseCsv(csv);
  for (const row of rawRows) {
    for (const candidates of [
      DEFAULT_CANDIDATES.orderAmount,
      DEFAULT_CANDIDATES.commissionAmount,
    ]) {
      const raw = pick(row, candidates);
      if (raw && money(raw) === null)
        throw new Error("Amounts must be numeric");
    }
  }
  const rows = rawRows,
    orders = adapterById(platform).parseOrderReport(rows);
  if (!rows.length || rows.length !== orders.length)
    throw new Error("Every row needs an order ID");
  return prepareOrderImport(platform, orders, csv);
}
export interface CuratedProduct {
  id: string;
  name: string;
  platform: string;
  externalId: string;
  status: string;
  recommendScore: number;
  personas: string[];
  category: string;
}
export function planDecision(
  p: Proposal,
  decision: "approved" | "rejected",
  product?: CuratedProduct,
): {
  status: Proposal["status"];
  patch: Partial<CuratedProduct>;
  effect: string;
} {
  if (p.status !== "pending")
    return { status: p.status, patch: {}, effect: "already decided" };
  if (decision === "rejected")
    return {
      status: "rejected" as const,
      patch: {},
      effect: "rejected without changes",
    };
  if (p.kind === "replace" || p.kind === "add_gap")
    return { status: "approved" as const, patch: {}, effect: "advisory only" };
  if (!["pause", "boost", "retag"].includes(p.kind))
    throw new Error("Unsupported proposal kind");
  if (!product) throw new Error("Target product is unavailable");
  const patch: Partial<CuratedProduct> =
    p.kind === "pause"
      ? { status: "paused" }
      : p.kind === "boost"
        ? {
            recommendScore: Math.min(
              SCORE_MAX,
              product.recommendScore + BOOST_INCREMENT,
            ),
          }
        : {
            personas: p.personas
              ? cleanPersonaCodes(p.personas)
              : product.personas,
            category: p.category ?? product.category,
          };
  return {
    status: "applied" as const,
    patch,
    effect:
      p.kind === "boost"
        ? `Recommendation score: ${patch.recommendScore} / ${SCORE_MAX}`
        : p.kind === "pause"
          ? "product paused"
          : "tags updated",
  };
}
