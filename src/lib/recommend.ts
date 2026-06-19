import { listProducts } from "./products";
import { productClickStats } from "./clicks";
import { productOrderStats } from "./orders";
import { listLinksForProduct } from "./links";
import { scoreProduct, type ScoreContext, type Scored } from "./scoring";

// 商品推薦引擎（規格 §16-20）：候選 → 計分 → 多樣性 → 補 /go code。

export interface RecommendContext extends ScoreContext {
  budgetTier?: string | null;
  scenario?: string | null;
  limit?: number;
  diversity?: boolean;
}

export interface Recommendation extends Scored {
  goCode: string | null;
}

export async function recommendProducts(ctx: RecommendContext): Promise<Recommendation[]> {
  const limit = Math.min(Math.max(ctx.limit ?? 12, 1), 50);
  // 候選：active 商品（指定城市先用城市過濾，否則全 active）
  const { items } = await listProducts({ status: "active", city: ctx.city ?? null, limit: 200 });
  if (items.length === 0) return [];

  const [clickStats, orderStats] = await Promise.all([
    productClickStats(30),
    productOrderStats(30),
  ]);
  const maxComm = Math.max(1, ...items.map((p) => p.estimatedCommission ?? 0));

  const scored = items.map((p) => {
    const cs = clickStats.get(p.id);
    const os = orderStats.get(p.id);
    const conversion = cs && cs.uniqueSessions > 0 && os ? os.validOrders / cs.uniqueSessions : 0;
    const commissionNorm = (p.estimatedCommission ?? 0) / maxComm;
    return scoreProduct(p, ctx, { ctr: 0, conversion }, commissionNorm);
  });
  scored.sort((a, b) => b.score - a.score);

  const chosen = (ctx.diversity ?? true) ? diversify(scored, limit) : scored.slice(0, limit);

  const out: Recommendation[] = [];
  for (const s of chosen) {
    const links = await listLinksForProduct(s.product.id);
    out.push({ ...s, goCode: links.find((l) => l.active)?.code ?? links[0]?.code ?? null });
  }
  return out;
}

/**
 * 多樣性控制（規格 §20）：避免同平台 / 同類型 / 同城市洗版。
 * 貪婪挑選：每步選「分數 − 重複屬性懲罰」最高者。
 */
function diversify(scored: Scored[], limit: number): Scored[] {
  const out: Scored[] = [];
  const pool = [...scored];
  const seenPlatform = new Map<string, number>();
  const seenCategory = new Map<string, number>();
  const seenCity = new Map<string, number>();

  while (out.length < limit && pool.length) {
    let bestIdx = 0;
    let bestVal = -Infinity;
    for (let i = 0; i < pool.length; i++) {
      const p = pool[i].product;
      const penalty =
        0.06 * (seenPlatform.get(p.platform) ?? 0) +
        0.06 * (seenCategory.get(p.category ?? "") ?? 0) +
        0.04 * (seenCity.get(p.city ?? "") ?? 0);
      const v = pool[i].score - penalty;
      if (v > bestVal) {
        bestVal = v;
        bestIdx = i;
      }
    }
    const [picked] = pool.splice(bestIdx, 1);
    out.push(picked);
    const p = picked.product;
    seenPlatform.set(p.platform, (seenPlatform.get(p.platform) ?? 0) + 1);
    seenCategory.set(p.category ?? "", (seenCategory.get(p.category ?? "") ?? 0) + 1);
    seenCity.set(p.city ?? "", (seenCity.get(p.city ?? "") ?? 0) + 1);
  }
  return out;
}
