# Connect your Supabase project

Nothing in the source is connected to a real Supabase account. Local desktop and local Wi-Fi use work without it.

The POS cloud project is **Angel Steak house Pos**
(`nebpmyoglgmaztexbchl`).

- Project URL: `https://nebpmyoglgmaztexbchl.supabase.co`
- Restaurant UUID: `2fa67e09-df28-4be7-a90d-03dab6436936`

## 1. Create the schema

The schema is already applied on that project. To recreate it on a new
project, open SQL Editor and execute `supabase/001_restaurant.sql` once. It creates:

- `pos_restaurants`: a restaurant and its authoritative hub identity.
- `pos_members`: users and waiter/manager permissions.
- `pos_snapshots`: latest restaurant state for mobile readers.
- `pos_commands`: mobile commands and their result.
- `pos_submit_command`: validates membership and fixes command ownership server-side.
- `pos_claim_hub`: prevents a blank second desktop from replacing your restaurant state.

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

Open desktop **Settings → Supabase & local data** to find its data folder. Close the app. Copy the contents of `desktop/desktop-config.example.json` into `desktop-config.json` in that data folder. If the file already exists, retain its printer assignments and port and add the `supabase` object.

```json
{
  "port": 47831,
  "printers": {
    "named": [],
    "kitchen": "",
    "bar": "",
    "bill": ""
  },
  "supabase": {
    "url": "https://nebpmyoglgmaztexbchl.supabase.co",
    "serviceRoleKey": "YOUR_SERVER_ONLY_SERVICE_ROLE_KEY",
    "restaurantId": "2fa67e09-df28-4be7-a90d-03dab6436936"
  }
}
```

Use the project's server-side service role key here only. This desktop has full backend privileges: use a dedicated project for the restaurant and restrict access to its Windows account/data folder. Do not put that key in the phone app, frontend source, Git, or a screenshot. The preload API deliberately never returns it to the renderer.

Restart the app. Settings should show cloud status. The first successful connection claims the restaurant for this SQLite database and publishes its snapshot. Keep this original database or its full backup; a newly created database has a different hub identity and is refused by the bridge.

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

Use only one running instance/database for a restaurant. Moving to a new PC means restoring the original full SQLite backup and desktop configuration. The app already prevents two instances of the same installation from opening simultaneously.

Do not clear or reassign `hub_id` casually: doing so may overwrite existing cloud snapshots. A deliberately fresh replacement requires an administrator to reconcile pending commands and historical data first.

Supabase snapshots are a sync/read model, not a complete desktop backup. They omit the command ledger and paired-device hashes. Back up SQLite separately. Pending commands are retried through the durable ledger even if the desktop crashed after applying a command but before updating its cloud status.

For very large histories, normalise and paginate the snapshot schema before expanding this beyond one restaurant; this implementation transfers the aggregate restaurant snapshot.
