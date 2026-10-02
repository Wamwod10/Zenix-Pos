# Zenix POS 53 Fixes Design

Source of truth: the uploaded Zenix-POS(9).zip.

Goal: resolve the complete audit checklist without rewriting the product or weakening inventory, financial, tenant, permission, billing, Telegram, or audit integrity.

Approach:
- Preserve current Zenix visual language and business rules.
- Replace technical/raw UI with human-readable business identifiers and actionable errors.
- Make customer creation reusable between POS quick-create and full CRM.
- Make inventory batch/serial workflows proactive instead of failing after generic quantity entry.
- Make destructive product deletion safe: hard delete only when no immutable history exists; otherwise preserve history.
- Make store creation, shift state, Telegram state, and other mutations server-authoritative and idempotent.
- Standardize responsive/error/loading/empty states and verify tenant/store isolation.
- Use backward-compatible migrations only.
