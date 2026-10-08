# Zenix POS deployment — separate repositories

**Frontend (this repo) → Vercel. Backend (dedicated repo) → Render.**

1. In the backend repository, configure Render from its own `render.yaml`, with `DATABASE_URL` pointing to Neon pooler and `MIGRATION_DATABASE_URL` pointing to a direct Neon connection for controlled migrations.
2. Before applying new production migrations, take a Neon restore point/backup and validate migrations on disposable PostgreSQL. Run `npm run migrate:status`, then manually `npm run migrate`, followed by `npm run db:verify` and `npm run db:audit-integrity`. Never let frontend deployment apply database mutations.
3. Deploy the frontend repository root to Vercel. Use `ZENIX_BACKEND_URL=https://YOUR-RENDER-API` as a server-only environment variable, keep production `VITE_API_URL` unset for same-origin cookie behavior.
4. Check `/ready`, login, POS flows, billing, Telegram bots and receipt printing on staging before real customers.
5. Rollback: revert Vercel to the previous verified deployment; restore the previously verified backend revision via Render. Database rollback requires a tested restore plan and must never use destructive schema commands by default.

The frontend repository must not ship an embedded backend or nested frontend directory. Earlier monorepo documentation has been archived.
