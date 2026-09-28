# Telegram Payment Approval Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a secure, durable, idempotent Telegram approval flow for existing Zenix POS billing payments without changing the current customer bot or visual design.

**Architecture:** Existing `billing_payments` and organization license fields remain authoritative. Payment creation emits a dedicated event into the existing outbox; a payment-bot delivery service sends the admin message, while a separate authenticated webhook delegates state changes to one transaction-safe billing review service shared with the current platform route.

**Tech Stack:** Node.js 20, Express, PostgreSQL/Neon, Telegram Bot HTTP API, React/Vite, Node test runner.

**Spec:** `docs/superpowers/specs/2026-09-26-telegram-payment-approval-design.md`

## Global Constraints

- Preserve the existing premium black/gray frontend design and all working production behavior.
- Keep `@zenixposbot` and `@zenixpaymentbot` tokens, routes, secrets, services, and responsibilities isolated.
- Never persist or log a raw bot token, webhook secret, or callback token.
- Trust payment, plan, duration, amount, organization, and limits only from PostgreSQL.
- Use backward-compatible migrations; do not create duplicate payment or subscription tables.
- Use test-first RED -> GREEN cycles for every production behavior change.

## Review Focus

- Concurrent approve/approve and approve/reject callbacks must produce exactly one state transition and one license change.
- A valid token from the wrong chat or non-whitelisted user must not reveal or mutate payment data.
- Telegram send/edit failures must not lose the payment or roll back a committed billing decision.
- Receipt delivery must use validated database bytes and never fetch arbitrary user URLs.
- Existing POS notification events must continue through the POS bot and never use payment-bot credentials.

---

### Task 1: Configuration And Route Isolation

**Files:**
- Modify: `backend/.env.example`
- Modify: `backend/src/config/env.js`
- Modify: `backend/src/middleware/clientGuard.js`
- Modify: `backend/src/app.js`
- Create: `backend/src/routes/paymentTelegram.js`
- Create: `backend/tests/paymentTelegramConfig.test.mjs`

**Interfaces:**
- Produces: parsed `env.paymentBotToken`, `env.paymentAdminChatId`, `env.paymentAdminUserIds`, `env.paymentWebhookSecret`, and `env.paymentBotUsername`; public route `POST /api/telegram/payment/webhook`.

- [ ] Write failing configuration tests asserting the five placeholders, numeric whitelist parsing, production validation, a distinct payment webhook path, and unchanged `/api/telegram/webhook` POS path.
- [ ] Run `node --test tests/paymentTelegramConfig.test.mjs`; expect failures for missing payment configuration and route.
- [ ] Add the five payment variables and strict parser/production validation without exposing values in logs.
- [ ] Add the payment webhook route shell and client-guard exemption while preserving existing auth and POS routing.
- [ ] Run the focused test and full backend suite; expect all pass.

### Task 2: Backward-Compatible Review Metadata

**Files:**
- Create: `backend/migrations/009_payment_telegram_approval.sql`
- Modify: `backend/src/db/verifySchema.js`
- Modify: `backend/tests/database-production.test.mjs`
- Create: `backend/tests/paymentTelegramMigration.test.mjs`

**Interfaces:**
- Produces: nullable `billing_payments.telegram_review_token_hash`, `telegram_review_token_expires_at`, `telegram_admin_chat_id`, `telegram_admin_message_id`, and `telegram_notification_sent_at` columns plus a partial token-hash index.

- [ ] Write failing migration/schema tests asserting nullable columns, unique/partial token lookup, migration registration, and no duplicate payments/subscriptions table.
- [ ] Run the focused tests; expect failure because migration 009 is absent.
- [ ] Add an additive idempotent SQL migration and schema verification requirements.
- [ ] Run focused tests and backend suite; expect all pass.

### Task 3: Transaction-Safe Shared Billing Review

**Files:**
- Create: `backend/src/services/billingReview.js`
- Modify: `backend/src/routes/platform.js`
- Create: `backend/tests/billingReview.test.mjs`
- Modify: `backend/tests/transaction-contract.test.mjs`

**Interfaces:**
- Produces: `reviewBillingPayment({ paymentId, decision, actor }) -> { outcome, payment, organization }`, where outcome is `approved`, `rejected`, or `alreadyReviewed`.
- Consumes: existing billing plan/store/expiry semantics and `writeAudit`.

- [ ] Write failing tests for row locks, `REVIEW` precondition, monthly/yearly activation, extra-store limit, rejection, tenant isolation, audit metadata, and two concurrent reviews causing one transition.
- [ ] Run focused tests; expect failure because the shared service is absent.
- [ ] Extract the existing platform transaction into `billingReview.js`, accepting actor metadata but deriving all billing values from locked rows.
- [ ] Replace the platform route's inline transaction with the shared service while preserving its current permission and response contract.
- [ ] Run focused tests and backend suite; expect all pass.

### Task 4: Durable Payment Review Outbox Event

**Files:**
- Modify: `backend/src/routes/billing.js`
- Modify: `backend/src/services/notificationWorker.js`
- Create: `backend/tests/paymentReviewOutbox.test.mjs`
- Modify: `backend/tests/security-contract.test.mjs`

**Interfaces:**
- Produces: one `billing.payment_review` outbox event atomically with each new `REVIEW` payment.
- Consumes: existing `notification_outbox` uniqueness/retry fields.

- [ ] Write failing tests proving pending payment and event share a transaction, duplicate submission cannot create duplicate events, and the POS worker does not claim `billing.payment_review`.
- [ ] Run focused tests; expect failure because billing creation emits no event.
- [ ] Insert the outbox event from the existing payment transaction and filter the POS worker claim query by event type.
- [ ] Run focused tests plus billing/POS notification regression suites; expect all pass.

### Task 5: Isolated Payment Bot Delivery

**Files:**
- Create: `backend/src/services/paymentTelegram.js`
- Create: `backend/src/services/paymentNotificationWorker.js`
- Modify: `backend/src/index.js`
- Create: `backend/tests/paymentTelegramDelivery.test.mjs`

**Interfaces:**
- Produces: `sendPaymentReview(paymentContext)`, `answerPaymentCallback(id, text)`, `editPaymentReviewMessage(...)`, and `processPaymentNotificationOutbox()`.
- Consumes: payment env from Task 1, metadata columns from Task 2, and `billing.payment_review` events from Task 4.

- [ ] Write failing tests for Uzbek content, DB-derived amount/plan/order/branch limit, opaque callback shape, SHA-256-only persistence, configured chat destination, safe bytea receipt multipart upload, and retry after Telegram API failure.
- [ ] Run focused tests; expect failure because payment services are absent.
- [ ] Implement a payment-token-only Telegram client with bounded request timeout and sanitized errors.
- [ ] Implement event claiming, trusted context reload, random callback token creation, message/receipt send, delivery metadata update, retry/backoff, and startup scheduling.
- [ ] Run focused tests and POS/payment token-separation regressions; expect all pass.

### Task 6: Secure Payment Webhook And Message Finalization

**Files:**
- Modify: `backend/src/routes/paymentTelegram.js`
- Modify: `backend/src/services/billingReview.js`
- Create: `backend/tests/paymentTelegramWebhook.test.mjs`

**Interfaces:**
- Consumes: payment bot callbacks from Task 5 and `reviewBillingPayment` from Task 3.
- Produces: fully authenticated callback processing and final Telegram message edits with keyboards removed.

- [ ] Write failing tests for invalid secret, wrong chat, non-whitelisted user, malformed/expired/unknown token, valid approval, valid rejection, duplicate click, approve-then-reject, and unchanged foreign organization.
- [ ] Run focused tests; expect failures because the route is only a shell.
- [ ] Add timing-safe webhook-secret validation and strict callback parsing.
- [ ] Resolve payment by token hash, then require configured chat and whitelisted user before calling the review service.
- [ ] Answer callbacks in Uzbek and edit successful final messages after commit; tolerate edit failure without reverting database state.
- [ ] Run focused tests and full backend suite; expect all pass.

### Task 7: Payment Webhook Setup Script

**Files:**
- Create: `backend/scripts/setPaymentTelegramWebhook.js`
- Modify: `backend/package.json`
- Create: `backend/tests/paymentWebhookScript.test.mjs`

**Interfaces:**
- Produces: `npm run telegram:payment:webhook` registering `${PUBLIC_API_URL}/api/telegram/payment/webhook` with the payment token and secret.

- [ ] Write a failing contract test proving the script uses only payment-bot env variables and the exact payment route.
- [ ] Run the focused test; expect failure because the script is absent.
- [ ] Implement the bounded setup call without printing secrets and add the package script.
- [ ] Run focused tests and backend suite; expect all pass.

### Task 8: Pending Billing Polling

**Files:**
- Modify: `frontend/src/pages/billing/Billing.jsx`
- Create: `frontend/tests/billingPaymentPolling.test.mjs`

**Interfaces:**
- Consumes: existing `reloadStore`/workspace hydration and `payments` state.
- Produces: eight-second polling only while at least one payment has status `REVIEW`.

- [ ] Write a failing frontend test for polling start, cleanup, stop after terminal status, and absence of local payment-status mutation.
- [ ] Run `node --test tests/billingPaymentPolling.test.mjs`; expect failure because no interval exists.
- [ ] Add one effect using the existing reload function and an 8000 ms interval; do not change markup or styling.
- [ ] Run focused and full frontend tests; expect all pass.

### Task 9: Production Regression And Documentation

**Files:**
- Modify: `DEPLOYMENT.md`
- Modify: `README.md` only if it already documents Telegram setup
- Test: all backend and frontend test suites

**Interfaces:**
- Produces: exact Render environment list and webhook setup procedure without secret values.

- [ ] Add a failing documentation contract test if deployment configuration is test-covered; otherwise verify all five variable names and exact endpoint manually.
- [ ] Document Render variables, `https://zenix-pos-backend.onrender.com/api/telegram/payment/webhook`, migration order, worker behavior, and webhook registration command.
- [ ] Run backend `npm test` and `npm run check`.
- [ ] Run frontend `npm test`, `npm run audit`, and `npm run build`.
- [ ] Run targeted security, billing, database, Telegram POS, and payment bot suites again and record exact results.
- [ ] Review the complete diff for secrets, token fragments, unsafe URLs, destructive SQL, accidental design changes, and cross-bot credential use.
