# POS Pro 3.2 micro-detail QA

2026-10-22. Continued `phase3/pos-pro-premium-workspace` from remote/local
`b710cf59c905787566a92989697810045dabd6bc`. No backend files, ordinary Sales,
financial calculation/validation, deployment settings or production data changed.

The two original user screenshots were not attached to this session. Findings
below are reproduced from that commit in Chromium, not attributed to unseen
images. Before/after use the same synthetic API fixture, product names, prices,
quantities, viewport and theme. Reconciliation notices are dismissed in both.
The clock remains live, so screenshots are visual comparisons rather than
byte-identical image-diff baselines.

## Confirmed findings and fixes

| Finding | Root cause | Result |
| --- | --- | --- |
| Quantity/discount headings drift | Four-track heading and six-track rows used different widths, gaps and padding | Shared six-track CSS variables; hidden index/action headings; measured control-center error <=0.008px |
| Total heading/right edge drifts | Scrollbar gutter existed only on row scroller | Sticky heading lives inside the same memoized scroll container; edge error 0px |
| Negative zero discount | Minus sign rendered unconditionally | Display-only formatter rounds to existing money precision before deciding the sign; 0 and -0 both show `0 so‘m` |
| Generic CTA opens cash | Existing handler always calls `openPayment('cash')` | Label and F12 helper explicitly say `Naqd to‘lov`; method buttons still open their original dialogs |
| Duplicate barcode label / heavy focus | Placeholder repeated label; input and wrapper both indicated focus | Short `Kod kiriting` placeholder; one 2px wrapper outline; submit/scan logic unchanged |
| Search/tab rhythm differs | Tab text wraps with content-derived height | Both catalog tabs 48px with common padding/line-height; existing search spacing retained |
| Long catalog names clipped | Two-line WebKit clamp | Full wrapping names; min-content grid rows; consistent 156px minimum cards |
| Long names collide with prices | Minimum grid rows under-sized intrinsic button content | Inner flex layout with a growing name area and intrinsic parent row sizing; card/row overlap assertions |
| Price/unit spacing inconsistent | Inline small text combined inherited small/price styles with nowrap | Baseline-aligned wrapping price group; secondary units 12px; custom units retained verbatim |
| Catalog columns disappear | <=1250px override forced one column | Two-column grid retained, including phone/tablet; scroll-end checks and bottom padding |
| Catalog action borders differ | Load-more used dashed border | Solid border and shared action sizing |
| Quantity controls cramped | Narrow input and separate control sizing | 44px control heights; 60px centered input; existing fractional steps unchanged |
| Large payment/CTA gap; clipped methods | Flexible body consumed free space while settlement stayed outside it | Content-sized payment body; scrollable terminal; adjacent settlement |
| Odd final payment button | Five buttons in two-column grid | Final odd button spans both columns; 46px buttons and consistent shortcut alignment |
| Mixed language / helper wrapping | `Subtotal`, `Live panel`, verbose sequence | `Mahsulotlar jami`, `Natijalar`, compact three-step helper |
| Long branch overlaps cashier | Auto-minimum grid track and nonexistent `.premium-select-trigger` selector | Bounded branch track styles the actual `.premium-select`; cashier ellipsis with full-name title |
| Sparse context cut off above scroll origin | Centered overflowing flex content | Safe centering, compact padding; explicit scroll-origin assertion |
| Mid-width receipt overflow | Tablet columns remained active just above 650px | Existing stacked layout extended through 900px; additional 680px case |
| Keyboard helper lacks matching focus | Focus selector excluded summary | Summary included in shared focus treatment |

No new payment selection state, quantity/price conversion, financial backend
change or scanner timing change was introduced. Existing memoized cart traversal
is retained and its 500-row regression passes. The obsolete compact cart grid
override was removed; base/media rules for terminal and operator rail remain
scoped to POS Pro rather than changing platform tokens.

## Evidence

| Check | Result |
| --- | --- |
| Combined frontend | 411 total: **409 PASS, 2 SKIP, 0 FAIL** (one new discount regression) |
| Serialized backend + loopback PostgreSQL | 762 total: **745 PASS, 17 SKIP, 0 FAIL** |
| Real Chromium → Express → loopback PostgreSQL supermarket | **15 checkpoints / 11 sales**, including discounts, mixed units, stock, serial selection, shift reconciliation and ordinary Sales/history |
| Separate real PostgreSQL receipt/recovery browser | PASS: kg/l, split/cash, lost response, reload, exact stock/outbox and recovered receipt/change |
| Existing synthetic browser profiles | default, premium, polish, tracking, scan-clock: PASS |
| New pixel matrix | **98 PASS**: 1920×1080, 1600×900, 1366×768, 1280×800, 1024×768, 680×900, 390×844; light/dark; 0/1/2/5/20/100/500 rows |
| Additional screenshot states | Closed shift, payment modal, native fullscreen, offline, hold recovery; long names/barcodes/identities, custom unit, 12,000,000 so‘m total |
| Geometry assertions | Heading/control centers, money edge, payment viewport/height, horizontal overflow, card row/inner overlap, paired card heights, sparse scroll origin and catalog scroll end |
| Accessibility browser profile | 14 viewport/theme cases; focus ring, equal quantity-control heights, last receipt row reachable; 8 representative text selectors per case have contrast >=4.5:1 (minimum **5.74:1**) |
| Baseline geometry | 84 original-viewport cases: 278 failed assertions before; after 98 cases: 0 failures. Baseline center error up to19px, total edge12px; after <=0.008px /0px |
| Build / design / import audit / readiness / bundle budgets | PASS; only POS Pro SCSS hash updated in design manifest |

Search benchmark method is unchanged: production build, 50k catalog fixture,
160ms debounce, hydrated 100/500-row cart, seven queries, first sample discarded,
six retained request/render/paint samples. Final run was performed after other
test processes finished. Small local samples do not establish a speedup.

| Rows | Previous p50 / p95 ms | Current p50 / p95 ms |
| --- | ---: | ---: |
| 100 | 201.0 / 204.5 | 200.5 / 204.2 |
| 500 | 210.1 / 217.6 | 208.5 / 217.8 |

Main JS gzip118,276 bytes; total JS gzip443,101 bytes, within130,000/470,000
budgets (previous118,264/443,023). No dependency installed.

## Reviewable artifacts

- 1366×768, two lines: [before](pos-pro-32-qa/before-1366-light-2.png), [after](pos-pro-32-qa/after-1366-light-2.png).
- 1600×900, dark, 20 lines: [before](pos-pro-32-qa/before-1600-dark-20.png), [after](pos-pro-32-qa/after-1600-dark-20.png).
- [680px responsive](pos-pro-32-qa/after-680-light-2.png), [long identity/barcode, custom unit, large total](pos-pro-32-qa/after-1366-stress.png).
- [DOM measurements](pos-pro-32-qa/measurements.json), [contrast measurements](pos-pro-32-qa/accessibility.json), [raw unchanged search samples](pos-pro-32-qa/search-benchmark.json).
- Full local screenshot matrix and execution logs: workspace `artifacts/pos-pro-32/` and `artifacts/pos-pro-32-*.log` (outside standalone frontend Git repository).

Changed implementation: `Cart.jsx`, `PosPro.jsx`, `WorkspaceHeader.jsx`,
`posPro.scss`, `presentation.js`. Verification: `posPro.browser.mjs`,
`posProWorkspace.test.mjs`, `design-baseline.json`, `.github/workflows/verify.yml`,
this report and selected QA artifacts. New pixel profiles are included in CI.

## Limits and remaining issues

Screenshots were visually inspected separately from geometry tests; the first
green geometry run missed long-name overlap, so new inner-card assertions were
added before accepting the final images. Review also found the651–700px gap;
the680px case now protects it. Earlier failed runs are not counted as PASS.

At1024px and below the workspace deliberately scrolls vertically; receipt
columns become stacked below901px. Catalog/cart bodies remain scrollable and
can show partial rows at their scroll boundaries. Large totals may wrap the
currency onto a second line. Very long branch/cashier identities use ellipsis;
full cashier name is available via title. These are intentional responsive
tradeoffs, not claims of zero scrolling at every resolution.

The contrast check samples representative normal text; it is not a complete
WCAG audit of every state or disabled control. Recovery screenshots use a
simulated failed hold response; actual lost-sale recovery is separately covered
by the real PostgreSQL browser. No physical HID/printer/scale, bank/fiscal
integration, native Windows print-dialog or production/staging soak claim.
Original user screenshots were unavailable. CI status is checked after push
and reported separately with the commit/compare link; local PASS is not CI PASS.

No production deployment, main merge, Neon data or Telegram webhook operation
was performed.
