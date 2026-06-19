# 聯盟商品與分潤連結 Agent — 實作計畫

> 狀態：MVP 建置中。獨立服務 + 自己的後台，與主站 `tbtitest.com`（[TREKX-dev/travelmbti](https://github.com/TREKX-dev/travelmbti)）共用同一個 Neon Postgres。

## 0. 定位：把既有「試水溫」畢業成完整系統

主站已有一個刻意做小的聯盟試水溫，本 Agent 是它設計文件指定的下一步（原話：_"Graduate the creative from `ads.ts` (config) → a `feed_ads` DB table with an admin upload UI"_）。

| 既有（主站，預設關閉） | 本 Agent 升級為 |
|---|---|
| `src/lib/ads.ts` 單一硬寫死 KKday 卡（config） | `affiliate_products` 商品庫 + 後台 |
| `ad_clicks`（只存 ad_id/locale/時間，無 PII） | `affiliate_clicks`（情境 + 雜湊 session，仍無 PII） |
| `/api/ad/[id]` → 計數 → 302 帶出 `cid+ud1` | 一般化為 `/go/[code]` 深層連結跳轉 |

**人格模型校正**：主站真正的模型是 **22 人格 × 8 維度**（`pace, planning, budget, social, content, workleak, pigeon, foodie`）。規格的 FOOD/SOLO/LUXE/BUDGET 只是例子；商品配對直接用這 8 維 + 主站相同的 RMS 距離（V2）。

## 1. 技術棧（沿用主站約定）

Next.js 16（App Router）、React 19、TypeScript、Tailwind 4、Neon Postgres（`@neondatabase/serverless` HTTP）、zod。
- **無 migration**：每模組 lazy `CREATE TABLE IF NOT EXISTS`（比照 `ad-clicks.ts`）。
- **無測試框架**：`npm run typecheck`（tsc --noEmit）+ `npm run lint` + 手動 smoke = 驗收門檻。
- **缺 env 一律 graceful no-op**。

## 2. 架構與權限隔離

- **兩個部署、一個資料庫**：本服務做全部重活（匯入 / AI 分類 / 連結 / 健康檢查 / 訂單歸因 / 績效 / 優化 / Discord / Cron / 後台）；主站只做最小整合（讀 `affiliate_*` 渲染商品卡、提供 `/go/[code]`）。
- **`/go/[code]` 放主站網域**（連結信任、同網域 session），寫入本 Agent 擁有的 `affiliate_clicks`。本服務也內建一份 `/go/[code]` 供獨立驗證。
- **權限（§13）**：Agent 用限權 DB 角色 → `affiliate_*` 可讀寫；正式站 user/auth 表不可寫，只讀匿名聚合 View。
- **Kill switch（§52）**：`AGENT_WRITE_ENABLED=false` → 唯讀 + 只報告。
- **稽核（§51）**：所有變更寫 `affiliate_audit_log`（誰/何時/前後值/理由/是否核准）。
- **隱私**：`affiliate_clicks` 存情境欄位（人格碼/頁面/版位/campaign）+ 雜湊 session，**不存原始 IP/email**，延續主站「無法回推個人」原則。

## 3. 資料模型（全部 lazy-DDL，`affiliate_` 前綴）

| 表 | 角色 | 規格 |
|---|---|---|
| `affiliate_products` | 商品主表（分類 / 人格 / 目的地 / 情境標籤 / 信心分 / 生命週期 status / 推薦分） | §4,5,6,7-11,17 |
| `affiliate_links` | 每個（商品×版位×人格×campaign）一條深層連結 + SubId；`/go/[code]` 的 code | §12,13,14 |
| `affiliate_clicks` | 點擊事件（情境 + 雜湊 session，無 PII） | §26-28 |
| `affiliate_orders` | 訂單／佣金（`platform+external_order_id` 唯一去重） | §29-34 |
| `affiliate_import_batches` | 匯入批次來源/雜湊，防重複匯入 | §32 |
| `affiliate_audit_log` | 所有變更稽核 | §51 |

狀態機：`draft / pending_review / active / paused / expired / broken / sold_out / rejected / archived`。

## 4. Agent 執行模型（不是聊天機器人）

= 每日排程管線（Vercel Cron）+ LLM 輔助分類 + 人在迴路審核 + 決定論排序公式。
- 分類用 LLM + 結構化輸出，存 `classification_confidence`（≥0.9 自動過 / 0.7 抽查 / <0.5 人工）。沿用主站「LLM 不做最終裁決」哲學。
- 排序用固定公式（§17）：`人格×25 + 目的地×25 + CTR×15 + 轉換×15 + 佣金×10 + 新鮮度×5 + 人工×5`，強制多樣性 + 冷啟動。**佣金非唯一因子（§18）**。

## 5. 平台 Adapter（每平台獨立）

介面：`detect / extract / buildDeepLink / appendSubId / parseOrderReport`。實作：`Klook / KKday / Trip.com / Generic`。
鐵則：抓不到欄位 → `needs_review`，**絕不捏造價格/評分/優惠**。SubId 規則 `persona_dest_placement_variant`（KKday 用 `ud1`）。

## 6. 開發階段

- **MVP（本次）**：商品庫 + 人工/CSV 匯入 + 分潤連結保存 + `/go/[code]` 追蹤 + SubId + 狀態管理 + 基礎人格/目的地標籤 + 連結健康檢查 + 點擊數據 + 訂單 CSV 匯入 + 商品收益報告 + Discord + 最小後台。回答「**哪些商品有人點？有成交？真正有收益？**」
- **V2**：AI 自動分類 + 人格推薦分 + 自動排序 + 缺口分析 + 替代建議 + 頁面別推薦 + A/B。
- **V3**：平台 API/Feed + Postback + 自動更新庫存價格 + 自動換失效商品 + 即時推薦 + Email 個人化。

## 7. 成功指標（§16 → 後台首頁）

連結失效率、無法歸因訂單比例、CTR、點擊→訂單轉換率、曝光 RPM、EPC、每位訪客收益、維護人工時數、每週待審核數、失效發現速度。

## 8. 採用的預設（可推翻）

1. 共用同一個 Neon（限權角色）。
2. `/go/[code]` 放主站網域，寫共用 `affiliate_clicks`。
3. 隱私：情境 + 雜湊 session，不存原始 PII。
4. AI 分類沿用 AI SDK（現任 OpenAI，可換 Claude）— V2。
5. MVP 不碰主站 repo；主站整合是獨立小工項（屬上線動作）。

## 9. 檔案地圖（本服務）

```
src/lib/
  env.ts            環境旗標 + kill switch
  db.ts             Neon client + once() 一次性 DDL
  hash.ts           session 雜湊（無 PII）
  csv.ts            零相依 CSV 解析 + 欄位挑選
  personas.ts       22 人格 × 8 維度詞彙（鏡像主站）
  audit.ts          affiliate_audit_log
  products.ts       affiliate_products schema + CRUD + 狀態機
  links.ts          affiliate_links + SubId + /go code
  clicks.ts         affiliate_clicks（隱私安全）
  orders.ts         affiliate_orders + import_batches（去重）
  health.ts         連結健康檢查
  revenue.ts        商品收益 rollup（CTR/EPC/RPM）
  discord.ts        Discord webhook（日報/警報）
  adapters/         Klook/KKday/Trip/Generic + detect 註冊表
src/app/
  go/[code]/route.ts        跳轉 + 點擊
  api/admin/*               商品 / 匯入 / 訂單匯入（ADMIN_KEY 閘）
  api/cron/daily/route.ts   每日管線（CRON_SECRET 閘）
  admin/*                   後台 UI（dashboard / products / review）
```

## 10. 驗收（MVP）

```
npm run typecheck     # tsc --noEmit
npm run lint
npm run dev           # /go/<code> → 302 + affiliate_clicks 一筆；CSV 匯入；/admin 渲染
```
缺 `DATABASE_URL` → 後台可開、跳轉照走（不寫點擊）、不爆。
