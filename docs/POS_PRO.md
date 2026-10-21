# POS Pro — Phase 2

## Design and implementation plan

Purpose: a separate `/pos-pro` supermarket workspace after Savdo. Existing Sales remains unchanged. Three panels: bounded remote catalog, independent receipt/cart, payment terminal. Tenant/user/branch-scoped drafts use the existing draft serializer with a separate key; financial attempts deliberately share the existing sale journal so unresolved writes cannot be bypassed by switching modules.

1. Test and implement HID detection, explicitly configured EAN-13 weight labels, decimal quantities, payment validation and money totals using `posMoney`.
2. Build independent React components and scoped styles. Reuse `createPosCatalog`, `productFromApi`, reconciliation, tracking allocation, holds, `commitSaleTransaction`, Modal and unsaved navigation guard. Restore and preflight fetch current authoritative products. Checkout confirmation is explicit, external card/transfer confirmation is manual, timeout recovery preserves the exact original packet/reference.
3. Add server validation for POS Pro metadata and a scoped live shift summary from existing sales/payments/returns. No new financial ledger, migration, subscription rule or deployment setting.
4. Run unit/regression/browser tests and synthetic catalog/cart benchmarks; distinguish simulated APIs and hardware from PostgreSQL and physical device evidence. Open draft PRs against Phase 1; no production release.

## Safety and integration boundaries

Browser printing supports 58/80 mm receipts. No fiscal certification, fabricated QR URL, direct ESC/POS, drawer command or bank authorization is claimed. Serial/USB devices require a documented device protocol and a separately tested adapter; unsupported adapters remain disabled. Weighted labels are opt-in with explicit prefix/product/value offsets, divisor and unit; EAN checksum is required and an exact ordinary barcode is resolved first.

Large discounts remain subject to existing server rules; no manager password impersonation or implicit approval. Offline is draft-only. Server transactions continue to own stock, shift, tenant authorization, audit, customer credit and Telegram notifications. Phase 1 Telegram worker release gates remain in force.

## Delivery and verification — 2026-10-21

Branches start at latest Phase 1: frontend `06ababd`, backend `336d716`. Both Phase 2 branches are `phase2/pos-pro`; PR base is `phase1/professional-finish`. No production deployment, migration, webhook change or real business-data write was performed. No database migration is added.

Implemented: separate route/menu/workspace, kiosk exit, bounded search/categories and current-shift popular products, exact HID/manual/camera barcode workflow, configured EAN-13 weight/price-label decoder, decimal quantities, item/cart discounts, cash/card/transfer/split/credit, explicit payment review and manual external-payment confirmation, customer lookup, server-backed Hold/Resume, persisted independent draft, shared sale retry/reconciliation, live shift summary, keyboard controls, 58/80 mm HTML receipt and browser printing.

### Test results

| Verification | Result |
| --- | --- |
| All frontend tests including sibling-backend contracts | 398 PASS, 0 FAIL, 2 SKIP / 400 |
| All backend tests, serial, local PostgreSQL | 734 PASS, 5 FAIL, 17 SKIP / 756 |
| Remaining backend failures on untouched Phase 1 `336d716` | Same 5 FAIL in `warehouseMigrationAudit.test.mjs` |
| Targeted POS PostgreSQL/HTTP/catalog | 17 PASS, 0 FAIL |
| New model/HID/weight/payment/receipt/draft unit tests | 7 PASS, 0 FAIL |
| Synthetic API Chromium acceptance | PASS, zero page errors |
| Actual browser → Express → PostgreSQL | PASS: 10 HID scans, one 120,000 UZS sale, cash 70,000/card 50,000, stock 20 → 10, outbox event, live panel and ordinary Sales |
| Build, design baseline, source audit, readiness, CPU/bundle budgets | PASS |
| Physical scanner/scale/printer/drawer, bank/fiscal provider | NOT TESTED / NOT CONNECTED |

Browser coverage includes repeated/unknown/ambiguous scans; configured 1.250 kg label; combined discounts; cash change; manually confirmed card; slow/lost checkout response; unresolved checkout locked across reload then reconciled once; rejected Hold unlock; pending barcode blocks F5; Hold/Resume; offline draft; 100/500-line reload; 1366×768, 1920×1080, 1024×768 and 390×844 overflow checks; closed-shift block; old-backend optional-summary fallback; kiosk exit; and F10 print invocation with a stub. Thermal-paper output is not certified by the stub.

The first concurrent backend run had 15 failures because the existing migration test drops the shared test `public` schema. Re-running serially left only the five historical 031/032 fixture failures. They were reproduced in a separate database using the unmodified Phase 1 commit. No failure is marked PASS or removed. Optional environment-specific tests remain explicitly skipped; PostgreSQL and CI-specific profiles provide additional coverage.

### Measured performance

Environment: Windows, Intel i3-13100F (8 logical CPUs), Node 24.11.1, local PostgreSQL 18.4. CI also exercises PostgreSQL 16 / Node 22. These are development measurements, not production latency guarantees.

| Actual catalog SQL/service (12 samples) | p50 | p95 |
| --- | ---: | ---: |
| 10k catalog / 40-row page | 8.24 ms | 22.38 ms |
| 10k catalog / last-item search | 14.78 ms | 25.29 ms |
| 10k catalog / exact barcode | 6.01 ms | 12.76 ms |
| 50k catalog / 40-row page | 10.40 ms | 13.55 ms |
| 50k catalog / last-item search | 38.10 ms | 57.45 ms |
| 50k catalog / exact barcode | 11.56 ms | 17.37 ms |

Node cart-update + money microbenchmark (100 samples): 100 lines p50 0.24/p95 1.05 ms; 500 lines p50 0.78/p95 0.88 ms. Synthetic controller search p95: 10k 0.12 ms, 50k 0.70 ms; this does not measure SQL.

Latest Chromium interaction sample, including automation and debounce: 10 HID scans 1,542 ms; 100-line edit 36.8 ms; 500-line edit 120.3 ms; 50k last-item search with 100/500 cart lines 270.9/857.8 ms; 500-line initial usable workspace 1,600 ms. The 500-line browser search still costs substantially more than SQL/model work; these figures are reported rather than represented as sub-frame UI performance. Remote pages stay bounded at 40 and the last-product search renders one result. No full 50k catalog is hydrated in POS Pro.

Local raw evidence: `../artifacts/phase2-frontend-full-final.log`, `phase2-backend-serial.log`, `phase2-phase1-baseline.log`, `phase2-postgres.log`, `phase2-build.log`, and `../artifacts/phase2/{browser-results,postgres-benchmark,client-benchmark,real-browser-postgres}.json`. Browser screenshots are in `../artifacts/phase2/`.

Re-run from frontend: `node --test tests/posPro.test.mjs`; `npm run build`; `node tests/posPro.browser.mjs`; `node scripts/benchmark-pos-pro.mjs`. Actual browser/database test: `node tests/posProPostgres.browser.mjs` with `NODE_ENV=test` and matching loopback `DATABASE_URL`/`TEST_DATABASE_URL`, using a fully migrated disposable database. Never point these profiles at Neon. New synthetic browser tests are included in frontend CI; new PostgreSQL tests are in backend CI.

### Changed files

- Route/integration: `src/App.jsx`, `src/layout/MainLayout.jsx`, `src/context/StoreContext.jsx`, `src/utils/posCatalog.js`, `src/utils/posDraft.js`.
- New isolated module: `src/pages/posPro/{PosPro,Cart,Payment,Receipt}.jsx`, `useProCatalog.js`, `useProSession.js`, `model.js`, `hardware.js`, `receiptFormat.js`, `posPro.scss`.
- Verification: `tests/posPro.test.mjs`, `tests/posPro.browser.mjs`, `tests/posProPostgres.browser.mjs`, `scripts/benchmark-pos-pro.mjs`, `.github/workflows/verify.yml`, `design-baseline.json`, this report. Original style hashes and `Sales.jsx` are unchanged.
- Backend files are listed in its `docs/POS_PRO.md`.

### Remaining limits and release gates

Direct scale/ESC-POS/drawer adapters require the actual model, protocol and a trusted local bridge or supported browser API. [Web Serial](https://developer.chrome.com/docs/capabilities/serial) requires explicit device selection and a protocol-specific reader; [WebUSB](https://developer.mozilla.org/en-US/docs/Web/API/WebUSB_API) has browser/secure-context restrictions. API presence is not device compatibility. No device commands are sent by this module.

Weight schemes are device-local, opt-in and editable with existing `settingsWrite`; ordinary exact barcodes take priority. Excess manager discounts are blocked by current server limits: a manager must use existing authorized configuration/account workflows; there is no fabricated approval bypass. Old backend supports ordinary checkout, but live summary is unavailable and holds over its historical 250-line cap are rejected with the cart retained. Offline settlement, automatic bank authorization, fiscal receipts and certified tax QR are intentionally unsupported.

Phase 1 + Phase 2 release remains gated by review, the owner's explicit release permission, resolution/acceptance of the historical migration fixture failures, fresh production backup/restore validation, physical-device acceptance, and an agreed rollback/rollout window. Preserve the Phase 1 Telegram worker release gate. Merge and production deployment are not part of this change.

### UX review follow-up (PR #24)

Name/SKU Enter selects the unique result or exact SKU; arrows explicitly select among multiple results. Stale results cannot be added during debounce/fetch, and switching to popular products clears the search. Selection returns focus to barcode input. Quantity buttons use 0.05 kg/l, 50 g/ml and 1 piece; exact fractional entry remains available. Payment totals print the currency once. Canonical server receipts retain item metadata units, payment allocations, tendered cash, change, receipt number and timestamp. Uncertain Hold retry now invokes the protected retry path rather than the locked new-hold action.

A memoized cart-list boundary avoids traversing 500 rows on unrelated catalog/clock updates; one shared UZS formatter avoids repeated formatter construction. A rendering regression verifies skipped traversal, fresh action callbacks and lock propagation. No ordinary Sales or Phase 1 source was changed.

Verification: frontend 402 passed, 0 failed, 2 skipped (404 total); POS Pro browser flows passed with zero page errors, including name/SKU, delayed results, ambiguous results, popular switching, kg/l/g/piece steps, single currency, normal and recovered receipts, ten HID scans, double submit, Hold, offline and responsive layouts. Real browser -> Express -> loopback PostgreSQL passed normal kg split payment and recovered l cash payment, stock, outbox and ordinary Sales. Targeted PostgreSQL suites: 18 passed, 0 failed. Build, audit, readiness, design and CPU/bundle checks passed. Hardware remains simulated, not physically tested. Historical 031/032 migration fixture failures documented above remain separate; the full PostgreSQL suite was not rerun for these test-only backend additions.

Controlled production-build search benchmark: hydrated cart, 50k synthetic catalog, one discarded warmup and six measured queries per size, same Windows/i3-13100F/Node 24.11.1 machine. Times include the intentional ~160 ms debounce. 100 rows before p50/p95 204.7/212.8 ms, after 200.5/205.2 ms; 500 rows before 205.4/207.0 ms, after 202.8/204.7 ms. At 500 rows after: debounce p50/p95 163.4/164.2 ms, synthetic fetch+JSON 8.4/8.5 ms, render/two-frame paint 31.5/33.3 ms. The small steady-state difference is within local noise, not a claimed 4x improvement. The earlier 857.8 ms automation sample did not wait for draft reconciliation to enable editing and included restoration/debounce/automation costs. The latest broad acceptance sample was 325.4 ms; this is also not equivalent to the isolated in-page benchmark. Synthetic APIs do not measure SQL or physical-scanner latency.

Raw follow-up evidence: ../artifacts/phase2-ux-{frontend-full,browser-full,postgres,real-browser,build}.log and ../artifacts/phase2/search-benchmark-{before,after}.json. Updated files: src/pages/posPro/{PosPro,Cart,Payment}.jsx, {catalogSelection,model,receiptFormat,useProCatalog}.js, posPro.scss, tests/{posPro.test,posProCartRendering.test,posPro.browser,posProPostgres.browser}.mjs, design-baseline.json and this report. Backend adds only receipt/reconciliation regression coverage and its report.

### Final supermarket QA (supersedes earlier open fixture status)

See [POS_PRO_FINAL_QA.md](POS_PRO_FINAL_QA.md) for the final matrix, exact localhost instructions, physical-device limits and performance evidence. Frontend 404 PASS/0 FAIL/2 SKIP; backend 745 PASS/0 FAIL/17 SKIP; targeted PostgreSQL 28/28; real supermarket browser 14 checkpoints/10 sales; both actual Phase 1/Phase 2 checkout compatibility combinations pass. The five 031/032 historical fixture failures are resolved using a test-only version-pinned contract; the production fail-closed auditor and migration SQL are unchanged. Credit deposits/unpaid credit now use captured payment rows for cash reconciliation, confirmed by zero-difference UI shift closing. Production release remains unapproved. Final-head CI is a staging gate; hardware/bank/fiscal certification and production backup/restore remain separate.
