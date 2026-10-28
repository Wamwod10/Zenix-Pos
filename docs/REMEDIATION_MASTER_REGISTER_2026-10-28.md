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
| SAFE-001 | CONFIRMED | Neon production branch `br-small-dew-b197rvkz` was unprotected | FIXED / VERIFY | Neon API changed `protected: false` to `true` on 2026-10-28; readback required |
| SAFE-002 | CONFIRMED | Vercel proxy runtime reported Node DEP0169 for `url.parse()` | OPEN | Identify actual stack owner before changing application proxy. Application proxy already uses `new URL`; do not claim warning fixed |
| SAFE-003 | RISK | Backend Render auto-deployment disabled | REVIEW | Verify deliberate manual promotion, owner and rollback checklist; don't enable automatically |
| SAFE-004 | RISK | Restore drill and retention policy not independently verified in current audit | OPEN | Prove isolated recovery without overwriting live data; confirm offsite/retention coverage |
| SAFE-005 | CONFIRMED HISTORICAL | Render Telegram worker emitted 'financial writes paused' during 2026-10-27 cutover | MONITOR | No new error in 2026-10-28 08:00Z+ query; run alerting/retry and post-cutover review |
| SAFE-006 | CONFIRMED | Neon production migration ledger contains migrations through 046 | VERIFIED | Read-only DB `schema_migrations` query 2026-10-28 |
| SAFE-007 | IMPROVEMENT | Need repeatable external /health and /ready check | IMPLEMENTED / VERIFY | `node scripts/check-live-health.mjs https://www.zenixpos.uz`; CI should not depend on production internet |

## Phase 2 — Sales & POS Pro
| ID | Type | Exit condition |
| --- | --- | --- |
| POS-001 | RISK | Payment/stock/return/idempotency replay matrix with real PostgreSQL |
| POS-002 | NOT VERIFIED | Scanner, receipt printer, offline/reconnect and Windows/Android devices with actual hardware |
| POS-003 | RISK | Real customer checkout and cashier shift workflow, interruption, back-button and second tab |

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
