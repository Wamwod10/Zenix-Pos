# Zenix POS UI/UX remediation register — 2026-11-01

> **Branch:** `design/ui-001-032-batch-remediation` · **PR:** https://github.com/Wamwod10/Zenix-Pos/pull/113
>
> **Status definitions:** `Staged` = code committed on PR branch, **not** browser-accepted or production deployed; `Partial` = only part of the stated scope is implemented; `Pending` = no complete fix yet. Do not mark any task Done before CI + visual QA + merge + deployment verification.

## User-reported UI-001–UI-020 and audit-derived UI-021–UI-032

| ID | Scope | Status | Evidence / remaining work |
| --- | --- | --- | --- |
| UI-001 | Dashboard loading banner and title spacing | Staged | Dashboard loading status/spinner; responsive margins |
| UI-002 | Sales category/catalog scrollbars | Staged | Subtle scrollbars; scroll behavior retained |
| UI-003 | Sales catalog load-more button spacing | Staged | Separated footer button from product grid |
| UI-004 | Classic POS ergonomic layout | Partial | Catalog/panel proportions adjusted; real-device acceptance needed |
| UI-005 | Touch POS ergonomic layout | Partial | Conservative touch focus, active-payment and keypad styling; workspace heights unchanged after previous pointer obstruction |
| UI-006 | Customers CRM single-row toolbar | Staged | Desktop grid alignment and responsive wrap |
| UI-007 | Customer details modal payment form | Staged | Two-column payment controls and single-width CTA |
| UI-008 | Sales history pagination placement | Staged | Pagination moved to table footer |
| UI-009 | Sales history details modal polish | Partial | Explicit sale identity, cashier, customer, branch and shift metadata; visual/print acceptance pending |
| UI-010 | Products columns control alignment | Staged | Columns picker aligned to toolbar end |
| UI-011 | Billing plan/card separation | Staged | Subscription usage vertical rhythm |
| UI-012 | Promo validation button spacing | Staged | Dedicated class and margin |
| UI-013 | Sales history compact mobile cards | Partial | Condensed CSS; verify returned/hidden data accessibility |
| UI-014 | Products mobile card/table behavior | Staged | Mobile default cards; responsive table with horizontal scrolling |
| UI-015 | Inventory mobile card/table behavior | Staged | Native table displayed when user chooses list view |
| UI-016 | Suppliers mobile card/table behavior | Staged | Native table displayed when user chooses list view |
| UI-017 | Expenses mobile cards | Partial | Mobile two-column density; browser visual pass pending |
| UI-018 | Activity timeline mobile layout | Partial | Tighter spacing and metadata without removing audit data |
| UI-019 | Billing transaction history compact mobile | Staged | Native details disclosure with full payment details |
| UI-020 | Zenix AI premium minimal UX | Partial | Composer and suggestion hierarchy refined; keyboard-open screen hides decorative suggestions; full device acceptance pending |
| UI-021 | Mobile header control density | Partial | Icon spacing adjusted; visual tests pending |
| UI-022 | Floating Zenix AI button coverage | Partial | Mobile launcher moved above bottom nav; verify content occlusion |
| UI-023 | Mobile bottom navigation readability | Partial | Label typography improved |
| UI-024 | Zenix Pulse single-signal layout | Staged | Single signal uses full panel width |
| UI-025 | Dashboard no-sales chart empty state | Staged | Explicit no-data state replaces empty chart when loaded trend has no activity |
| UI-026 | Billing quota indicator consistency | Staged | Progress indicators now use the shared theme in light/dark modes |
| UI-027 | Products row action density | Staged | Routine actions remain visible; archive/delete moved to expandable secondary controls |
| UI-028 | Shift history mobile readability | Staged | Dense table supports horizontal scroll |
| UI-029 | Settings staff table mobile readability | Staged | Editable staff table preserves desktop columns horizontally |
| UI-030 | Seller analytics mobile detail table | Staged | Comparison table scrolls horizontally |
| UI-031 | Super Admin directory and payments mobile table | Staged | Administrative data table scrolls horizontally |
| UI-032 | Small-screen metadata typography | Partial | Shared mobile label sizing increased |

## Acceptance gate (do not bypass)

1. `npm test`, `npm run verify:design`, `npm run audit`, `npm run verify:production`, `npm run build` and the required browser workflow must pass.
2. For mobile, inspect 320 / 375 / 430px, keyboard-open, safe-area and scroll behavior, including the Payment history disclosure and product table switch.
3. For POS Pro, verify that the Touch and Classic payment buttons are reachable at 1024 × 768 and 1366 × 768; the previous unaccepted Touch grid-height adjustment caused `.pp-shortcuts` to intercept payment clicks and was reverted.
4. Verify dark + light, modal focus/Escape, no hidden monetary data, buttons and print/checkout correctness.
5. Preserve all sales math, billing math, permission and multi-tenant behavior; no backend or database changes in this PR.
6. Merge only after verified CI, then compare exact Vercel production SHA with merged `main` and manually spot-check key routes.

This register tracks staged code and acceptance only; it does **not** claim all 32 fixes are complete.
