# Production CSS and security follow-up — 2026-11-17

## Verified baseline
Frontend production commit 667145e7dd9efd6e9a5e31a04e5ffe23e001a776; Vercel READY. Guest session probe returns 200 with user null and no-store. Main push CI 44070110966 succeeded. Production HTML has CSP base-uri 'self'; object-src 'none'; frame-ancestors 'none', X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy strict-origin-when-cross-origin, HSTS max-age=63072000. Backend session response has separate Helmet security headers. Frontend HTML does not yet have COOP or Trusted Types enforcement. HSTS already exists; do not enable preload or includeSubDomains until all subdomains and HTTPS redirects have been inventoried.

## CSS
Only the two customer-detail modal blocks scoped to .platform-customer-modal were moved from global saas.scss to a stylesheet imported by lazy PlatformAdmin. No declarations removed or restyled. Remain mindful of cascade order on the platform route. Keep auth, shared skeleton, crash, feedback, registration pricing and base tokens global until measured route coverage supports further extraction. Existing platform routing browser checks exercise mobile and desktop modal behavior; production build and CI are required before merge. Do not claim an exact built-size reduction until measured.

## Security rollout (not enforced by this PR)
- Inventory actual script, image, fetch/WebSocket, font, worker, frame and form destinations across auth, billing, POS, Telegram, barcode, camera, receipt preview and offline mode. Inline React style properties currently exist. 
- In isolated preview or a local production build, exercise a CSP Report-Only candidate: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data: https:; connect-src 'self' https: wss:; worker-src 'self' blob:; frame-src 'self' blob: https:; form-action 'self' https:; base-uri 'self'; object-src 'none'; frame-ancestors 'none'. This is an inventory candidate, not a final allowlist. Broad scheme allowances must be narrowed to verified required origins before enforcement. Do not add unsafe-eval to bypass violations. Report collection must avoid storing URLs containing credentials or customer data; do not publish raw violation logs.
- Exercise COOP same-origin-allow-popups in Report-Only first because payment and document-print popups may require opener interaction. Do not add COEP without cross-origin resource compatibility checks.
- Test require-trusted-types-for 'script' in Report-Only separately, including PDF and printing. Never install a permissive default Trusted Types policy merely to silence diagnostics.
- Enforce only after the integration matrix is green. Keep auth/me protected, expired/invalid sessions rejected and no credentials in logs. No database changes or backend deploy needed.

## Lighthouse
New PSI API requests could not be retrieved in this session. Re-run mobile and desktop against the final production URL after release and record observed scores only. Separate synthetic CI performance budgets from Lighthouse metrics.

## 2026-11-17 follow-up: local report-only trial
- Run npm run build, then node tests/cspReportOnly.browser.mjs and ZENIX_CSP_AUDIT=1 node tests/posPro.browser.mjs with Chromium installed. Both are localhost/synthetic only. CI runs the new smoke and existing full POS suite with the candidate header. No changes to production headers, auth, POS or database.
- Current production baseline stays enforced in local preview; broader candidate and require-trusted-types-for are report-only. POS receipt uses iframe.srcdoc (including printing); Trusted Types enforcement must wait for a reviewed, narrow safe HTML policy or sink refactor. Report-only logs contain only directive names and counts. Positive control deliberately attempts inline script in an isolated context and checks it executes and reports.
- Remaining: review observed directive counts, inventory real integration origins and browser/device support, run staging billing, camera, Telegram, PWA and physical printer validation. Browser mocks do not prove live hardware or provider compatibility. COOP and HSTS scope changes remain deferred.
