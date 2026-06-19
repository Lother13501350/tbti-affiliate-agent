// 人格與維度詞彙 —— 鏡像主站 travelmbti（src/lib/personas.ts、dimensions.ts）。
// 商品配對用：商品可掛多個 persona code，並可給 8 維 target profile（0–100 錨點）。
// V2 再用與主站相同的 RMS 距離把商品配到人格；MVP 先人工掛 code。

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

/** 商品的目標人格傾向（8 維，0–100 錨點，只填想錨的維度）。 */
export type TargetProfile = Partial<Record<DimensionId, number>>;

// 22 人格。eggOnly = 彩蛋型（LIAR/FULL/NPC/PREP/GRGS），不適合當商品鎖定客群 → 不進標籤下拉。
export const PERSONAS = [
  { code: "RUSH", title: "鐵腿特種兵指揮官", eggOnly: false },
  { code: "LAZY", title: "飯店廢人", eggOnly: false },
  { code: "OBEY", title: "聽勸俠", eggOnly: false },
  { code: "COOL", title: "優越仔", eggOnly: false },
  { code: "FLEX", title: "限動洗版王", eggOnly: false },
  { code: "BURN", title: "報復性消費家", eggOnly: false },
  { code: "POOR", title: "金牌打野", eggOnly: false },
  { code: "DAZI", title: "朋友王", eggOnly: false },
  { code: "SOLO", title: "i 人獨旅修行者", eggOnly: false },
  { code: "WASH", title: "班味洗滌劑", eggOnly: false },
  { code: "WORK", title: "帶薪出國上班族", eggOnly: false },
  { code: "GRND", title: "窮鬼鐵人", eggOnly: false },
  { code: "LUXE", title: "神隱度假貴婦", eggOnly: false },
  { code: "BUDD", title: "佛系隨緣仔", eggOnly: false },
  { code: "FOOD", title: "美食特攻隊", eggOnly: false },
  { code: "GULA", title: "窮鬼美食家", eggOnly: false },
  { code: "HAUL", title: "人形代購行李箱", eggOnly: false },
  { code: "PREP", title: "攻略課代表", eggOnly: true },
  { code: "LIAR", title: "泉哥", eggOnly: true },
  { code: "FULL", title: "我全都要貪心怪", eggOnly: true },
  { code: "NPC", title: "NPC", eggOnly: true },
  { code: "GRGS", title: "古拉格斯", eggOnly: true },
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
