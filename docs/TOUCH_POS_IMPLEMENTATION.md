# Touch POS and module views

User requested direct implementation using existing Zenix design and authoritative checkout.

## Design / constraints
- Classic remains the default. Persist Classic/Touch choice per organization/user; switching never remounts or clears the cart.
- Touch: large selectable receipt above a compact catalog, right-side keypad and existing payment terminal. Responsive stacking on narrow screens. Existing tokens, Inter, light/dark, scanner and shortcuts remain.
- Quantity/discount use existing session handlers. Target unit price maps to existing line discount, including cart discount and current permission/limit checks. Price increases remain forbidden by the existing server contract. No new price/checkout service or backend changes.
- Inventory/Suppliers reuse filtered/paginated records and current action handlers across cards/table; persist view per user/organization.
- No production writes, main merge or deployments.

## Plan
1. Preserve pending product-action fix on new feature branch.
2. Add tested touch-input/price-to-discount helpers and user-scoped layout preference.
3. Reuse Cart with optional touch selection/price column; add keypad; integrate without changing checkout/hold/recovery.
4. Add scoped responsive Touch CSS and module Grid/List UI.
5. Synthetic Chromium: 1024/1366/1920 touch, 390 mobile, light/dark; keypad edits, scanner, payment guards, persistence, filters/actions/pagination.
6. Existing unit/browser regression, build, design/readiness/budgets, review, commit/push/PR. Record evidence/results here.

## Verification and evidence
- Latest remote main at start of delivery: `620cf31` (PR #27 merge). Feature branch fast-forwarded to that commit without changing pending work.
- `npm test`: 295 passed, 0 failed/skipped. Includes keypad input/large target-price precision, scoped view preferences and shared pagination tests.
- `npm run build`, `npm run audit`, `npm run verify:production`: passed. Backend/API/financial services unchanged.
- `npm run verify:design`: intentionally updates only modified/new component styles; shared palette/tokens unchanged.
- `node scripts/check-performance-budget.mjs --bundle`: passed; main gzip 118,363 bytes / 130,000, total 446,308 / 470,000 (synthetic, not hardware throughput).
- `node tests/posPro.browser.mjs`: full Classic workflows passed: HID/rapid scans, quantity, discounts, hold/resume, cash/card, recovery, receipt, offline drafts, 100/500-line carts and 50k catalog lookup.
- `POS_PRO_UX_ONLY=pixel-states`: recovery acceptance and visual states passed. `pixel-accessibility`: passed.
- `POS_PRO_UX_ONLY=touch-mode`: selected row keypad, quantity/discount/target price, mode persistence and Classic cart preservation, cash authoritative payload, hold/resume, 500-line selection and closed-shift guard. Screenshots in `../artifacts/touch-pos/`.
- `VISUAL_MODULE_VIEWS=1 VISUAL_WIDTHS=320,390,1366 VISUAL_ROUTES=/inventory,/suppliers VISUAL_PHASE=module-views VISUAL_STRICT=1 node tests/visualResponsive.browser.mjs`: 12 theme/viewport/module cases and 6 view workflows passed. 45-row fixtures test pagination, search reset, reload persistence and existing action dialogs. Contained table scrolling is intentional.
- Module screenshots: `../artifacts/visual-fix-2026/module-views/{320,390,1366}-{inventory,suppliers}-{grid,list}-{light,dark}.png`.
- Mobile Classic/Products: 8 cases, no overflow/runtime/route failures at 320/390, both themes. Prior pending Products single-row action fix is preserved in this commit.
- Independent read-only code review found target-price percentage rounding could lose cents on large prices. Removed premature rounding and added regression coverage.

## Scope and limitations
Touch uses the same receipt/session and checkout guard as Classic. Target price can only decrease within existing discount authorization/combined limits; server-forbidden price increases remain forbidden. Desktop keypad stays beside receipt/catalog; the shared payment terminal becomes a compact footer. Mobile stacks the payment terminal immediately after the receipt, ahead of catalog/keypad.

No physical POS terminal, bank terminal, printer, Android/iOS keyboard, or production checkout was tested. Browser evidence is synthetic Chromium with touch emulation. Production was not modified, main was not merged, and no deployment was requested.
- Final Classic `POS_PRO_UX_ONLY=pixel`: 112 geometry/theme/cart cases passed, 0 failures (1920/1600/1440/1366/1280/1024/680/390, carts 0/1/2/5/20/100/500).
- Final Touch run includes 320/390/1024/1366/1920 widths, light/dark screenshots, every enabled payment modal and payment-button viewport bounds. 1024px checkout bottom 693px; 1366px 656px; 1920px 968px. Final 320/390 Classic/Products rerun: 8 cases, 0 overflow/runtime/route failures.
- Touch browser acceptance now also runs in the default POS browser suite used by CI. Code review follow-up found no remaining blockers.
