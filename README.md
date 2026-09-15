# TBTI Affiliate Agent

An affiliate operations service built with **TypeScript, Next.js, React, and Neon PostgreSQL**. It combines product management, redirect-based click tracking, CSV order imports, revenue reporting, and AI-assisted optimization proposals reviewed by a human.

## Engineering overview

| Area | Implementation |
| --- | --- |
| Web application | Next.js App Router, React, TypeScript, Tailwind CSS. |
| Data layer | Neon PostgreSQL with affiliate product, click, order, and proposal records. |
| Integrations | Platform adapters for affiliate links and order report formats. |
| Operations | Protected admin routes, a daily cron endpoint, and optional Discord reports. |
| AI workflow | Classification and an advisory optimizer; proposals are executed through application code after review. |
| Click data | Salted session hashes when configured; click records omit raw IP addresses and email. |

Source code is organized into `src/app/` for pages and routes, `src/lib/` for domain logic and platform adapters, and `scripts/` for import and diagnostic utilities.

## TBTI 聯盟商品與分潤連結 Agent

聯盟商品生命週期管理：**蒐集商品 → 建立分潤連結 → 分類標籤 → 配對人格 → 追蹤點擊 → 匯入訂單 → 計算收益 → 淘汰低效商品**。

獨立服務 + 自己的後台，與主站 [`tbtitest.com`](https://github.com/TREKX-dev/travelmbti) 共用同一個 Neon Postgres。完整設計見 [`docs/affiliate-agent/PLAN.md`](docs/affiliate-agent/PLAN.md)。

## 快速開始

```bash
npm install
cp .env.example .env.local   # 填 DATABASE_URL / ADMIN_KEY 等（全部可選，缺則對應功能停用）
npm run dev                  # http://localhost:3000
```

後台：`http://localhost:3000/admin?key=<ADMIN_KEY>`

## Scripts

| 指令 | 用途 |
|---|---|
| `npm run dev` | 開發伺服器（Next 16 + Turbopack） |
| `npm run build` / `npm run start` | 正式建置 / 啟動 |
| `npm run typecheck` | `tsc --noEmit`（主要型別門檻） |
| `npm run lint` | ESLint |

> 目前沒有測試框架；主要驗收門檻為 `typecheck`、`lint` 與手動 smoke check。另有 `scripts/e2e.mjs`，執行前請閱讀內容並準備隔離測試環境，因為它會使用後台 API。

## 環境變數

| 變數 | 缺值時 |
|---|---|
| `DATABASE_URL` | DB 功能全停（後台仍可開、跳轉照走） |
| `ADMIN_KEY` | `/admin` 與 `/api/admin/*` 一律 403 |
| `AGENT_WRITE_ENABLED` | 唯讀 / 只報告（kill switch，預設 false） |
| `CLICK_HASH_SALT` | 不寫 session 雜湊欄位 |
| `DISCORD_WEBHOOK_URL` | 日報 / 警報只寫 console |
| `CRON_SECRET` | production 下 `/api/cron/*` 一律 403 |

## 核心流程

```
使用者點商品卡 CTA → /go/<code>
  → 解析連結 → 寫 affiliate_clicks（情境 + 雜湊 session，無 PII）
  → 302 到平台聯盟連結（cid / ud1 / sub_id 原樣帶出）
平台後台依 SubId 歸因 → 下載訂單報表 CSV → 後台匯入（platform+external_order_id 去重）
  → 點擊 × 訂單歸因 → 商品 / 人格 / 平台收益（CTR / EPC / RPM）
每日 Cron：健康檢查連結 → 標記失效 → 算 CTR → 匯入訂單 → 算收益 → Discord 日報
```

## 隱私

`affiliate_clicks` 只存情境欄位（人格碼 / 頁面 / 版位 / campaign）與**雜湊化** session，**不存原始 IP / email**，延續主站 `ad_clicks` / `answer_logs` 的「無法回推個人」原則。

## MVP 範圍

見 PLAN.md §6。本版回答：**哪些商品有人點？哪些有成交？哪些真正有收益？**

## Current scope & deployment

This repository contains an MVP service and administration interface. Database-backed features require `DATABASE_URL`; admin routes require `ADMIN_KEY`. AI and notification features additionally need their own credentials. An existing hosted instance is an operations environment and may require authorization, rather than providing a public interactive demo.

For local development, use the environment variable reference above and [`.env.example`](.env.example). Production setup and migration guidance are in [docs/affiliate-agent/DEPLOY.md](docs/affiliate-agent/DEPLOY.md). Design and planned extensions are documented in [docs/affiliate-agent/PLAN.md](docs/affiliate-agent/PLAN.md); roadmap items should not be treated as implemented features.
