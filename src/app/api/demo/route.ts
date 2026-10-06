import { createDemoHandler } from "@/lib/demo/handler";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const handler = createDemoHandler(
  process.env.DEMO_SESSION_SECRET ??
    (process.env.NODE_ENV !== "production"
      ? "local-demo-only-not-an-operations-credential"
      : ""),
);
export const GET = handler;
export const POST = handler;
