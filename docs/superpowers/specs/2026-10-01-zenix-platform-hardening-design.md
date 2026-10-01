# Zenix Platform Hardening Design

## Goal
Preserve the existing Zenix visual language and working business flows while eliminating functional/responsive defects, making POS and inventory usable on mobile, and adding a native Customers + Credit Sales foundation without turning the product into a cluttered ERP.

## Constraints
- Existing visual style is preserved; new UI follows existing components, spacing, typography, surfaces and interaction patterns.
- Existing working flows are not rewritten without need.
- Desktop, tablet and mobile must remain functional with no horizontal viewport overflow.
- Credit sales live in Sales/POS; customer-level debt and payment history live in Customers.
- Financial mutations must be auditable and transaction-safe.
- Tenant/store permissions remain enforced server-side.
- Performance must not regress; large collections use indexed/server-side access where appropriate.

## Design
1. Fix known responsive defects first: POS product grid overflow and Inventory Quick Receipt selector collapse, then audit shared modal/table/dropdown patterns.
2. Add Customers as a first-class module using server-side search/pagination and customer detail views.
3. Extend checkout settlement with credit amount/due date/customer requirements while preserving cash/card/transfer mixed payments.
4. Store customer receivables as ledger/allocation records rather than an editable aggregate debt number. Refund/cancel uses compensating entries.
5. Integrate customer/credit data into Sales detail and Customers profile, with permission/audit coverage.
6. Keep navigation compact: Customers gets one primary entry; credit is surfaced inside Sales and Customers, not as another top-level module.
7. Finish with regression, syntax/build, responsive and source-contract audits.
