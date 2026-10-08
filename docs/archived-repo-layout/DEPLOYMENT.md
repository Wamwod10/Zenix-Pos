# Zenix POS production deployment

## 1. Neon

Use project `steep-wind-39440568`, branch `production`. Set `DATABASE_URL` to Neon's pooled PostgreSQL connection string: its hostname must contain `-pooler` and it must include `sslmode=require` (or a stricter verify mode). Keep the real value only in deployment environment variables.

## 2. Render

Deploy the dedicated `https://github.com/Wamwod10/Zenix-Pos-Backend.git` repository through the root `render.yaml` blueprint. The `backend/` directory in the frontend repository is retained only as a compatibility mirror. Set:

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

The Blueprint pre-deploy command is deliberately read-only: it runs `npm run migrate:status` and `npm run db:verify`. It must not apply migrations automatically.

### Controlled migration order

1. Create or confirm a Neon backup/point-in-time restore point and record the currently deployed backend commit.
2. From the canonical backend checkout, run `npm run migrate:status` against the target environment and review every pending filename and checksum.
3. Test the exact pending set on a disposable PostgreSQL database first.
4. During an approved maintenance window, run `npm run migrate` once from the canonical backend release.
5. Run `npm run db:verify`, `npm run migrate:status`, and `npm run db:audit-integrity`; only then promote the backend release.

For rollback, revert the application release to the recorded commit. These migrations are additive, so do not attempt ad-hoc `DROP`, `TRUNCATE`, or data deletion. If a schema/data rollback is genuinely required, stop writes and use the verified Neon point-in-time restore procedure in a separate recovery branch before changing production.

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
