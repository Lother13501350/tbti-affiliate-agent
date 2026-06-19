import type { PlatformAdapter, PlatformId, SubIdParts } from "./types";
import { kkdayAdapter } from "./kkday";
import { klookAdapter } from "./klook";
import { tripAdapter } from "./trip";
import { genericAdapter } from "./generic";

export * from "./types";

// 註冊表：依序比對；generic 永遠最後（detect 恆真）。
const MATCHERS: PlatformAdapter[] = [kkdayAdapter, klookAdapter, tripAdapter];
const BY_ID: Record<PlatformId, PlatformAdapter> = {
  kkday: kkdayAdapter,
  klook: klookAdapter,
  trip: tripAdapter,
  other: genericAdapter,
};

/** 自動辨識平台（規格 §2）。 */
export function detectPlatform(url: string): PlatformId {
  for (const a of MATCHERS) if (a.detect(url)) return a.id;
  return "other";
}

export function adapterForUrl(url: string): PlatformAdapter {
  for (const a of MATCHERS) if (a.detect(url)) return a;
  return genericAdapter;
}

export function adapterById(id: string): PlatformAdapter {
  return BY_ID[id as PlatformId] ?? genericAdapter;
}

/**
 * 組情境化 SubId（規格 §13）：persona_dest_placement_variant，例 food_osaka_result_top。
 * 全小寫、去非英數、各段限 20 字；全空 → "tbti"。
 */
export function composeSubId(parts: SubIdParts): string {
  const clean = (s?: string | null) =>
    (s ?? "").toString().toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 20);
  const joined = [parts.persona, parts.dest, parts.placement, parts.variant]
    .map(clean)
    .filter(Boolean)
    .join("_");
  return joined || "tbti";
}
