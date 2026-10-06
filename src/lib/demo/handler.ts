import { z } from "zod";
import { createWorkspace, readWorkspace, workspaceResponse } from "./session";
import { importDemo, decideDemo } from "./workspace";
const Command = z.discriminatedUnion("action", [
  z.object({ action: z.literal("reset") }),
  z.object({ action: z.literal("role"), role: z.enum(["viewer", "reviewer"]) }),
  z.object({
    action: z.literal("import"),
    platform: z.enum(["kkday", "klook", "trip", "other"]),
    csv: z.string().min(1).max(5000),
  }),
  z.object({
    action: z.literal("decide"),
    id: z.enum(["boost", "pause", "replace"]),
    decision: z.enum(["approved", "rejected"]),
  }),
]);
export function createDemoHandler(secret: string) {
  return async (req: Request): Promise<Response> => {
    if (secret.length < 32)
      return Response.json(
        { error: "Sample workspace is temporarily unavailable" },
        { status: 503 },
      );
    const state = readWorkspace(req, secret);
    if (req.method === "GET")
      return workspaceResponse(state ?? createWorkspace(), secret);
    if (req.method !== "POST")
      return Response.json({ error: "Method not allowed" }, { status: 405 });
    let sameOrigin = false;
    try {
      const origin = new URL(req.headers.get("origin") ?? "");
      const requestUrl = new URL(req.url);
      const host = req.headers.get("host") ?? requestUrl.host;
      const protocol =
        req.headers.get("x-forwarded-proto")?.split(",")[0].trim() ??
        requestUrl.protocol.slice(0, -1);
      sameOrigin = origin.host === host && origin.protocol === protocol + ":";
    } catch {
      /* Missing or malformed origin is denied. */
    }
    if (!sameOrigin)
      return Response.json(
        { error: "Open the workspace and retry" },
        { status: 403 },
      );
    if (Number(req.headers.get("content-length") ?? 0) > 8000)
      return Response.json({ error: "Report too large" }, { status: 413 });
    let body: unknown;
    try {
      const raw = await req.text();
      if (raw.length > 8000)
        return Response.json({ error: "Report too large" }, { status: 413 });
      body = JSON.parse(raw);
    } catch {
      return Response.json({ error: "Invalid request" }, { status: 400 });
    }
    const parsed = Command.safeParse(body);
    if (!parsed.success)
      return Response.json(
        { error: "Check the report or decision and retry" },
        { status: 400 },
      );
    const cmd = parsed.data;
    if (cmd.action === "reset")
      return workspaceResponse(createWorkspace(), secret, {
        note: "Workspace reset. All figures are fictional.",
      });
    if (!state)
      return Response.json(
        { error: "Session expired. Reload or reset the workspace." },
        { status: 401 },
      );
    if (cmd.action === "role") {
      state.role = cmd.role;
      return workspaceResponse(state, secret, {
        note: `Demo role changed to ${cmd.role}.`,
      });
    }
    if (state.role !== "reviewer")
      return Response.json(
        {
          error:
            "Viewer cannot import reports or decide proposals. Switch to Reviewer to continue.",
        },
        { status: 403 },
      );
    try {
      let note: string;
      if (cmd.action === "import") {
        const s = importDemo(state, cmd.platform, cmd.csv);
        note = s.skippedDuplicateFile
          ? "Identical report skipped. No orders changed."
          : `${s.inserted} inserted · ${s.updated} updated · ${s.duplicates} duplicate rows ignored.`;
      } else {
        note = decideDemo(state, cmd.id, cmd.decision);
      }
      state.version++;
      state.events = [note, ...state.events].slice(0, 4);
      return workspaceResponse(state, secret, { note });
    } catch (e) {
      return Response.json(
        {
          error:
            e instanceof z.ZodError
              ? "Check order IDs, numeric amounts, and ISO dates, then retry."
              : e instanceof Error
                ? e.message
                : "No changes applied",
        },
        { status: 400 },
      );
    }
  };
}
