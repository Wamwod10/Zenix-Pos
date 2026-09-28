# Route Preservation Design

## Goal

Refreshing the application must keep the current route, and returning from Telegram group selection must reopen Settings on the Telegram section.

## Root causes

- The store briefly reports the anonymous workspace as ready after authentication has restored a user. `WorkspaceAccess` sees no organization during that render and treats it as `PAYMENT_REQUIRED`, replacing the current URL with `/billing`.
- Settings keeps its selected section primarily in component state. Most section changes do not update `?tab=...`, so remounting Settings falls back to `Tashkilot`.

## Design

- Track which authenticated user/workspace the hydrated store data belongs to. `workspaceReady` is true only when the loaded identity matches the current identity. A previous anonymous or different-user load cannot authorize a redirect decision.
- Do not interpret a missing organization row as a payment state. The license redirect runs only after the current workspace has loaded and an organization exists.
- Make the Settings query parameter authoritative. Every section selection updates `tab` through React Router while preserving unrelated query parameters.
- Before opening Telegram, navigate to the Telegram settings URL through React Router. Returning to or refreshing that URL restores the same section.

## Verification

- A lifecycle test proves data loaded for an anonymous/different identity is not ready for the restored user.
- Navigation tests prove Settings tab URLs preserve existing query parameters and restore Telegram.
- Existing frontend tests and production build remain green.
