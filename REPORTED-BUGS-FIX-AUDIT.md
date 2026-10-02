# Reported bugs fix audit — 2026-10-02

Fixed against the supplied Zenix-POS(8) source without redesigning the product visual language.

1. Dashboard Zenix Pulse now has explicit vertical separation from KPI cards on desktop and mobile.
2. Mobile form focus zoom is prevented at the iOS input-font root cause (16px controls), while browser pinch zoom remains available for accessibility; horizontal viewport drift is constrained.
3. Inventory Quick Receive product selector has a stable minimum width and switches to a card-style responsive row earlier, preventing the “Yangi mahsulot” selector from collapsing in narrow modals/devtools/tablets.
4. Customers UI now isolates list/stats requests so one secondary endpoint cannot blank the entire module; create errors stay inside the modal, inputs are normalized, validation is explicit, and modal actions are responsive. Backend customer routes and required DB migrations are present and mounted at `/api/customers`. Backend integration now enforces `moduleSales`, preserves omitted PATCH fields, and validates payment store scope plus organization ownership. Production must deploy this backend revision so the live 404s disappear.
5. Activity Log parses legacy JSON strings/objects and renders human-readable Uzbek labels/statuses instead of exposing raw JSON payloads.

Verification:
- Frontend full suite: 208/208 PASS.
- Backend full suite: 104/104 PASS, including four real Express/customer integration regressions.
- Frontend source/import audit: PASS (90 source files, no missing imports, brace errors, or forbidden references).
- Frontend production-readiness audit: PASS (144 files checked).
- Backend syntax check: PASS.
- Vite production build: PASS (669 modules transformed).
- Frontend and backend production dependency audits: 0 known vulnerabilities.
- Frontend dev server returned HTTP 200. Screenshot/click-based visual verification was unavailable because no browser backend was connected in this session; responsive behavior remains covered by the automated UI regression suite and production build.
