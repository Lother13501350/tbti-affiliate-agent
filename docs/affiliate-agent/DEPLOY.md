# 部署上線指南

## 架構：誰部署到哪

| 元件 | 跑在哪 |
|---|---|
| 主應用（後台 / 商品 / `/go` / 推薦 API / 匯入 / 每日 cron） | **Vercel**（獨立專案，與正式站分開） |
| 資料庫 | **獨立 Neon**（`ep-autumn-surf…`，**不是**正式站那個） |
| 「優化大腦」（Claude Agent SDK） | **不在 Vercel**（內含 ~215MB 原生執行檔，超過 serverless 函式上限）→ 本機 / 小型 Node 主機 / 排程 |

## 一次性準備
- GitHub 帳號（這個 repo 跟 travelmbti 是**不同** repo）
- 你的 Vercel 帳號
- 獨立 Neon 的 `DATABASE_URL`

## Step 1 — 推上 GitHub
在 github.com 開一個新的 **private** repo（例如 `tbti-affiliate-agent`，不要勾選建立 README）。然後：

```bash
git remote add origin https://github.com/<你的帳號>/tbti-affiliate-agent.git
git branch -M main
git push -u origin main
```
> `.env.local`（含資料庫密碼）不會上傳 —— 已被 `.gitignore` 忽略。

## Step 2 — 建 Vercel 專案 + 環境變數
1. Vercel → **Add New → Project** → 選剛剛的 repo → **Import**
2. Framework 自動偵測 Next.js，不用改
3. **Environment Variables**（Production）填：

| 變數 | 值 |
|---|---|
| `DATABASE_URL` | 你的**獨立** Neon pooled 連線字串 |
| `ADMIN_KEY` | 一組強隨機字串 |
| `CLICK_HASH_SALT` | 一組強隨機字串 |
| `CRON_SECRET` | 一組強隨機字串（Vercel Cron 會自動帶上） |
| `AGENT_WRITE_ENABLED` | `true` |
| `NEXT_PUBLIC_SITE_URL` | 先留空，Step 4 補 |
| `DISCORD_WEBHOOK_URL` | （選）要 Discord 日報才填 |
| `OPENAI_API_KEY` | （選）有效的 key，要開 AI 分類才填 |

> ⚠️ **不要**把 Claude token（`CLAUDE_CODE_OAUTH_TOKEN` / `ANTHROPIC_API_KEY`）放 Vercel —— 優化大腦不在這裡跑。
> ⚠️ `DATABASE_URL` **千萬別**填成正式站那條（`ep-summer-credit…`）。

4. **Deploy**

## Step 3 — 確認
- 開 `https://<你的網址>/` → 服務狀態頁
- `https://<你的網址>/admin?key=<ADMIN_KEY>` → 後台
- Vercel 專案 → **Settings → Cron Jobs** 應看到 `/api/cron/daily`（由 `vercel.json` 設定，每天 01:00 UTC）

## Step 4 — 補 `NEXT_PUBLIC_SITE_URL`
把 Production 的 `NEXT_PUBLIC_SITE_URL` 設成正式網址（例：`https://tbti-affiliate-agent.vercel.app`），再 **Redeploy** 一次。這樣 `/api/recommend` 回的 `goUrl` 才是絕對網址（給主站商品卡 CTA 用）。

## 優化大腦怎麼跑（非 Vercel）
部署版的 `/api/admin/optimize` 會 graceful 失敗（binary 已排除、也未設 token），這是刻意的。需要分析時：

- **本機**：`.env.local` 放 `DATABASE_URL`（獨立庫）+ `CLAUDE_CODE_OAUTH_TOKEN` → `npm run dev` → 開 `/admin/proposals?key=…` → 按「讓 Claude 分析一輪」
- **或** 之後架一台小型 Node 主機 / 排程定期跑（可再協助）

## 日後更新
`git push` 到 `main` → Vercel 自動重新部署。

## 主站整合（未來，需另行授權）
正式站 tbtitest.com 要顯示商品卡時，呼叫本服務的 **公開** `GET /api/recommend?persona=…&city=…`，拿排序後商品 + `goUrl`。主站**不需要**本服務的資料庫權限。此步驟會動到正式站 repo，屬上線動作。
