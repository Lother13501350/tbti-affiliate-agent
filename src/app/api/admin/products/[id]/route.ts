import { adminGuard } from "@/lib/admin-auth";
import { getProduct, setStatus, updateCuration } from "@/lib/products";
import type { ProductStatus } from "@/lib/taxonomy";
import { PRODUCT_STATUS_CODES } from "@/lib/taxonomy";
import { cleanPersonaCodes } from "@/lib/personas";
import { audit } from "@/lib/audit";
import { z } from "zod";

export const runtime = "nodejs";

const PatchSchema = z.object({
  status: z.string().optional(),
  personas: z.array(z.string()).optional(),
  scenarios: z.array(z.string()).optional(),
  audience: z.array(z.string()).optional(),
  budgetTier: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  recommendScore: z.coerce.number().nullable().optional(),
  needsReview: z.boolean().optional(),
  reason: z.string().optional(),
});

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = adminGuard(req);
  if (denied) return denied;
  const { id } = await params;
  const product = await getProduct(id);
  if (!product) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json({ product });
}

// 審核 / 編輯（規格 §43,44）：改狀態（通過/拒絕/暫停）+ 指定人格/標籤。
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = adminGuard(req);
  if (denied) return denied;
  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "validation", issues: parsed.error.issues }, { status: 400 });
  }
  const d = parsed.data;

  const before = await getProduct(id);
  if (!before) return Response.json({ error: "not found" }, { status: 404 });

  let product = before;

  // 先套策展欄位
  if (
    d.personas || d.scenarios || d.audience ||
    d.budgetTier !== undefined || d.category !== undefined ||
    d.recommendScore !== undefined || d.needsReview !== undefined
  ) {
    const updated = await updateCuration(id, {
      personas: d.personas ? cleanPersonaCodes(d.personas) : undefined,
      scenarios: d.scenarios,
      audience: d.audience,
      budgetTier: d.budgetTier ?? undefined,
      category: d.category ?? undefined,
      recommendScore: d.recommendScore ?? undefined,
      needsReview: d.needsReview,
    });
    if (updated) product = updated;
  }

  // 再改狀態
  if (d.status) {
    if (!PRODUCT_STATUS_CODES.includes(d.status as ProductStatus)) {
      return Response.json({ error: "bad status" }, { status: 400 });
    }
    const updated = await setStatus(id, d.status as ProductStatus);
    if (updated) product = updated;
    await audit({
      entityType: "product",
      entityId: id,
      action: "status_change",
      actor: "admin",
      before: { status: before.status },
      after: { status: d.status },
      reason: d.reason ?? null,
      approved: true,
    });
  } else {
    await audit({
      entityType: "product",
      entityId: id,
      action: "curate",
      actor: "admin",
      before,
      after: product,
      reason: d.reason ?? null,
    });
  }

  return Response.json({ product });
}
