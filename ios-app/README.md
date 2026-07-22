# ChargeRoute — iOS

This is a **separate, self-contained iOS-only copy** of the ChargeRoute (EV Route & Charging Planner) React Native app, split out from the main project (which targets Android). It has its own `node_modules`, its own native `ios/` Xcode project, and no `android/` folder at all — changes here don't affect, and aren't affected by, the Android version one level up.

The app logic itself (`src/`, `App.tsx`) is a snapshot copy of the main project's code, not a symlink or shared package — the two versions are intentionally independent so they can diverge if needed.

## What's here vs. what's not

- `src/`, `App.tsx`, `index.js`, `app.json` — the app itself (identical to the main project's code as of this copy).
- `ios/` — the native Xcode project (`TempNativeShell.xcworkspace` after `pod install`; internal Xcode target/scheme names are still `TempNativeShell`, a leftover from the original `react-native init` scaffold — cosmetic only, doesn't affect functionality).
- No `android/` folder, no Android scripts in `package.json`.
- `.env` was copied over with the same API keys as the main project (Google Maps, OpenChargeMap) so it runs against live services out of the box.

## One real bug found and fixed here

`ios/TempNativeShell/AppDelegate.mm` had `self.moduleName = @"TempNativeShell"`, but the JS side (`index.js` / `app.json`) registers the root component as `"EVRoutePlanner"`. That mismatch would have crashed on launch with a "no component found" error — the Android side already correctly uses `"EVRoutePlanner"` (see `android/app/.../MainActivity.kt`), so this was an iOS-only inconsistency, never previously built/tested. Fixed here; **the same fix has not been applied to the original repo's root-level `ios/` folder**, since that one wasn't in scope.

## Setup already done

- CocoaPods installed via Homebrew (`brew install cocoapods`, since the system Ruby's gem install was broken) and `pod install` run — `ios/Pods/` and `ios/TempNativeShell.xcworkspace` exist.
- Bundle identifier changed from the RN template default (`org.reactjs.native.example.*`) to `com.chargeroute.ios`, matching the Android app's `com.chargeroute` convention.
- `CFBundleDisplayName` in `Info.plist` changed from `TempNativeShell` to `ChargeRoute` so the Home Screen shows the right name.

## Running it

```bash
cd ios-app
npx react-native start          # Metro bundler, in one terminal
npx react-native run-ios        # builds + launches in Simulator, in another
```

Or open `ios/TempNativeShell.xcworkspace` in Xcode directly and hit Run — **always open the `.xcworkspace`, never the `.xcodeproj`**, or CocoaPods dependencies won't be found.

## Known gaps

- No custom app icon is set (`Images.xcassets/AppIcon.appiconset` is empty) — it'll build with a blank icon until one is added.
- To install on a physical iPhone rather than the Simulator, Xcode needs your Apple ID signed in (Xcode → Settings → Accounts) and the project's Signing & Capabilities pane set to your team, then build with your iPhone connected and selected as the destination.
