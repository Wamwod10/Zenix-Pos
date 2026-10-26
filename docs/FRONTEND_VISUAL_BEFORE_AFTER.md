# Visual before/after evidence

All captures use synthetic local fixtures. External origins are blocked. No production account/customer data was used.

|Finding|Before / root cause|Minimal fix / after verification|
|---|---|---|
|F-01 Select Escape closes parent dialog|Keyboard Escape bubbled from open select to modal listener.|Stop propagation while closing select; first Escape retains dialog, second closes it. Chromium regression.|
|F-02 Select keyboard semantics/focus|No linked active option; Tab retained menu. Combobox migration also exposed unnamed bare controls during review.|Linked listbox/option IDs, active descendant, Tab/Home/End/Space handling, explicit report filter names and native-label-preserving fallback. AX/name checks and keyboard tests.|
|F-03 Register password toggle unnamed|Icon-only reveal had no accessible name.|State-specific reveal/hide label. Visual appearance intentionally unchanged; browser accessible-name assertion proves fix.|
|F-04 Reporting products/units merged|Seller ranking combined different IDs sharing a name; Analytics combined historical units of one ID. Example10 dona or10 kg.|Group by product ID plus unit; show7 kg and3 dona separately. Stable keys and matching stock-risk lookups; focused unit/browser regressions.|
|F-05 Analytics branch valuation|10 units at branch cost0 displayed990 using global reference99.|Sum quantity × supplied branch cost, preserve zero, sum branches independently. Browser after0; regression for0/300/198/all498. No backend cost policy invented.|
|F-06 Direct Seller route ranking unstyled|Rank styles existed only in Analytics' lazy stylesheet. Fresh Seller route showed zero badge/name gap and inline unit.|Scoped seller ranking rules reuse existing tokens/typography. Geometry gap9px; unit below name. No visit-to-Analytics prerequisite.|
|F-07 Platform mobile header clipping|At320px profile button extended to358px. Help/Fullscreen hiding depended on AI availability, which Platform Admin lacks.|Hide secondary header actions on mobile for all roles; retain Help/Fullscreen in profile menu.44px controls preserved. Strict header bounds and menu-action checks.|
|F-08 Register1024 clipping|Implicit minimum grid tracks exceeded available form width; autofocus shifted page to x=-41 and right edge1038.|One scoped `repeat(2,minmax(0,1fr))` rule; existing single-column mobile rule retained.320/768/1024/1366 × both themes geometry.|

## Locations

- Full baseline: `../artifacts/visual-fix-2026/frontend-master-before/` (relative to frontend directory).
- Full route/theme screenshots: `../artifacts/frontend-master-20261026/after/platform/`.
- Final strict geometry: `../artifacts/frontend-master-20261026/after/final-matrix/measurements.json`.
- Shared controls: `../artifacts/frontend-master-20261026/{before,after}/shared-accessibility/`.
- Register responsive: `../artifacts/frontend-master-20261026/{before,after}/auth-responsive/`.
- Reporting: `../artifacts/frontend-master-20261026/reporting/` includes matching fixture screenshots and geometry JSON.
- Representative evidence is copied under `docs/artifacts/frontend-master-20261026/` for PR review; exhaustive captures remain workspace artifacts.

Before/after reporting pairs use the same1366×900 viewport and synthetic dataset; Register and select pairs use their named matching viewports/themes. Dynamic date/time text is not used as a pixel-perfect regression assertion. Nonvisual accessible-name fixes may have identical pixels; their browser/AX evidence is authoritative for that symptom.

## Design baseline review

Three intentional, scoped stylesheet changes are documented: seller ranking ownership, mobile header action placement and Register grid tracks. Only those three manifest entries are updated. Original screenshot evidence is retained; other23 stylesheet entries, global palette, Inter, tokens and shared radii remain unchanged. The baseline guard was not disabled. Raw child overflow inside deliberate horizontal tab/quick-product scrollers is classified as contained scroll behavior, not silently hidden or automatically fixed.
