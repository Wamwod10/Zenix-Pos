# Zenix POS — Production safety and release runbook
Date: 2026-10-28. Guidance only; no migrations or customer-data changes are performed by this document.

## Live services
- Frontend: Wamwod10/Zenix-Pos, Vercel zeniz-pos project, domain https://www.zenixpos.uz.
- Backend: Wamwod10/Zenix-Pos-Backend, Render service ID srv-darqr0l9fdbs73amtig0; auto-deploy is OFF.
- Neon: project steep-wind-39440568, branch production, ID br-small-dew-b197rvkz, protected=true.
- Database migration ledger was observed through 046_transfer_create_replay.sql.

## Before every release
1. Read exact GitHub HEAD and current Vercel/Render deployed SHAs.
2. Require CI passing for the exact release commit (unit, build, design, browser).
3. Confirm Neon branch protection and the latest actual snapshot. Automatic daily at 21 UTC with 7-day retention is configured, but first execution must still be verified.
4. Review tenant, cash, billing, inventory, auth and migration changes with their tests.
5. Rehearse migrations on isolated Neon branch and establish a controlled rollback before live migrations. Do not silently run them on production.
6. Merge reviewed frontend PR; deploy backend on Render explicitly, because backend auto-deploy is off.
7. Verify exact live commits and run: node scripts/check-live-health.mjs https://www.zenixpos.uz from a networked trusted environment.
8. Confirm /health and /ready, monitor 5xx, authentication failures, Telegram worker and checkout errors; only staging credentials may be used for write-based smoke tests.

## Release stop conditions
- /ready is not JSON, has ok=false, database is not ready, or is non-2xx.
- Live production SHA differs from approved release SHA.
- CI tests fail or finance/tenant isolation is not verified.
- Increasing customer checkout failures or unexplained 5xx errors.

## Frontend rollback
1. Record incident, failing deployment ID, SHA, and UTC timestamps.
2. Promote last known healthy Vercel deployment using the supported platform rollback; GitHub git revert alone does not prove production changed.
3. Recheck alias, exact SHA and read-only API endpoints.

## Backend/database recovery
- Render backend rollback requires compatibility review with the current Neon schema and frontend.
- Never immediately restore snapshots on top of a live production database; it can erase subsequent transactions.
- Restore first into an isolated branch, reconcile transactions and obtain operator approval before any production restore.
- Keep existing snapshots until retention and restoration have been verified.

## Backup and alerting caveats
- Neon project history_retention_seconds is currently 86400 (24h PITR). This differs from scheduled snapshot retention.
- Scheduled snapshots can create extra billable storage. Review usage and charges weekly.
- GitHub production-health.yml runs hourly at :17 UTC once merged into main. A failed Action is visible, but its schedule is not an availability SLA.
- Alert recipients and escalation owners must be designated; a failed GitHub workflow alone does not guarantee anyone is notified.
