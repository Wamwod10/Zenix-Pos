# Functional and E2E evidence

## Evidence levels

1. Real Chromium→local Express→disposable PostgreSQL: actual server transactions/invariants; never Neon production.
2. Real Chromium with intercepted synthetic API: actual React interactions and request contracts; not database persistence proof.
3. Component/unit tests: deterministic functions/state transitions; not a replacement for browser/device acceptance.

## Executed suites

- `node tests/posProPostgres.browser.mjs`: actual browser/API/DB scanner/name/SKU,kg/l, normal/split and recovered cash receipt/change, stock/outbox and ordinary Sales regression.
- `node tests/frontendFinancePostgres.browser.mjs`: UI customer creation; seeded test debt60000; cash repayment25000 with committed response lost, reload and exact immutable retry; one PAYMENT and one drawer entry, remaining debt35000. Server summary125000 includes opening100000+repayment; UI close124000 requires reason and persists difference-1000.
- `node tests/posPro.browser.mjs`: synthetic Classic/Touch keypad/mode persistence, checkout/closed guards, long names, slow-response ordering, Hold/Resume, unknown-payment recovery/no duplicate POST, HID, print invocation and100/500-row cart states. One initial setup timeout passed unchanged in isolated and complete reruns; it was not hidden by extending timeout/skipping.
- `node tests/finalControls.browser.mjs`:45 synthetic action checks passed with0 failures/0 fixture gaps. Covers named modal/validation/search/filter/pending/error/retry/settings/AI controls, not every business transaction.
- Shared accessibility14 assertions; auth geometry8 checks; reporting source-browser captures prove ID/unit separation and branch-cost display.
- Grid/List module controls exercise45-record pages, first/last pagination, search, list/grid action dialogs and reload persistence. Settings panel traversal is read-only; it does not claim autosave persistence for every field.

## Requested workflow trace

|Workflow|Verified scope / remaining gap|
|---|---|
|Register→Login→Setup|Mock browser register validation/workspace entry, invalid/valid login PASS; OTP/provider and full setup persistence NOT VERIFIED.|
|Product create→Receive→Sell|PASS actual UI/API/DB: product12000, receipt10@6000, sale12000, stock9.|
|Classic checkout→Receipt|PASS real local API/DB and synthetic retry scenarios.|
|Touch keypad→Checkout|PASS synthetic Chromium; bank/physical terminal not exercised.|
|Credit sale→Customer payment|Customer/payment real local DB with seeded debt; complete credit origination chain is not implied by seed.|
|Supplier→Invoice→Payment|Module/modal/pagination covered; full persisted business chain not established by smoke.|
|Open shift→Sale→Return→Close|PASS actual seeded opening shift→UI sale→original refund→close: stock10→9→10, expected/actual100000, difference0. Opening shift was fixture-seeded, not a UI open assertion.|
|Branch transfer|PASS stateful mock create503→retained draft→retry IN_TRANSIT; cancel decline0writes/confirm1write. Receive/approval/DB transition chain NOT VERIFIED.|
|Inventory count|PASS stateful mock10→13 exact contract,503→retained draft→retry/bootstrap13. DB reconciliation not established by this mock.|
|Expense→Dashboard/Analytics|Component/branch contract coverage; complete UI persistence/report refresh requires named evidence.|
|Permission denied roles|Mock cashier denied Analytics PASS; exhaustive browser endpoint/role matrix NOT VERIFIED.|
|Logout→Session invalidation|Mock logout clears authenticated UI;401 redirects protected route PASS. Server revocation not proved by this mock.|
|Billing lifecycle|Mock REVIEW/REJECTED/APPROVED authoritative reload states PASS; no real bank payment/provider approval lifecycle exercised.|
|Error→Retry→Recovery|PASS customer real lost-response replay and POS synthetic/real recovery; scope-specific, not all mutations.|

Additional workflow scripts added during this audit are listed in the final ledger with their exact mock/DB boundaries. Unavailable hardware is **NOT VERIFIED — PHYSICAL DEVICE** (scanner, printer/fiscal device, card terminal). Simulated HID and window.print invocation are not hardware certification.

`frontendStockLifecyclePostgres.browser.mjs` verifies product/receipt/sale/refund/close in one actual local DB-backed chain. `inventoryWorkflows.browser.mjs` verifies three stateful mock workflows. `authBillingWorkflows.browser.mjs` verifies eight mock checks. Its initial English error-text expectation was corrected to the API client's existing localized credential message; no production assertion or behavior was weakened. The lifecycle refund selector follows the new combobox semantics, preserving the exact labeled control assertion.
