# POS Pro 4.0 — platform design integration audit

Date: 2026-10-23, Asia/Tashkent. Branch: `design/pos-pro-platform-unification`.
Fetched current frontend main before starting: **c16a142**, production merge of
POS Pro 3.2 source **55a56f8**. The new branch starts from c16a142, not Phase 2/3.
Backend checkout tested: **a357b6a**; no backend source was changed.

The production screenshot mentioned in the request was not attached to this
session; the IDE attachment contained an empty text file. No claim is made
about unseen pixels. Confirmed findings below come from current-main source,
local Chromium screenshots and interaction measurements. No real business data
was used. Platform reference pages use the same synthetic owner/branch fixture.

## Design brief and references

Keep the independent three-zone cashier workspace and every existing financial,
scanner, session and recovery contract. Rebuild its visual layer around the
actual platform surfaces, control geometry, typography and operational hierarchy.
Do not add a separate palette, global sidebar, Dashboard topbar, dependencies,
animation framework, provider integration or new payment state machine.

Audited references:

| Reference | Source and application to POS Pro |
| --- | --- |
| Sidebar/topbar/theme | `src/layout/mainlayout.scss`, `MainLayout.jsx`: quiet identity groups, restrained actions, subtle borders and inherited appearance variables |
| Runtime appearance | `src/utils/useWorkspaceAppearance.js`: existing user accent, system/light/dark preference, density/radius preferences and body theme class remain authoritative |
| Dashboard | `src/pages/dashboard/dashboard.scss`, `Dashboard.jsx`: normal-color KPI typography, soft cards, number hierarchy and restrained supporting text |
| Savdo | `src/pages/sales/sales.scss`, `Sales.jsx`: search surfaces, contextual payment actions, quiet row separators and rounded controls |
| Kassa/Smena | `src/pages/shifts/shifts.scss`, `Shifts.jsx`: compact operational notices, separate shift identity and explicit actions |
| Mahsulotlar/Ombor | `src/pages/products/product.scss`, `Products.jsx`, `src/pages/inventory/inventory.scss`, `Inventory.jsx`: name/price/stock hierarchy and secondary metadata |
| Analitika/Settings | `src/pages/analytics/analytics.scss`, `Analytics.jsx`, `src/pages/settings/Settings.jsx`, shared `src/styles/saas.scss`: consistent sections, form rhythm and surfaces |
| Shared components | `src/components/Ui.jsx`, `Modal.jsx`: reused PremiumSelect, date input, modal shell, focus trap and confirmation controls |
| Typography/spacing | `src/index.css`: Inter stack, body14px, secondary12–13px, established weights and4/8/12/16/20/24px spacing family |

All seven reference pages were captured in both themes after their actual h1
and content loaded. The first capture attempt caught Suspense skeletons; those
images were replaced and are not accepted reference evidence.

### Actual tokens

| Token | Light | Dark |
| --- | --- | --- |
| Background | `#f3f4f4` | `#111315` |
| Card | `#fbfbfa` | `#181a1d` |
| Surface | `#f6f6f4` | `#1e2125` |
| Soft surface | `#eff1f2` | `#23272c` |
| Main text | `#202327` | `#eef0f2` |
| Platform muted | `#7a7f87` | `#969ba2` |
| Border | `rgba(31,35,40,.085)` | `rgba(255,255,255,.075)` |

Base stylesheet primary is `#4d6e9f`; runtime appearance overrides it from the
user's accent. The measured default fixture resolves **primary#647687** and
**primary-dark#536270**. POS Pro consumes these variables rather than hardcoding
either palette. Control/card/panel radii are **13/20/18px**. The existing soft
shadow is reused; no additional panel stroke/shadow stack is introduced.

POS Pro secondary text derives from70% platform text over card, preserving
readability without changing global muted tokens. Typography: section16px/600,
product/cart names14px/550, prices15–17px/650, total30–44px/650, labels/helpers
12–13px. Only tertiary scan status and shortcut keys use11px. Stock, barcode,
unit and tracking information are12px. Receipt numbers use tabular numerals.

Inputs, quantity buttons and payment methods retain44px touch targets. Header
actions use40px; the compact branch selector uses36px within its labeled group.
Focus is a2px inherited-primary outline. Disabled actions keep full opacity and
readable muted text; hover/pressed states use platform surfaces. Checkout uses
the runtime primary-dark token and its existing contrasting text token.

## Confirmed findings, severity and root cause

P0: no financial/security regression identified. No changes to API contracts,
pricing, stock validation, ledger, discount arithmetic or checkout idempotency.
P1 entries below were discovered during the rebuild and fixed before acceptance.
User-reported production concerns are not automatically treated as reproduced.

| Priority | Confirmed issue | Root cause and final treatment |
| --- | --- | --- |
| P2 | Heavy panel/card outlines | `--pp-edge`,3px panel tops and thicker selected borders overrode platform borders. Replaced with single theme borders and soft surfaces |
| P2 | Black/inverted total hierarchy | Total and checkout used text color as their background. Total now follows Dashboard KPI text; CTA uses platform primary-dark |
| P2 | Surfaces insufficiently differentiated | Nested controls/cards shared backgrounds and added frames. Product/search surfaces now use existing surface tokens against card panels |
| P2 | Unequal header identity hierarchy | Branch had a label; cashier mixed name and shift status. Both identities now have labels; shift/connection/time form a distinct compact group |
| P2 | Excess header action framing | Group frame plus individual action frames increased noise. Quiet topbar actions retain accessible labels/titles, including icon-only breakpoints |
| P2 | Closed-shift notice prominence | Stacked large heading/paragraph competed with receipt content. Compact operational notice is60px in the1366px contract fixture; opening/reload actions and Draft guard remain |
| P2 | Uneven discovery controls | Independent search, tabs and selector styles lacked a common rhythm. Search icon wrapper, segmented tabs and existing PremiumSelect share platform geometry |
| P2 | Product cards looked separate from platform | Heavy outlines and hard selection treatment. Soft intrinsic-height two-column cards with baseline price/unit groups and stable1px selection border |
| P2 | Technical receipt appearance | Separate rounded +/- inputs, repeated last-product summary and strong row framing. Joined quantity control, softer separators, compact next-product prompt and clear discount heading |
| P2 | Secondary tracking/barcode text too small | Some metadata used11px. Metadata/tracking now12px; long barcode/name/unit wrapping retained |
| P2 | Disabled payment readability | Whole-button opacity.48 faded text and icons together. Full opacity with explicit muted surfaces/text; guards unchanged |
| P2 | Implicit cash selection | First payment method had a persistent highlighted style although clicking immediately opens its modal. Methods are neutral direct actions; cash CTA remains explicitly labeled |
| P2 | Operator toolbar felt framed/mechanical | Nested card borders and per-button frames. Borderless contextual actions sit on one soft footer surface outside receipt scroll |
| P2 | Excess helper/debug copy | HID suffix diagnostics and repeated sparse-item/helper content occupied the main workflow. Useful shortcuts remain; device limitations stay in the device modal; closed-shift copy describes the operator's next action |
| P2 | Prominent scrollbars | General scrollbar styling added visual weight. Quiet thin scrollbar styling is scoped to POS Pro; stable receipt gutter retained |
| P2 | Fragile SCSS cascade | Repeated terminal, total, rail and breakpoint overrides accumulated. Rewritten into base controls, header, discovery, receipt, settlement, operational/modal and responsive sections |
| P2 | Low stock relied on color | A color-only hint can disappear with theme/disabled styling. `Kam qoldi` text plus emphasis retains the actual API quantity without converting it |
| P1, fixed | Mobile total/CTA narrowed | Tablet `align-self:start` persisted into stacked layout. Mobile stretch override; regression failed before the fix and passes afterward |
| P1, fixed | Closed-shift CTA cut by panel | A viewport-only assertion missed panel clipping. Content-sized/shrinkable payment body, fixed settlement and compact spacing; panel-aware regression added |
| P1, fixed | Final method clipped in short terminal | Pinning CTA alone reduced the payment body's visible height. Rebalanced internal spacing while retaining44px payment targets; closed-shift all-method visibility contract passes |

Previously fixed3.2 alignment, negative-zero discount and long-name wrapping
were retained, not claimed as new4.0 discoveries. Both before and after basic
geometry matrices pass; this rebuild addresses visual identity beyond alignment.
Broad claims that every normal secondary label was low contrast were not
reproduced. Disabled-opacity and warning-color risks were addressed; the final
normal-text sample has minimum contrast5.74:1.

## Visual comparison and iteration

Audit → first implementation → Chromium screenshots → visual review → fixes →
regression → final screenshots was completed. Screenshots exposed mobile
settlement width and closed-shift clipping even when earlier geometry tests were
green. These became dedicated red/green regressions. A separate reviewer found
no important code or visual defect in the final representative screenshots.

| Platform reference | Final POS Pro correspondence |
| --- | --- |
| Dashboard light KPI cards | Normal-color totals on soft surfaces, same typography and radius family; no black KPI slab |
| Savdo dark workspace | Same layered dark surfaces, quiet separators, rounded search/controls and restrained primary CTA |
| Platform topbar | Matching brand/identity/action hierarchy, adapted to the cashier; global sidebar/topbar intentionally absent |
| Platform forms/modal | Same actual PremiumSelect and Modal components; POS content styles remain scoped |
| Other data pages | Matching body/secondary type and spacing; POS controls stay larger where cashier touch/keyboard use needs it |

Before/after screenshots use the same current-main synthetic fixture, prices,
cart quantities, long name, viewport and theme. Notices from fixture rehydration
are dismissed in both. The clock remains live; this is a visual comparison, not
a byte-identical screenshot diff. Reference pages contain synthetic/empty data,
not production sales.

- 1366×768 dark,2 rows: [before](pos-pro-4-qa/before-1366-dark-2.png), [after](pos-pro-4-qa/after-1366-dark-2.png).
- 1600×900 light,2 rows: [before](pos-pro-4-qa/before-1600-light-2.png), [after](pos-pro-4-qa/after-1600-light-2.png).
- [Dashboard light](pos-pro-4-qa/platform-dashboard-light.png), [Dashboard dark](pos-pro-4-qa/platform-dashboard-dark.png), [Savdo light](pos-pro-4-qa/platform-sales-light.png), [Savdo dark](pos-pro-4-qa/platform-sales-dark.png).
- [Closed shift with retained Draft](pos-pro-4-qa/1366-dark-closed.png), [phone](pos-pro-4-qa/390-light-2.png), [payment modal](pos-pro-4-qa/1600-light-5-modal.png), [long identities/barcode, custom unit, large total](pos-pro-4-qa/1366-dark-custom-unit-large-total.png).

Complete local artifacts: workspace `artifacts/pos-pro-4/{before,after,platform}`;
execution logs `artifacts/pos-pro-4-*.log`. Selected evidence is committed here
so reviewers do not need the local workspace.

## Verification

| Check | Final result |
| --- | --- |
| Full combined frontend | **409 PASS,2 SKIP,0 FAIL**;411 total |
| Full serialized backend with local PostgreSQL | **745 PASS,17 SKIP,0 FAIL**;762 total |
| Real browser → Express → local PostgreSQL supermarket | **15 checkpoints,11 sales**; cash/card/split/credit, weighted/fractional quantities, stock, serial choice, Hold/Resume, replay/recovery, shift reconciliation, ordinary Sales/history |
| Separate real PostgreSQL receipt/recovery browser | PASS; normal kg/split and recovered l/cash receipts/change, exact stock/outbox, ordinary Sales |
| Existing synthetic UI profiles | default, premium, polish, tracking, scan-clock: PASS |
| Platform contract | PASS; non-inverted KPI, no thick total border, readable disabled methods, compact notice, all closed-shift methods/CTA within panel, full-width phone settlement |
| Before/after geometry | **112 cases each**,0 failures;8 viewports ×2 themes ×7 cart sizes |
| Accessibility | **16 viewport/theme cases**,14 representative text selectors each; minimum contrast **5.74:1**; visible focus, matched quantity-control heights and final receipt row reachability |
| Import audit/readiness/build/design/bundle | PASS; only POS Pro SCSS hash changed in the24-file visual baseline |
| Independent review | No remaining important code/visual findings; phone sparse helper can approach its scroll boundary |

Viewports:1920×1080,1600×900,1440×900,1366×768,1280×800,1024×768,
390×844 and additional680×900 coverage. Cart sizes:0,1,2,5,20,100,500.
Final heading/control center error **0px**, right money edge **0px** in desktop
cases. Assertions cover horizontal overflow, header/control geometry, paired
card heights, inner-card/row overlap, sparse scroll origin, payment panel/body
clipping, checkout visibility, focus and scroll reachability.

Additional screenshots cover open/closed shift, retained Draft, payment modal,
native Fullscreen API, offline, hold recovery, long names/barcodes/identities,
custom units and12,000,000 so‘m totals in both themes. Real lost-sale recovery is
separately checked against PostgreSQL. HID/bank input is explicitly simulated or
manually confirmed in tests; physical devices are not certified.

Intermediate failures were retained and not counted as PASS:

- The initial local backend run crossed the Tashkent/UTC date boundary. An old
  test combines SQL `CURRENT_DATE-1` with an organization switched to UTC.
  Session `PGOPTIONS` did not fix that test because its explicit pool options
  override it; it also made the app/test pools disagree. A directory-only retry
  then encountered fixtures left from a previous run. The final complete suite
  used its normal schema-reset stages with **only the disposable local test
  database temporarily set to UTC**. All745 tests passed and its original
  Asia/Tashkent setting was restored. No backend/test source or production
  database was changed to force a green result.
- One unrelated scheduler test failed under concurrent load because it assumes
  a nested timer finishes within20ms. Its isolated rerun and final full frontend
  run passed without modifying the scheduler or relaxing the assertion.

## Performance

Same production-build browser benchmark:50k catalog, hydrated100/500-row cart,
160ms debounce,7 queries, first sample discarded,6 retained input/request/JSON/
render/paint samples. Final benchmark ran after other test processes finished.
The algorithm and methodology were not changed.

| Rows | Recorded3.2 p50/p95 ms | Final4.0 p50/p95 ms |
| --- | ---: | ---: |
|100|200.5 /204.2|201.6 /202.0|
|500|208.5 /217.8|204.0 /210.4|

The500-row acceptance baseline is208.5/217.8. Small local samples
show no material slowdown and do not establish a statistically proven speedup.
Raw samples are linked below. At500 rows:9,751 DOM nodes,26MB used heap/35.1MB
allocated in the sampled run; heap is GC-dependent. The500-row memoized cart
traversal regression remains intact.

Main JS gzip **118,258 bytes**, all JS gzip **443,079 bytes**, below the existing
130,000/470,000 budgets. This synthetic browser timing is distinct from actual
API/PostgreSQL correctness tests and from real store/hardware performance.

Evidence: [geometry](pos-pro-4-qa/geometry.json), [contrast](pos-pro-4-qa/contrast.json),
[runtime platform tokens](pos-pro-4-qa/platform-tokens.json),
[unchanged search samples](pos-pro-4-qa/search-benchmark.json).

## Files and safety boundaries

Implementation: `src/pages/posPro/{posPro.scss,WorkspaceHeader.jsx,Cart.jsx,PosPro.jsx}`.
Verification: `tests/posPro.browser.mjs`, `.github/workflows/verify.yml`,
`design-baseline.json`. Deliverables: this report and `docs/pos-pro-4-qa/`.

Unchanged: financial services, API contracts, `useProSession`, scan queue/HID
adapter, model/money helpers, stock validation, receipt implementation, auth,
branch/tenant permissions, Web Lock, ordinary Sales and platform styles.
No dependency installed. No production Vercel deployment, main merge, Render
settings change, Neon write or Telegram bot/webhook operation was performed.

## Remaining limits and GitHub handoff

- Original production screenshot was unavailable; no production-data visual test.
- 1024px/tablet and phone intentionally use vertical page scrolling; below901px,
  receipt controls stack. Cards/rows at scroll boundaries can be partially
  visible. Phone sparse helper actions remain inside their scrollable helper;
  operator actions remain outside receipt scrolling.
- Long identities use ellipsis; long product names/barcodes/custom units wrap.
  Very large monetary values may wrap while retaining the full value.
- When multiple recovery/operational notices reduce usable height, the payment
  body can scroll while settlement remains available. No fixed fake totals,
  hidden methods or invented device-connected indicators are used.
- Contrast sampling is not a complete WCAG audit of every custom user accent,
  state or provider modal. Physical scanners/printers/scales, native Windows
  print dialog, bank/fiscal integrations and staging soak remain external checks.

## GitHub delivery and CI result

Implementation commit: [`9e4ed35`](https://github.com/Wamwod10/Zenix-Pos/commit/9e4ed3552a208c25a89020cdb66582012610b2c0), pushed to
[`design/pos-pro-platform-unification`](https://github.com/Wamwod10/Zenix-Pos/tree/design/pos-pro-platform-unification).

[GitHub Actions run 39841326371](https://github.com/Wamwod10/Zenix-Pos/actions/runs/39841326371)
completed **SUCCESS** for that implementation commit on 2026-10-22 UTC
(2026-10-23 Tashkent). It includes frontend tests, protected design baselines,
source audit, production readiness, build, all POS browser profiles including
pixel/platform-contract, CPU/bundle budgets and responsive login smoke.
The later report-only commit does not change the tested implementation.

The automatic Vercel commit status is **success**:
[branch deployment details](https://vercel.com/shamshods-projects-9be974ef/zenix-pos/AUg2wYdY5cygRUr7DmGoYF2MTZoz).
This is a status/details link, not a separately verified public staging URL.
No manual deployment or production promotion was performed.

Draft PR creation was attempted against main. The GitHub connector returned
**403 Resource not accessible by integration**. No PR was created. Use the
[authorized compare fallback](https://github.com/Wamwod10/Zenix-Pos/compare/main...design/pos-pro-platform-unification?expand=1)
to review the pushed branch and open it as a Draft PR.