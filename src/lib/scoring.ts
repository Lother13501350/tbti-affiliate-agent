import type { TargetProfile, DimensionId } from "./personas";
import { personaProfile } from "./personas";
import type { Product } from "./products";

// V2 智慧推薦核心（規格 §17,18）。決定論公式，不交給 AI；佣金永遠不是唯一因子。

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

/**
 * 商品 target_profile 對人格 profile 的相似度 0..1。
 * 以「人格有錨的維度」為準（比照主站 matchPersona 的距離計算）；商品缺該維 → 視為中性 50。
 */
export function profileSimilarity(product: TargetProfile, persona: TargetProfile): number {
  const dims = Object.keys(persona) as DimensionId[];
  if (dims.length === 0) return 0.5;
  let sumSq = 0;
  for (const d of dims) {
    const pv = product[d] ?? 50;
    const av = persona[d] ?? 50;
    sumSq += ((pv - av) / 100) ** 2;
  }
  const rms = Math.sqrt(sumSq / dims.length);
  return clamp01(1 - rms);
}

/** 商品對某人格的符合度 0..1：明確標 persona → 1；否則 target_profile RMS；都沒有 → 0.3。 */
export function personaMatch(product: Product, personaCode?: string | null): number {
  if (!personaCode) return 0.5;
  if (product.personas.includes(personaCode)) return 1;
  if (product.targetProfile) return profileSimilarity(product.targetProfile, personaProfile(personaCode));
  return 0.3;
}

/** 目的地符合度 0..1：同城市 1、同國 0.6、其餘 0；未指定目的地 → 0.5。 */
export function destMatch(
  product: Product,
  ctx: { city?: string | null; country?: string | null },
): number {
  if (!ctx.city && !ctx.country) return 0.5;
  if (ctx.city && product.city && product.city.toLowerCase() === ctx.city.toLowerCase()) return 1;
  if (ctx.country) {
    const c = ctx.country.toLowerCase();
    if (product.countryCode && product.countryCode.toLowerCase() === c) return 0.6;
    if (product.countryName && product.countryName.toLowerCase().includes(c)) return 0.6;
  }
  return 0;
}

/** 新鮮度 0..1：30 天內線性由 1 → 0.2（規格 §17 新鮮度因子 + §19 冷啟動）。 */
export function freshness(createdAt: string): number {
  const t = Date.parse(createdAt);
  if (!Number.isFinite(t)) return 0.3;
  const days = (Date.now() - t) / 86_400_000;
  if (days <= 0) return 1;
  if (days >= 30) return 0.2;
  return 1 - (days / 30) * 0.8;
}

export interface ScoreContext {
  persona?: string | null;
  city?: string | null;
  country?: string | null;
}

export interface ScoreStats {
  ctr?: number; // 0..1（unique 點擊 / 曝光）；MVP 無曝光 → 0
  conversion?: number; // validOrders / uniqueClicks（原始比例，內部對 5% 正規化）
}

export const DEFAULT_WEIGHTS = {
  persona: 0.25,
  dest: 0.25,
  ctr: 0.15,
  conversion: 0.15,
  commission: 0.1,
  freshness: 0.05,
  manual: 0.05,
};
export type ScoreWeights = typeof DEFAULT_WEIGHTS;

export interface Scored {
  product: Product;
  score: number;
  breakdown: Record<keyof ScoreWeights, number>;
}

/**
 * 決定論排序分數（規格 §17）。commissionNorm 由呼叫端對候選集正規化到 0..1。
 * 任何訊號缺失（冷啟動）→ 該項 0，由 persona/dest/manual 撐住，不會 NaN。
 */
export function scoreProduct(
  product: Product,
  ctx: ScoreContext,
  stats: ScoreStats,
  commissionNorm: number,
  weights: ScoreWeights = DEFAULT_WEIGHTS,
): Scored {
  const breakdown: Record<keyof ScoreWeights, number> = {
    persona: personaMatch(product, ctx.persona),
    dest: destMatch(product, ctx),
    ctr: clamp01(stats.ctr ?? 0),
    conversion: clamp01((stats.conversion ?? 0) / 0.05),
    commission: clamp01(commissionNorm),
    freshness: freshness(product.createdAt),
    manual: product.recommendScore != null ? clamp01(product.recommendScore / 100) : 0.5,
  };
  let score = 0;
  for (const k of Object.keys(weights) as (keyof ScoreWeights)[]) {
    score += breakdown[k] * weights[k];
  }
  return { product, score, breakdown };
}
