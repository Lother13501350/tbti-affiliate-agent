// 人格與維度詞彙 + 8 維 profile 錨點 —— 鏡像主站 travelmbti（src/lib/personas.ts、dimensions.ts）。
// 商品配對：商品可掛多個 persona code，並可給 8 維 target profile（0–100 錨點）。
// V2 用與主站相同的 RMS 距離把商品配到人格（見 scoring.ts）。

export const DIMENSION_IDS = [
  "pace",
  "planning",
  "budget",
  "social",
  "content",
  "workleak",
  "pigeon",
  "foodie",
] as const;
export type DimensionId = (typeof DIMENSION_IDS)[number];

export const DIMENSIONS: { id: DimensionId; name: string; high: string; low: string }[] = [
  { id: "pace", name: "節奏狂熱", high: "特種兵式", low: "躺平度假" },
  { id: "planning", name: "規劃控制慾", high: "行程表暴君", low: "聽勸隨緣" },
  { id: "budget", name: "燒錢指數", high: "報復性消費", low: "窮鬼套餐" },
  { id: "social", name: "社交電量", high: "搭子收集者", low: "i 人獨旅" },
  { id: "content", name: "打卡慾", high: "顯眼包打卡機", low: "反向深度遊" },
  { id: "workleak", name: "班味殘留", high: "帶筆電出國", low: "徹底逃離" },
  { id: "pigeon", name: "鴿子指數", high: "永遠在計劃", low: "說走就走" },
  { id: "foodie", name: "吃貨魂", high: "為食而生", low: "吃飽就好" },
];

/** 商品 / 人格的 8 維傾向（0–100 錨點，只填想錨的維度）。 */
export type TargetProfile = Partial<Record<DimensionId, number>>;

// 22 人格 + profile 錨點（鏡像主站）。eggOnly = 彩蛋型，不進商品標籤下拉，也不參與商品配對建議。
export const PERSONAS = [
  { code: "RUSH", title: "鐵腿特種兵指揮官", eggOnly: false, profile: { pace: 95, planning: 85 } },
  { code: "LAZY", title: "飯店廢人", eggOnly: false, profile: { pace: 8, workleak: 15 } },
  { code: "OBEY", title: "聽勸俠", eggOnly: false, profile: { planning: 8, content: 75 } },
  { code: "COOL", title: "優越仔", eggOnly: false, profile: { content: 8, social: 22 } },
  { code: "FLEX", title: "限動洗版王", eggOnly: false, profile: { content: 95, social: 78 } },
  { code: "BURN", title: "報復性消費家", eggOnly: false, profile: { budget: 95 } },
  { code: "POOR", title: "金牌打野", eggOnly: false, profile: { budget: 8 } },
  { code: "DAZI", title: "朋友王", eggOnly: false, profile: { social: 95 } },
  { code: "SOLO", title: "i 人獨旅修行者", eggOnly: false, profile: { social: 6 } },
  { code: "WASH", title: "班味洗滌劑", eggOnly: false, profile: { workleak: 6 } },
  { code: "WORK", title: "帶薪出國上班族", eggOnly: false, profile: { workleak: 95 } },
  { code: "GRND", title: "窮鬼鐵人", eggOnly: false, profile: { pace: 90, budget: 12 } },
  { code: "LUXE", title: "神隱度假貴婦", eggOnly: false, profile: { pace: 12, budget: 92, workleak: 18 } },
  { code: "BUDD", title: "佛系隨緣仔", eggOnly: false, profile: { planning: 15 } },
  { code: "FOOD", title: "美食特攻隊", eggOnly: false, profile: { foodie: 95 } },
  { code: "GULA", title: "窮鬼美食家", eggOnly: false, profile: { foodie: 90, budget: 12 } },
  { code: "HAUL", title: "人形代購行李箱", eggOnly: false, profile: { social: 75, budget: 62 } },
  { code: "PREP", title: "攻略課代表", eggOnly: true, profile: { planning: 95 } },
  { code: "LIAR", title: "泉哥", eggOnly: true, profile: { pigeon: 95 } },
  { code: "FULL", title: "我全都要貪心怪", eggOnly: true, profile: { pace: 90, budget: 88, content: 88, social: 85 } },
  { code: "NPC", title: "NPC", eggOnly: true, profile: { pace: 50, planning: 50, budget: 50, social: 50, content: 50, workleak: 50, pigeon: 50, foodie: 50 } },
  { code: "GRGS", title: "古拉格斯", eggOnly: true, profile: { foodie: 90, social: 65 } },
] as const;

export type PersonaCode = (typeof PERSONAS)[number]["code"];

export const PERSONA_CODES: readonly string[] = PERSONAS.map((p) => p.code);

/** 可掛在商品上的鎖定人格（排除彩蛋型）。 */
export const TAGGABLE_PERSONAS = PERSONAS.filter((p) => !p.eggOnly);

export function isPersonaCode(x: string): x is PersonaCode {
  return PERSONA_CODES.includes(x);
}

export function personaTitle(code: string): string {
  return PERSONAS.find((p) => p.code === code)?.title ?? code;
}

/** 取某人格的 8 維 profile 錨點（給 scoring 的 RMS 配對用）。 */
export function personaProfile(code: string): TargetProfile {
  return (PERSONAS.find((p) => p.code === code)?.profile ?? {}) as TargetProfile;
}

/** 過濾出合法人格碼（給匯入/表單清洗用）。 */
export function cleanPersonaCodes(input: string[]): PersonaCode[] {
  const seen = new Set<string>();
  const out: PersonaCode[] = [];
  for (const raw of input) {
    const c = raw.trim().toUpperCase();
    if (isPersonaCode(c) && !seen.has(c)) {
      seen.add(c);
      out.push(c);
    }
  }
  return out;
}
