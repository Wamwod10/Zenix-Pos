# Zenix POS — 8-phase remediation register
Date: 2026-10-28. Source commits: frontend `d294df5`, backend `94f88cf`.

## Rules
- Do not close an issue without a reproducible failure or testable specification, fix commit, verification evidence, and production verification when relevant.
- Distinguish CONFIRMED, RISK, UX IMPROVEMENT, and NOT VERIFIED. A green build or synthetic test does not prove that every button or every physical device works.
- Never run destructive database migrations on production during an audit. Use a staged migration and verified recovery plan for schema changes.
- Use per-phase branches and reviewed PRs. Do not modify the established Zenix visual design tokens unnecessarily.
- A production deploy is only completed after Vercel/Render target and exact commit verification.

## Phase 1 — Production Safety
| ID | Classification | Finding | Status | Evidence/exit condition |
| --- | --- | --- | --- | --- |
| SAFE-001 | CONFIRMED | Neon production branch `br-small-dew-b197rvkz` was unprotected | FIXED / VERIFY | Neon API changed `protected: false` to `true` on 2026-10-28; readback CONFIRMED |
| SAFE-002 | CONFIRMED | Vercel proxy runtime reported Node DEP0169 for `url.parse()` | OPEN | Identify actual stack owner before changing application proxy. Application proxy already uses `new URL`; do not claim warning fixed |
| SAFE-003 | RISK | Backend Render auto-deployment disabled | REVIEW | Verify deliberate manual promotion, owner and rollback checklist; don't enable automatically |
| SAFE-004 | CONFIRMED / FIXED | Neon production snapshots were unscheduled. Configured automatic **daily at hour 21 UTC, retention 604800s (7 days)**; Neon readback confirmed. Existing manual snapshots preserved. | SCHEDULE FIXED / RESTORE NOT VERIFIED | Verify first scheduled snapshot after 21:00 UTC, verify size/storage cost and safe isolated restore. Do not modify production branch during rehearsal |
| SAFE-005 | CONFIRMED HISTORICAL | Render Telegram worker emitted 'financial writes paused' during 2026-10-27 cutover | MONITOR | No new error in 2026-10-28 08:00Z+ query; run alerting/retry and post-cutover review |
| SAFE-006 | CONFIRMED | Neon production migration ledger contains migrations through 046 | VERIFIED | Read-only DB `schema_migrations` query 2026-10-28 |
| SAFE-007 | IMPROVEMENT | Strict external /health and /ready check plus hourly monitoring | IMPLEMENTED / CI AND FIRST SCHEDULE PENDING | `node scripts/check-live-health.mjs https://www.zenixpos.uz`, 4 offline synthetic tests, GitHub Actions hourly at minute 17 after merge. Verify first real scheduled run and alert recipients |

## Phase 2 — Sales & POS Pro
| ID | Type | Exit condition |
| --- | --- | --- |
| POS-001 | RISK | Payment/stock/return/idempotency replay matrix with real PostgreSQL |
| POS-002 | NOT VERIFIED | Scanner, receipt printer, offline/reconnect and Windows/Android devices with actual hardware |
| POS-003 | RISK | Real customer checkout and cashier shift workflow, interruption, back-button and second tab |
| POS-004 | CONFIRMED UX | POS Pro `onConfirm` closed payment modal unconditionally even for definite 4xx checkout rejection, losing typed cash/split amounts and hiding inline error. | FIX IMPLEMENTED / VERIFY | Keep modal on definitive reject, preserve inputs, and verify no extra sale; unknown-write journal still opens recovery; PR #41 |

## Phase 3 — Inventory and financial accounting
| ID | Type | Exit condition |
| --- | --- | --- |
| INV-001 | RISK | Transfer/WAC/COGS/returns/retry across multi-warehouse scenarios verified in staging DB |
| INV-002 | RISK | Inventory count/concurrent sales, negative stock, batch/serial and branch isolation |
| FIN-001 | RISK | Customer credit, supplier invoices, expenses and cash summaries reconcile end-to-end |

## Phase 4 — Authentication, Billing, Permissions
| ID | Type | Exit condition |
| --- | --- | --- |
| AUTH-001 | RISK | Cross-business/branch/role authorization matrix, session expiry and reset |
| BILL-001 | RISK | Trial, promotions, renewals, pending receipt and rejected payment |
| BILL-002 | CONFIRMED UI | Billing promo text shows a literal question mark between discount and amount; improve copy/spacing |

## Phase 5 — Visual design
| ID | Type | Exit condition |
| --- | --- | --- |
| UI-001 | NOT VERIFIED | Real 320/375/390/768/1366px light/dark and 200% zoom screenshot review of every module |
| UI-002 | RISK | Dense Controls in Settings, Inventory, Billing and Sales; check card overlap with measured boxes and long data |
| UI-003 | RISK | All dialogs have keyboard focus, accessibility labels, readable small text, clear disabled reason |

## Phase 6 — Performance
| ID | Type | Exit condition |
| --- | --- | --- |
| PERF-001 | RISK | Large catalog (500+), sales (1000+), pagination, search, reconnect, memory and slow API response |
| PERF-002 | RISK | Back-end timings, slow queries, resource ceilings and representative concurrency |

## Phase 7 — Professional additions (not defects)
Action Center, unified system health, device readiness, contextual help, audit timeline; gated by priorities and impact rather than premature feature additions.

## Phase 8 — Final QA
Independent full E2E, mobile/desktop visual review, credentials/role matrix, staged release, exact commit verification and rollback rehearsal.

## Verified at kickoff
- Frontend 316/316 unit tests pass; build, audit, production/design verification pass.
- Both GitHub HEADs match live Vercel/Render commits. Render service is live.
- Current smoke-test/visual matrix is synthetic. Physical hardware/real authenticated production acceptance remains unverified.

## Phase 1 decision log — 2026-10-28
- Neon production branch protected: **true**. Verified by API readback.
- Automatic snapshot schedule: **daily, 21 UTC, 7-day retention**, verified by API readback. This can incur storage charges. Historical manual snapshots were not deleted.
- Neon project `history_retention_seconds=86400`: point-in-time history is 24h, distinct from snapshot retention. Evaluate RPO/RTO against requirements.
- A schedule is not recovery proof: first automatic snapshot and isolated restore must still be demonstrated without production writes.
- Frontend /health and /ready route is proxied to Render backend; the strict JSON checker requires service name and DB readiness. Hourly GitHub workflow begins only after merged to default branch; scheduled run is not a 24x7 guaranteed alert SLA.
- As-of audit, live health endpoints could not be reached through independent browser fetch; do not claim real production probe PASS based on synthetic unit tests. First GitHub runner health job is the operational acceptance gate.
