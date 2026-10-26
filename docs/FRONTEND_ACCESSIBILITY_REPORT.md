# Accessibility verification

Target: WCAG2.2 AA-oriented remediation, not a conformance certification.

## Fixed and browser verified

- PremiumSelect: combobox/listbox association, active descendant, named controls, disabled option handling, keyboard Arrow/Home/End/Enter/Space, Tab dismissal and Escape isolation from parent modal.
- Explicit stable Analytics/Seller filter labels; fallback only for bare controls with no native label. Existing wrapped supplier label retained.
- Register password visibility toggle has a state-specific accessible name.
- Existing Profile dialog initial focus, forward/reverse Tab trap, Escape close and focus restoration passed without rewriting Modal.
- Register grid remains within viewport including input autofocus at320/768/1024/1366 in both themes.
- Platform mobile profile remains reachable; Help/Fullscreen remain available in its menu.

`node tests/sharedAccessibility.browser.mjs`:14 browser assertions pass. `node tests/authResponsive.browser.mjs`:8 viewport/theme checks pass. Browser contexts use reduced-motion preferences; source and visual guards preserve design tokens.

## Explicit limits

- NOT VERIFIED: actual screen reader announcements (NVDA/JAWS/VoiceOver/TalkBack), physical keyboard/device behavior, native Android/iOS virtual keyboard and browser focus zoom.
- Reduced-height viewport/focus visibility is emulation, not a real mobile keyboard PASS.
- NOT VERIFIED: exhaustive computed contrast ratios across all custom accents, backgrounds, disabled/toast/modal states; no full-page automated WCAG rule engine or manual AA certification was performed.
- NOT VERIFIED: every nested dialog/drawer/tooltip in every permission/state combination. The named modal/select regressions establish their tested scope only.

Before/after failures and final checks are retained under `artifacts/frontend-master-20261026/{before,after}/shared-accessibility` in the workspace, with representative PR evidence under docs/artifacts.
