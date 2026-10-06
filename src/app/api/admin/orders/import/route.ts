import { adminGuard } from "@/lib/admin-auth";
import { parseCsv } from "@/lib/csv";
import { adapterById } from "@/lib/adapters";
import { importOrders } from "@/lib/orders";
import { prepareOrderCsv } from "@/lib/workflows";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";

// 聯盟訂單報表匯入（規格 §29-34）。body: { platform, csv, source? }。
// 平台已知（各平台後台各自下載）。整檔 content_hash 去重 + 每筆 (platform, order_id) 去重。
export async function POST(req: Request) {
  const denied = adminGuard(req);
  if (denied) return denied;

  let body: { platform?: string; csv?: string; source?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }
  if (!body || typeof body.platform !== "string" || !body.platform)
    return Response.json({ error: "missing platform" }, { status: 400 });
  if (typeof body.csv !== "string" || !body.csv)
    return Response.json({ error: "missing csv" }, { status: 400 });
  if (
    body.source != null &&
    (typeof body.source !== "string" || body.source.length > 200)
  )
    return Response.json({ error: "invalid source" }, { status: 400 });

  try {
    prepareOrderCsv(body.platform, body.csv);
  } catch {
    return Response.json(
      {
        error: "invalid report",
        hint: "Check platform, order IDs, amounts, and ISO dates.",
      },
      { status: 400 },
    );
  }
  const adapter = adapterById(body.platform);
  const rows = parseCsv(body.csv);
  const orders = adapter.parseOrderReport(rows);
  const summary = await importOrders(adapter.id, orders, {
    source: body.source,
    rawContent: body.csv,
  });

  await audit({
    entityType: "import",
    action: "orders_csv",
    actor: "admin",
    after: { platform: adapter.id, ...summary },
  });

  return Response.json(summary);
}
