import { adminGuard } from "@/lib/admin-auth";
import { getProduct, updateCuration } from "@/lib/products";
import { classifyProduct, classifyEnabled, reviewDecision } from "@/lib/classify";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";
export const maxDuration = 30;

// AI 分類單一商品（規格 §7-11）。ADMIN_KEY 閘；缺 OPENAI_API_KEY → 503。
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = adminGuard(req);
  if (denied) return denied;
  const { id } = await params;

  if (!classifyEnabled) {
    return Response.json({ error: "classify disabled", hint: "設定 OPENAI_API_KEY 後啟用" }, { status: 503 });
  }
  const product = await getProduct(id);
  if (!product) return Response.json({ error: "not found" }, { status: 404 });

  let c;
  try {
    c = await classifyProduct(product);
  } catch (e) {
    return Response.json({ error: "classify failed", detail: String(e) }, { status: 502 });
  }
  if (!c) return Response.json({ error: "classify disabled" }, { status: 503 });

  const decision = reviewDecision(c.confidence);
  const updated = await updateCuration(id, {
    city: c.city,
    countryCode: c.countryCode,
    category: c.category,
    personas: c.personas.length ? c.personas : undefined,
    scenarios: c.scenarios.length ? c.scenarios : undefined,
    audience: c.audience.length ? c.audience : undefined,
    budgetTier: c.budgetTier,
    classificationConfidence: c.confidence,
    needsReview: decision.needsReview,
  });

  await audit({
    entityType: "product",
    entityId: id,
    action: "ai_classify",
    actor: "admin",
    after: { classification: c, decision },
  });

  return Response.json({ classification: c, decision, product: updated });
}
