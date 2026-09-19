# Windows, local network and printer setup

## Install and start

Use Node.js 24 LTS for development/builds. Run `npm ci`, then `npm start`. `npm run dist:win` creates the installer on Windows. After installation, Node is bundled through Electron; staff do not need to install Node to run the packaged app.

## Automatic Windows updates

Installed copies check GitHub Releases for
[OgnyanTatarov/restaurant-pos](https://github.com/OgnyanTatarov/restaurant-pos).
They do this when the app starts and every few hours, download the installer in
the background, then install it the next time the app restarts. A banner
appears when a download is ready.

The repo is public so restaurant PCs can download updates without a GitHub
login. Restaurant orders stay on each computer; only the installer is on
GitHub.

This only works after every restaurant PC has installed a build that includes
the updater. That first build is still installed by hand. Later versions
update themselves.

To publish a new Windows version from this Mac:

1. Raise `version` in `package.json` (for example `1.1.0` to `1.1.1`).
2. Commit the change.
3. Run `npm run release`. That tags `v1.1.1` and pushes it.
4. GitHub Actions builds the installer and creates the Release. When it
   finishes, restaurant PCs pick it up on their next check.

You can also build on a Windows PC with `npm run dist:win:publish` if
`GH_TOKEN` is set. Leave the update address in Settings blank unless a
computer should use a different feed.

Use a trusted manager Windows account. The desktop session has manager privileges; there is no additional manager PIN on the desktop. Give waiters paired mobile devices with the waiter role.

## Printers

1. Connect the USB printer to the Windows PC.
2. Install the manufacturer's Windows driver and print a Windows test page.
3. Install every other printer in Windows too, whether it connects by USB or network.
4. In the app's Settings, add each printer and give it a name such as Upstairs or Downstairs.
5. Assign those named printers to kitchen tickets, bar tickets and bills. Save before sending tests.
6. Set 58 mm or 80 mm paper width and check the driver's paper width, margins and cutter settings.
7. Print kitchen, bar and bill tests. Inspect wrapping, long notes and Bulgarian characters. Kitchen tickets print larger than the ticket text size so cooks can read them.

The app uses Electron's Windows print API with the exact system device name and silent printing. It does not assume ESC/POS compatibility, Bluetooth support or a particular printer model. Two jobs can be assigned to the same printer for testing. Phones print bills through the Windows hub and can choose a named printer when more than one is configured.

An order creates one ticket per destination containing only the newly sent lines. Removing a sent line or cancelling a sent order creates cancellation tickets. Moving, splitting and merging sent lines creates station notices. Print bill queues a guest bill. Printer settings and ticket styling apply when a queued ticket is printed.

## Print queue recovery

- `queued`: waiting for the desktop printer service.
- `printing`: currently being submitted.
- `spooled`: accepted by the Windows print driver, not proof of physical output.
- `error`: configuration or printer submission failed. Fix the problem, inspect paper, and explicitly reprint.
- `uncertain`: the app restarted during submission. Check whether it already printed.
- `resolved`: manager recorded that a failed/uncertain original was handled.

Reprints create a new ticket marked REPRINT. An error is never automatically retried because the printer may have received the original before a connection failure. Resolve the original once its outcome is known. This avoids hidden duplicate food preparation.

## Local network

The desktop listens on TCP port 47831, even without internet. The mobile app carries its own UI and calls this hub; it does not open a hosted website.

- Put the desktop and staff devices on the same trusted network, not isolated guest Wi-Fi.
- Reserve the desktop's LAN address in the router.
- Allow incoming TCP 47831 in Windows Firewall on the Private network profile only.
- Do not forward this port through the router to the public internet.
- Pair every device separately and revoke lost devices in Settings.
- Keep the desktop plugged in and the application running during service. The app requests that Windows prevent automatic suspension; manually sleeping/shutting down the PC still stops the hub.

The default local hub uses HTTP for compatibility with a private network. Pairing tokens and order data are not encrypted on this transport. Use a separate trusted staff network, or configure trusted HTTPS before operating on a shared/untrusted network.

## Optional HTTPS local hub

Add `tlsCert` and `tlsKey` absolute file paths to `desktop-config.json`, with a certificate/key for your local DNS name/IP. Restart and use an `https://` hub address on phones. Install/trust the appropriate certificate chain on each device. The application does not bypass certificate validation.

```json
{
  "port": 47831,
  "tlsCert": "C:\\Restaurant\\certs\\hub.crt",
  "tlsKey": "C:\\Restaurant\\certs\\hub.key",
  "printers": {
    "named": [],
    "kitchen": "",
    "bar": "",
    "bill": ""
  }
}
```

For an HTTPS-only mobile release, remove Android's `usesCleartextTraffic` and iOS's broad `NSAllowsArbitraryLoads` exception. These are included to support the default local HTTP connection and must be considered during distribution review.

## Backup and restore

Use Settings → Backup & audit → Save backup. This uses SQLite's online backup API, producing a consistent snapshot while the application is open. Store backups away from the restaurant PC.

To restore: close the application completely; preserve the current data folder as a safety copy; replace `restaurant.sqlite` with the chosen backup; remove stale `restaurant.sqlite-wal` and `restaurant.sqlite-shm` files only after the app is closed and the current data is preserved; restart. Retain `desktop-config.json` separately for printer/cloud configuration. A restored backup includes its prior device pairings; review and revoke outdated pairings.

No automatic backup schedule is included. The database is not encrypted by this application; use Windows disk encryption and normal account protections.
