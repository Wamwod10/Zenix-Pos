# Phase 1 frontend review — 2026-10-20

Base: freshly fetched main `c5db7c6`. Branch: `phase1/professional-finish`.

- `src/pages/dashboard/Dashboard.jsx`: profitable-product quantities retain the actual sale unit, with the existing legacy `dona` fallback.
- `src/pages/settings/Settings.jsx`: Telegram saves have a synchronous pending guard and disabled controls while saving, send only the changed setting, show success/error and restore the previous value on failure. The report description distinguishes scheduled interim reports from final day closing.
- `tests/phase1Ux.test.mjs`: targeted regression guards.
- `tests/phase1Telegram.browser.mjs`: synthetic API Chromium check for actual units, save serialization, rollback/error and 390px mobile overflow. Uses an already built local Vite bundle; set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` if needed.

Validation: combined frontend suite 391 PASS / 0 FAIL / 2 environment-gated SKIP; subscription browser acceptance subsequently 7 PASS / 0 FAIL / 0 SKIP. Targeted UI browser check PASS with zero browser errors. Vite build PASS; existing 23-file CSS/SCSS baseline PASS. Old frontend/new backend and new frontend/old backend subscription browser/HTTP/PG compatibility each 7 PASS.

The environment-gated AI browser suite was also run: two child scenarios plus their parent fail (missing expected suggestion and subsequent usage assertion). The same failures reproduce on unchanged main; no AI behavior was changed in Phase 1. Backend broad-suite baseline failures and full release/rollback instructions are in the backend PR's `docs/PHASE1_RELEASE.md`.

No styles, dependencies or API endpoints were changed. No production deploy or merge performed. Deploy backend API/workers together first under its documented queue-quiescence procedure, then frontend, only after explicit owner authorization. Live Telegram acceptance and existing baseline regression disposition remain required before final production acceptance.
