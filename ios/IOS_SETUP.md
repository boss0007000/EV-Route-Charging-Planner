# iOS native project — what's done and what's left

The previous `ios/` folder in this repo was an incomplete Xcode scaffold —
no `AppDelegate`, no real `Info.plist`, no asset catalog, just a test
target. It has been regenerated from a real React Native 0.76.5 template and
wired up for this app specifically. **The rest requires a Mac with Xcode —
that part cannot be done from Windows.**

## Already done (verified by inspection, not yet build-tested — needs a Mac)

- Real app target `EVRoutePlanner` with `AppDelegate.h/.mm`, `main.m`,
  `Images.xcassets`, `LaunchScreen.storyboard`, `PrivacyInfo.xcprivacy`.
- Bundle identifier set to `com.chargeroute.app` (was the RN placeholder
  `org.reactjs.native.example.*`).
- `CFBundleDisplayName` set to "ChargeRoute", matching Android.
- `NSLocationWhenInUseUsageDescription` filled in (required — the app uses
  `react-native-geolocation-service` + `react-native-maps`). Apple will
  reject the build at review without this.
- `Podfile` updated to add the `GoogleMaps` and `Google-Maps-iOS-Utils` pods
  — required because the app explicitly uses `PROVIDER_GOOGLE` in
  `RoutePlannerScreen.tsx` / `ChargerMapScreen.tsx`, not Apple's default
  MapKit.
- `AppDelegate.mm` calls `[GMSServices provideAPIKey:...]` using
  `[RNCConfig envFor:@"GOOGLE_MAPS_API_KEY"]` — reads the same `.env` at the
  repo root that Android uses. Confirmed (by reading
  `node_modules/react-native-config`'s podspec) that this version bundles a
  CocoaPods `script_phase` that generates the config automatically on
  `pod install` — no manual Xcode build-phase step needed, unlike older
  react-native-config docs suggest.

The old broken folders are preserved, not deleted, at
`ios.OLD_BROKEN_unused/` and `ios-app.OLD_BROKEN_unused/` (the latter was a
dead duplicate of the same broken scaffold) — safe to delete once the new
`ios/` is confirmed working.

App icon is done — `Images.xcassets/AppIcon.appiconset` is fully populated
with real generated images (see `store-assets/` at repo root for the source
files), no manual step needed there.

## Current plan: free personal signing, own device only (no $99/yr fee yet)

Chosen for now over paying Apple's Developer Program fee. This gets the app
running on your own iPhone to verify it actually works, but **cannot** reach
TestFlight, cannot be installed by other testers, and the signed build
expires after 7 days (Apple's limitation on free/personal signing, not
something to work around — just re-run from Xcode to refresh it).

1. Install Xcode (App Store) and CocoaPods (`sudo gem install cocoapods`, or
   via Homebrew).
2. Copy/clone this repo onto the Mac, then `npm install` (node_modules isn't
   committed to git).
3. `cd ios && pod install`
4. Open **`ios/EVRoutePlanner.xcworkspace`** in Xcode — not the `.xcodeproj`.
   CocoaPods projects must be opened via the workspace.
5. In the project's Signing & Capabilities tab, under **Team**, choose
   **Add an Account…** and sign in with your regular (free) Apple ID. Xcode
   creates a free "Personal Team" automatically — no payment involved. Leave
   "Automatically manage signing" checked.
6. Connect your iPhone via cable (or same Wi-Fi for wireless debugging).
   First time only: on the iPhone, go to **Settings → General → VPN & Device
   Management** and trust the developer certificate once Xcode prompts —
   free personal builds aren't Apple-notarized, so the device blocks them
   until you manually trust it.
7. In Xcode's toolbar, select your iPhone (not a simulator) as the run
   destination, then press **Run (▶)**. It builds, installs, and launches
   directly on your phone.
8. If it's been 7+ days since the last run and the app won't open, that's
   the free-signing expiry — just reconnect and hit Run again to re-sign it.

## Later: if/when you decide to pay for TestFlight / App Store distribution

1. Enroll in the Apple Developer Program ($99/yr) — an account action only
   you can do, needs your Apple ID, payment, and identity verification
   (can take a day or two).
2. Back in Signing & Capabilities, switch **Team** from the personal team to
   your paid organization/individual team.
3. Product → Archive. This is the real pass/fail test — a simulator run or
   a personal-signed device run isn't sufficient proof it's App Store ready.
4. Watch for an App Store Connect privacy-manifest warning
   (`ITMS-91053`) — some dependencies (AsyncStorage, SQLite storage) touch
   APIs Apple now requires a declared reason for. Recent versions of those
   libraries usually ship their own `PrivacyInfo.xcprivacy`, so this may be
   a non-issue, but check the upload warnings if it comes up.
5. Upload the archive via Xcode Organizer, add it to TestFlight, add
   internal testers (instant) or external testers (short Beta App Review).
