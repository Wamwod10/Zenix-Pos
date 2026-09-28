# Telegram Payment Approval Design

## Goal

Add a second, isolated Telegram bot (`@zenixpaymentbot`) that lets explicitly
whitelisted platform administrators approve or reject existing Zenix POS
billing payments from one configured private Telegram group. PostgreSQL remains
the source of truth and the customer-facing `@zenixposbot` integration remains
unchanged.

## Existing System Decisions

- Reuse `billing_payments`; its existing `REVIEW` value is the persisted form of
  the Uzbek "Tekshiruvda" state. Do not add a duplicate payments table.
- Reuse `organizations.plan`, `license_status`, `expiry_date`, and `store_limit`
  as the active subscription state. Do not add a parallel subscriptions table.
- Preserve the real plan definitions in `backend/src/config/billing.js`:
  `MONTHLY` is one month and `ANNUAL` is twelve months, each with two included
  stores. Extra-store handling continues to use the existing billing rules.
- Extract the transaction already used by the platform payment-review route
  into a shared internal billing-review service. Both the platform route and
  Telegram callback call that service; it is never exposed as an unguarded
  public endpoint.
- Reuse `notification_outbox` for durable payment-review delivery. The existing
  POS notification worker must exclude payment-review events; a dedicated
  payment delivery path consumes only those events and sends them with the
  payment bot token to the configured admin chat.

## Data Model

A backward-compatible migration extends `billing_payments` with nullable
Telegram-review metadata:

- callback token hash and optional expiry;
- admin chat/message identifiers;
- notification sent timestamp.

The raw callback token is never persisted. A cryptographically random opaque
token is put in callback data and only its SHA-256 hash is stored. Callback data
contains an action plus this token, not organization, amount, plan, duration,
role, or admin assertions. Existing rows remain valid because all new columns
are nullable.

`notification_outbox` receives a `billing.payment_review` event in the same
database transaction that creates the `REVIEW` payment. Failed Telegram calls
leave the event retryable. Once Telegram accepts the message, its chat/message
IDs are stored and the outbox event is marked sent. The payment's existing
unique organization/order constraint continues to prevent duplicate requests.

## Bot Isolation And Configuration

The payment bot uses only these variables:

- `ZENIX_PAYMENT_BOT_TOKEN`
- `ZENIX_PAYMENT_ADMIN_CHAT_ID`
- `ZENIX_PAYMENT_ADMIN_USER_IDS`
- `ZENIX_PAYMENT_WEBHOOK_SECRET`
- `ZENIX_PAYMENT_BOT_USERNAME` (default `zenixpaymentbot`)

The existing `TELEGRAM_*` variables, service, webhook, and notification worker
remain dedicated to `@zenixposbot`. Tokens and webhook secrets are never logged
or copied into source files. Production startup validation requires complete
payment-bot configuration.

## Delivery Flow

1. The authenticated tenant billing route validates the receipt and plan using
   the existing rules, inserts a `REVIEW` payment, and inserts one
   `billing.payment_review` outbox event in the same transaction.
2. The payment notification worker claims only this event type, reloads all
   trusted values from PostgreSQL, creates an opaque callback token, and sends
   an Uzbek payment summary to `ZENIX_PAYMENT_ADMIN_CHAT_ID`.
3. A receipt is uploaded from the already validated `billing_receipts` bytea
   using Telegram multipart upload. The bot never fetches a user-controlled URL
   and therefore does not introduce an SSRF path.
4. The review message has only `Tasdiqlash` and `Rad etish` inline actions.

## Webhook And Authorization

`POST /api/telegram/payment/webhook` is public only at the HTTP routing layer.
It first compares `X-Telegram-Bot-Api-Secret-Token` with
`ZENIX_PAYMENT_WEBHOOK_SECRET` using a timing-safe comparison. Invalid or absent
secrets return 403.

For callbacks, the server independently verifies:

- the callback message chat equals `ZENIX_PAYMENT_ADMIN_CHAT_ID`;
- `callback_query.from.id` is in the comma-separated admin-user whitelist;
- callback data has the expected minimal form;
- the token hash maps to an existing payment;
- the token is not expired;
- the payment is still `REVIEW` when locked in the review transaction.

Both chat and user checks are mandatory. Unauthorized callbacks receive
"Bu amal uchun ruxsat yo'q." and cannot mutate data. Unknown or already-used
tokens receive a neutral already-reviewed/invalid response without leaking
tenant details.

## Atomic Review

The shared billing-review service starts a PostgreSQL transaction and locks the
payment and its organization. It accepts only `REVIEW -> APPROVED` or
`REVIEW -> REJECTED`.

Approval reads plan, dates, amount, organization, and branch limits from the
locked database row. It applies the existing activation or extra-store logic.
Rejection never activates a subscription. A second concurrent callback sees a
non-`REVIEW` row and returns `alreadyReviewed`, so it cannot extend a license or
increase a store limit twice. The organization ID always comes from the locked
payment row, preserving tenant isolation.

Every transition writes an `audit_logs` record containing the payment and
organization IDs, old/new states, Telegram user ID, optional username, chat ID,
and timestamp. No secret or callback token is included.

After commit, the webhook answers the callback and edits the originating
Telegram message to show the final Uzbek status, reviewer, time, and order ID,
with the inline keyboard removed. A message-edit failure is logged without
rolling back the already committed billing decision.

## Frontend

The premium dark UI is unchanged. While a `REVIEW` payment is visible, the
billing page calls the existing workspace reload function every eight seconds.
Polling stops on unmount or when no review payment remains. All displayed state
still comes from backend bootstrap data; no local storage or optimistic status
mutation is introduced.

## Verification

Automated tests cover creation/outbox atomicity, webhook secret, chat and user
authorization, token validation, monthly/yearly activation, store limits,
idempotency and races, rejection, tenant isolation, audit metadata, receipt
delivery safety, retry behavior, POS/payment bot separation, frontend polling,
and the existing backend/frontend production suites.
