# Architecture

## Authority and offline behaviour

The Windows process owns one SQLite database and is the only authoritative writer. All commands pass through `core/engine.mjs` and are committed in a SQLite transaction. Desktop interaction uses a narrow Electron preload IPC API. Local phones call the authenticated hub. Remote phones submit commands to Supabase, which the desktop bridge processes every two seconds.

This deliberately avoids trying to merge independently edited order documents across offline devices. The desktop continues taking orders and printing offline. Phones need a connection to the hub or cloud; an isolated phone displays its cached snapshot and cannot independently accept a new order.

`pos_snapshots` provides mobile cloud readers with the latest aggregate state. The bridge holds a restaurant hub identity in Supabase, preventing a new blank desktop database from replacing an existing restaurant. One hub per restaurant is supported. Running a cloned backup concurrently on a second PC is unsupported.

## Durable commands and conflict rules

A command contains a random ID, type, payload and, for order changes, expected order version. SQLite stores the result by command ID and actor. A repeated command returns that result without applying it again. A stale order version produces a conflict message and no mutation; refresh and repeat the intended action against current state.

The command and corresponding print tickets are committed together. A lost response cannot produce another ticket when the same command is retried. Cloud command completion is written after the local transaction; if that acknowledgement fails, replay uses the stored result.

Mobile clients retain an unconfirmed command and block further submissions until it is retried or its outcome is explicitly considered during changing connections. They do not silently replay actions as new command IDs.

## Data model

SQLite contains:

- `state`: versioned aggregate with settings, tables, menu, orders, print jobs and audit events.
- `commands`: durable actor-bound idempotency results.
- `devices`: device names, roles, SHA-256 token hashes and revocation state.

Money is stored as integer minor units. Menu changes never rewrite existing order lines. Once orders exist, currency cannot be changed, because doing so would relabel historical amounts.

Table/menu deletion is a tombstone. Unsent order deletion takes it out of service but retains the audit/history record. Sent orders are cancelled with station tickets. Closed orders are immutable through the current command API. No refund workflow is implemented.

## Security boundaries

The Electron renderer has node integration disabled, context isolation enabled, a sandboxed preload, blocked navigation/popups and a restrictive content policy. It can invoke only the listed preload actions. Local desktop access is trusted manager access protected by the Windows login.

Each local mobile device uses its own 256-bit pairing token. The database stores the hash, not the plaintext token. Mobile manager devices can change configuration; waiter devices can work with orders but cannot edit menu/tables/settings, cancel sent items/whole orders, or reprint/resolve tickets.

The local hub uses authenticated requests. HTTPS is optional; default HTTP is for a trusted staff LAN only. The Supabase service key stays in the desktop process configuration, outside the UI/package. Supabase clients use authentication and RLS, and server-fixed command ownership. SQL RPCs explicitly restrict execution privileges.

## Extension points

- Add a command type to the engine, validate it there and test permissions/rollback.
- Add a corresponding UI action calling `submit` with the order's version.
- Extend `State` and introduce an explicit data migration before changing the persisted schema.
- Extend `ticket.mjs` for printer layout, or replace the Windows spool adapter for verified specific hardware.
- Introduce inventory/recipes as transactionally updated state, not disconnected frontend totals.
- For multilingual UI, extract English interface strings into locale dictionaries. Menu and ticket data already support Unicode.

## Current scope and scalability

This is a single-restaurant first implementation. The aggregate snapshot and audit list grow over time, and mobile polling transfers the whole aggregate. Larger installations should normalise records, paginate history, implement retention policies and reduce transfers. Do not delete the durable idempotency ledger while commands might be retried.

Not included: certified fiscal-device integrations, tax calculations, payment-provider processing, stock management, reservation scheduling, automatic table geometry, independently writable offline phones, staff PIN/timekeeping, customer CRM, automatic backups or multi-branch support.
