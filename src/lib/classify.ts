import { generateObject } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";
import type { Product } from "./products";
import {
  CATEGORIES,
  SCENARIOS,
  BUDGET_TIERS,
  AUDIENCES,
  CATEGORY_CODES,
  SCENARIO_CODES,
  BUDGET_TIER_CODES,
  AUDIENCE_CODES,
} from "./taxonomy";
import { TAGGABLE_PERSONAS, cleanPersonaCodes } from "./personas";

// V2 AI 自動分類（規格 §7-11）。沿用主站 AI SDK + OpenAI；缺 OPENAI_API_KEY → 停用（graceful）。
// 鐵則：不捏造價格/評分；不確定就給 null/空 + 低信心。結構化輸出 + code 端清洗回受控詞彙。

const OPENAI_KEY = process.env.OPENAI_API_KEY ?? "";
export const classifyEnabled = OPENAI_KEY.length > 0;
const MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

const Schema = z.object({
  countryCode: z.string().nullable(),
  city: z.string().nullable(),
  category: z.string().nullable(),
  personas: z.array(z.string()),
  scenarios: z.array(z.string()),
  budgetTier: z.string().nullable(),
  audience: z.array(z.string()),
  confidence: z.number().min(0).max(1),
});

export interface Classification {
  countryCode: string | null;
  city: string | null;
  category: string | null;
  personas: string[];
  scenarios: string[];
  budgetTier: string | null;
  audience: string[];
  confidence: number;
}

export async function classifyProduct(p: Product): Promise<Classification | null> {
  if (!classifyEnabled) return null;
  const openai = createOpenAI({ apiKey: OPENAI_KEY });

  const prompt = [
    "You classify a travel affiliate product into TBTI's controlled vocabulary.",
    "DO NOT invent price, rating, or promotions. If unsure, use null/empty and a lower confidence.",
    "",
    `Product name: ${p.productName}`,
    `URL: ${p.productUrl ?? p.affiliateUrl ?? ""}`,
    p.description ? `Description: ${p.description}` : "",
    "",
    "Return codes from these vocabularies:",
    `category (one code or null): ${CATEGORIES.map((c) => `${c.code}=${c.label}`).join(", ")}`,
    `personas (0-3 best-fit codes): ${TAGGABLE_PERSONAS.map((x) => `${x.code}=${x.title}`).join(", ")}`,
    `scenarios (0-3 codes): ${SCENARIOS.map((s) => `${s.code}=${s.label}`).join(", ")}`,
    `budgetTier (one code or null): ${BUDGET_TIERS.map((b) => `${b.code}=${b.label}`).join(", ")}`,
    `audience (0-3 codes): ${AUDIENCES.map((a) => `${a.code}=${a.label}`).join(", ")}`,
    "countryCode: ISO-3166 alpha-2 lowercase if confidently inferable from name/url, else null.",
    "city: lowercase english slug (e.g. osaka) if inferable, else null.",
    "confidence: overall 0..1 confidence in this classification.",
  ]
    .filter(Boolean)
    .join("\n");

  const { object } = await generateObject({ model: openai(MODEL), schema: Schema, prompt });

  const inSet = (set: readonly string[], v: string | null) => (v && set.includes(v) ? v : null);
  return {
    countryCode: object.countryCode?.trim().toLowerCase() || null,
    city: object.city?.trim().toLowerCase() || null,
    category: inSet(CATEGORY_CODES, object.category),
    personas: cleanPersonaCodes(object.personas),
    scenarios: object.scenarios.filter((x) => SCENARIO_CODES.includes(x)),
    budgetTier: inSet(BUDGET_TIER_CODES, object.budgetTier),
    audience: object.audience.filter((x) => AUDIENCE_CODES.includes(x)),
    confidence: object.confidence,
  };
}

/** 信心 → 路由（規格 §11）：≥0.9 自動通過、≥0.7 抽查、其餘人工。 */
export function reviewDecision(confidence: number): {
  needsReview: boolean;
  tier: "auto" | "spot" | "manual";
} {
  if (confidence >= 0.9) return { needsReview: false, tier: "auto" };
  if (confidence >= 0.7) return { needsReview: true, tier: "spot" };
  return { needsReview: true, tier: "manual" };
}
