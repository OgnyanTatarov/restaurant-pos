# Validation and installation acceptance

## Automated validation performed in the build environment

- `npm run check`: transaction-engine, LAN authentication and cloud-bridge tests, strict TypeScript check and production interface build.
- `npx cap sync`: generated Android and iOS projects receive the built application assets.
- Native runtime source syntax checks for Electron entry/preload and backend modules.

Covered behaviours:

1. Separate food/drink tickets and additions-only sends.
2. Durable duplicate-command protection for orders and tickets.
3. Stale order edits rejected without mutation.
4. Sent cancellation vs unsent removal.
5. Manager/waiter permissions.
6. Occupied-table deletion guard and historical data retention.
7. Unsent-close guard and integer monetary totals.
8. Price snapshots and historical currency guard.
9. Split/merge total preservation and station notices.
10. Full rollback on invalid settings.
11. Restart persistence and uncertain printing recovery.
12. Authenticated, revocable local pairing over real HTTP requests.
13. HTML escaping and Unicode ticket text.
14. Supabase bridge claim, membership check, command acknowledgement and snapshot publication using a mocked HTTP boundary.

The cloud test is an integration-boundary simulation, not a test of a real Supabase account. The SQL migration still needs applying and verifying in your project.

## Not performed here

No Windows GUI/printer hardware, Android SDK release build, Xcode build/signing, physical-device UI run or live Supabase project was available for validation. No signed installer/APK/IPA is represented as tested or included. Browser/visual QA was not performed. Treat the source as ready for installation testing, not already validated for a live shift.

## Before a restaurant shift

Use test orders before accepting real transactions:

- Start the Windows app with real menu prices and restaurant currency.
- Connect two staff phones and verify order changes appear on each.
- Have both devices edit the same order; confirm one stale edit is rejected clearly.
- Unplug internet while keeping Wi-Fi active; take orders from desktop and local phones.
- Restart the desktop; verify open tables, history and queued tickets persist.
- Print food and drinks to the real kitchen/bar devices; check both printer assignments.
- Check long notes, large quantities, Cyrillic names, 58/80 mm paper and cutter behaviour.
- Disconnect a printer, send a ticket, reconnect and perform a labelled reprint once.
- Cancel a sent item and verify the cancellation reaches the correct station.
- Move, split and merge test orders; compare total amounts before and after.
- Close a test order after taking a simulated payment; inspect history and daily total.
- Revoke a phone and verify its next request is refused.
- Save and restore a backup using a separate test data folder/computer while the original hub is stopped.
- Configure Supabase and verify member/non-member access, remote order execution and reconnect behaviour.
- Install/run each native app on the actual Android/iPhone devices and check narrow-screen controls and local-network permission prompts.

Record printer models/driver versions and any hardware-specific adjustments in this file once tested.
