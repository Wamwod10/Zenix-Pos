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

## Mandatory Neon isolation gate (incident #97, 2026-10-30)

**WARNING: `restore_snapshot` defaults to `finalize:true` when restoring onto a NEW branch.**
On 2026-10-30 a rehearsal restore without an explicit `finalize:false` promoted the
restored snapshot to `production`, reassigned the existing production compute,
and temporarily caused PostgreSQL authentication failures / connection drops.
See [incident #97](https://github.com/Wamwod10/Zenix-Pos/issues/97).

**A restore is forbidden unless ALL of the following can be verified and logged:**

1. Obtain independent operator approval for a rehearsed restore, identify the
   *scheduled* snapshot ID, protected/default original production branch ID,
   production read-write compute ID/hostname, **current production automatic
   snapshot schedule**, and the root-branch quota. Never
   delete an old branch autonomously as a quota workaround.
2. Run the pure preflight helper `prepareIsolatedRestore` from
   `scripts/neonRestoreSafety.mjs` using fresh Neon API metadata. The generated
   `restoreArguments` **MUST** contain `finalize:false`. Pass those exact
   arguments into the connector, with no omitted fields. **Do not** supply
   `target_branch_id`, and never use the name `production`.
3. **Before querying the restored database**, read the Neon default branch,
   original branch, original production endpoint and the new restore branch.
   Run `verifyIsolatedRestore` to ensure the default remains original,
   original production branch remains protected, existing production endpoint
   ID/hostname is unchanged and still points to the original branch, and the
   new restore is nondefault/nonpromoted with `restore_status=restored`,
   and production's automatic snapshot schedule has NOT moved or disappeared.
   **ABORT/ESCALATE IMMEDIATELY** on any mismatch; do not finalize.
4. Only then provision a **read-only** compute on the new branch and perform
   table counts, sorted row hashes, foreign-key and payment/credit/refund audits.
   Review the exact snapshot age (RPO) and measured operator restore duration
   (RTO); comparing two static datasets alone is not a recovery SLA.
5. Verify application `/ready` and `/health` and Render/Vercel error logs.
   Record transient service disruptions as incidents, even when health is
   restored. Deleting or cleaning up any root branch needs separate approval.

### 2026-10-30 recovery evidence
- Source automatic snapshot: `snap-broad-sun-b12879xg`
  (created 2026-10-29 21:00:06 UTC).
- Restored **nondefault** branch: `br-divine-boat-b1n14ljj`
  (`zenix-auto-snapshot-restore-verified-20261030`); audit endpoint
  `ep-dawn-lake-b1y2v6kh` is **read-only**.
- Original live protected/default production branch remains
  `br-small-dew-b197rvkz`, production compute
  `ep-patient-field-b1xbogfo` is attached to it.
- Six financial/outbox tables matched **sorted full-row MD5** across the
  live and restored branches at the time of verification. This does **not**
  exclude transient request failures during the 08:17–08:21 UTC incident.
- Original 26-Oct rehearsal root branch was retired; manual archive snapshot
  `snap-summer-surf-b1l8l230` retained. Do not delete the new restored
  root branch or audit compute without an explicit resource review.

**Post-incident schedule repair:** The 2026-10-30 implicit promotion also
moved the daily 21:00 UTC / 7-day-retention scheduled snapshot configuration
to the temporary snapshot clone. Once the original production branch was
restored, the live branch reported an empty schedule. That live schedule was
reinstated and read back as `daily hour=21 retention_seconds=604800`; the
nonproduction restored clone's redundant schedule was disabled to avoid
unintended billable duplicate snapshots. The safety gate now compares the
schedule before and after restore as a release-blocking invariant.
