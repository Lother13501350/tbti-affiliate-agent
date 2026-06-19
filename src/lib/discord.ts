import { DISCORD_WEBHOOK_URL, discordEnabled } from "./env";

// Discord 通知（規格 §46-48）。未設 webhook → 寫 console（graceful no-op）。

export async function postDiscord(content: string, opts?: { alert?: boolean }): Promise<boolean> {
  const text = (opts?.alert ? "⚠️ " : "") + content;
  if (!discordEnabled) {
    console.log("[discord:noop]", text.slice(0, 300));
    return false;
  }
  try {
    const res = await fetch(DISCORD_WEBHOOK_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      // Discord content 上限 2000 字
      body: JSON.stringify({ content: text.slice(0, 1990) }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function money(n: number): string {
  return Number.isFinite(n) ? n.toLocaleString("en-US", { maximumFractionDigits: 2 }) : "0";
}

export function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}
