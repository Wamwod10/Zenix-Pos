# ZENIX POS visual / responsive audit — 2026-10-24

## A. Audit summary

26 original entries: 13 confirmed/fixed (some share a root cause), 7 not reproduced in exercised states, 2 intended behavior, 4 partially verified. One additional confirmed/fixed Products toolbar defect. No confirmed defect remains in the exercised matrix. Four broader scopes remain explicitly partial.

Local synthetic APIs only. No production data, financial logic, backend contracts, permissions, deployment settings or environments changed. Existing Inter, palette, tokens, radius/shadow and desktop POS three-panel identity preserved.

Fetched GitHub main: `3994e8e5775fe74e5127bc27f62c025535e2022e`. Clean starting branch: `design/pos-pro-platform-unification`, HEAD `29a157cd66426abed4fde0dadac7ad36cc00ef3d`. Created fix branch and fast-forwarded it to origin/main; previous work preserved. Previous dated audit document absent; supplied checklist used.

## B. Original 26 checklist

NOT REPRODUCED applies only to exercised fixtures/states. Partial entries are not blanket PASS results.

| ID | Status | Root cause / observation | Fix | Verification |
|---|---|---|---|---|
| S-01 | FIXED excess space | Empty mobile cart forced to 600px | Bound mobile cart to 320–420px; smaller empty minimum | 390px CTA y=2014.5 → 1802.5px. Still requires page scroll; 0/1/20/100/500-row cases |
| S-02 | FIXED | Header padding/wrap gaps | Scoped padding/gaps | 390px header 190.4 → 174.4px; all information retained |
| S-03 | NOT REPRODUCED clipping | Full long names wrap naturally | No name truncation | Long names/barcodes; row-overlap and card bounds; light/dark |
| S-04 | FIXED | Tablet scrollport 88–110px versus 252px card; desktop 183px versus 194px card | Catalog gap 10→8px; tablet catalog minimum 700px | Last card fully inside scrollport at 980/1024/1366px; interaction assertion |
| S-05 | INTENDED | Independent page/catalog/cart scroll surfaces | No scroll-lock rewrite; shorter mobile cart | Touch emulation, catalog/cart/payment reachability; physical momentum NOT VERIFIED |
| S-06 | FIXED | Integer-thousand rounding repeated 0k | Numeric/compact tick formatter | Original formatter fails regression; fractions/0/1k/1.5k/1M pass; empty and 120-sale charts |
| S-07 | FIXED | Compact empty state minimum 150px | Empty compact minimum 64px | Matching Pulse screenshots; alert rendering unchanged |
| S-08 | FIXED | Empty list states forced 210px | Empty minimum 110px | Empty products/stock/seller/expense; populated lists retain natural height; branch/business metrics unchanged |
| S-09 | FIXED | 820px launcher obstacle list omitted Sales input fields | Include checkout inputs/selects and customer dropdown in existing placement logic | Reproduced after two animation frames; strict bounding/intersection and elementFromPoint tests; 820px screenshot pair |
| S-10 | FIXED | Store/profile flex wrappers shrank short labels | Measured wrapper minimums above 1280px; profile button constrained to parent; full-name title hints | 1366px Asosiy filial/Test kassir scrollWidth equals clientWidth; desktop and long-cashier fixtures |
| S-11 | INTENDED | Empty desktop terminal naturally leaves space | No artificial content | 0/1/20/100/500 rows, shift closed, recovery, payment modal |
| S-12 | NOT REPRODUCED clipping | Existing scoped POS muted contrast | No font/token rewrite | POS contrast assertions, barcode/helper/shortcut labels, light/dark |
| K-01 | NOT REPRODUCED | Five bottom-nav items fit | No redesign | 320/360/375/390/430px touch screenshots; native 200% zoom NOT VERIFIED |
| K-02 | FIXED child overflow | Global hidden overflow masked real child faults | Fix Products/login/tablet Sales children; retain global rule | Child rectangles independent of document scrollWidth; expected scrollers recorded separately |
| K-03 | FIXED | Tablet Sales intrinsic grid minimums | Zero-minimum panels and minmax(0,1fr) tracks | 768/820px catalog; long metadata and 60-line cart |
| K-04 | NOT REPRODUCED | Existing bounded cart scroll works | No rewrite | 60 distinct rows at 320/390/768/1366px; last row + checkout in viewport |
| K-05 | FIXED | Bottom-fixed dropdown detached from input by 53–197px | Retain input-relative positioning; dvh-bounded list | Original gap assertion fails; attached dropdown at 320/390/600px passes |
| K-06 | NOT REPRODUCED table-card clipping | Existing labels/actions fit | Toolbar fix separately below | 320px long barcode/name geometry/screenshots; OS font scaling NOT VERIFIED |
| K-07 | NOT REPRODUCED | Existing quick-receive breakpoints render | No speculative consolidation | Modal/selectors/bounds at 320/390/600/700/760/980px and matrix sizes |
| K-08 | FIXED | Tablet catalog minimum left tiny scrollport | Catalog-only 700px minimum above mobile breakpoint | Tablet/landscape + last-card/payment reachability; mobile override remains independent |
| K-09 | NOT REPRODUCED | Existing visualViewport-aware AI works under emulation | No AI rewrite | Composer focus, resized viewport, orientation; existing 28-screenshot AI suite |
| K-10 | PARTIAL | Shared modal shells exercised | No unconfirmed change | Settings employee validation/footer, POS/inventory modals; billing evidence modal/native 200% zoom NOT VERIFIED |
| K-11 | PARTIAL | Empty and populated reporting renders | No unconfirmed change | 120 sales, long UZS totals, History/Analytics/Seller Analytics; all tooltip/export interactions NOT VERIFIED |
| K-12 | PARTIAL | Long customer/supplier/debt fixture renders | No unconfirmed change | Directories, customer dropdown, activity scrollers; all context-menu/pagination/error combinations NOT VERIFIED |
| K-13 | FIXED | Nested auth grids retained intrinsic minimum widths | Zero-minimum page/form grid tracks | 320px login originally right=367px; final bounds; login/register/reset focused reduced-viewport checks |
| K-14 | PARTIAL | Scoped POS contrast passes; global palette preserved | No token recoloring | POS 4.5:1 assertions and light/dark screenshots; whole-platform WCAG/custom-accent certification NOT VERIFIED |

New N-01 — FIXED: 320px Products toolbar right edge was 333.25px because actions could not wrap. Existing flex row now wraps; matching screenshot and child-bound assertion verify it.

## C. Mobile audit

Chromium: 320×700, 360×780, 375×812, 390×844, 430×932; 600×800, 680×900, 768×1024, 820×1180; 900×600 landscape. Additional breakpoint checks: 700×900, 760×900, 980×800.

Core layouts run at every size; all 22 modules have representative 320/390/768/1366px light/dark coverage. Separate 120-sale/60-cart-row fixtures supplement empty states; existing POS tests include 500 rows.

Keyboard checks resize the viewport while focusing inputs. They do NOT open a physical keyboard. Touch is Chromium hasTouch emulation. Real Android/iOS keyboard, momentum, hardware safe-area and native 200% browser zoom remain NOT VERIFIED. Existing AI zoom-equivalent viewport tests are not native zoom.

## D. Desktop audit

1024×768, 1280×800, 1366×768, 1440×900, 1600×900, 1920×1080 core layouts. Full screenshots at 1366px plus existing POS matrix cover balance, name truncation, shift closed, recovery and payment dialogs.

## E. Test results

| Command / check | Result |
|---|---|
| npm test | PASS: 290 tests, 0 FAIL, 0 SKIP |
| npm run build | PASS, final build |
| npm run audit | PASS: 0 missing imports, 0 brace errors, 0 forbidden references |
| npm run verify:production | PASS, standalone frontend |
| npm run verify:design | PASS: 24 stylesheets; only six intentional hashes updated |
| VISUAL_INTERACTIONS=1 VISUAL_STRICT=1 VISUAL_PHASE=release node tests/visualResponsive.browser.mjs | PASS: 19 widths, 22 modules, 251 theme/viewport/page cases, 146 interactions, zero runtime/route errors or uncontained overflow |
| Reviewer-strengthened acceptance-final matrix | PASS: 251 cases / 146 interactions; real result selection, route matching, launcher hit targets; zero failures |
| VISUAL_SALES_CART=1 node tests/visualResponsive.browser.mjs | PASS: 60 distinct cart rows, last-row/checkout reachability at 320/390/768/1366px |
| VISUAL_STRESS=1 node tests/visualResponsive.browser.mjs | PASS: 48 populated cases, 120 sales, long UZS values; zero runtime/route errors or uncontained overflow |
| node tests/aiWorkspace.browser.mjs | PASS: 28 light/dark/mode screenshots, composer, focus/inert, Sales checkout separation, zero page errors |
| tests/posPro.browser.mjs modes | PASS: default, pixel (112 cases, including 500 rows), pixel-accessibility, pixel-states, premium, tracking, polish, scan-clock, platform-contract |
| node scripts/check-performance-budget.mjs --bundle | PASS: main gzip 118294B / total 443181B; budgets 130000B / 470000B |
| git diff --check | PASS |
| Physical devices, Firefox/WebKit, native 200% zoom, full WCAG/custom-accent audit | NOT VERIFIED |

No assertions removed/skipped or timeout increases. Intermediate red evidence is retained. The initial formatter fails the new regression test; the fixed formatter passes. The 820px collision failed a settled-geometry assertion before the obstacle-list fix and passes afterward.

Recovery: GitHub run 39846167596 logs confirmed line 145 .pp-recovery failure after shift open/F5. It later reproduced locally: the snapshot still showed initial 24000 total instead of 36000 after selection. Shift opening asynchronously reconciles the draft; the test dispatched actions without asserting readiness. It now asserts dialog closure, open shift, editable quantity and quantity=2 before F5. The recovery visibility assertion and original 5000ms timeout remain. All pixel-states cases then passed. No financial/recovery business logic changed. Linux CI result is reported separately.

Read-only independent review found no definite production regression. Three important test gaps were addressed: requested-route assertion, actual customer result selection, and launcher center hit-testing; diagnostic truncation before overflow classification was removed. The strengthened acceptance-final matrix passed without recapturing screenshots. Short/long header geometry supplements cover the final wrapper constraints.

## F. GitHub and changed files

Branch: `fix/platform-visual-responsive-audit`. Commit/PR supplied in handoff. No main merge or manual deployment.

Implementation: `src/components/ZenixAILauncher.jsx`, `src/layout/MainLayout.jsx`, `src/layout/mainlayout.scss`, `src/pages/dashboard/Dashboard.jsx`, `src/pages/dashboard/dashboard.scss`, `src/pages/login/login.scss`, `src/pages/posPro/posPro.scss`, `src/pages/products/product.scss`, `src/pages/sales/sales.scss`, `src/utils/formatChartTick.js`.
Verification: `tests/posPro.browser.mjs`, `tests/visualResponsive.browser.mjs`, `tests/visualResponsive.test.mjs`, `scripts/visual-responsive-evidence.mjs`, `design-baseline.json`, this report, selected artifacts. No dependencies added.

## G. Visual evidence

Selected committed triplets: [artifacts/visual-fix-2026](../artifacts/visual-fix-2026/) with before/after/diff directories. Full local workspace evidence: `artifacts/visual-fix-2026/{before,sales-before,auth-before,catalog-diagnostic,release-check,release,sales-stress,populated,ai-regression}`. JSON includes child bounds, launcher hit tests/collisions, scrollports and interaction results.

Evidence mapping (same filename under before/after/diff):

| Findings | Screenshot | Regression risk / check |
|---|---|---|
| S-01/S-02 | 390-pos-pro-light.png and dark.png | Mobile cart viewport; 0?500 rows and checkout checks |
| S-04/K-08 | 1366-pos-pro-light.png | Catalog available height; tablet 980/1024px diagnostic bounds and final-card assertions |
| S-06/S-07/S-08 | 390-dashboard-light.png and dark.png | Intended vertical reflow; populated 120-sale rendering and formatter test |
| S-09 | 820-sales-light.png | Launcher may move vertically; collision/hit and existing placement tests |
| S-10 | 1366-dashboard-light.png | Header width pressure; short/long-name geometry |
| K-03 | 768-sales-light.png | Tablet shrink behavior; cart/catalog and 60-row reachability |
| K-05 | 390-customer-dropdown.png | Relative overlay clipping; real result selection and scroll checks |
| K-13 | 320-login-light.png | Nested grid sizing; auth geometry/focus at all sizes |
| N-01 | 320-products-light.png | Toolbar wrap; product action bounds |

Recovery screenshot: after/1366-recovery.png (no matching failed-state screenshot was available from historical CI; failure details are in diff/recovery-investigation.json). K-02 refers to the corresponding child-overflow fixes above.

Pairs use identical viewport/theme/fixture. Full-page pixel diffs include intended vertical reflow and live header clocks; no exact screenshot-equality claim. Existing baseline images are retained.

## H. Remaining risks

Physical Android/iOS, Firefox/WebKit, native 200% zoom, OS font scaling, four partial scopes and historical Linux recovery CI remain NOT VERIFIED. Checkout is closer but still below catalog/cart; no floating CTA covers controls. This representative audit does not certify every loading/error/modal/data permutation. No production read-only UI verification was performed; synthetic data is used throughout.
