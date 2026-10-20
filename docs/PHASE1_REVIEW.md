# Phase 1 frontend review — 2026-10-20

Base: freshly fetched main `c5db7c6`. Branch: `phase1/professional-finish`.

Readiness follow-up: `tests/aiBackend.test.mjs` now injects the current agent protocol and submits through the visible question field, asserting HTTP success, real report data and quota. The old hidden-selector/provider mismatch is fixed. Local full combined frontend/browser regression: **404 PASS, 0 FAIL, 0 SKIP**; AI browser subset: **6 PASS**. The backend also rejects foreign/absent AI branches before quota/provider processing. See backend `docs/PHASE1_READINESS.md` for infrastructure evidence, five remaining historical migration-test failures, and the concrete worker-safe rollout.

Live Telegram acceptance was not performed: the existing single group was found, but bot credentials were unavailable and the owner requested completion of the other checks. No new group, production webhook change or production operation occurred. The historical results below describe the initial Phase 1 run and are superseded by this follow-up where different.

- `src/pages/dashboard/Dashboard.jsx`: profitable-product quantities retain the actual sale unit, with the existing legacy `dona` fallback.
- `src/pages/settings/Settings.jsx`: Telegram saves have a synchronous pending guard and disabled controls while saving, send only the changed setting, show success/error and restore the previous value on failure. The report description distinguishes scheduled interim reports from final day closing.
- `tests/phase1Ux.test.mjs`: targeted regression guards.
- `tests/phase1Telegram.browser.mjs`: synthetic API Chromium check for actual units, save serialization, rollback/error and 390px mobile overflow. Uses an already built local Vite bundle; set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` if needed.

Validation: combined frontend suite 391 PASS / 0 FAIL / 2 environment-gated SKIP; subscription browser acceptance subsequently 7 PASS / 0 FAIL / 0 SKIP. Targeted UI browser check PASS with zero browser errors. Vite build PASS; existing 23-file CSS/SCSS baseline PASS. Old frontend/new backend and new frontend/old backend subscription browser/HTTP/PG compatibility each 7 PASS.

The environment-gated AI browser suite was also run: two child scenarios plus their parent fail (missing expected suggestion and subsequent usage assertion). The same failures reproduce on unchanged main; no AI behavior was changed in Phase 1. Backend broad-suite baseline failures and full release/rollback instructions are in the backend PR's `docs/PHASE1_RELEASE.md`.

No styles, dependencies or API endpoints were changed. No production deploy or merge performed. Deploy backend API/workers together first under its documented queue-quiescence procedure, then frontend, only after explicit owner authorization. Live Telegram acceptance and existing baseline regression disposition remain required before final production acceptance.
