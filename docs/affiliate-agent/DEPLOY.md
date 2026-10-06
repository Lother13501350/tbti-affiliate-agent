# Deployment

The web service runs on Vercel, with affiliate data in Neon PostgreSQL. The Claude Agent SDK optimizer requires a local or other Node host because its native runtime is excluded from the Vercel function bundle.

## Prepare an isolated environment

Use a dedicated database or a database role restricted to the required affiliate tables. Do not connect a new deployment to another product's production database by assumption. Domain modules lazily create `affiliate_*` tables and indexes; this repository does not have a versioned migration system.

Install from the lockfile with `npm ci`, then run `npm run typecheck`, `npm run lint`, and `npm run build`. The October 6, 2026 audit passed those checks without credentials. Review current dependency advisories before public deployment.

## Configure Vercel

Import this repository as a Next.js project. Set the following in the environment settings:

- `DATABASE_URL`: the selected database connection string.
- `ADMIN_KEY`: a strong random admin secret.
- `CLICK_HASH_SALT`: a random value for session hashing.
- `CRON_SECRET`: a random bearer secret for the daily endpoint.
- `AGENT_WRITE_ENABLED=false`: retain the safe default until you intend to enable gated writes.
- `NEXT_PUBLIC_SITE_URL`: the deployment's public origin.
- Optional `DISCORD_WEBHOOK_URL` and `OPENAI_API_KEY`; use `OPENAI_MODEL` to select classification behavior.

Never place secrets in Git, screenshots, query strings shared with others, or this document. The current admin page navigation uses a query-string key, so it should not be presented as production identity management.

## Cron and verification

`vercel.json` defines `/api/cron/daily` at 01:00 UTC. The endpoint checks `Authorization: Bearer <CRON_SECRET>` and denies unconfigured production requests. It checks product links, computes metrics, and optionally sends Discord reports; platform order CSVs still require a separate import.

After deployment, inspect the public status page, verify that unauthorized admin requests return 403, and confirm the environment/cron configuration. Perform product imports, classification, and proposal approval only in a deliberate operations test with isolated data. Do not use the mutating `scripts/e2e.mjs` against a production database to prove that a deployment works.

## Local optimizer

Copy [.env.example](../../.env.example) to `.env.local`, select the intended database, configure the admin key, and provide either `ANTHROPIC_API_KEY` or `CLAUDE_CODE_OAUTH_TOKEN`. Start `npm run dev` and use the proposals administration page. The SDK has read tools and a proposal-submission tool; accepted proposals are applied by application code after review.

Do not configure optimizer credentials on Vercel while its native binary remains excluded. For a separate Node host, retain the same review gate and write switch.

## External product integration

The public `GET /api/recommend` endpoint returns ranked products and redirect URLs. A client product can consume this API without receiving database credentials. Any change to that client product or its deployment is a separate release decision.
