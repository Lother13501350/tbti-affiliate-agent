// 端到端管線測試（打本機 dev server 的真實路由）。
// 用法：先 `next dev`，再 node --env-file=.env.local scripts/e2e.mjs
const BASE = process.env.E2E_BASE || "http://localhost:3000";
const KEY = process.env.ADMIN_KEY || "tbti-admin-9f3a2c";
const k = `key=${encodeURIComponent(KEY)}`;
const J = async (res) => ({ status: res.status, body: await res.json().catch(() => null) });

// 1) 人工新增商品（含 external id，方便訂單對回）
let r = await fetch(`${BASE}/api/admin/products?${k}`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    productName: "大阪・道頓堀美食導覽",
    productUrl: "https://www.kkday.com/zh-tw/product/20991-dotonbori-food-tour",
    affiliateUrl: "https://www.kkday.com/zh-tw/product/20991?cid=25446&ud1=TBTI",
    externalProductId: "20991",
    city: "osaka",
    category: "experience",
    priceFrom: 1200,
    currency: "TWD",
    commissionRate: 8,
  }),
});
let { status, body } = await J(r);
const productId = body?.product?.id;
const goCode = body?.link?.code;
console.log("1) 新增商品:", status, "id =", productId, "| /go code =", goCode);

// 2) 審核通過 → active + 指定人格 FOOD
r = await fetch(`${BASE}/api/admin/products/${productId}?${k}`, {
  method: "PATCH",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ status: "active", personas: ["FOOD"], needsReview: false }),
});
({ status, body } = await J(r));
console.log("2) 審核上架:", status, "status =", body?.product?.status, "personas =", JSON.stringify(body?.product?.personas));

// 3) 模擬訪客點擊 /go（不跟隨轉址，看 302 與目的地）
r = await fetch(`${BASE}/go/${goCode}?p=/zh-TW/result&persona=FOOD&s=visitor-abc`, { redirect: "manual" });
console.log("3) /go 點擊:", r.status, "→", r.headers.get("location"));

// 4) 匯入一筆訂單報表（對回 external id 20991）
const csv = "order id,status,product id,sub id,commission,currency\nORD-1001,completed,20991,food_osaka,184,TWD";
r = await fetch(`${BASE}/api/admin/orders/import?${k}`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ platform: "kkday", csv }),
});
({ status, body } = await J(r));
console.log("4) 訂單匯入:", status, JSON.stringify(body));

// 5) 公開推薦 API（主站會打這支）
r = await fetch(`${BASE}/api/recommend?persona=FOOD&city=osaka`);
({ status, body } = await J(r));
console.log("5) 推薦 API:", status, JSON.stringify(body?.items?.map((i) => ({ name: i.name, go: i.goCode, score: i.score }))));

// 6) AI 分類（環境已有 OPENAI_API_KEY 才會跑）
r = await fetch(`${BASE}/api/admin/products/${productId}/classify?${k}`, { method: "POST" });
({ status, body } = await J(r));
console.log(
  "6) AI 分類:",
  status,
  body?.classification
    ? JSON.stringify({ conf: body.classification.confidence, city: body.classification.city, category: body.classification.category, personas: body.classification.personas })
    : JSON.stringify(body),
);
