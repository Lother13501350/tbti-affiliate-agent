# Affiliate operations architecture and scope

The service turns a product-link experiment into an operations workflow: collect and review products, build affiliate URLs, classify them, track redirects, import order reports, and inspect attribution/commissions. This document distinguishes implemented code from proposed extensions.

## Architecture and deployment boundary

Next.js pages and route handlers call modules in `src/lib`. Neon supplies a PostgreSQL HTTP client; modules create their own `affiliate_*` tables lazily through a once-only schema helper. The database URL is configurable. A dedicated database or least-privilege role is the deployment recommendation; shared ownership of another product's production database is not assumed.

Vercel serves the web/API and scheduled endpoint. The Claude Agent SDK optimizer executes on a local or other Node host with its native runtime. Native optimizer files are excluded from the Vercel trace.

## Implemented modules

| Module | Responsibility |
| --- | --- |
| `products`, `links`, `taxonomy`, `personas` | Product lifecycle, curated metadata, affiliate URLs, persona classification. |
| `adapters/` | Platform SubId composition and CSV order normalization. |
| `clicks`, `hash` | Redirect context and optional salted session hashes. |
| `csv`, `orders` | Report parsing, import batches, file-hash and order-ID deduplication. |
| `revenue`, `scoring`, `recommend`, `gaps` | Metrics, ranking, recommendation previews, coverage gaps. |
| `health`, `discord` | Link checks and optional operations reports. |
| `classify` | Optional OpenAI classification. |
| `optimizer`, `proposals`, `audit` | Constrained advisory agent, reviewed decisions, action records. |
| `admin-auth`, `env`, `db` | Admin gate, feature switches, optional database client. |

## Data and request flow

A client uses `/api/recommend` to receive products and `/go/<code>` URLs. Redirects resolve the link, compose a contextual SubId, log click context best-effort, and return a 302 to the affiliate platform. Unknown/disabled links fall back to the configured home origin.

An operator uploads product/order CSVs through guarded APIs. Order normalization maps platform columns into a common record; file hashes and `(platform, external_order_id)` prevent duplicate imports. SubId decoding attempts persona/placement attribution and preserves unknown attribution rather than inventing a match.

The daily cron performs link health checks, computes metrics, and optionally sends Discord reports. It does not automatically download or import platform order reports. Credentials, platform permissions, and actual report contents determine what can be operated in a deployed environment.

## AI and write boundaries

The optimizer receives read tools plus `submit_proposals`; it is not a general command runner. It records pending proposals for human review. Application code can apply `pause`, `boost`, and `retag`; `replace` and `add_gap` remain advisory. An approved boost changes the application's bounded recommendation score, so the correct claim is constrained reviewed execution, not that recommendation ranking can never change.

`AGENT_WRITE_ENABLED` gates supported automatic write paths and defaults to false. It is not a blanket database read-only mode: click logging, schema initialization, proposal persistence, and explicitly reviewed decisions have their own code paths. Admin access uses a shared secret rather than individual user accounts or role-based access control.

## Privacy and security scope

The click schema omits raw IP/email columns; an optional salted hash links sessions. This is not an assertion that identifiers are mathematically anonymous or that infrastructure logs contain no personal data. Keep secrets out of URLs shared with others; admin navigation currently carries a query-string key.

The code is an MVP. SQL import and proposal concurrency now have executable integration evidence; dependency advisories, individual admin identity, and versioned schema migrations remain open limits.

## Verification and remaining work

The portfolio extension adds a separate public sample deployment, server-validated signed sessions, and a workflow UI for duplicate imports and reviewed product changes. It uses fixed suggestions with no paid AI calls. Demo roles are separate from operations access, and its bounded cookie adapter is not the operations database.

The order import is one PostgreSQL function call: a platform/hash advisory transaction lock protects batch replay, order upserts count only actual changes, and receipt persistence shares the transaction. Reviewed decisions lock the proposal and affected product, then commit product mutation, terminal proposal state, and audit persistence together. Replayed decisions cannot apply an action again.

On October 6, 2026, 37 domain/API tests, 16 actual PostgreSQL tests, and two built-server HTTP tests passed with zero skips. Typecheck, lint, and production build passed. GitHub Actions provisions its own PostgreSQL 16 service and runs the same checks. There is no coverage percentage or automated browser-suite claim. [Demo and test boundaries](DEMO.md) explain what the evidence establishes.

Remaining work includes versioned migrations, individual admin identities, production load verification, and dependency advisory remediation. Automatic ingestion and broader platform API integrations remain roadmap items. The legacy mutating `scripts/e2e.mjs` still requires an isolated environment.
