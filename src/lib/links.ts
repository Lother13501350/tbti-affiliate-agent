import { sql, once } from "./db";
import { adapterById, composeSubId } from "./adapters";

// affiliate_links —— 每個（商品 × 版位 × 人格 × campaign × A/B）一條深層連結（規格 §12-15）。
// code 就是 /go/<code> 的 code。target_url = 原聯盟連結 + 情境化 SubId。

const ensureSchema = once(async () => {
  if (!sql) return;
  await sql`CREATE TABLE IF NOT EXISTS affiliate_links (
    code         text PRIMARY KEY,
    product_id   text NOT NULL,
    platform     text NOT NULL,
    base_url     text NOT NULL,
    target_url   text NOT NULL,
    placement    text,
    persona_code text,
    campaign     text,
    variant      text,
    dest         text,
    sub_id       text,
    active       boolean NOT NULL DEFAULT true,
    created_at   timestamptz NOT NULL DEFAULT now()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS idx_aff_links_product ON affiliate_links(product_id)`;
});

export interface Link {
  code: string;
  productId: string;
  platform: string;
  baseUrl: string;
  targetUrl: string;
  placement: string | null;
  personaCode: string | null;
  campaign: string | null;
  variant: string | null;
  dest: string | null;
  subId: string | null;
  active: boolean;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function rowToLink(r: any): Link {
  return {
    code: r.code,
    productId: r.product_id,
    platform: r.platform,
    baseUrl: r.base_url,
    targetUrl: r.target_url,
    placement: r.placement ?? null,
    personaCode: r.persona_code ?? null,
    campaign: r.campaign ?? null,
    variant: r.variant ?? null,
    dest: r.dest ?? null,
    subId: r.sub_id ?? null,
    active: !!r.active,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

function genCode(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 10);
}

export interface CreateLinkInput {
  productId: string;
  platform: string;
  baseAffiliateUrl: string;
  placement?: string | null;
  personaCode?: string | null;
  campaign?: string | null;
  variant?: string | null;
  /** 目的地 token（如 osaka），併入 SubId。 */
  dest?: string | null;
}

export async function createLink(input: CreateLinkInput): Promise<Link | null> {
  if (!sql) return null;
  await ensureSchema();
  const subId = composeSubId({
    persona: input.personaCode,
    dest: input.dest,
    placement: input.placement,
    variant: input.variant,
  });
  const targetUrl = adapterById(input.platform).appendSubId(input.baseAffiliateUrl, subId);
  const code = genCode();
  const rows = await sql`
    INSERT INTO affiliate_links
      (code, product_id, platform, base_url, target_url, placement, persona_code, campaign, variant, dest, sub_id)
    VALUES (${code}, ${input.productId}, ${input.platform}, ${input.baseAffiliateUrl}, ${targetUrl},
            ${input.placement ?? null}, ${input.personaCode ?? null}, ${input.campaign ?? null},
            ${input.variant ?? null}, ${input.dest ?? null}, ${subId})
    RETURNING *`;
  return rows[0] ? rowToLink(rows[0]) : null;
}

export async function getLink(code: string): Promise<Link | null> {
  if (!sql) return null;
  await ensureSchema();
  const rows = await sql`SELECT * FROM affiliate_links WHERE code = ${code} AND active = true`;
  return rows[0] ? rowToLink(rows[0]) : null;
}

export async function listLinksForProduct(productId: string): Promise<Link[]> {
  if (!sql) return [];
  await ensureSchema();
  const rows = await sql`
    SELECT * FROM affiliate_links WHERE product_id = ${productId} ORDER BY created_at DESC`;
  return rows.map(rowToLink);
}

export async function deactivateLink(code: string): Promise<void> {
  if (!sql) return;
  await ensureSchema();
  await sql`UPDATE affiliate_links SET active = false WHERE code = ${code}`;
}
