# Branch Realtime Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every session in one organization/branch share the same live workspace and branch shift without reloading the page.

**Architecture:** Successful authenticated mutations bump a PostgreSQL-backed organization revision. A focused frontend controller polls that lightweight revision every second and silently rehydrates the existing React store only when it changes; branch shifts are selected by store rather than by logged-in account.

**Tech Stack:** Node.js 20, Express 5, PostgreSQL, React 19, Vite 8, Node test runner.

**Spec:** `docs/superpowers/specs/2026-10-06-branch-realtime-sync-design.md`

## Global Constraints

- Do not add WebSocket/SSE infrastructure or a new runtime dependency.
- Poll `/api/sync/version` every 1,000 ms only while the document is visible; run a 60,000 ms fallback silent refresh.
- Never reload the browser document or reset route, modal, scroll, search, or form state.
- Keep branch scope server-authoritative and derived from `req.user`; never trust a client organization id.
- Keep seller attribution on the user completing a sale even when the branch shift was opened by someone else.
- Preserve dangerous shift controls behind the existing `shiftRecon`/shift-owner authorization.
- All schema work must be additive and mirrored to `Zenix-Pos-Backend`.

## Review Focus

- A revision request resolving after logout/account switch must not refresh or write into the new workspace.
- Polling must never overlap version requests or silent hydrations during a slow network response.
- A failed revision bump must not turn a successful business mutation into an error; the 60-second fallback must recover.
- Two simultaneous shift-open attempts for one branch must yield exactly one open shift.
- A branch-locked user must not receive or operate another branch’s shift even though organization revision is shared.

---

### Task 1: PostgreSQL workspace revision contract

**Files:**
- Create: `backend/migrations/015_workspace_revisions.sql`
- Create: `backend/src/lib/workspaceRevision.js`
- Create: `backend/src/middleware/workspaceRevision.js`
- Create: `backend/src/routes/sync.js`
- Modify: `backend/src/app.js`
- Modify: `backend/src/db/verifySchema.js`
- Create: `backend/tests/workspaceRevision.test.mjs`
- Modify: `backend/tests/database-production.test.mjs`

**Interfaces:**
- Produces: `shouldBumpWorkspaceRevision({ method, statusCode, organizationId }): boolean`.
- Produces: `bumpWorkspaceRevision(db, organizationId): Promise<{revision:number,updatedAt:string|null}>`.
- Produces: `readWorkspaceRevision(db, organizationId): Promise<{revision:number,updatedAt:string|null}>`.
- Produces: authenticated `GET /api/sync/version` returning `{revision, updatedAt}`.

- [ ] **Step 1: Write failing revision tests**

Add tests asserting: successful `POST/PATCH/PUT/DELETE` with an organization bumps; `GET`, error responses, and users without an organization do not; reads are tenant-scoped; bump failures are reported through the injected logger without altering the already-sent response.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test tests/workspaceRevision.test.mjs`

Expected: FAIL because revision helpers/middleware and route do not exist.

- [ ] **Step 3: Add the additive migration and schema verification**

Create `workspace_revisions(organization_id uuid primary key references organizations(id) on delete cascade, revision bigint not null default 0, updated_at timestamptz not null default now())`; add its table/columns to `verifySchema.js` and migration list assertions.

- [ ] **Step 4: Implement revision helpers, middleware, and route**

Use one atomic `INSERT ... ON CONFLICT ... DO UPDATE SET revision=workspace_revisions.revision+1, updated_at=now()`. Attach middleware before API routes, observe `res.finish`, and only bump 2xx authenticated organization mutations. Mount the sync router with `requireAuth`, `requireOrganization`, and `requireActiveLicense`.

- [ ] **Step 5: Run focused and backend suites**

Run: `node --test tests/workspaceRevision.test.mjs tests/database-production.test.mjs`

Expected: PASS.

Run: `npm test`

Expected: all backend tests PASS.

- [ ] **Step 6: Commit Task 1**

```bash
git add backend/migrations/015_workspace_revisions.sql backend/src/lib/workspaceRevision.js backend/src/middleware/workspaceRevision.js backend/src/routes/sync.js backend/src/app.js backend/src/db/verifySchema.js backend/tests/workspaceRevision.test.mjs backend/tests/database-production.test.mjs
git commit -m "feat: add workspace revision tracking"
```

### Task 2: Frontend synchronization controller

**Files:**
- Create: `frontend/src/utils/workspaceSync.js`
- Create: `frontend/tests/workspaceSync.test.mjs`
- Modify: `frontend/src/context/StoreContext.jsx`

**Interfaces:**
- Consumes: `GET /api/sync/version -> {revision:number,updatedAt:string|null}` from Task 1.
- Produces: `createWorkspaceSyncController({ getVersion, refresh, getIdentity, isVisible, addVisibilityListener, addOnlineListener, setTimer, clearTimer, pollMs, fallbackMs }): { start():void, checkNow():Promise<void>, stop():void }`.

- [ ] **Step 1: Write failing controller tests**

Cover literal behavior: unchanged revision causes zero refreshes; revision `4 -> 5` causes exactly one refresh; concurrent ticks share one request; a revision change during refresh schedules one follow-up; hidden documents pause and visibility/online resume immediately; identity change/logout discards late results; a version error backs off while the 60-second fallback refresh remains available.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test tests/workspaceSync.test.mjs`

Expected: FAIL because `createWorkspaceSyncController` is missing.

- [ ] **Step 3: Implement the standalone controller**

Keep all timing/concurrency state in `workspaceSync.js`; inject timers/listeners so Node tests use real behavior without browser mocks. Default `pollMs=1000` and `fallbackMs=60000`.

- [ ] **Step 4: Integrate it into StoreContext**

After `workspaceReady`, create one controller using `api.get("/api/sync/version")` and `hydrateWorkspace({silent:true})`. Capture `workspaceIdentity(currentUser)` for stale-response rejection and stop the controller on logout, identity change, platform-admin sessions, or provider unmount.

- [ ] **Step 5: Run focused and frontend suites**

Run: `node --test tests/workspaceSync.test.mjs tests/workspaceLifecycle.test.mjs tests/performanceHardening.test.mjs`

Expected: PASS with no leaked timers.

Run: `npm test`

Expected: all frontend tests PASS.

- [ ] **Step 6: Commit Task 2**

```bash
git add frontend/src/utils/workspaceSync.js frontend/tests/workspaceSync.test.mjs frontend/src/context/StoreContext.jsx
git commit -m "feat: sync workspace changes across sessions"
```

### Task 3: One shared open shift per branch

**Files:**
- Create: `backend/src/lib/branchShift.js`
- Modify: `backend/src/routes/shifts.js`
- Modify: `backend/src/routes/bootstrap.js`
- Modify: `backend/src/routes/sales.js`
- Create: `backend/tests/branchShift.test.mjs`
- Modify: `backend/tests/transaction-contract.test.mjs`

**Interfaces:**
- Produces: `branchRegisterKey(storeId): string` returning exactly `store:<storeId>`.
- Produces: `selectActiveBranchShifts(shifts): Record<string, Shift>` selecting the newest open shift per store regardless of cashier.
- Preserves: `assertShiftControl(user, shift)` for close/manual movement authorization.

- [ ] **Step 1: Write failing shared-shift tests**

Assert that an owner-opened shift is selected for cashier bootstrap in the same store; a shift from another store is not selected for a branch-locked user; the branch register key is stable; a second open attempt after the advisory lock sees the existing store shift and returns `SHIFT_ALREADY_OPEN`; a cashier sale/refund may use the shared open shift while the recorded seller remains the requester.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test tests/branchShift.test.mjs tests/transaction-contract.test.mjs`

Expected: FAIL on per-user register/ownership behavior.

- [ ] **Step 3: Implement branch shift selection and concurrency guard**

Use `pg_advisory_xact_lock(hashtextextended(organizationId || ':' || storeId, 0))` before checking for any open shift in the store. Ignore client register identity and persist `branchRegisterKey(storeId)`. In bootstrap, map the newest open shift for each allowed store without filtering by `req.user.id`.

- [ ] **Step 4: Permit sales on the shared shift without weakening scope**

Keep the existing `id + organization_id + store_id + status='open'` lookup and remove only cashier-owner equality checks for sale completion and cash refund. Continue using `req.user.id` as `sales.seller_id` and `shift_movements.created_by`.

- [ ] **Step 5: Run focused and backend suites**

Run: `node --test tests/branchShift.test.mjs tests/transaction-contract.test.mjs`

Expected: PASS.

Run: `npm test`

Expected: all backend tests PASS.

- [ ] **Step 6: Commit Task 3**

```bash
git add backend/src/lib/branchShift.js backend/src/routes/shifts.js backend/src/routes/bootstrap.js backend/src/routes/sales.js backend/tests/branchShift.test.mjs backend/tests/transaction-contract.test.mjs
git commit -m "feat: share branch shifts across staff"
```

### Task 4: Frontend shared-shift behavior and end-to-end regression

**Files:**
- Modify: `frontend/src/context/StoreContext.jsx`
- Modify: `frontend/src/pages/shifts/Shifts.jsx`
- Modify: `frontend/tests/workspaceLifecycle.test.mjs`
- Create: `frontend/tests/sharedBranchShift.test.mjs`

**Interfaces:**
- Consumes: branch-scoped `activeShifts` from Task 3.
- Produces: shift-open requests using `registerKey: store:<storeId>` and UI ownership derived from `cashierAccountId` only for control buttons, never for visibility or sales eligibility.

- [ ] **Step 1: Write failing UI/state tests**

Assert that a shift opened by another account becomes `activeShift` for the selected store, Sales treats it as open, and Shifts renders it read-only for a cashier without `shiftRecon`; owner/manager control remains available. Assert that applying a silent snapshot preserves route-local form state because no document navigation/reload occurs.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `node --test tests/sharedBranchShift.test.mjs tests/workspaceLifecycle.test.mjs`

Expected: FAIL on the old per-user register/control rendering.

- [ ] **Step 3: Update StoreContext and Shifts UI**

Send the branch register key on open. Keep `activeShift = activeShifts[currentStoreId]`. In Shifts, show shared shift status and metrics to all scoped users, but hide/disable movement and close actions unless `shiftRecon` is granted or `cashierAccountId` matches the current account.

- [ ] **Step 4: Run full frontend verification**

Run: `npm test`

Expected: all frontend tests PASS.

Run: `npm run verify:production`

Expected: `{ "ok": true }`.

Run: `npm run build`

Expected: Vite exits 0 with no compile errors.

- [ ] **Step 5: Commit Task 4**

```bash
git add frontend/src/context/StoreContext.jsx frontend/src/pages/shifts/Shifts.jsx frontend/tests/workspaceLifecycle.test.mjs frontend/tests/sharedBranchShift.test.mjs
git commit -m "feat: use shared branch shift in pos"
```

### Task 5: Standalone backend parity, final verification, and deployment handoff

**Files:**
- Mirror all Task 1 and Task 3 backend/migration/test files under sibling repo `../backend/`.
- Modify standalone-only broken tests only when they reference monorepo frontend paths that cannot exist in a standalone checkout.

**Interfaces:**
- Consumes: completed monorepo backend implementation.
- Produces: functionally identical backend code in `Wamwod10/Zenix-Pos-Backend`.

- [ ] **Step 1: Mirror backend changes with explicit patches**

Apply only the reviewed backend files; do not copy unrelated monorepo files or overwrite standalone-specific deployment configuration.

- [ ] **Step 2: Verify backend parity**

Run `git diff --no-index` for every mirrored source, migration, and behavior test. Expected differences: none, except documented standalone-only test path handling.

- [ ] **Step 3: Run final verification in all three packages**

Run in `zenix-pos/backend`: `npm test` and `npm run check`.

Run in `zenix-pos/frontend`: `npm test`, `npm run verify:production`, and `npm run build`.

Run in `../backend`: `npm test` and `npm run check`.

Expected: every command exits 0; report exact test counts.

- [ ] **Step 4: Review diffs and migration safety**

Run `git diff --check`, inspect both repo statuses, confirm no secrets/build artifacts, and verify migration 015 is additive and listed by schema verification.

- [ ] **Step 5: Commit standalone parity**

```bash
git add migrations/015_workspace_revisions.sql src/lib/workspaceRevision.js src/lib/branchShift.js src/middleware/workspaceRevision.js src/routes/sync.js src/routes/shifts.js src/routes/bootstrap.js src/routes/sales.js src/app.js src/db/verifySchema.js tests/workspaceRevision.test.mjs tests/branchShift.test.mjs tests/database-production.test.mjs tests/transaction-contract.test.mjs
git commit -m "feat: sync branch workspace across staff"
```

- [ ] **Step 6: Push in safe deploy order**

Push `Zenix-Pos-Backend/main` first and wait for Render health/deploy success. Then push `Zenix-Pos/main` and wait for Vercel success. Verify two authenticated sessions in the same branch: open shift, sale, stock change, and close shift all appear without manual refresh; verify a different branch remains isolated.
