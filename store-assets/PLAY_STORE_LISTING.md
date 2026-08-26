# Play Console listing — copy-paste content

Everything below is drafted from what the app actually does (read from the
source, not guessed) — check it reads right for your voice before pasting,
but the facts (permissions, data use, no ads/analytics) are accurate as of
this commit.

## App details

- **App name:** ChargeRoute
- **Package name:** com.chargeroute
- **Default language:** English (US)
- **App or game:** App
- **Free or paid:** Free
- **Category suggestion:** Maps & Navigation (or Travel & Local)

## Short description (max 80 characters)

```
Plan EV road trips with smart charging stops and a live charger map.
```
(69 characters)

## Full description (max 4000 characters)

```
ChargeRoute plans your electric vehicle journey — enter your start,
destination, vehicle, and battery level, and get a route with charging
stops calculated for exactly when you'll need them.

FEATURES

Route Planning
Enter your trip details and ChargeRoute calculates whether you can make it
without charging, or exactly where along the way you should stop — based
on your vehicle's real efficiency and battery capacity, with a built-in
safety buffer.

Charger Map
Browse nearby EV chargers on an interactive map, with filtering to find
the connector type and power level you need.

Vehicle Database
20+ electric vehicles with accurate range and efficiency data, so route
calculations reflect your actual car.

Smart Caching
Charger data is cached locally so the map stays fast and responsive even
with a spotty connection.

Google Maps Integration
Once your route is planned, hand off to Google Maps with every charging
stop already added as a waypoint.

ChargeRoute uses your device location to find nearby chargers and to plan
routes starting from where you are. Location is only used for these
features and is not sold or shared for advertising.
```
(this is well under the 4000 char limit — expand with your own
screenshots/story if you want more detail)

## Screenshots

Real screenshots captured from a running build are in
`store-assets/screenshots/`:
- `1-route-planner.png` — main route planning screen with a vehicle selected
- `2-charger-map.png` — the charger map with Google Maps tiles loaded

Play requires at least 2 phone screenshots (up to 8); these two are enough
to satisfy the minimum. Add more later if you want to show off the
Settings screen or a completed route with charging stops.

## Icon & feature graphic

- **App icon (512×512):** `store-assets/playstore-icon-512.png` — ready to upload as-is.
- **Feature graphic (1024×500):** not generated — Play requires this banner
  image for the store listing header. I can generate one from the same
  icon design if you want (just say so), or you can make your own.

## Content rating questionnaire — expected answers

Based on what's actually in the app (no violence, no user-generated
content, no gambling, no in-app purchases):
- Violence: None
- Sexual content: None
- Profanity: None
- Controlled substances: None
- User-generated content / communication with other users: None (no
  social features, no chat, no accounts)
- Shares user location: **Yes** (declare this — it's what triggers the
  location question elsewhere too)
- In-app purchases: No
- Ads: No

This should land the app in the "Everyone" rating category, but Google's
questionnaire has the final say — answer honestly based on the current
build.

## Data Safety form — answers based on the actual code

**Does your app collect or share any of the required user data types?**
Yes.

**Location**
- Data type: Approximate location, Precise location
  (`ACCESS_FINE_LOCATION` + `ACCESS_COARSE_LOCATION` in the manifest)
- Collected: Yes
- Shared: Yes — sent to Google (Directions/Places/Maps APIs) and Open
  Charge Map as part of normal route/charger lookups. This is "shared
  with third party" in Play's taxonomy even though it's just API calls,
  not data sale.
- Processed ephemerally: depends on your judgment — the app doesn't store
  raw location history itself, it's used per-request to call the APIs.
- Purpose: App functionality (route planning, finding nearby chargers).
- Required or optional: Required (core features don't work without it).

**No other listed data types are collected** — no personal info (name,
email, etc. — there's no account system at all), no financial info, no
health data, no contacts, no photos, no device identifiers collected by
the app itself (Google Play Services / Google Maps SDK have their own
separate disclosures Google handles on their end).

**No data is collected for advertising** — there are no ad SDKs in this
app (confirmed: no AdMob, no Firebase, no analytics SDKs in package.json).

**Security practices**
- Data is encrypted in transit: Yes (all API calls are HTTPS)
- Users can request data deletion: N/A / not applicable — there's no
  account and no server-side storage of user data to delete. (Play may
  still want this addressed — since there's nothing to delete, note that
  in the form's free-text field if it asks.)

## Testers

Internal Testing track lets you add testers by email instantly (no
review). Add your own email and anyone else you want testing before
wider release.

## Upload

The signed release bundle is at:
`android/app/build/outputs/bundle/release/app-release.aab`
