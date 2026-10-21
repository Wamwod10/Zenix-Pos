# POS Pro final supermarket QA — Windows, 2026-10-21

Staging decision: **READY FOR STAGING QA only when both final PR heads have green CI**. This is not production release approval or hardware certification. Existing PRs: [frontend #24](https://github.com/Wamwod10/Zenix-Pos/pull/24), [backend #16](https://github.com/Wamwod10/Zenix-Pos-Backend/pull/16). Their Checks tabs track the final pushed commits. Base remains `phase1/professional-finish`.

## Environment and results

Windows, Node 24.11.1, existing dependencies, Chromium headless 153, PostgreSQL 18.4 at `127.0.0.1:55432/zenix_phase2_test`. Schema verification: 64 tables, 40 migrations, 188 indexes; no missing/drifted/unverified/unknown migration. No dependency installation, production connection, worker, webhook change or deployment was needed.

| Profile | PASS | FAIL | SKIP |
| --- | ---: | ---: | ---: |
| Frontend full unit/regression | 404 | 0 | 2 |
| Backend full, serialized, local PG | 745 | 0 | 17 |
| Targeted HTTP/PG/catalog/final-QA/031–032 | 28 | 0 | 0 |
| Real supermarket browser workflow | 14 checkpoints / 10 sales | 0 | 0 |
| Existing real browser/PG checkout + lost-response recovery | passed | 0 | 0 |
| Synthetic API browser, four screen sizes, touch and long names | passed | 0 | 0 |
| Build, audit, readiness, CSS baseline, CPU/bundle budgets | passed | 0 | 0 |

The 28 targeted results are included in the broad backend profile; do not add them to its total. Frontend skips are optional AI/subscription browser profiles. Backend skips are optional AI, subscription/resource/release/migration profiles requiring their own environment variables/databases; these were not represented as local PASS. Existing CI explicitly runs the subscription/resource/release profiles with disposable databases. Final CI outcomes must be read from the linked PR heads.

## Real browser → Express → PostgreSQL coverage

`tests/posProSupermarket.browser.mjs` seeds an active PREMIUM organization, two branches, two cashiers, a manager, a customer with a 50,000 credit limit and 100 products. The catalog includes kg/g/l/ml/pieces, duplicate names with distinct identifiers, zero/low stock and a long name. Password login and shift opening occur through the real UI. All business writes use the loopback database.

- Cash sale 127,000; tendered 150,000; change 23,000. Split sale 180,000 = cash 80,000 + manually confirmed card 100,000.
- A batch of 100 HID keyboard events produces exactly 100 units and one committed sale; stored stock falls from 1,000 to 900. Separately, the existing browser profile types ten timed HID bursts.
- Olma 0.750 kg, Banan 1.250 kg, Guruch 2.500 kg, Shakar 500 g, Sut 1.500 l, Suv 750 ml: combined discounts, actual Hold/Resume, receipt units and exact stock quantities are asserted.
- Synthesized configured EAN labels exercise grams→kg, ml→l, price encoding and 0.001 quantity, then commit the decoded amounts to PostgreSQL. Decoder unit tests cover checksum, prefixes, overlap and malformed schemes.
- Browser customer selection and due date produce a 20,000 credit sale with 5,000 cash deposit and exactly 15,000 in the credit ledger. HTTP tests reject a missing customer, missing/malformed due date and excess credit.
- A Hold commits but its HTTP response is dropped; retry retains the same logical Hold and creates no duplicate. Injected 409/429/503 checkout responses exercise draft reload and exact retry. The separate existing profile drops a committed checkout response and verifies reconciliation after reload.
- SQL asserts sale count, cash/card captures, stock, audit rows and one sale-completed outbox event per sale. Ordinary Savdo and history remain usable. History row count equals SQL count; manager Dashboard revenue and transaction count equal SQL totals.
- Shift closing uses opening cash + actual captured cash; its stored difference is zero. No Telegram delivery worker runs: outbox persistence is tested, real message delivery is not.

Targeted HTTP/PG tests also exercise two simultaneous cashiers competing for stock, no negative stock, double submission/idempotency, tenant/branch scope, manager/cashier permissions, shift authorization, price/discount limits, refunds, debt/refund allocation, audit immutability, archived/missing catalog resolution and ordinary Sales contracts. Invalid zero/negative/short/excess payments leave sales/stock unchanged. Card without manual confirmation is rejected.

## Bugs and historical fixtures

1. **Credit cash reconciliation:** a canonical server sale can have display method `cash` while its payment rows contain only the deposit, or no capture at all. The old gross-payment helper inferred the full sale total from that display method. Legacy `credit` snapshots could instead omit the deposit. It now uses authoritative payment rows (including an empty array = zero), with the existing breakdown fallback for legacy credit snapshots. Debt is never counted as captured cash. Failing unit reproductions, the full reporting regressions and actual UI shift closing verify the fix.
2. **Historical 031/032 tests:** five failures were reproduced before the correction. Their fixture intentionally stopped at 030 while the live auditor correctly required the catalog through 040. After 032, the current schema verifier also expected newer tables/triggers. Test-only fixtures now pin the complete 032 schema requirements from commit `4c2f3a6` and the catalog through 032. The auditor algorithm/SQL and production migration files are unchanged. Tests additionally prove that the current auditor rejects the incomplete historical database. All five historical tests now run, not skip, and pass lock, rollback, partition, finite-quantity and repeatable-read safeguards.

No production-schema defect was established by those historical fixture failures. An actually incomplete production catalog would still be rejected. The version-pinned test contract must remain deliberately historical; it is not a production audit bypass.

Initial exploratory runs also exposed test-harness mistakes (legacy label, reconciliation warning handling, PDF cleanup and in-flight route cleanup); these were corrected and rerun. Final zero-FAIL counts do not erase the retained failing/reproduction logs.

## Compatibility

| Combination | Evidence |
| --- | --- |
| Phase 2 frontend + Phase 2 backend | actual browser/PG supermarket and recovery profiles PASS |
| Phase 2 frontend + actual Phase 1 backend `336d716` | actual browser/PG normal split kg checkout and recovered l checkout PASS; live-summary endpoint explicitly 404/unsupported |
| Actual Phase 1 frontend bundle `06ababd` + Phase 2 backend | actual ordinary Savdo cash checkout, receipt, single sale and stock decrement PASS; existing safe catalog-reconciliation warning is reviewed/reconfirmed |

The older snapshots are detached, local test worktrees. Phase 1 branches, ordinary `Sales.jsx`, existing styles and Telegram release logic were not rewritten. Compatibility is checkout scope, not a claim that every page of every older release was exhaustively tested. Old backend Hold size limits and missing POS Pro summary remain documented in `POS_PRO.md`.

## Performance — measurements kept separate

Same Windows/i3-13100F host, production frontend build. Hydrated 100/500 carts, bounded 40-row remote pages, synthetic 50k catalog, one warmup discarded and six measured queries per size. Intentional ~160 ms search debounce is included.

| Browser in-page query → rendered result | Previous p50/p95 ms | Final p50/p95 ms |
| --- | ---: | ---: |
| 100 cart rows | 200.5 / 205.2 | 201.2 / 206.1 |
| 500 cart rows | 202.8 / 204.7 | 193.4 / 211.3 |

No material regression against the ~203 ms median baseline; six samples do not establish a statistically significant speedup. At 500 rows final stage p50/p95: debounce 163.4/177.4 ms, synthetic fetch+JSON 7.6/7.9 ms, render/two-frame paint 23.4/26.3 ms. Cart-list memoization regression still proves unrelated parent updates do not traverse all 500 lines and callbacks stay fresh.

Broad browser automation samples (not the controlled in-page benchmark): 100/500-row load 1,087/1,637 ms; cart edit 98.6/94.1 ms; reload-adjacent search 270.5/578.7 ms. The latter includes restoration/automation and must not replace the hydrated benchmark. Coarsened Chromium heap samples: 100 rows ~10.0 MB used; 500 rows ~18.2 MB used, ~44.7 MB allocated, 7,391 DOM nodes. This is not a memory-leak endurance certification.

Actual browser→API local transport samples from the supermarket flow: catalog requests n=143 p50 8.2/p95 21.9 ms (mixed catalog/barcode/resolve requests), successful checkout POST n=10 p50 36.6/p95 81.9 ms. These measure intercepted local fetch/response, not button-to-paint or WAN latency. Login + shift + usable workspace 2,914 ms; 100 synthesized HID events through resolved UI quantity 1,921 ms. Hardware/OS event cadence is not measured.

Actual PostgreSQL service benchmark (12 samples each, disposable 10k/50k fixture, rolled back):

| Catalog / operation | p50 ms | p95 ms |
| --- | ---: | ---: |
| 10k / 40-row page | 16.50 | 47.31 |
| 10k / last-name search | 8.85 | 27.07 |
| 10k / exact barcode | 3.05 | 3.55 |
| 50k / 40-row page | 14.02 | 24.21 |
| 50k / last-name search | 38.38 | 57.11 |
| 50k / exact barcode | 16.75 | 23.44 |

Full 50k catalogs are not hydrated into the browser. CPU/bundle budgets pass; gzip budget tool reports main 118,140 bytes and total 439,027 bytes against 130,000/470,000 limits.

## Print, simulation and remaining release gates

**PASS, actual computer:** Chromium generated `receipt-58mm.pdf` and `receipt-80mm.pdf`; PDF parsing verified page widths and totals/change. Receipt HTML normal/recovery data and browser print command dispatch are tested. Screenshots at 1366×768, 1920×1080, 1024×768 and 390×844 were inspected; synthetic long-name and touch-event checks pass without horizontal overflow.

**SIMULATED:** HID device events, scale labels (weight/price), manual bank confirmation, network loss/latency/HTTP faults, touch input and the print-call dispatch spy. A 100-event zero-gap burst is deliberate stress simulation; real HID cadence remains an acceptance test.

**NOT TESTED / UNSUPPORTED without devices/providers:** USB/Bluetooth electrical behavior, direct electronic-scale protocol, physical 58/80mm feed/cutter, ESC/POS bridge, drawer kick, actual bank authorization/settlement, fiscal certification/QR. Headless PDF validates Chromium print rendering, not Windows native print-dialog interaction or a physical printer. Offline mode stores/reconciles drafts; it does not settle sales offline.

Local `pg_dump` drill was attempted but did not run: this portable PostgreSQL package does not include `pg_dump.exe`. Do not count it as PASS. CI's existing disposable PostgreSQL dump/restore step remains a required final gate; it is not a production backup test. Before any later production release: explicit owner permission, fresh production backup/restore validation, physical/provider acceptance as applicable, staging soak, rollback plan and safe Phase 1 Telegram worker rollout are still required. No critical/high application defect remains in the executed scope; hardware and production certification remain outside it.

## Exact manual localhost instructions (PowerShell)

These use the existing isolated cluster in this workspace. No `.env` file or deployment setting needs editing. Do not replace the URLs with Neon.

Terminal 1, workspace root (start only if this cluster is stopped):

```powershell
cd 'D:\Freemustafa\Zenix-POS-production-final\Zenix POS'
& '.task/phase2-pg/package/native/bin/pg_ctl.exe' -D '.task/phase2-pg/data' -l '.task/phase2-pg/postgres.log' -o '-h 127.0.0.1 -p 55432' -w start
```

Terminal 2, backend (environment values apply only to this terminal):

```powershell
cd 'D:\Freemustafa\Zenix-POS-production-final\Zenix POS\backend'
$env:NODE_ENV='test'
$env:DATABASE_URL='postgresql://postgres@127.0.0.1:55432/zenix_phase2_test'
$env:TEST_DATABASE_URL=$env:DATABASE_URL
$env:MIGRATION_DATABASE_URL=$env:DATABASE_URL
$env:FRONTEND_ORIGIN='http://127.0.0.1:5173'
$env:PUBLIC_API_URL='http://127.0.0.1:4000'
$env:RUN_NOTIFICATION_WORKERS='false'
$env:TELEGRAM_BOT_TOKEN=''
$env:ZENIX_PAYMENT_BOT_TOKEN=''
$env:OPENAI_API_KEY=''
& 'C:/Program Files/nodejs/node.exe' src/db/migrationStatus.js
& 'C:/Program Files/nodejs/node.exe' scripts/seed-pos-pro-qa.mjs
& 'C:/Program Files/nodejs/node.exe' scripts/serve-pos-pro-qa.mjs
```

The seed prints the newly generated `users.cashier`, `users.second` and `users.manager` usernames/passwords. Save those local QA credentials. Each invocation creates a separate test organization, not a production business. Stop if migration status is not clean. The dedicated QA server verifies schema, binds only `127.0.0.1:4000`, and never imports the production server, Telegram/webhook workers or AI maintenance. Startup/CORS/auth were smoke-tested.

Terminal 3, frontend:

```powershell
cd 'D:\Freemustafa\Zenix-POS-production-final\Zenix POS\frontend'
$env:VITE_API_URL='http://127.0.0.1:4000'
& 'C:/Program Files/nodejs/node.exe' node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5173 --strictPort
```

Open **http://127.0.0.1:5173/login**. Log in as the printed cashier, open Kassa/Smena with 10,000, then enter `/pos-pro`. Use barcode `30000006` for the 127,000 product; enter 150,000 cash, review/confirm and inspect 23,000 change. Barcode `30000007` is the 180,000 product for cash80,000/card100,000; the card confirmation is explicitly manual. Weighted products: `00123` Olma, `00124` Banan, `00125` Guruch, `00126` Shakar, `00127` Sut, `00128` Suv. Exact SKU search uses `QA-0` etc. Test Hold F5 / Resume F6, history, and shift closing; use manager login for Dashboard. Browser Print Preview/Save as PDF can be checked manually here; no thermal-printer claim follows from it.

Stop frontend and QA API with Ctrl+C. After both stop, shut down this test cluster from root with `pg_ctl.exe -D '.task/phase2-pg/data' -m fast -w stop`. Do not run destructive migration fixtures while using the manual workspace.

## Changed files and retained evidence

Frontend: `src/utils/reporting.js`; `tests/{reporting.test,posPro.browser,posProPostgres.browser,posProSupermarket.browser}.mjs`; this report and `docs/POS_PRO.md`.

Backend: `scripts/{seed-pos-pro-qa,serve-pos-pro-qa}.mjs`; `tests/posProFinalQa.test.mjs`, `tests/warehouseMigrationAudit.test.mjs`, `tests/fixtures/warehouse032{Audit,Requirements}.mjs`; `.github/workflows/verify.yml`; `docs/POS_PRO.md`.

Local evidence under `../artifacts/`: `final-qa-{frontend-full,backend-full,postgres-targeted,supermarket,real-browser,phase1-frontend,phase1-backend,warehouse-red,warehouse-green,credit-shift-red,credit-canonical-red,credit-shift-green,finance,browser,touch,long,build,audit,readiness,design,schema,sql-benchmark,search-benchmark,performance-budget}.log`; `final-qa/supermarket.json`, `final-qa/receipt-{58,80}mm.pdf`; `phase2/search-benchmark-final-qa.json`, `phase2/postgres-benchmark.json`, browser JSON/screenshots. Artifacts are local test evidence, not application assets or production uploads.
