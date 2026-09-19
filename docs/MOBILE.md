# Android and iPhone application builds

These are actual Capacitor native projects. Each app bundles the shared interface and uses native HTTP requests to the restaurant hub/Supabase. They are not browser bookmarks or PWA shortcuts.

## Prerequisites

Use Node 24 for this project. Capacitor 8 requires Android Studio 2025.2.1 or newer for Android, and Xcode 26 or newer on macOS for iOS. The project targets Android SDK 36 with minimum SDK 24; the generated iOS deployment target is iOS 15.

Reference: https://capacitorjs.com/docs/getting-started/environment-setup

## Android

1. Install Android Studio and SDK 36; use its bundled compatible JDK.
2. Extract the entire source folder and run `npm ci` from its root.
3. Run `npm run android`. This rebuilds the UI, syncs native assets and opens Android Studio.
4. Allow Gradle sync to finish. Select your phone/emulator and press Run.
5. On a real phone, enable USB debugging for development installation.
6. For distribution, use Build → Generate Signed App Bundle / APK. Create and securely retain your signing key.
7. Install the resulting APK on staff devices using your chosen controlled distribution method.

The manifest permits local HTTP for the default Wi-Fi hub and disables Android automatic app backup. No camera, contacts or location permission is required.

## iPhone/iPad

1. On a Mac capable of running the required Xcode, install Xcode and its command-line tools.
2. Extract the whole project, run `npm ci`, then `npm run ios`.
3. The generated project uses Swift Package Manager. Let package resolution finish.
4. In Xcode select the App target, choose your development team. The iOS bundle ID is `com.angelsteakhouse.mobile`.
5. Connect an iPhone, enable Developer Mode if requested, and select it as the run destination.
6. Run the app and allow local network access when prompted.
7. For staff distribution use an Apple-supported signed distribution method, such as TestFlight or managed/ad hoc distribution appropriate to your account.

The source cannot directly produce an installable iPhone app without signing and provisioning. A Windows computer cannot perform a normal local Xcode build.

For local HTTP connections, the included Info.plist has a local-network purpose string and ATS exceptions. Use a trusted staff network. For an HTTPS-only release, narrow those exceptions as described in the Windows guide.

## First connection

Start the Windows app. Settings displays its IP address and allows manager/waiter pairing. On the phone choose local Wi-Fi and enter the address/token. To use Supabase instead, follow SUPABASE.md.

Local pairing tokens are stored in the application's local storage. Treat staff devices as access credentials, use device screen locks, and revoke lost devices from the desktop. Cloud session tokens are kept only in memory and require a fresh login after an app restart.

## Updating the apps

After editing shared source, always run `npm run mobile:sync` before building either platform. Bump Android `versionCode`/`versionName` and Xcode build/version numbers for releases. Default generated launcher assets are retained; replace them with the restaurant's approved icon before public distribution.
