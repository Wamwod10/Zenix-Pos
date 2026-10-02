# Zenix POS — 53-point remediation checklist

Source of truth: Zenix-POS(9).zip. Verification combines existing regression suites, new `fiftyThreeFixesRegression.test.mjs` contracts, syntax checks, and source review. Runtime-only checks requiring installed npm packages are reported separately and are not silently marked verified.

Latest verification (2026-10-02): frontend production readiness and source audit passed; frontend tests passed 227/227; backend tests passed 109/109; backend syntax checks and the Vite production build passed. The local dev server returned HTTP 200. Screenshot-based browser inspection could not run because no in-app or external browser was connected to the verification environment; responsive, theme, touch-target, overflow and render behavior remain covered by the automated regression suite.

1. Technical UUID/internal IDs hidden from normal business UI.
2. POS cart customer selector + quick customer creation (name + phone).
3. Full CRM customer edit flow.
4. Customer profile hierarchy/actions responsive hardening.
5. Customer KPI icons/labels render through StatCard contract.
6. Branch create false-failure root cause fixed (`await addStore`) + duplicate-submit guard.
7. Shift state remains store-scoped/server-authoritative.
8. Telegram state remains store-scoped; POS/payment bots remain separate.
9. Batch/serial inventory rules preserved; transfer allocation remains server FEFO/FIFO.
10. Safe permanent product delete added for never-used products only.
11. Audit structured payloads humanized.
12. API business errors mapped to actionable Uzbek messages.
13. Branch modal no longer guesses `N-filial`; displays entered branch name.
14. Branch create UI mutation guarded while request is in flight.
15. Supplier invoice UI no longer falls back to database ID.
16. Inventory movement/transfer UI uses business context instead of UUID labels.
17. Inventory business errors remain explicit/actionable.
18. Product archive warning lists branch stock locations/quantities.
19. Tracked-stock invariants preserved instead of weakening backend checks.
20. SHIFT_REQUIRED has actionable user-facing mapping.
21. Global command search retains customers/sales/suppliers/employees/routes.
22. Product permanent delete endpoint guarded by owner/settings permission.
23. Expense UI hides shift UUID.
24. Sales history shift filter/display uses human labels.
25. Transfer confirmations/rows hide transfer UUID.
26. Platform Admin organization list hides raw organization UUID.
27. Normal business exports avoid raw object JSON formatting.
28. Closed-shift cash expense edit prevalidated.
29. Cash expense requires open shift before submit.
30. Supplier register cash payment keeps open-shift requirement.
31. Supplier debt archive error is actionable through unified mapping.
32. Supplier payment UI caps payment at open debt.
33. Store archive returns dependency details.
34. Last active store protection retained.
35. Store plan-limit protection retained and surfaced in UI.
36. Customer payment UI caps payment at current debt.
37. Customer detail payload bounded with ledger/sales limits and has-more metadata.
38. Customer list search/pagination remains server-side.
39. Missing relation fallbacks do not expose internal IDs.
40. Human business labels used when formal document number is unavailable.
41. API error presentation centralized.
42. Technical server details are not intentionally surfaced by client fallback.
43. CSV/print/XLSX object cells humanized instead of JSON.stringify output.
44. Batch/serial backend tracking remains shared across transfer/receipt/sale paths.
45. Serial integrity checks retained.
46. Store isolation contracts retained.
47. Refresh/re-login state continues to originate from backend bootstrap.
48. Branch optimistic-state contradiction removed by awaiting server result.
49. Financial mutation/idempotency protections from existing suite retained.
50. Mobile iOS input auto-zoom prevented with >=16px focused controls; viewport fixed per requested kiosk-like behavior.
51. Existing mobile-card table pattern retained; no desktop table rewrite.
52. Customer list distinguishes loading/error/empty states; existing platform patterns retained.
53. Final regression/readiness gate: focused 53-fix contracts + full suites + backend syntax + frontend production build attempt + ZIP integrity.
