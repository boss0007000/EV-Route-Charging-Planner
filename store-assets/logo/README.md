# ChargeRoute logo

Current design: a yellow (`#FFDE69`) lightning-bolt mark, made in Illustrator.
This replaced an earlier hand-built placeholder design — everything below
reflects the current files.

| File | Use |
|---|---|
| `chargeroute-icon.ai` / `.svg` | Source icon mark — yellow bolt, transparent background. Edit this in Illustrator. |
| `chargeroute-icon-1024.png` | Raw Illustrator export of the mark, trimmed tight to the artwork (not square — 458×798). Not meant for use as an app icon directly. |
| `chargeroute-icon-square-1024.png` | **App icon master** — the mark centered in a full-bleed square with the brand yellow background and white bolt (matches `store-assets/listing/playstore-icon-512.svg`, the source of truth for the Play Store icon). This is what's used to generate the Android launcher icons and the Play Store listing icon. |
| `chargeroute-logo-primary.ai` / `.svg` / `.png` | Primary horizontal lockup (mark + "ChargeRoute" wordmark), all in brand yellow on a transparent background — for placing on dark or colored surfaces. Edit the `.ai` in Illustrator. |
| `chargeroute-logo-reversed.png` | Lockup on the app's green brand gradient (`#22C55E` → `#16A34A` → `#15803D`) — generated from `chargeroute-logo-primary.svg`, for use on light/white surfaces where the transparent-background primary lockup wouldn't have contrast. |

## Where this logo is actually used

- **App icon** (Android launcher, all densities + round variant): generated
  from `chargeroute-icon-square-1024.png` → `android/app/src/main/res/mipmap-*/`
- **Play Store icon (512×512)**: `store-assets/listing/playstore-icon-512.png`,
  sourced directly from `store-assets/listing/playstore-icon-512.svg` (also
  made in Illustrator — `.ai` source alongside it)
- **Feature graphic (1024×500)**: `store-assets/listing/feature-graphic.png`
  — rounded-square icon badge + wordmark, regenerate if the icon changes
- **In-app header**: `src/assets/images/chargeroute-mark.png` (small
  transparent PNG of just the bolt, used next to the "ChargeRoute" text on
  the Route Planner screen header)

## Editing

Open any `.ai` file directly in Illustrator — that's the actual source of
truth now. The `.svg` exports next to each `.ai` are Illustrator's SVG
export of the same artwork, used to regenerate the PNG/app-icon derivatives
(there's no separate hand-maintained SVG anymore).

If you change the mark or wordmark in Illustrator, re-export the `.svg`
over the existing file and say so — the app icon, launcher icons, feature
graphic, and in-app header image all need to be regenerated from it (that's
a scripted rebuild, not a manual re-export per asset).
