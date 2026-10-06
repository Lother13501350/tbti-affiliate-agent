# Public demo and verification boundaries

[Open the workspace](https://tbti-affiliate-demo.vercel.app/demo)

## Reproducible scenario

The initial CSV contains DEMO-101 (confirmed, TWD 120 commission), DEMO-102 (pending, TWD 90), DEMO-103 (completed, TWD 160), and an identical DEMO-101 row. Import yields three inserts and one duplicate; replay skips the file. A second CSV refunds DEMO-101 and completes DEMO-102, updating two records. Only confirmed/completed commissions count, giving TWD 280 before the update and TWD 250 afterward. These are fictional fixtures, not earnings.

The review queue contains a bounded boost, a pause, and an advisory replacement. Suggestions begin pending. Boost approval changes 92 to 100; rejection leaves the product unchanged. Replacement approval records `approved` without product mutation. Viewer mode disables writes in the interface and the API independently returns 403; **Check permission** deliberately sends a denied request to make that boundary visible.

## Storage and access

`/api/demo` uses a signed, compressed sample snapshot in an HttpOnly, SameSite=Strict cookie. Production sets Secure and requires a signing secret of at least 32 characters. Cookies expire after one hour and reset affects only the current browser. Signatures protect integrity; cookie contents are fictional and are not encrypted.

The demo shares CSV normalization and the application decision planner with operations. Its bounded in-cookie record adapter is intentionally separate from PostgreSQL persistence. It retains six report hashes, up to eight sample orders, and four recent actions. It is a single-browser sandbox: parallel tabs can overwrite the same cookie snapshot, and clearing cookies discards it. Sequential request replay is tested; the demo does not claim database-style concurrent writes.

Demo roles are freely selectable sample roles. They never grant operations permissions. Operations continue to require the shared admin secret. The isolated public Vercel project has no operations database, admin, AI, partner, or Discord credentials and no cron schedule.

## Tested database guarantees

`tests/postgres.integration.test.ts` loads the exported operations table definitions and the exact PL/pgSQL in `src/lib/workflow-sql.ts`, then executes them against an exclusive local/CI PostgreSQL database. It does not mock SQL.

Order tests cover row/file duplicates, platform-scoped identities, changed statuses and commissions, concurrent identical imports, mid-batch rollback, and successful retry after failure. Proposal tests cover pending/rejected/advisory states, boost limits, replay, simultaneous decisions, two proposals updating the same product without losing an increment, pause/retag filtering, missing targets, and rollback when audit persistence fails.

Unit/API tests cover normalization, negative status matching, malformed CSV, runtime validation, fail-closed admin configuration, cookie signature/expiry, forged roles, visitor isolation, denied origins, and oversized reports. The HTTP suite starts the built Next server with service credentials cleared and verifies real cookie/route behavior. These checks do not measure partner API correctness, AI output quality, production throughput, or code-coverage percentage.

## Browser evidence

The English demo was checked at 1280px and 390px widths. Wide data tables scroll inside their own containers; the mobile page does not overflow horizontally. Initial import, replay, update, Viewer denial, boost approval, and reset were exercised through the actual interface.

The README screenshot is an actual capture of the isolated published demo on October 6, 2026. See [screenshot provenance](../screenshots/PROVENANCE.md).
