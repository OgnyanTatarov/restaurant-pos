# Connect your Supabase project

Nothing in the source is connected to a real Supabase account. Local desktop and local Wi-Fi use work without it.

The POS cloud project is **Angel Steak house Pos**
(`nebpmyoglgmaztexbchl`).

- Project URL: `https://nebpmyoglgmaztexbchl.supabase.co`
- Restaurant UUID: `2fa67e09-df28-4be7-a90d-03dab6436936`

## 1. Create the schema

The schema is already applied on that project. To recreate it on a new
project, open SQL Editor and execute `supabase/001_restaurant.sql` once. It creates:

- `pos_restaurants`: a restaurant row.
- `pos_members`: users and waiter/manager permissions.
- `pos_hubs`: each Windows computer that is sharing this restaurant.
- `pos_events`: the ordered command log both computers apply.
- `pos_snapshots`: latest restaurant state for mobile readers (menu, tables, and orders live in this JSON, not as separate SQL tables).
- `pos_commands`: mobile commands and their result.
- `pos_submit_command`: validates membership and fixes command ownership server-side.
- `pos_claim_hub`: registers a Windows computer; more than one till is allowed.

The migration enables row-level security. Authenticated mobile clients can read their own memberships, restaurant snapshot and commands. They cannot directly overwrite snapshots or command results. Only the server-side desktop bridge can do so.

## 2. Create the restaurant and staff

Create each staff user in Supabase Authentication. Use email/password accounts. Record their user IDs. In SQL Editor, run this using your actual names and UUIDs:

```sql
-- Restaurant already exists: 2fa67e09-df28-4be7-a90d-03dab6436936
-- Replace AUTH_USER_UUID with the staff user's Auth UUID.
insert into public.pos_members(restaurant_id,user_id,role,display_name)
values (
  '2fa67e09-df28-4be7-a90d-03dab6436936',
  'AUTH_USER_UUID',
  'manager',
  'Manager'
);

-- Repeat with role = 'waiter' for waiter accounts.
```

No public signup workflow is included. Staff are provisioned by the project owner. Changing a membership role or removing membership changes permissions checked by the desktop when a pending cloud command is processed.

## 3. Configure the Windows hub

The Windows installer writes the Angel Steakhouse Supabase URL, restaurant UUID, and service-role key into that computer's `desktop-config.json` on first launch. You do not copy those values by hand onto each till. Printer names stay local — set kitchen/bar/bill printers in Settings on each machine.

This desktop has full backend privileges. Do not put the service-role key in the phone app, frontend source, Git, or a screenshot. The preload API deliberately never returns it to the renderer. GitHub Actions injects the key from the `POS_SUPABASE_SERVICE_ROLE_KEY` repository secret when it builds the installer.

Restart the app. Settings should show cloud status. The first computer publishes the current menu, tables, and orders. The second computer starts empty, downloads that snapshot, then both follow `pos_events`. Each till prints only the tickets for actions taken on that computer, so set kitchen/bar/bill printers on both machines (network printers can be selected on both).

Keep each computer's SQLite file. A brand-new empty database on a second PC is expected: it loads from the cloud instead of replacing it.

## 4. Connect a phone through the internet

In the phone app choose **Supabase (internet)**. Enter:

- Project URL: `https://nebpmyoglgmaztexbchl.supabase.co`
- Public anon key: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5lYnBteW9nbGdtYXp0ZXhiY2hsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk4MTM1OTcsImV4cCI6MjEwNTM4OTU5N30.SZ0AMht0MDPhNjrbx-ZH8yt8jTC4_ck1LAzA0TL4xn4`
- Or the newer publishable key: `sb_publishable_-81gCPsl70asFXGka57v0w_WYKV8hJ1`
- Never the service role key.
- Restaurant UUID: `2fa67e09-df28-4be7-a90d-03dab6436936`
- The staff user's email and password.

Access/refresh tokens stay in memory; after restarting the mobile app, sign in again using Settings. Public project configuration is retained. The desktop processes submitted commands and uploads the updated state. Two-second polling is used; Supabase Realtime configuration is not required.

## 5. Check failure recovery

Send a small test order from the phone. Verify it appears on the desktop and creates the expected tickets. Disconnect the desktop from the internet: local desktop/Wi-Fi operation continues. A remote phone command waits for the hub, rather than pretending it has printed. Reconnect and use **Retry pending action** if confirmation is still outstanding. Its unchanged command ID prevents duplicate execution.

## Recovery and operation

Two Windows tills can run at the same time when both are connected to this project. They must stay online to share new orders. If both people change the same table at the same moment, one action is kept and the other till asks to refresh.

The app still prevents two windows of the same installation from opening on one PC. Moving a till to a new computer: install the app, start empty so it reloads from the cloud, then set that PC's printers. Or restore that PC's SQLite backup and keep its `desktop-config.json`.

Supabase snapshots are a sync/read model, not a complete desktop backup. They omit the command ledger and paired-device hashes. Back up SQLite separately. Pending commands are retried through the durable ledger even if the desktop crashed after applying a command but before updating its cloud status.

For very large histories, normalise and paginate the snapshot schema before expanding this beyond one restaurant; this implementation transfers the aggregate restaurant snapshot.
