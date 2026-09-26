# Zenix POS production deployment

## 1. Neon
Use project `steep-wind-39440568`, branch `production`. Set `DATABASE_URL` to Neon's pooled PostgreSQL connection string: its hostname must contain `-pooler` and it must include `sslmode=require` (or a stricter verify mode). Keep the real value only in deployment environment variables.

## 2. Render
Deploy the repository with the root `render.yaml` blueprint. Set:

- `DATABASE_URL`
- `DB_POOL_MAX` - `5` (safe default for Render + Neon pooling)
- `FRONTEND_ORIGIN` — final Vercel URL, e.g. `https://your-app.vercel.app`
- `PUBLIC_API_URL` — final Render URL, e.g. `https://your-api.onrender.com`
- `TELEGRAM_BOT_TOKEN` — BotFather token for `@zenixposbot`
- `TELEGRAM_WEBHOOK_SECRET` — a long random secret

The blueprint runs the existing `npm run migrate` runner and then `npm run db:verify` before start. The verifier checks migration records, required tables, primary/foreign keys, unique constraints, and indexes. After the service is live, run `npm run telegram:webhook` once from the backend environment/shell.

## 3. Vercel
Deploy the `frontend` directory, or set the Vercel project Root Directory to `frontend`. In production leave `VITE_API_URL` unset and set the server-only environment variable:

- `ZENIX_BACKEND_URL` — the Render backend URL

The included Vercel proxy keeps `/api/*`, `/health` and `/ready` same-origin for secure HttpOnly sessions.

## 4. Verification
- Open `/ready` through the frontend domain and confirm database status is `ready`.
- Register/login and refresh the browser to confirm the server session persists.
- Connect a Telegram group from Settings and send a test notification.
- Run one sale, one return, one shift open/close and one inventory receipt before production use.
