# Zenix POS

Zenix POS is a multi-tenant retail/POS application with a React/Vite frontend and a Node.js/Express/PostgreSQL backend. The existing premium dark UI is preserved while operational data, authorization and transactions are server-authoritative.

## Architecture

```text
React / Vite frontend (Vercel)
          ↓ HTTPS API
Node.js / Express backend (Render)
          ↓
PostgreSQL (Neon)
          ↓
Telegram notifications (@zenixposbot)
```

Business data is not persisted in `localStorage`, `sessionStorage` or IndexedDB. Authentication uses server-side sessions with secure HttpOnly cookies, and organization/store/permission boundaries are enforced by the backend.

## Main modules

- Authentication, organizations, employees, roles and permissions
- Stores / branches
- POS sales and returns
- Products, barcode generation and inventory
- Serial/IMEI and batch tracking
- Receiving, transfers and inventory counts
- Shifts, cash movements and reconciliation
- Suppliers, purchases and debt
- Expenses
- Analytics and activity/audit history
- Billing / license workflow
- Telegram group connection and operational notifications
- Platform administration

## Local development

### Frontend

Copy `frontend/.env.example` to `frontend/.env` and set the API address:

```env
VITE_API_URL=http://localhost:4000
```

Then:

```bash
cd frontend
npm install
npm run dev
```

### Backend

Copy `backend/.env.example` to `backend/.env` and configure PostgreSQL:

```env
NODE_ENV=development
PORT=4000
DATABASE_URL=postgresql://user:password@localhost:5432/zenix_pos
DB_POOL_MAX=5
FRONTEND_ORIGIN=http://localhost:5173
PUBLIC_API_URL=http://localhost:4000
TELEGRAM_BOT_USERNAME=zenixposbot
```

Then:

```bash
cd backend
npm install
npm run migrate
npm run dev
```

The backend provides:

- `GET /health` — process health
- `GET /ready` — database readiness

## Production deployment

### Recommended Vercel → Render session path

In production, leave `VITE_API_URL` unset on Vercel and set the **server-only** Vercel variable `ZENIX_BACKEND_URL` to the Render backend URL. Vercel then proxies `/api/*`, `/health` and `/ready` to Render. This keeps the secure HttpOnly session cookie first-party from the browser’s perspective and avoids third-party-cookie failures between `vercel.app` and `onrender.com`.

On Render, set `FRONTEND_ORIGIN` to the deployed Vercel origin (and later the custom app domain if one is added).


### Neon

1. Use the Neon project `steep-wind-39440568`, branch `production`.
2. Copy its pooled connection string: the hostname must contain `-pooler` and the URL must include `sslmode=require` (or a stricter verify mode).
3. Keep the real URL only in Render environment variables. Never place it in `.env.example`, source files, or git.
4. Create or confirm a Neon restore point, run `npm run migrate:status`, apply reviewed migrations manually with `npm run migrate`, and finish with `npm run db:verify`. Supply `DATABASE_URL` only through the process environment.

### Render backend

The root `render.yaml` explicitly deploys the dedicated canonical backend repository, `https://github.com/Wamwod10/Zenix-Pos-Backend.git`. The embedded `backend/` directory is a compatibility mirror and is not the production deployment source. Configure these environment variables in Render:

```env
NODE_ENV=production
DATABASE_URL=...
DB_POOL_MAX=5
FRONTEND_ORIGIN=https://your-frontend.vercel.app
PUBLIC_API_URL=https://your-api.onrender.com
TELEGRAM_BOT_TOKEN=...
TELEGRAM_WEBHOOK_SECRET=...
TELEGRAM_BOT_USERNAME=zenixposbot
SESSION_COOKIE_NAME=zenix_session
SESSION_TTL_DAYS=30
```

`DB_POOL_MAX=5` is the conservative default for a Render instance using Neon's pooled endpoint. Values outside `1..20` are rejected at startup. Render pre-deploy runs only `npm run migrate:status` and `npm run db:verify`; it never changes production schema automatically.

After the backend is live, install the Telegram webhook once:

```bash
cd backend
npm run telegram:webhook
```

The production browser should normally talk to the Vercel same-origin proxy rather than calling the Render hostname directly. Custom domains remain supported later without changing the data model.

### Vercel frontend

Do **not** set `VITE_API_URL` in production unless you intentionally want a direct cross-origin API connection. Set this server-only variable in Vercel instead:

```env
ZENIX_BACKEND_URL=https://your-api.onrender.com
```

Then deploy the `frontend` directory to Vercel, or set the Vercel project Root Directory to `frontend`. `frontend/vercel.json` sends `/api/*`, `/health` and `/ready` through the server-side proxy and keeps all other client-side routes working on direct refresh.

## Telegram integration

Bot username: **@zenixposbot**.

A Zenix POS user opens **Settings → Telegram → Guruhni ulash**. The backend creates a short-lived one-time token and opens Telegram using a `startgroup` deep link. The user selects a group; the bot receives the token and the backend securely binds that Telegram `chat_id` to the correct organization/store. No manual connect code needs to be typed into the group.

Telegram secrets are never stored in the frontend. Set `TELEGRAM_BOT_TOKEN` and `TELEGRAM_WEBHOOK_SECRET` only in backend environment variables.

## Validation

Frontend static checks:

```bash
cd frontend
npm run verify:production
npm run audit
npm test
npm run build
```

Backend checks:

```bash
cd backend
npm test
npm run check
```

A full frontend build requires installed npm dependencies. In restricted/offline environments, source audit and backend tests can still run while Vercel performs the production dependency install/build.

## Security / data integrity notes

- All important API routes enforce authenticated organization context and server-side permissions.
- Branch-locked roles are filtered server-side.
- Sales, returns, stock movements, shifts, supplier payments and other ledger operations use PostgreSQL transactions.
- One branch can have multiple parallel cashier/register shifts; a user only receives their own open shift as the active POS shift.
- Barcode/SKU uniqueness is enforced server-side.
- Serial/IMEI and batch inventory tracking is authoritative on the backend.
- Telegram delivery uses an outbox/delivery ledger to support retry and idempotency.
- Billing renewal checkout uses a backend draft so selected dates/amounts survive navigation and cannot be silently recalculated by the browser.
