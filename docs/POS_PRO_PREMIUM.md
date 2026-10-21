# POS Pro Premium workspace — Phase 3

## Source audit and implementation plan

Frontend base e2d64b4, latest phase2/pos-pro; PR23 and24 remain Draft/open. Vercel production READY dpl_7HxESMYceiVeYQf22tXD4puHtFHQ uses this exact SHA. Backend main b41bd55 contains Phase1+2 and Render live dep-dbcbosifngtc739mmsog uses b41bd55. Read-only checks; no deployments or production data writes.

Selected design: separate protected /pos-pro route outside MainLayout; same user/store/license/permission guards and shared React providers. Compared with hiding global chrome via CSS, a separate route avoids mounting global navigation effects and guarantees direct-link behavior. Existing sale/inventory/payment/credit/hold/journal services remain authoritative. Theme preference application is reused without changing other page designs. Use platform surface/text/primary/radius tokens; three full-height desktop panels, barcode-first discovery, clear receipt rows, sticky total and prominent operations. At 1024 use two panels plus checkout; phone uses a readable vertical flow. No gradients or extra dependencies.

1. Route, launch and appearance: direct POS URLs omit global sidebar/header; menu user gesture opens named large window, popup denial falls back same-tab; return uses existing unsaved guard; actual Fullscreen API on documentElement keeps confirmation dialogs visible.
2. Safety: lifetime per-user/branch Web Lock permits one POS editor; second window is read-only/blocked with retry. No force takeover; lack of safe browser lock is explicit. Existing shared financial journal stays unchanged. Closed shifts retain labelled unsold draft; existing commitShiftOpen opens a shift and draft is reconciled before payment.
3. Product/cart/payment UX: scoped styles, platform icons/tokens, larger controls, honest keyboard/device state, explicit disabled reason, focus restoration, stock/tracking visibility, existing financial calculations.
4. Red/green route/launch/lease/fullscreen/shift tests; preserve Phase2 HID/hold/recovery/receipt/money regressions. Five viewports, light/dark, long names, 100/500 carts and 10k/50k catalog. Compare same hydrated in-page benchmark (previous500 p50~193/p95~211ms including debounce).
5. Isolated local PostgreSQL checkout/shift/credit/stock/outbox and full regressions; independent review; push Phase3 and Draft PR base phase2/pos-pro; preview only if available. Never production deploy/merge.

Visual baseline: retained local Phase2 fixture screenshot ../artifacts/phase3/before-1366.png from the deployed source layout. No new user screenshot attachment was supplied; no production business was accessed to fabricate one.

## Audit outcomes

| Severity | Reproduction / root cause | Targeted fix | Regression evidence |
| --- | --- | --- | --- |
| P1 | Direct `/pos-pro` mounted MainLayout and consumed cashier screen space | Separate protected route; existing guards/providers retained | workspace/premium browser profiles: sidebar/topbar absent |
| P2 | POS used its own surfaces and small controls, terminal actions scrolled away | Platform appearance hook/tokens; scoped three-panel layout, larger controls, sticky settlement/actions | Five viewports in both themes; no horizontal overflow |
| P1 | Two POS windows could hydrate/edit the same per-user/branch draft | Acquire lifetime Web Lock before mounting session; second editor blocked until retry | Actual two-page Chromium lock/release test |
| P2 | Clicking menu again could reload active named cashier window | Focus existing named POS without navigating again | Unit plus browser continuity token and cart preservation |
| P2 | Closed shift left an unexplained draft and disabled checkout | Explicit unsold-draft gate; existing shift-open API inline; reconcile draft on shift change | Synthetic closed/open flow plus real PostgreSQL shift opening |
| P2 | Serial product could silently choose first available physical serial | Explicit serial selection, existing allocator/server authority retained | Missing/noninteger choice rejected; browser and PostgreSQL prove S2 sold, S1 remains |
| P2 | Branch selection remained available while barcode request pending | Disable branch change until scan queue drains | Delayed barcode + Hold/payment/branch browser test |
| P2 | Device wording implied scanner connection | Honest keyboard/HID capability, untested physical scanner and unsupported adapters | Visual inspection and hardware panel |
| P2 | At 390px the fixed 470px catalog left nearly no product-list height after its controls | Mobile catalog grows naturally; product list retains 240px | New browser height assertion failed before fix, passed in both themes after fix |
| P3 | Quantity Enter invoked the commit and blur commit | Blur performs one commit | Existing quantity/receipt regressions |

Independent final code/visual review found no additional confirmed P0/P1/P2. No confirmed P0 remains in the tested scope. Unsupported Web Locks explicitly block editing rather than permit unsafe concurrent draft writes. Existing shared financial journal, server replay, inventory and permissions remain authoritative; no second ledger or backend checkout was introduced.

## Verification and measurements

- Frontend combined runner (`--with-backend`): 408 tests, 406 PASS, 0 FAIL, 2 SKIP (environment-dependent existing checks). Standalone CI subset: 286 PASS, 0 FAIL.
- Backend full serialized runner: 762 tests, 745 PASS, 0 FAIL, 17 SKIP. Backend working tree equals main b41bd55; no backend files changed.
- Real Chromium → Express → disposable loopback PostgreSQL: 15 supermarket checkpoints and 11 sales PASS, including inline shift, six units/EAN labels, 100 synthesized HID scans, cash/card/split/credit, Hold/timeout/replay, history, stock/audit/outbox, serial S2 and shift close. Separate normal/recovered kg/l receipt integration PASS. Receipt 58/80mm PDFs regenerated and parsed by the supermarket test.
- Default Phase2 browser profile, new premium and serial/pending profiles PASS. Premium covers named window/reuse, blocked popup same-tab fallback, direct route, lock handover, actual Fullscreen API/Escape and both themes at 1920×1080, 1600×900, 1366×768, 1024×768 and 390×844.
- Build, import audit, readiness, 24 stylesheet baselines and CPU/bundle budgets PASS. Only POS stylesheet baseline changed. Main gzip 118,267 bytes; total 442,238 bytes (budgets 130,000/470,000).
- An initial full browser run concurrent with backend tests counted 9/10 timed HID scans. The idle rerun passed unchanged. The outside-input detector intentionally rejects >45ms gaps; simulated OS scheduling stalls can violate that cadence. Its threshold was not widened to misclassify ordinary typing. The dedicated barcode field supports manual/slow entry. Real hardware cadence still requires acceptance testing.
- One frontend source assertion initially failed after appearance extraction; updated it to verify the shared hook and currency assignment. No test was removed or hidden. Historical 031/032 version-pinned migration fixtures remain unchanged and pass in the backend suite.

Controlled browser search benchmark, same hydrated production-build profile, 160ms debounce, six samples per size (p95 nearest-rank; not SQL/WAN timing):

| Cart rows | Previous p50 / p95 ms | Premium p50 / p95 ms |
| --- | ---: | ---: |
| 100 | 201.2 / 206.1 | 206.9 / 213.9 |
| 500 | 193.4 / 211.3 | 207.4 / 209.9 |

500-row median increased ~14ms (~7%); tail stayed similar. These small samples support no major regression, not a statistically significant performance claim. At 500 rows ~27.6MB used heap, 53.5MB allocated, 9,707 DOM nodes; no endurance/leak certification. Catalog pagination and cart memoization are retained; browser fixtures represent 10k/50k catalogs without loading all products. Latest broad 500/50k initial-load sample 1,810ms includes browser automation/restoration and is separate from the controlled query timing. SQL baseline results in [Phase2 QA](POS_PRO_FINAL_QA.md) are historical, not rerun measurements for this frontend-only change.

## Visual evidence and local use

Local evidence: `../../artifacts/phase3/` contains before-1366.png, standalone-window.png, fullscreen.png and `{1920,1600,1366,1024,390}-{light,dark}.png`, build/test logs and benchmark log. Screenshots are fixture-based UI evidence; no production customer data. Premium browser profile regenerates screenshots and verifies cancelling a guarded return preserves all five draft lines. Real-API evidence/PDFs are under `../../artifacts/final-qa/`. These artifacts are local rather than application assets.

Use the three PowerShell terminals in [the existing exact localhost guide](POS_PRO_FINAL_QA.md#exact-manual-localhost-instructions-powershell): start the isolated cluster on 55432, seed/run the guarded QA API on 4000 with bot tokens blank, and run this frontend branch with VITE_API_URL=http://127.0.0.1:4000 on 5173. Do not use a Neon URL. Log in with the generated local cashier credentials, click POS Pro in the sidebar, then open shift inline. Popup blocking falls back to the same standalone route. Fullscreen requires a user click. A second cashier window for the same identity/branch waits until the first closes, then use Qayta tekshirish. Ctrl+R refreshes; F5 holds a nonempty cart. Return uses the unsaved-draft guard. Stop API/frontend before stopping the isolated cluster.

SIMULATED: HID/scale labels, bank confirmation, network failures, touchscreen events and print command dispatch. Physical scanner/scale/printer/drawer, real bank/fiscal settlement and native Windows print dialog are NOT certified. Browser PDF rendering is tested. No cloud preview was provisioned against the production API; localhost is the isolated review environment. New production deployment, main merge, provider configuration and production writes were not performed. Later release still requires owner approval, staging soak, fresh backup/restore and safe Telegram worker rollout.

Changed frontend files: App.jsx; layout/MainLayout.jsx; utils/{launchPosPro,useWorkspaceAppearance}.js; pages/posPro/{PosPro,Cart,Tracking,WorkspaceHeader}.jsx, {useProSession,usePosWindowLease,serialSelection}.js, posPro.scss; tests/{posProWorkspace.test,deepAudit.test,posPro.browser,posProSupermarket.browser}.mjs; design-baseline.json; .github/workflows/verify.yml; this report. Other modules retain their design styles and business services.

Review branch: `phase3/pos-pro-premium-workspace`, base `phase2/pos-pro`. [Compare / open Draft PR](https://github.com/Wamwod10/Zenix-Pos/compare/phase2/pos-pro...phase3/pos-pro-premium-workspace?expand=1). No backend PR required.

GitHub connector refused Draft PR creation with HTTP403 `Resource not accessible by integration`; branch push succeeded, so the requested compare fallback is supplied. [Branch CI runs](https://github.com/Wamwod10/Zenix-Pos/actions?query=branch%3Aphase3%2Fpos-pro-premium-workspace). Vercel read-only deployment listing found no automatic preview for this branch. No new cloud environment or production API test was substituted for isolated localhost review.

## Latest follow-up: dense cashier controls and presentation audit

Continued from 7bdb38d on the same Phase3 branch. Changes are limited to POS components, scoped styles, display helpers and tests. Shared checkout, finance, stock, shift, replay, credit and backend code are unchanged.

| Requested improvement | Result |
| --- | --- |
| Contrast / checkout hierarchy | Inset contrasting total, strong enabled CTA, explicit disabled reason, differentiated payment keys and customer selector; light/dark platform tokens retained |
| Dense catalog | Two compact columns at 1366px and wider; bounded one-column tablet fallback; load-more and price check share a compact action row; real pending label/aria-busy |
| Cart and sparse state | Denser readable lines; 1–2-row carts show a real cart item, quantity/unit/amount and working F3/F2 actions; no invented scan history or recommendations |
| Operator rail | Hold / Cheklar / Bekor qilish / Chek anchored under the receipt; frees terminal space so all five payment methods remain visible at desktop sizes |
| Workspace controls | Theme/device/fullscreen grouped, return visually secondary; fullscreen has denser scoped spacing |
| Keyboard / scan state | Focused barcode readiness, pending scan count and F3 return state; honest physical-device disclaimer remains |
| Shortcut helper | Collapsed strip opens a keyboard-accessible key grid; the full help line no longer occupies the workspace |
| Unit / stock audit | API units and selected-branch stock are preserved. Display-only aliases for kg/g/l/ml/dona; grouped fractional quantities; unknown custom units retained; missing units are not guessed by the helper |

The previous visual fixture deliberately assigned `unit:'kg'` and stock1000 to every dummy item. `productFromApi` retains row.unit; no incorrect production unit mapping was reproduced. New visual fixtures use mixed product types, stock, prices and entered quantities. Thus before/after screenshots compare layout, not identical basket financial values. Neither stock nor price was converted to make a screenshot look plausible; presentation only renders API data. Actual kg/g/l/ml/dona checkout/stock behavior remains covered by the disposable PostgreSQL suite.

### Additional confirmed HID defect and regression

P1, reproduced with recorded browser key events: an emission gap41.8ms was delivered to JavaScript49.9ms apart, causing the previous `performance.now()` classifier to reject one valid scan. A separate timed-driver probe generated49.2ms emission gaps, correctly outside the45ms protocol. Focus stayed BODY; this was not a focus steal. Evidence: local `phase3-polish/hid-timing-0.json`, failed browser logs and unit red/green logs.

Fix: `hardware.js` uses finite `event.timeStamp` by default; `PosPro.jsx` forwards the browser timestamp. Explicit test clocks and the45ms threshold are retained. New unit regression rejects queued180ms ordinary typing even when callbacks are processed together. New browser `scan-clock` profile rejects that slow input and accepts ten6ms emitted scans with deliberately50ms-delayed dispatch. Browser HID simulation now uses an explicit emission clock, because Playwright keyboard command roundtrips cannot guarantee device cadence. This is labelled SIMULATED and does not certify an attached scanner. Manual barcode field Enter, modal/editable guards, rapid100-event and existing payment/replay tests remain in place. Initial failures are retained, not counted as PASS.

Independent read-only review of visuals/components and the subsequent HID change found no additional confirmed P0/P1/P2. Its scope was code/screenshots; executed test evidence is recorded separately.

### Follow-up evidence

Frontend combined regression: **410 total, 408 PASS, 0 FAIL, 2 SKIP**. Backend serialized regression: **762 total, 745 PASS, 0 FAIL, 17 SKIP**. No backend files changed. Historical031/032 fixtures still pass. Real browser/API/PostgreSQL supermarket and normal/recovery receipt profiles were rerun; existing Savdo/history and shift reconciliation assertions pass. Final browser/performance evidence is retained under `../../artifacts/phase3-polish/` and `../../artifacts/phase2/search-benchmark-phase3-polish.json`.

Visual evidence: `phase3-polish/before-1366-light.png`, `before-1920-dark.png`; updated `phase3/{1920,1600,1366,1024,390}-{light,dark}.png`; `phase3-polish/sparse-light.png`, `shortcut-help.png`. Five viewport/two-theme browser assertions include overflow, minimum phone catalog height, visible desktop payment methods and unsaved-return preservation. Existing popup fallback, lock handover, fullscreen and shift opening checks remain active.

Follow-up changed files: `src/pages/posPro/{Cart,PosPro,WorkspaceHeader}.jsx`, `{hardware,presentation}.js`, `posPro.scss`; `tests/{posPro.browser,posProPostgres.browser,posProWorkspace.test}.mjs`, `tests/helpers/posHid.mjs`; `design-baseline.json`, `.github/workflows/verify.yml`, this report. The localhost guide and release limits above still apply. Production database, deployments, bots/webhooks and main were not changed.

Final controlled hydrated search (same production-build fixture, 160ms debounce, six measured samples, nearest-rank p95):

| Cart rows | Initial Phase3 p50/p95 ms | Follow-up p50/p95 ms |
| --- | ---: | ---: |
| 100 | 206.9 / 213.9 | 198.1 / 199.2 |
| 500 | 207.4 / 209.9 | 211.4 / 215.9 |

500-row p50 increased4ms (~2%) and p956ms (~3%). No material regression in this small local sample; not a speedup/endurance certification. Broad 100/500-row initial loads were1,001/1,846ms, separate from search. 500-row heap sample29.4MB used,53.5MB allocated,9,742 DOM nodes. Main gzip118,269 bytes and total442,985 bytes pass130,000/470,000 budgets; total increased747 bytes from preceding Phase3. Build, design baseline, import audit and readiness checks pass. Default browser, tracking, polish, premium and scan-clock profiles pass; premium waits for resize layout to settle before asserting desktop scroll bounds and taking screenshots.

Remaining gates: physical HID cadence, printers/scales/drawer, bank/fiscal providers, native Windows print dialog and staging soak. A driver probe that itself emits slower than45ms is outside the HID heuristic; slow/manual entry remains supported in the barcode field. No production release was performed. The existing localhost instructions use the isolated database and remain the supported review route; cloud preview was not created against the production API.

The initial final recovery-profile run also observed9/10 native driver scans; it was not recorded as PASS. That profile now reuses the same explicit `SIMULATED` emission helper as the synthetic-API browser, and its final real browser → API → PostgreSQL receipt/recovery run passes. The supermarket profile passes15 checkpoints/11 sales after the timestamp fix, including100 burst events and actual SQL stock/audit/outbox checks. The simulator is test-only; production scanner checks were not loosened.
