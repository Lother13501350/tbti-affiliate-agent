import { adminGuard } from "@/lib/admin-auth";
import { decide } from "@/lib/proposals";
import { z } from "zod";

export const runtime = "nodejs";

const Schema = z.object({ decision: z.enum(["approved", "rejected"]) });

// 核准 / 駁回一條建議（規格 §44）。核准才由決定論程式執行,並寫稽核。
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
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "validation" }, { status: 400 });

  const r = await decide(id, parsed.data.decision);
  if (!r.proposal) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json(r);
}
