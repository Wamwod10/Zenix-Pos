# Frontend performance observations

## Measured local Chromium run

Command: `node tests/performance.browser.mjs --production --profile`, explicit installed Chromium path,390px viewport,4× CPU throttle,50000 synthetic products.

Thirty recorded native-input-to-result-DOM samples: P5029.6ms, P9558.6ms, P9962.7ms.20 simulated HID scans produced5 cart lines of quantity4. Runtime errors:0. CPU profile saved at `.cache/performance/search.cpuprofile`; raw results `.cache/performance/browser-profile.json`. These are local descriptive samples, not production guarantees; concurrent audit workloads may affect them.

POS browser acceptance exercised100/500-row cart mutation/reload and server-style catalog tail search. Actual browser→local Express→PostgreSQL verified checkout/recovery/stock, but does not establish high-volume production throughput.

## Scope and interpretation

- No performance optimization or before/after speedup is claimed. This task's fixes address correctness, accessibility and bounded responsive layout.
- The50k test supplies a synthetic local catalog; it is not proof of a100k-row production server query, actual network p95, or memory safety over a long shift.
- Browser screenshots and geometry are not measurements of physical paint. Search timing ends at expected DOM result, not input-to-photon latency.
- Build output is retained in `.task/frontend-master-*-build.log`; main bundle sizes are reported in the main audit verification ledger after the final build.
- NOT VERIFIED:100000-product DB-backed browser pagination,10000-customer/sales browser stress, long-duration heap leak soak, production network/reconnect saturation or all-module rerender profiling.
- Existing unit/component tests exercise stale responses, debounce, branch changes, quota and async mutation recovery. Passing them does not establish a measured throughput number.
