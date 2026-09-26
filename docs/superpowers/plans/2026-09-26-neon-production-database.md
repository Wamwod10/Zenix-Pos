# Neon Production Database Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect the existing Node.js backend safely to the Neon `production` branch with pooled PostgreSQL, existing migrations, and production-grade startup/schema verification.

**Architecture:** Keep the existing Express and `pg` architecture. Centralize production connection validation and pool sizing around `DATABASE_URL`, make server startup wait for a database probe, and add a read-only catalog verifier for required tables and constraints. Continue using the existing transaction-based SQL migration runner.

**Tech Stack:** Node.js 20+, Express 5, `pg` 8, PostgreSQL/Neon, Node test runner, Render Blueprint.

**Spec:** User request dated 2026-09-26 (no repository spec file).

## Global Constraints

- Do not modify the frontend or its design.
- Do not rewrite the backend or replace its existing `pg` migration architecture.
- Never reset/drop the database or delete production data.
- Keep all passwords, tokens, and real connection strings out of source control.
- Read `DATABASE_URL` only from the environment and require a Neon pooled TLS connection in production.
- Use project `steep-wind-39440568`, branch `production`, and the existing migrations `001` through `008`.
- Do not enable Neon Auth, Object Storage, Functions, or AI Gateway.
- Keep Telegram credentials environment-only.

## Review Focus

- A production URL using a direct Neon host must fail before the service starts.
- A production URL without required TLS must fail before the service starts.
- Invalid pool sizes must fail with an actionable message and never silently create an oversized pool.
- Startup database errors must be actionable without leaking credentials.
- Schema verification must report every missing required table and verify foreign keys, unique constraints, and indexes.

---

### Task 1: Production database configuration

**Files:**
- Create: `backend/src/db/config.js`
- Modify: `backend/src/db/pool.js`
- Modify: `backend/src/config/env.js`
- Modify: `backend/.env.example`
- Test: `backend/tests/database-production.test.mjs`

**Interfaces:**
- Consumes: `DATABASE_URL`, `NODE_ENV`, optional `DB_POOL_MAX`.
- Produces: `createPoolConfig(options)` and a singleton `pool` configured for pooled Neon TLS with a conservative default maximum.

- [ ] Write tests for pooled URL acceptance, direct-host rejection, missing TLS rejection, and pool-limit validation.
- [ ] Run the focused test and confirm it fails because the configuration module does not exist.
- [ ] Implement `createPoolConfig(options)` and wire it into the existing pool.
- [ ] Run the focused test and the full backend suite.

### Task 2: Startup and schema verification

**Files:**
- Create: `backend/src/db/startup.js`
- Create: `backend/src/db/verifySchema.js`
- Modify: `backend/src/server.js`
- Modify: `backend/package.json`
- Test: `backend/tests/database-production.test.mjs`

**Interfaces:**
- Consumes: the existing `pool` and PostgreSQL catalog views.
- Produces: `assertDatabaseConnection(db)`, `verifyDatabaseSchema(db)`, and `npm run db:verify`.

- [ ] Write tests proving startup errors are clear and credential-safe, and schema reports detect missing tables/constraints/indexes.
- [ ] Run the focused test and confirm the new assertions fail for missing exports.
- [ ] Implement the database probe, startup gate, and read-only schema verifier.
- [ ] Run the focused test, full backend suite, and syntax checks.

### Task 3: Render documentation and Neon production execution

**Files:**
- Modify: `render.yaml`
- Modify: `backend/render.yaml`
- Modify: `README.md`
- Modify: `DEPLOYMENT.md`

**Interfaces:**
- Consumes: Neon CLI authentication or an externally supplied `DATABASE_URL` environment variable.
- Produces: linked Neon project context, applied `001`-`008` migration records, schema verification output, and a successful database readiness probe.

- [ ] Document the pooled endpoint/TLS requirement and optional `DB_POOL_MAX=5` Render setting.
- [ ] Install dependencies without adding Neon tooling to runtime dependencies.
- [ ] Link Neon CLI to project `steep-wind-39440568`, branch `production`, without pulling unrelated services.
- [ ] Run `npm run migrate`, then `npm run db:verify`, with `DATABASE_URL` supplied only through the process environment.
- [ ] Start the backend with required production variables and verify `/health` and `/ready`, or record the exact credential blocker without fabricating a result.
- [ ] Run final secret scan, backend tests, and syntax checks.

## Self-Review

- Spec coverage: all requested audit, pooling, SSL, migration, schema, startup, Render, and reporting requirements map to Tasks 1-3.
- Step scan: each implementation task starts with a failing focused test and ends with full verification.
- Type consistency: Task 2 consumes the singleton pool produced by Task 1; Task 3 consumes the scripts produced by Tasks 1-2.
- Review focus: each listed failure mode is covered by Task 1 or Task 2 tests.
- Proportion: the plan adds only focused database configuration and verification modules; no frontend or backend domain rewrite is included.
