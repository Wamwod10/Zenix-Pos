# Zenix Platform Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Fix Zenix functional/responsive defects and deliver integrated Customers + Credit Sales without changing the established product style.

**Architecture:** Harden existing flows in place, add narrowly scoped customer/receivable APIs and data structures, and reuse existing UI primitives. Credit is a settlement capability of Sales; Customers provides the customer-centric financial view.

**Tech Stack:** React/Vite, Express/Node, PostgreSQL, existing Zenix SCSS/UI primitives.

**Spec:** `docs/superpowers/specs/2026-10-01-zenix-platform-hardening-design.md`

## Global Constraints
- Preserve existing visual style and working flows.
- No horizontal viewport overflow on supported mobile widths.
- Server-side tenant/permission enforcement for customer financial data.
- Financial changes are transaction-safe and auditable.
- Avoid unnecessary new top-level navigation.

## Review Focus
- 320–430px POS and inventory layouts.
- Long product/customer names and empty states.
- Partial/mixed credit payments and refunds.
- Cross-tenant/store access attempts.
- Double-submit/idempotency and stale UI reconciliation.

---

### Task 1: Responsive defect hardening
**Files:** POS/inventory/shared responsive SCSS and components; targeted tests.
- [x] Add regression assertions for mobile POS product visibility and quick-receipt selector sizing.
- [x] Fix layout/overflow without changing visual language.
- [x] Audit shared modal/table/dropdown overflow at mobile breakpoints.
- [x] Run targeted UI tests.

### Task 2: Customer data foundation
**Files:** DB migration, customer routes/services, permission/schema verification tests.
- [x] Add customer and receivable ledger schema/indexes.
- [x] Add tenant-safe paginated customer search/detail APIs.
- [x] Add customer create/update and audit coverage.
- [x] Run backend contract tests.

### Task 3: Customers UI
**Files:** navigation/routes, Customers page/detail, API integration, responsive styles/tests.
- [x] Add Customers navigation using existing UI primitives.
- [x] Add search/pagination, summary and customer profile sections.
- [x] Ensure mobile cards/table fallback and empty/loading/error states.
- [x] Run frontend route/UI tests.

### Task 4: Credit Sales integration
**Files:** POS checkout, sales backend transaction, sales detail, ledger/payment allocation tests.
- [x] Extend checkout with customer + due date + credit remainder.
- [x] Enforce customer for credit and preserve mixed payment totals.
- [x] Write receivable ledger atomically with sale.
- [x] Surface status in Sales and customer profile.
- [x] Test partial payment/refund/cancel/idempotency.

### Task 5: Full audit and packaging
- [x] Run frontend tests and production build when dependencies are available.
- [x] Run backend tests/checks and migration/schema verification.
- [x] Search for viewport overflow and unsafe full-workspace refresh regressions.
- [x] Verify ZIP integrity and produce final artifact.
