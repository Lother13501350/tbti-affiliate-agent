// 匯入 Klook 聯盟「商品 Feed」CSV（連結轉換器/產品瀏覽器匯出的格式）。
// 欄位：Country Name, City Name, Product Name, Product Image, Currency, Sell Price,
//       Commission Rate(小數,如 0.05), Instant Confirmation tag, Affiliate Link
// 用法：node --env-file=.env.local scripts/import-klook-feed.mjs "C:\path\products.csv"
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

const sql = neon(process.env.DATABASE_URL);
const path = process.argv[2];
if (!path) { console.error("用法: node ... import-klook-feed.mjs <csv路徑>"); process.exit(1); }

// --- 簡易 CSV 解析（支援引號/跳脫/CRLF/BOM）---
function parseCsv(input) {
  const text = input.replace(/^﻿/, "");
  const rows = []; let field = "", row = [], q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i+1] === '"') { field += '"'; i++; } else q = false; } else field += c; }
    else if (c === '"') q = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c !== "\r") field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function col(headers, ...names) {
  const norm = (s) => s.toLowerCase().replace(/[\s_()]/g, "");
  for (const n of names) {
    const i = headers.findIndex((h) => norm(h).includes(norm(n)));
    if (i >= 0) return i;
  }
  return -1;
}

function decodeKsite(affiliateUrl) {
  try { const u = new URL(affiliateUrl); const k = u.searchParams.get("k_site"); return k || null; }
  catch { return null; }
}
function extId(productUrl) {
  if (!productUrl) return null;
  const m = productUrl.match(/\/activity\/(\d+)/) || productUrl.match(/\/hotels\/detail\/(\d+)/);
  return m ? m[1] : null;
}
function guessCategory(name, productUrl) {
  if (productUrl && /\/hotels\/detail\//.test(productUrl)) return "hotel";
  const n = name || "";
  if (/eSIM|SIM卡|上網|Wi-?Fi/i.test(n)) return "esim";
  if (/JR|Pass|通票|通行證|周遊券|車票|鐵路|地鐵|捷運|悠遊卡|八達通|EasyCard|Octopus|半價卡/i.test(n)) return "transport_pass";
  if (/利木津|機場.*巴士|接送|快線|HARUKA|機場特快/i.test(n)) return "airport_transfer";
  if (/餐飲券|餐券|火鍋|料理|美食/i.test(n)) return "meal_voucher";
  if (/門票|入場|展望|觀景|水族館|樂園|動物園|博物館|園區/i.test(n)) return "attraction";
  if (/SUP|浮潛|纜車|滑車|直升機|表演|徒步|之旅|體驗|一日|私家團|day.?trip|tour/i.test(n)) return "experience";
  return "other";
}

const rows = parseCsv(readFileSync(path, "utf8"));
const headers = rows[0];
const C = {
  country: col(headers, "country name", "country"),
  city: col(headers, "city name", "city"),
  name: col(headers, "product name", "activity name"),
  image: col(headers, "product image", "image"),
  currency: col(headers, "currency"),
  price: col(headers, "sell price", "price"),
  comm: col(headers, "commission rate", "commission"),
  link: col(headers, "affiliate link", "link"),
};

let inserted = 0, links = 0, skipped = 0;
for (let r = 1; r < rows.length; r++) {
  const cells = rows[r];
  if (!cells || cells.length < 3) { continue; }
  const name = (cells[C.name] || "").trim();
  const affiliate = (cells[C.link] || "").trim();
  if (!name || !affiliate) { skipped++; continue; }

  const productUrl = decodeKsite(affiliate);
  const externalId = extId(productUrl);
  const id = externalId ? `klook:${externalId}` : `klook:${randomUUID().slice(0, 12)}`;
  const price = Number((cells[C.price] || "").replace(/[^0-9.]/g, "")) || null;
  const frac = Number(cells[C.comm]) || 0;          // 0.05
  const ratePct = frac > 0 ? Number((frac * 100).toFixed(2)) : null; // 5
  const estComm = price != null && frac > 0 ? Number((price * frac).toFixed(2)) : null;
  const category = guessCategory(name, productUrl);

  await sql`
    INSERT INTO affiliate_products (
      id, platform, external_product_id, product_name, product_url, affiliate_url,
      country_name, city, category, price_from, currency, commission_rate, estimated_commission,
      status, image_url, needs_review
    ) VALUES (
      ${id}, 'klook', ${externalId}, ${name}, ${productUrl}, ${affiliate},
      ${cells[C.country] || null}, ${cells[C.city] || null}, ${category},
      ${price}, ${cells[C.currency] || null}, ${ratePct}, ${estComm},
      'active', ${cells[C.image] || null}, true
    )
    ON CONFLICT (id) DO UPDATE SET
      product_name = EXCLUDED.product_name, product_url = EXCLUDED.product_url,
      affiliate_url = EXCLUDED.affiliate_url, country_name = EXCLUDED.country_name,
      city = EXCLUDED.city, price_from = EXCLUDED.price_from, currency = EXCLUDED.currency,
      commission_rate = EXCLUDED.commission_rate, estimated_commission = EXCLUDED.estimated_commission,
      image_url = EXCLUDED.image_url, updated_at = now()`;
  inserted++;

  const existing = await sql`SELECT 1 FROM affiliate_links WHERE product_id = ${id} LIMIT 1`;
  if (!existing[0]) {
    const code = randomUUID().replace(/-/g, "").slice(0, 10);
    await sql`INSERT INTO affiliate_links (code, product_id, platform, base_url, target_url, dest)
      VALUES (${code}, ${id}, 'klook', ${affiliate}, ${affiliate}, ${cells[C.city] || null})`;
    links++;
  }
}

const n = await sql`SELECT count(*)::int c FROM affiliate_products`;
console.log(`✓ 匯入完成：商品 ${inserted}、新建 /go 連結 ${links}、略過 ${skipped}。資料庫商品總數 = ${n[0].c}`);
