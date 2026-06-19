import { sql } from "./db";
import { getProduct } from "./products";
import { TAGGABLE_PERSONAS } from "./personas";

// 商品缺口分析（§41）+ 替代商品建議（§42）。

export interface Gap {
  persona: string;
  city: string;
  count: number;
}
export interface CoverageCell {
  persona: string;
  city: string;
  count: number;
}

export async function findGaps(
  opts: { minPerCombo?: number; topCities?: number } = {},
): Promise<{ cities: string[]; gaps: Gap[]; coverage: CoverageCell[] }> {
  if (!sql) return { cities: [], gaps: [], coverage: [] };
  const min = opts.minPerCombo ?? 2;

  const cityRows = await sql`
    SELECT city, COUNT(*)::int AS n FROM affiliate_products
    WHERE status = 'active' AND city IS NOT NULL AND city <> ''
    GROUP BY city ORDER BY n DESC LIMIT ${opts.topCities ?? 12}`;
  const cities = cityRows.map((r) => r.city as string);
  if (cities.length === 0) return { cities: [], gaps: [], coverage: [] };

  const prodRows = await sql`
    SELECT city, personas FROM affiliate_products
    WHERE status = 'active'
      AND city IN (SELECT jsonb_array_elements_text(${JSON.stringify(cities)}::jsonb))`;

  const counts = new Map<string, number>();
  for (const row of prodRows) {
    const personas: string[] = Array.isArray(row.personas) ? row.personas : [];
    for (const p of personas) {
      const k = `${p}|${row.city}`;
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
  }

  const gaps: Gap[] = [];
  const coverage: CoverageCell[] = [];
  for (const persona of TAGGABLE_PERSONAS) {
    for (const city of cities) {
      const count = counts.get(`${persona.code}|${city}`) ?? 0;
      coverage.push({ persona: persona.code, city, count });
      if (count < min) gaps.push({ persona: persona.code, city, count });
    }
  }
  gaps.sort((a, b) => a.count - b.count);
  return { cities, gaps, coverage };
}

export interface AltProduct {
  id: string;
  name: string;
  platform: string;
  city: string | null;
  category: string | null;
}

/** 某商品失效時的替代候選（§42）：同城市/同國 + 同類型，active，依人工分排序。 */
export async function suggestAlternatives(productId: string, limit = 5): Promise<AltProduct[]> {
  if (!sql) return [];
  const cur = await getProduct(productId);
  if (!cur) return [];
  const rows = await sql`
    SELECT id, product_name, platform, city, category FROM affiliate_products
    WHERE status = 'active' AND id <> ${productId}
      AND (city = ${cur.city} OR country_code = ${cur.countryCode})
      AND (${cur.category}::text IS NULL OR category = ${cur.category})
    ORDER BY (city = ${cur.city}) DESC, recommend_score DESC NULLS LAST
    LIMIT ${limit}`;
  return rows.map((r) => ({
    id: r.id,
    name: r.product_name,
    platform: r.platform,
    city: r.city ?? null,
    category: r.category ?? null,
  }));
}
