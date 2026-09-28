# Zenix POS production deployment

## 1. Neon

Use project `steep-wind-39440568`, branch `production`. Set `DATABASE_URL` to Neon's pooled PostgreSQL connection string: its hostname must contain `-pooler` and it must include `sslmode=require` (or a stricter verify mode). Keep the real value only in deployment environment variables.

## 2. Render

Deploy the repository with the root `render.yaml` blueprint. Set:

- `DATABASE_URL`
- `DB_POOL_MAX` - `5` (safe default for Render + Neon pooling)
- `FRONTEND_ORIGIN` - final Vercel URL, for example `https://your-app.vercel.app`
- `PUBLIC_API_URL` - final Render URL, for example `https://your-api.onrender.com`
- `TELEGRAM_BOT_TOKEN` - BotFather token for `@zenixposbot`
- `TELEGRAM_WEBHOOK_SECRET` - a long random secret for the POS bot
- `ZENIX_PAYMENT_BOT_TOKEN` - BotFather token for `@zenixpaymentbot`
- `ZENIX_PAYMENT_ADMIN_CHAT_ID` - the single private admin group's numeric chat ID, usually beginning with `-100`
- `ZENIX_PAYMENT_ADMIN_USER_IDS` - comma-separated Telegram user IDs allowed to approve or reject, for example `123456789,987654321`
- `ZENIX_PAYMENT_WEBHOOK_SECRET` - a separate random secret of at least 16 characters
- `ZENIX_PAYMENT_BOT_USERNAME` - `zenixpaymentbot`

The blueprint runs `npm run migrate` and then `npm run db:verify` before start. Migration `009_payment_telegram_approval.sql` is additive and preserves existing payment and license data.

After the service is live, run both webhook setup commands once from the backend environment or Render shell:

```sh
npm run telegram:webhook
npm run telegram:payment:webhook
```

The payment webhook route is `${PUBLIC_API_URL}/api/telegram/payment/webhook`. For a backend at `https://zenix-pos-backend.onrender.com`, the endpoint is `https://zenix-pos-backend.onrender.com/api/telegram/payment/webhook`.

Add `@zenixpaymentbot` to the configured private admin group after the environment variables are saved and the deployment is healthy. The bot needs permission to send messages and edit its own messages. Never commit or post bot tokens or webhook secrets.

## 3. Vercel

Deploy the `frontend` directory, or set the Vercel project Root Directory to `frontend`. In production leave `VITE_API_URL` unset and set the server-only environment variable:

- `ZENIX_BACKEND_URL` - the Render backend URL

The included Vercel proxy keeps `/api/*`, `/health`, and `/ready` same-origin for secure HttpOnly sessions.

## 4. Verification

- Open `/ready` through the frontend domain and confirm database status is `ready`.
- Register or log in and refresh the browser to confirm the server session persists.
- Connect a customer Telegram group from Settings and send a POS test notification.
- Submit a billing receipt and confirm `@zenixpaymentbot` posts it only in the configured admin group.
- Approve it with a whitelisted Telegram user and confirm the frontend changes from `Tekshiruvda` to active without local status mutation.
- Run one sale, return, shift open/close, and inventory receipt before production use.
