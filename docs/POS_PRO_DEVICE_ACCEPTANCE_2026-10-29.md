# POS Pro — real hardware acceptance (operator sign-off)

**Status:** checklist and guidance only, not a claim that a device has been tested. Use an authorized staging/test tenant. Do not run synthetic sales against customers' production inventory or payments.

| Device / mode | Pass criterion | Failure handling |
| --- | --- | --- |
| USB/HID barcode scanner | Scan a known barcode in the POS Pro **Barcode** field; one product resolves and one unit is added. Scanner sends Enter suffix, with no duplicate scans. | Check USB/HID keyboard mode, Enter suffix, barcode uniqueness, focus, and retry; do not claim a connected-device status from the browser API. |
| 58 mm receipt printer | Print a test/non-fiscal existing receipt using **F10**, select 58 mm paper; product, quantity, price and totals are legible and not clipped. | Check paper width and browser print scaling; record device/OS/driver and screenshot/photo before marking passed. |
| 80 mm receipt printer | As above on 80 mm paper, confirm long names and totals. | Record printer model, test context, and result. |
| Touchscreen / mobile | Tap products, change quantity, open and close payment modal at 320/375/430/768/1024 widths, with no horizontal overflow or hidden submit controls. | Record viewport, OS, browser and UI defect. |
| Offline / reconnect | With **no payment in flight**, disconnect internet: an unsent draft remains and checkout is disabled. Reconnect and verify the draft persists. For unknown checkout, verify the prior reference before retrying; never create a second payment. | Stop checkout if the outcome is unknown; reconcile against backend sale using the original reference. |
| Cash drawer / ESC-POS bridge | **Unavailable until integrated and physically accepted.** Browser print and WebUSB availability do not mean a working cash drawer. | Do not claim tested; track adapter integration and controlled device test separately. |
| Fiscal provider / bank terminal | **Not integrated.** Bank terminal confirmation is manual and not evidence of settlement. | Preserve current manual confirmation policy; require provider-specific acceptance before automation. |

Record store/test tenant (no customer secrets), device model, browser/OS, date, pass/fail, operator and reviewer in an external acceptance report. The in-app checkboxes are **temporary manual reminders only** and are not stored as organization-level hardware readiness.

**Exit gate #42:** obtain recorded physical results for scanners, installed printers, Android/touch, reconnect and any promised drawer/fiscal integrations. Browser/CI tests, even when green, are insufficient to close #42.
