# Restaurant POS

Application source project for a restaurant: **Windows desktop + Android + iPhone/iPad**. The interface is bundled inside Electron and Capacitor native applications. No hosted website is needed. Supabase connection is intentionally left unconfigured.

## Start on Windows

Install **Node.js 24 LTS**. Extract this folder, open a terminal inside it, and run:

```powershell
npm ci
npm start
```

The application starts with an empty restaurant. Add your tables and menu, or choose **Load example data** to explore. Example dishes and prices are demonstration data, not your father's actual menu.

To create the Windows installer:

```powershell
npm run dist:win
```

The installer is written under `release/`. Run this build on Windows. Distribution signing credentials are not included; sign the installer before distributing it publicly.

## What is implemented

- Local Windows SQLite storage: orders and printer jobs survive an internet outage or restart.
- Android and iOS native application projects with a shared responsive, touch-friendly interface.
- Local Wi-Fi device pairing with manager/waiter roles and revocation.
- Shared state refresh every two seconds while devices are connected.
- Menu item creation/editing/deletion, categories, prices, availability, and kitchen/bar routing.
- Tables and rooms: create, rename, change capacity, remove empty tables.
- Open orders, quantities, notes, remove unsent items, cancel sent items.
- Send only new items; kitchen and bar receive separate tickets.
- Move orders, merge into another open order, split selected whole item lines to another table.
- Record an already-taken cash/card/other payment and close the order.
- Paid-order history, current totals and today's paid total.
- Persistent print queue, driver spool status, explicit reprints, test tickets and manual resolution.
- Configurable printer assignments, 58/80 mm ticket layout, font size and footer.
- Restaurant name, currency, accent colour, and editable source for further customisation.
- Audit history and full SQLite backup from the desktop app.
- Supabase SQL migration, row-level access rules, authenticated mobile client, and desktop cloud command bridge.
- Order version checks and durable command IDs to prevent lost updates and duplicate submissions.

“Customisable” here means the settings above plus the complete editable source. It does not mean a visual builder for arbitrary new business logic.

## Project folders

| Folder      | Purpose                                                               |
| ----------- | --------------------------------------------------------------------- |
| `src/`      | React/TypeScript application interface and device clients             |
| `core/`     | SQLite transaction engine and business rules                          |
| `desktop/`  | Electron app, secure preload, local hub, cloud bridge and printing    |
| `android/`  | Generated native Android Studio project                               |
| `ios/`      | Generated native Xcode project using Swift Package Manager            |
| `supabase/` | Database migration to run in your project                             |
| `tests/`    | Automated order-engine, hub and cloud tests                           |
| `docs/`     | Setup, architecture and restaurant acceptance checks                  |
| `dist/`     | Built shared interface, included for reference; rebuild after editing |

## Mobile apps

On a machine with Android Studio:

```powershell
npm ci
npm run android
```

In Android Studio, run the app on your device or build a signed APK. See [mobile setup](docs/MOBILE.md).

On a Mac with Xcode:

```bash
npm ci
npm run ios
```

Select your Apple development team and device in Xcode, then Run. Normal iPhone distribution requires Apple's signing/provisioning process; an unsigned source folder cannot be installed directly on an iPhone.

## Connection setup

1. Start the Windows application.
2. Open **Settings → Pair a phone or tablet**.
3. Create a separate token for each phone, selecting waiter or manager permission.
4. On the phone app, select **Restaurant Wi-Fi**, enter the desktop address shown in Settings and the token.
5. Keep the Windows app running throughout service.

Internet is unnecessary for this local connection, but the phone and desktop must be able to reach each other on the local network. Mobile devices do not independently accept new orders while disconnected from both the desktop and cloud. They retain a cached view and any action whose confirmation was lost.

Supabase is optional for local use. To enable remote phones and two Windows tills, follow [Supabase setup](docs/SUPABASE.md). Both computers use the same project URL, restaurant UUID, and service-role key. Each keeps its own printer list.

## Other guides

- [Printer and local network setup](docs/WINDOWS-AND-PRINTING.md)
- [Mobile builds](docs/MOBILE.md)
- [Supabase setup](docs/SUPABASE.md)
- [Architecture and extension points](docs/ARCHITECTURE.md)
- [Validation and hardware acceptance checklist](docs/VALIDATION.md)

## Development commands

```bash
npm run check        # Meaningful engine/hub tests + TypeScript + production UI build
npm run mobile:sync  # Rebuild and copy the interface into Android and iOS projects
npm run desktop      # Run Electron using the current dist/ build
npm run dev          # UI development server only, not the delivered app
npm run hub          # Local integration-test hub; no printing in this mode
```

## Delivery limits

The shared interface builds and automated tests are recorded in `docs/VALIDATION.md`. The project has not been connected to a live Supabase account, tested with your printers, or compiled/signed with Windows, Android or Apple release toolchains here. These environment-specific steps are required before restaurant use.

This version records payments; it does not operate a payment terminal, produce certified fiscal receipts, calculate tax, manage stock/recipes, implement reservations, or provide a drag-and-drop floorplan designer. The UI is English; entered menu/table names and ticket text support Unicode. Whole-line splitting is implemented; arbitrary per-person partial payments are not.
