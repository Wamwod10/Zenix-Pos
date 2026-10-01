# Zenix Smart Platform Implementation Plan

**Goal:** Complete the agreed customer-credit and smart operational features without changing Zenix's visual identity or breaking existing flows.

**Architecture:** Extend the existing customer ledger with allocation/loyalty foundations, keep credit sale creation atomic with Sales, and expose intelligence through existing Dashboard/Layout/Supplier/Shift surfaces. Reuse the existing design system and responsive primitives.

**Tech Stack:** React, React Router, SCSS, Express, PostgreSQL, Zod, Node test runner.

**Spec:** `docs/superpowers/specs/2026-10-01-zenix-smart-platform-design.md`

## Global Constraints
- Preserve existing Zenix styling.
- Preserve working functionality and API compatibility.
- Mobile, tablet, and desktop must remain usable.
- Tenant financial data must remain organization-scoped and transactional.

## Review Focus
- Credit refund after partial/full customer payment.
- Concurrent customer debt payments.
- Overdue aging after partial allocations.
- 320–430px customer/POS/inventory layouts.
- Missing optional customer data.

### Task 1: Customer receivables hardening
- [x] Add allocation and loyalty schema migration.
- [x] Add FIFO payment allocation and aging API.
- [x] Make original-method credit refunds reduce receivables first.
- [x] Add contract tests.

### Task 2: Professional Customers UI
- [x] Add CRM financial KPIs, aging, tabs, open credit list, purchases, payment methods.
- [x] Preserve Zenix controls and mobile responsiveness.

### Task 3: Smart platform surfaces
- [x] Add Zenix Pulse and stock runout forecast.
- [x] Add customer credit notification and customer command-search action.
- [x] Reuse existing supplier price intelligence, saved views, shift reconciliation, notifications and activity timeline.

### Task 4: Verification
- [x] Run focused frontend design/regression tests.
- [x] Run customer/security/transaction backend tests.
- [x] Run backend syntax checks.
- [x] Attempt dependency install/build and record environment limitation.
