# Frontend launch gates

1. Use frontend/ as an independent GitHub repository root (not an inner frontend/ directory).
2. On a clean Linux runner: `npm ci && npm test && npm run verify:design && npm run audit && npm run verify:production && npm run build`.
3. Review environment `VITE_API_URL` and permissions/cookies/CORS with matching staging backend.
4. Real-browser checks: Super Admin 20-row server pagination, search/status filters, organization details, billing receipt review, subscriptions and mobile/desktop views.
5. Never treat static audit PASS as proof of live browser/device E2E.
