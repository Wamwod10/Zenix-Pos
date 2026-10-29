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
| POS-004 | CONFIRMED UX / FIX IMPLEMENTED | Definite 4xx rejection closed POS Pro payment modal, losing cash/split inputs and inline error. PR #41 retains modal and inputs, checks two methods, no duplicate sale, and preserves unknown-write recovery. Browser PASS and production verification required. |

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

## Phase 2 continuation — 2026-10-28 later verification
- **POS-005 / Issue #51 — CONFIRMED / FIXED / RELEASE VERIFIED:** optional shift-close `expectedCash` was still `z.coerce.number()`, permitting explicit empty string or null to become zero. Backend PR #26 added signed, exact-cent validation before coercion and isolated PostgreSQL HTTP regressions. Head `79292e29c802ae32d703796513964fedb4dc1490` CI SUCCESS; squash merged to backend main `3eea1dab5b7183834d11007d6ab1d32c732dabb9`. Backend main push CI `40692061083` SUCCESS for exact merge SHA; Render deployment `dep-dbgv3eu1egvs73e7vf4g` LIVE at that SHA; post-deploy frontend-proxied `/health` and `/ready` HTTP 200 and database `ready` at 13:00 UTC. Issue #51 CLOSED. Hardware and authenticated sale E2E remain outside this fix proof.
- **POS-004 and money fixes — RELEASED by provider readback:** backend PR #24 merge `743083bfce1f0c27d8e258eecfcddace69c05543` and PR #25 merge `d39e41e1b761183a214a86ff23feabf94b6812d4`. Render deployment `dep-dbgu9qrl550s7387mb5g` LIVE at `d39e41e1b761183a214a86ff23feabf94b6812d4`. PR #25 latest head `6be5a2b93ca85b62d57da91d45f4fd31c9aee5c9` Verify Backend CI SUCCESS; note main push workflow is not returned by the PR-only workflow lookup.
- **OPS-001 / Issue #46 — FIXED / CLOSED:** Vercel production `dpl_BXbSajazea1Kt5UHer27VJai4bLE` READY and production aliases include `www.zenixpos.uz`, SHA `8cece7afda2137dcd8c491c6f9bbd66fb935cc99`. Prior HTTP 402 quota failures are historical. Vercel-linked read-only `/health` and `/ready` returned HTTP 200 (`ok:true`, database `ready`) 2026-10-28 12:57 UTC. Exact frontend main SHA push CI SUCCESS. Issue #46 closed for resolved deployment blocker; recurring quota risk still tracked in release procedures.
- **SAFE-002 — CONFIRMED RUNTIME WARNING / ORIGIN NOT VERIFIED:** Vercel recorded `DEP0169 url.parse()` on `/api/proxy` for this deployment. The project-owned `api/proxy.js` uses `new URL()`; identify upstream runtime/dependency stack before editing proxy or hiding warnings.
- **SAFE-008 — RISK / CONFIGURATION REVIEW:** Render start log emitted pg-connection-string v3/pg v9 future SSL semantics warning, while current PostgreSQL connection and API startup succeeded. `src/db/config.js` allows `sslmode=require|verify-ca|verify-full`, and production enables channel binding; do not weaken TLS or change production secret in response to a warning. Validate a compatible future-proof configuration in staging first.
- **Production safety:** No customer data mutated for this audit. Vercel production read-only `/health` and `/ready` probes returned HTTP 200 at 12:57 UTC and again at 13:00 UTC after backend PR #26 deployment. Database readiness verified. No customer financial writes for smoke tests.

## Continuation — Phase 2 release closure and Phase 3 financial safety — 2026-10-28

- **POS-009 / Issue #50 — FIXED AND RELEASED:** backend PR #27 `81347cbd32260b02a3a10a739151df6659f1c9ac` (Render `dep-dbgvmomk1f9s73991utg` LIVE); frontend PR #55 `33601c6b9a51d5a8bd18115d5ec7cbefe8e6bf83` (Vercel `dpl_4tRU96kHfoBJRxgAfNUhTcS7eVfE` READY). Both exact main CI SUCCESS, frontend-proxied /health and /ready HTTP 200 with database ready on 2026-10-28 13:54 UTC. Code-specific issue #50 closed; real cashier hardware and authenticated E2E remain unverified under #42/#43.
- **POS monetary precision / Issue #53 — FIXED AND RELEASED:** frontend PR #54 `683e95f936d13d604fc89b160dbdc3357710fc41` previously READY on Vercel; legacy Sales POS split cash, credit remainder and change derived by integer cents. The later PR #55 release incorporates it. Issue #53 closed. No real customer transaction was created for testing.
- **FIN-002 / Issue #56 — CONFIRMED / FIXED / RELEASE VERIFIED:** backend PR #28 merged `111eb1989c0425df80d5f471681778e0942c2ebb`, last PR head `1cf7270a7347c52fd55cbfa4e8d08bfb59ffccb3` CI SUCCESS; merged-main push CI `40702010816` SUCCESS. Supplier invoice total, optional paidAmount and supplier payment amount validate exact cents before coercion; isolated PostgreSQL HTTP regression added.
- **FIN-003 / Issue #57 — CONFIRMED / FIXED / RELEASE VERIFIED:** backend PR #29 merged `ba73ceea70e8e83e1baa2fa04615e5aa7a9800ed`; last head `e8ab52b42edaa7b505e41d9bd39e80b88f9fec43` CI SUCCESS. Exact-cent POST/PATCH validation plus separate confirmed PATCH default regression fix (amount-only update must preserve payment method, category and note). Includes disposable PostgreSQL regression.
- **INV-003 / Issue #58 — CONFIRMED, RECEIPT SUBSCOPE RELEASED / FURTHER QUANTITY AUDIT OPEN:** backend PR #30 merged `f7660b8438c210b1898c3b287940ad1f8243a203`; last PR head `78406671216ab9e90e5c45e4ac41f2cb6183165b` CI SUCCESS. Receipt quantity exact three decimals and settlement paidAmount exact two decimals before conversion; remaining transfer/adjust/sales quantity input tolerance needs separate remediation. Keep Issue #58 OPEN until broader scope verified.
- **Backend release verified:** combined backend main `ba73ceea70e8e83e1baa2fa04615e5aa7a9800ed`, exact push CI `40703425739` SUCCESS; controlled Render deployment `dep-dbh065k9v7es73bgv3h0` LIVE at same SHA at 14:14 UTC; read-only www.zenixpos.uz `/health` and `/ready` HTTP 200 with database `ready` after deploy. Supplier issue #56 and expense issue #57 CLOSED; inventory receipt quantity issue #58 remains open for other quantity endpoints. No customer financial mutations used as probes.
- **Outstanding Phase 1/2 gates:** Neon snapshot scheduled for 21:00 UTC and isolated restore rehearsal not yet independently verified (#38); Vercel Node DEP0169 proxy warning still open (#39); Telegram worker operational alert review (#40); physical printer/scanner/cash drawer and authenticated end-to-end checkout (#42/#43). A green synthetic suite does not satisfy these.

## Phase 3 inventory quantity precision — final code release, 2026-10-28 14:40 UTC
- **INV-003 / Issue #58 — CODE DEFECT FIXED / RELEASE VERIFIED:** Separate strict raw three-decimal input checks applied to inventory receipt (PR #30), transfer create/receive and manual signed adjustment (backend PR #31), and Sales POS/returns (backend PR #32). Explicit blank/null, sub-0.001 and over-precision values fail HTTP validation in isolated PostgreSQL; zero received quantity and valid negative adjustment remain supported. Database NUMERIC(18,3) ledger and tenant permissions preserved.
- **Additional confirmed inventory snapshot precision defect** in Issue #58: native JavaScript `before +/- quantity` could yield e.g. `10.299999999999999` rather than exact `10.300` returned/audited. Backend PR #33 uses BigInt thousandths and safe numeric boundary guard in four transfer/adjustment snapshot paths, with regression tests. Does not rewrite existing customer data or change WAC/COGS ledger SQL.
- PR #31 exact head `daf2d0540db1d424d7374a47f07e1001e999e794` CI SUCCESS; merged `90a011f32ae3ff630586e5a6707f98d2878f48e6`. PR #32 head `efe43a16ba86385823cd75d8f2b9d3b1c55bf4cc` CI SUCCESS; merged `110f00b262f4d4ed2869fabd783671a56e27f22b`. PR #33 head `a2ea810f57d790c81f2a49a5ccceb6031864da3b` CI SUCCESS; merged `8d5fbd81e911c2fa23a86d374bf7ec46b0e3a13b`.
- Combined backend `main` exact SHA `8d5fbd81e911c2fa23a86d374bf7ec46b0e3a13b`, Actions workflow `40707689286` **SUCCESS**, controlled Render deploy `dep-dbh0i3om7kps73ev2hvg` **LIVE** at 14:39 UTC. Post-deploy proxied `/health` and `/ready` HTTP 200, database `ready` at 14:40 UTC. Issue #58 CLOSED for specific code defects only.
- **REMAINS OPEN (different acceptance scopes):** INV-001 transfer/WAC/COGS/returns concurrency/valuation matrix; INV-002 inventory counts/serial/batch race and branch boundaries; FIN-001 credit and supplier reconciliation across report views; SAFE-004 isolated Neon snapshot restore; physical device E2E and cross-role billing. No real customer financial/stock records mutated for test verification.
- **Runtime risk continues:** Render PostgreSQL client emitted its documented SSL-mode future-semantics warning in the successful release. Do not weaken production TLS without verified staging migration.

## Phase 3 checkpoint — 2026-10-29

- **INV-004 / Issue #61 — CONFIRMED / FIXED / RELEASE VERIFIED:** backend PR #34 corrected transfer available quantity from floating `Number(balance.quantity) - reserved` to exact 3-decimal arithmetic under locked stock. Head `eec91e349caef612f28ab1273b3c2552219b7c75` CI run `40831474369` SUCCESS, squash merged backend main `c7a4e16d5a67453b4ff12cb272dd219ba1dd725c`, main push CI `40836552061` SUCCESS. Render controlled deploy `dep-dbhhcilg1s2s73a3e51g` LIVE at exact SHA 09:48 UTC; postdeploy read-only /health and /ready HTTP 200, DB ready at 09:49 UTC. Disposable PostgreSQL regression: pending reservations 0.200 + 0.100 on 0.300 succeed; extra 0.001 rejected 409 with no third reservation/stock change. Issue #61 CLOSED.
- **SAFE-004 / Issue #38 — PARTIALLY VERIFIED, NOT CLOSED:** production Neon branch `br-small-dew-b197rvkz` protected/ready; automatic daily 21:00 UTC snapshots with 604800-second (7-day) retention confirmed. 2026-10-28 21:00:06 UTC automatic snapshot `snap-misty-tree-b1y7w86e` exists. Existing isolated restore branch `br-nameless-credit-b18fhfgm` named `zenix-045-046-real-snapshot-restore-rehearsal-20261028` has `restore_status: restored`, ready, sourced from `snap-sweet-mountain-b1nmxspo` (2026-10-27). Read-only SQL compares 64 public tables and 46 schema migrations on production and restore, with identical counts at observation time for organizations (17), stores (18), products (107), balances (108), sales (140), transfers (2). This is positive restore evidence but not a validated point-in-time checksum, relational integrity proof, or test of restoring the latest automated snapshot. Do not restore into production, delete a branch, or mark full rehearsal PASS without further checks.
- **Runtime warning remains:** Render PostgreSQL client emitted SSL-mode future semantics warning on release while connecting successfully. Investigate staging TLS configuration without weakening current production security.
- **Other open gates:** isolated Neon restore integrity and latest-snapshot drill (#38), hardware/online-offline tests (#42), full POS financial/live-device E2E (#43), Telegram worker operational alerts (#40), Vercel proxy DEP0169 (#39), and wider WAC/COGS concurrent accounting matrix. Neither CI SUCCESS nor health endpoints establish full customer acceptance.

## Phase 4 — Authentication security checkpoint, 2026-10-29

- **AUTH-001 / Issue #63 — CONFIRMED / FIXED / RELEASE VERIFIED:** The authenticated `POST /api/users/me/password` verified the current password but allowed a new password identical to the old one, clearing `must_change_password` without credential rotation. Backend PR #35 now rejects reuse against the stored bcrypt hash with HTTP 400 `PASSWORD_REUSE_FORBIDDEN`, leaving the mandatory change and sessions intact.
- **AUTH-002 / Issue #64 — CONFIRMED / FIXED / RELEASE VERIFIED:** The privileged staff endpoint `POST /api/users/:id/reset-password` allowed a logged-in OWNER to reset their own password without verifying the current password. PR #35 denies self-reset with HTTP 403 `SELF_PASSWORD_RESET_FORBIDDEN`; the protected `/me/password` endpoint is used for self changes, while delegated staff resets remain allowed.
- **Implementation/release:** backend PR #35 exact head `f0677aaf0e4aa8fd764e4ab2b52f7e575bf1a1d9` CI run `40858921477` SUCCESS. Squash merge backend main `a1d1e6276206f31ca4818f8683772e78060ab3e8`, main push CI `40859314901` SUCCESS. Manual Render deployment `dep-dbhi608ae00c73drerjg` LIVE at exact SHA 2026-10-29 10:42 UTC. Vercel-proxied production `/health` and `/ready` HTTP 200, database ready at 10:43 UTC. Issues #63 and #64 CLOSED.
- **Regression evidence:** one synthetic HTTP test verifies unchanged-password 400 without credential/session mutations, genuine new-password 200 with revocation of other sessions, and owner self-reset 403. No production customer credentials or session records modified for QA. No migration.
- **Open Phase 4–8 gates:** Wider billing permission and cross-tenant entitlement audit, real authenticated device E2E, backup/restore point-in-time checksum validation, Vercel DEP0169 warning, PostgreSQL TLS future-semantics warning, and final security acceptance. Successful read-only health endpoints do not prove user workflows in production.

## Phase 4 Billing — Input Integrity and Read-only Protection — 2026-10-29

- **BILL-001 / Issue #66 — FIXED / RELEASE VERIFIED:** Backend billing draft schema previously accepted `extraStoreCount:''` and `null` via `z.coerce.number()`, which silently converted them to zero (and could then create a default one-store EXTRA quote). The updated schema validates raw integer numbers or decimal-digit strings, retaining omitted count default zero but rejecting explicitly empty, null, boolean, fractional and out-of-range values.
- **BILL-002 / Issue #67 — FIXED / RELEASE VERIFIED:** `GET /api/billing/draft` is authorized by `moduleBilling` (read permission), but previously persisted `status='cancelled'` when the quote was stale. Reads now return `{draft:null,stale:true}` without writing, preserving the `billingWrite` boundary. `POST /payments` still returns 409 for stale draft, and `POST /draft` still cancels existing open drafts when creating a new one.
- **Evidence:** Backend PR #36 last head `630ef0b892dc740a59bdf6c16e5e09c390e559e3` GitHub CI `40861644493` SUCCESS. Combined backend main `9a77a7beae0653521b0bd8580a9cc68a558db0e0`, exact main CI `40861958396` SUCCESS, Render controlled deployment `dep-dbhifngm7kps73f0jh20` LIVE at exact SHA 2026-10-29 11:03 UTC. Post-deploy `/health` and `/ready` HTTP 200, database `ready` at 11:04 UTC. Issues #66 and #67 CLOSED.
- **Regression:** Focused billing input validation and existing disposable PostgreSQL HTTP subscription/resource contract updated to assert a stale GET does not mutate, while stale payment submission is denied. No production customer billing/payment records were written during QA. No database migration.
- **Still open:** Phase 4 cross-role and Super Admin authorizations, broader billing concurrency/payment review matrix, Neon newest snapshot restore checksum (#38), real POS hardware/offline acceptance (#42/#43), and final Phase 8 customer safety checks.

## Phase 4 authorization hardening — verified 2026-10-29 12:57 UTC

- **AUTH-003 / Issue #69 — CONFIRMED / FIXED / RELEASE VERIFIED.** `hasPermission` previously used `Boolean(overrides[permission])` / `Boolean(rolePermissions[role][permission])` for persisted role grants; truthy JSON strings like `"false"` could unintentionally grant `billingWrite`, `settingsWrite` and other permissions. `PATCH /api/settings/workspace` allowed such malformed role permission values as `z.any()`. The new policy grants an override only when its stored value is literal boolean `true`, while settings role permissions require boolean values before writing. Existing configurable-role/key validation, OWNER and PLATFORM_ADMIN boundaries and valid true/false overrides remain unchanged.
- **Implementation:** backend PR #37, head `4c1b8f3d0ac40e88c8a0b3d699c9caf1c5e4e7e0` CI `40876686649` SUCCESS, squash merged `b328940d6816ca7f1305b573d31918cfb346d29a`; exact backend main push CI `40877054644` SUCCESS. Controlled Render release `dep-dbhk4uoae00c73dvr8qg` **LIVE** at exact SHA 12:57 UTC. Production `/health` and `/ready` both HTTP 200; database `ready` at 12:57 UTC. Issue #69 CLOSED.
- **Regression:** targeted parser/resolver unit tests verify malformed persisted values fail closed, intentional boolean true grants remain supported, false revocations remain effective and platform-only privilege is unaffected. No migrations or real client permission writes in QA.
- **Separate open acceptance work:** cross-role authenticated production E2E, Super Admin action audit, multi-tenant billing review access, latest Neon restore rehearsal (#38), POS hardware/offline testing (#42/#43), Vercel DEP0169, and PostgreSQL TLS warning. Green CI and read-only health do not certify all 8 phases complete.

## Phase 4 closure / Phase 5 UI focus checkpoint — 2026-10-29

- **AUTH-UI / Issue #74 — FIXED / VERIFIED:** Frontend `StoreContext.hasPermission` now mirrors backend strict permission grants: JSON strings `"false"` and `"true"` never grant access; only literal boolean `true` does. OWNER never gets `platformAdmin`. Frontend PR #73 last head `55f9f83e6935b472e195ccfafbd83d92eb9299a8` CI `40880270044` SUCCESS; squash merged `2c533aedb034e04d4cf523b86715f7a2d7529fae`. Exact frontend main CI `40881241343` SUCCESS, Vercel `dpl_DmsyR3UXsfSdNgpstJ7gv4HeuKUT` READY at exact SHA, `www.zenixpos.uz` alias verified. Issue #74 CLOSED.
- **BILL-UI / Issue #72 — FIXED / VERIFIED:** Super Admin payment review now guards duplicate approvals/rejections with a synchronous ref lock acquired before confirmation; actions disabled and restored via `finally`. Same PR, CI, Vercel release, Issue #72 CLOSED. No real customer payment action performed during QA.
- **CI-001 / Issue #71 — FIXED / VERIFIED:** Python Playwright 1.56 Chromium installer failed on GitHub Ubuntu 26.04 runner despite earlier frontend checks passing. PR #70 pinned `verify.yml` to supported `ubuntu-24.04`; exact PR CI `40878815947` SUCCESS and merged `2e960723c9854657c91288945e6fd7bf1a9fc598`; main CI `40879768393` SUCCESS. No browser smoke coverage removed. Issue #71 CLOSED.
- **UX-001 / Issue #75 — CONFIRMED / IN PROGRESS:** Shared modal keyboard trap omitted hidden responsive and ancestor-hidden controls and could let Tab leave a dialog if active focus was outside or no visible focusable remained. Phase 5 frontend PR #76 contains a minimal visibility-aware focus list, reliable Tab containment, dialog fallback and targeted regression. **PR/main CI and Vercel release pending: do not mark issue CLOSED or production verified yet.**
- Open independent Phase 1/2/8 acceptance issues: #38 Neon latest-snapshot restore checksum, #39 Vercel proxy warning, #40 operational alerting, #42 hardware/offline acceptance, #43 isolated real financial E2E.

- **UX-002 / Issue #77 — CONFIRMED / IN PROGRESS:** Nested Super Admin detail/reset modals each restored a stale per-modal `document.body.style.overflow`, potentially leaving background page scrolling locked after both closed. PR #76 adds shared reference-counted scroll lock and targeted regression alongside UX-001. PR/main CI and Vercel exact SHA verification still required before closing.

## Phase 5 — Shared Modal Release + Billing A11y checkpoint — 2026-10-29

- **UX-001 / Issue #75 — FIXED / RELEASE VERIFIED:** Focusable modal controls now exclude elements hidden by ancestor hidden/inert/aria-hidden attributes, absence of layout rectangles, or CSS visibility. Tab is trapped even if focus starts outside; the dialog itself is focusable fallback, topmost nested modal behavior and previous-focus restoration retained. PR #76 CI `40883913184` SUCCESS, squash merge `cc4d29fb36a454c25847767443d9c62a46a371d2`, exact main CI `40884939567` SUCCESS, Vercel `dpl_8XkxfQF8tDbMQaxv1JXTumq7W5UA` READY with production alias.
- **UX-002 / Issue #77 — FIXED / RELEASE VERIFIED:** Nested modal scroll locks now use shared reference counting, preserving the original body overflow after the last dialog closes even if cleanup order varies. Same tested release; Issues #75 and #77 CLOSED. No visual redesign, data change or database migration. Production backend /health and /ready HTTP 200 at 13:46 UTC.
- **UX-003 / Issue #78 — CONFIRMED / IN PROGRESS:** Billing checkout card and amount icon-only copy buttons lack accessible action names; back/extra-store quantity controls have ambiguous icon or glyph labels. PR #79 adds aria-label/title and `type=button` with one focused regression. **Exact-head PR CI, main CI and Vercel release pending; do not mark fixed/released before verification.**
- **Remaining acceptance:** Browser checks remain synthetic, not physical checkout devices; unverified Phase 1/2/8 gates (#38, #39, #40, #42, #43) remain open.

## Phase 5 continuation — verified 2026-10-29 15:45 UTC

- **UX-001 / #75 and UX-002 / #77:** Release evidence independently rechecked: exact frontend main workflow `40884939567` frontend job completed SUCCESS (unit/design/audit/production/build/POS Pro responsive browser checks); PR #76 merged at `cc4d29fb36a454c25847767443d9c62a46a371d2`; Vercel deploy `dpl_8XkxfQF8tDbMQaxv1JXTumq7W5UA` READY with matching SHA. Both issues already CLOSED with release evidence; no duplicate changes.
- **UX-003 / #78:** PR #79 merged to `ea0a8fe80994878cd6b1b5cc2502a493cb797e69`. PR head `46d975c09c40e5a7ab7c08606eeb96f7ec188486` workflow `40886045306` completed SUCCESS. Current frontend main last-known commit and Vercel production `dpl_AQiktt3eBYhBoPAoPuTXRT2C4yft` are READY at exact `ea0a8fe80994878cd6b1b5cc2502a493cb797e69`, including `www.zenixpos.uz` alias. Read-only production `/health` HTTP 200 at 15:45:18 UTC, `/ready` HTTP 200 and `database:ready` at 15:45:22 UTC. **Main GitHub Actions workflow conclusion has not yet been independently confirmed** (commit's combined status reports Vercel success only); leave Issue #78 OPEN until exact-main CI proof.
- **Backend/DB:** Render deployment `dep-dbhk4uoae00c73dvr8qg` LIVE at backend `b328940d6816ca7f1305b573d31918cfb346d29a`; Neon production branch `br-small-dew-b197rvkz` READY and protected. No customer data mutations, schema migrations, or new production deploy in this verification.
- **Outstanding acceptance:** Keep #38 (latest snapshot isolated restore/integrity), #39 (DEP0169 origin), #40 (Telegram worker alerts), #42 (physical devices/offline), #43 (financial E2E) open. Existing synthetic success does not close hardware or authenticated customer acceptance.
