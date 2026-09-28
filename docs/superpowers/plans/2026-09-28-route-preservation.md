# Route Preservation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve the exact application page across refreshes and restore Settings > Telegram after the external Telegram flow.

**Architecture:** Bind workspace readiness to the current authenticated identity so stale anonymous state cannot trigger the license redirect. Make Settings tabs URL-driven through small pure routing helpers and React Router navigation.

**Tech Stack:** React 19, React Router 7, Node test runner, Vite.

**Spec:** `docs/superpowers/specs/2026-09-28-route-preservation-design.md`

## Global Constraints

- Do not redirect to Billing until the current user's workspace and organization are authoritatively loaded.
- Preserve pathname, unrelated query parameters, and browser-refresh behavior.
- Implement each behavior with RED -> GREEN tests.

## Review Focus

- Anonymous bootstrap finishing before auth restore must not mark the restored user's workspace ready.
- Switching between two organization users must invalidate prior workspace readiness.
- Invalid/missing Settings tab parameters must fall back to `Tashkilot`.
- Existing Settings query parameters must survive tab changes.
- A genuinely inactive license must still redirect to Billing after hydration.

---

### Task 1: Identity-bound workspace readiness

**Files:**
- Create: `frontend/src/utils/workspaceReadiness.js`
- Modify: `frontend/src/context/StoreContext.jsx`
- Modify: `frontend/src/App.jsx`
- Test: `frontend/tests/workspaceLifecycle.test.mjs`

**Interfaces:**
- Produces: `workspaceIdentity(user)` and `isWorkspaceReadyFor(identity, loadedIdentity)`.
- Produces: StoreContext `workspaceReady` that is valid only for the current user.

- [ ] Write failing lifecycle tests for anonymous-to-authenticated and user-to-user identity changes.
- [ ] Run the focused tests and confirm they fail because readiness is not identity-bound.
- [ ] Implement the pure readiness helpers and bind StoreContext hydration completion to its captured identity.
- [ ] Ensure `WorkspaceAccess` waits when no authoritative organization is available.
- [ ] Run the focused tests and confirm they pass.

### Task 2: URL-authoritative Settings tabs

**Files:**
- Create: `frontend/src/pages/settings/settingsNavigation.js`
- Modify: `frontend/src/pages/settings/Settings.jsx`
- Test: `frontend/tests/settingsNavigation.test.mjs`

**Interfaces:**
- Produces: `settingsTabFromSearch(search)` and `settingsSearchForTab(search, tab)`.
- Consumes: React Router `useNavigate` and `useLocation`.

- [ ] Write failing tests for Telegram restoration, fallback, encoding, and preservation of unrelated query parameters.
- [ ] Run the focused tests and confirm they fail because the navigation helper is absent.
- [ ] Implement the helpers and route every Settings section selection through one navigation function.
- [ ] Navigate to the Telegram tab URL before leaving for Telegram.
- [ ] Run the focused tests and confirm they pass.

### Task 3: Regression verification and delivery

**Files:**
- Modify only if a failing regression test identifies a scoped defect.

**Interfaces:**
- Consumes: Tasks 1 and 2 behavior.

- [ ] Run the complete frontend test suite.
- [ ] Run the production frontend build.
- [ ] Review the complete diff against the approved spec.
- [ ] Commit and push the verified change to `main`.
