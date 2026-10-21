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
| P3 | Quantity Enter invoked the commit and blur commit | Blur performs one commit | Existing quantity/receipt regressions |

Independent final code/visual review found no additional confirmed P0/P1/P2. No confirmed P0 remains in the tested scope. Unsupported Web Locks explicitly block editing rather than permit unsafe concurrent draft writes. Existing shared financial journal, server replay, inventory and permissions remain authoritative; no second ledger or backend checkout was introduced.

## Verification and measurements

- Frontend full runner: 408 tests, 406 PASS, 0 FAIL, 2 SKIP (environment-dependent existing checks).
- Backend full serialized runner: 762 tests, 745 PASS, 0 FAIL, 17 SKIP. Backend working tree equals main b41bd55; no backend files changed.
- Real Chromium → Express → disposable loopback PostgreSQL: 15 supermarket checkpoints and 11 sales PASS, including inline shift, six units/EAN labels, 100 synthesized HID scans, cash/card/split/credit, Hold/timeout/replay, history, stock/audit/outbox, serial S2 and shift close. Separate normal/recovered kg/l receipt integration PASS. Receipt 58/80mm PDFs regenerated and parsed by the supermarket test.
- Default Phase2 browser profile, new premium and serial/pending profiles PASS. Premium covers named window/reuse, blocked popup same-tab fallback, direct route, lock handover, actual Fullscreen API/Escape and both themes at 1920×1080, 1600×900, 1366×768, 1024×768 and 390×844.
- Build, import audit, readiness, 24 stylesheet baselines and CPU/bundle budgets PASS. Only POS stylesheet baseline changed. Main gzip 118,269 bytes; total 442,251 bytes (budgets 130,000/470,000).
- An initial full browser run concurrent with backend tests counted 9/10 timed HID scans. The idle rerun passed unchanged. The outside-input detector intentionally rejects >45ms gaps; simulated OS scheduling stalls can violate that cadence. Its threshold was not widened to misclassify ordinary typing. The dedicated barcode field supports manual/slow entry. Real hardware cadence still requires acceptance testing.
- One frontend source assertion initially failed after appearance extraction; updated it to verify the shared hook and currency assignment. No test was removed or hidden. Historical 031/032 version-pinned migration fixtures remain unchanged and pass in the backend suite.

Controlled browser search benchmark, same hydrated production-build profile, 160ms debounce, six samples per size (p95 nearest-rank; not SQL/WAN timing):

| Cart rows | Previous p50 / p95 ms | Premium p50 / p95 ms |
| --- | ---: | ---: |
| 100 | 201.2 / 206.1 | 206.9 / 213.9 |
| 500 | 193.4 / 211.3 | 207.4 / 209.9 |

500-row median increased ~14ms (~7%); tail stayed similar. These small samples support no major regression, not a statistically significant performance claim. At 500 rows ~27.6MB used heap, 53.5MB allocated, 9,707 DOM nodes; no endurance/leak certification. Catalog pagination and cart memoization are retained; browser fixtures represent 10k/50k catalogs without loading all products. Latest broad 500/50k initial-load sample 1,810ms includes browser automation/restoration and is separate from the controlled query timing. SQL baseline results in [Phase2 QA](POS_PRO_FINAL_QA.md) are historical, not rerun measurements for this frontend-only change.

## Visual evidence and local use

Local evidence: `../../artifacts/phase3/` contains before-1366.png and `{1920,1600,1366,1024,390}-{light,dark}.png`, build/test logs and benchmark log. Screenshots are fixture-based UI evidence; no production customer data. Premium browser profile regenerates all ten screenshots. Real-API evidence/PDFs are under `../../artifacts/final-qa/`. These artifacts are local rather than application assets.

Use the three PowerShell terminals in [the existing exact localhost guide](POS_PRO_FINAL_QA.md#exact-manual-localhost-instructions-powershell): start the isolated cluster on 55432, seed/run the guarded QA API on 4000 with bot tokens blank, and run this frontend branch with VITE_API_URL=http://127.0.0.1:4000 on 5173. Do not use a Neon URL. Log in with the generated local cashier credentials, click POS Pro in the sidebar, then open shift inline. Popup blocking falls back to the same standalone route. Fullscreen requires a user click. A second cashier window for the same identity/branch waits until the first closes, then use Qayta tekshirish. Ctrl+R refreshes; F5 holds a nonempty cart. Return uses the unsaved-draft guard. Stop API/frontend before stopping the isolated cluster.

SIMULATED: HID/scale labels, bank confirmation, network failures, touchscreen events and print command dispatch. Physical scanner/scale/printer/drawer, real bank/fiscal settlement and native Windows print dialog are NOT certified. Browser PDF rendering is tested. No cloud preview was provisioned against the production API; localhost is the isolated review environment. New production deployment, main merge, provider configuration and production writes were not performed. Later release still requires owner approval, staging soak, fresh backup/restore and safe Telegram worker rollout.

Changed frontend files: App.jsx; layout/MainLayout.jsx; utils/{launchPosPro,useWorkspaceAppearance}.js; pages/posPro/{PosPro,Cart,Tracking,WorkspaceHeader}.jsx, {useProSession,usePosWindowLease,serialSelection}.js, posPro.scss; tests/{posProWorkspace.test,deepAudit.test,posPro.browser,posProSupermarket.browser}.mjs; design-baseline.json; .github/workflows/verify.yml; this report. Other modules retain their design styles and business services.

Review branch: `phase3/pos-pro-premium-workspace`, base `phase2/pos-pro`. [Compare / open Draft PR](https://github.com/Wamwod10/Zenix-Pos/compare/phase2/pos-pro...phase3/pos-pro-premium-workspace?expand=1). No backend PR required.
