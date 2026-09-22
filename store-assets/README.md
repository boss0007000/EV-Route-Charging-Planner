# store-assets

Everything for the Play Store listing and marketing, grouped by purpose.

```
store-assets/
├── listing/            Play Store listing: icon, screenshots, listing copy
│   ├── PLAY_STORE_LISTING.md
│   ├── icon-source.svg
│   ├── icon-master-1024.png
│   ├── playstore-icon-512.png
│   ├── 1-route-planner.png
│   └── 2-charger-map.png
│
└── ads/                Marketing creative, not for the store listing itself
    ├── social-uk/          Real app screenshots — UK route (Manchester → Edinburgh)
    ├── social-sri-lanka/   Real app screenshots — Sri Lanka route (Colombo → Trincomalee)
    └── video/
        └── chargeroute_sri_lanka_ad.mp4   15.5s vertical (1080×1920) animated ad
```

## `listing/`
What actually gets uploaded to Google Play Console. See `PLAY_STORE_LISTING.md`
for the exact copy, content-rating answers, and Data Safety form answers.

## `ads/social-uk/` and `ads/social-sri-lanka/`
Raw phone screenshots (1080×2400) from real, working runs of the app —
each folder is a self-contained set from one real route, meant to be fed
into the Figma ad-builder plugin (`figma-plugin/`) to produce social ad
frames (feed / story / landscape).

## `ads/video/`
`chargeroute_sri_lanka_ad.mp4` — a 15.5s vertical video ad for the Sri
Lanka launch (WhatsApp status, Instagram/Facebook Reels & Stories, EV
community Facebook groups). Built from real screenshots (Colombo →
Trincomalee route, actual Ceylon Electricity Board charging stop, real
LKR pricing) with Ken Burns motion and crossfade transitions — not
narrated, no captions burned in beyond what's shown, silent-friendly.

Source scenes (HTML) live in the session scratchpad, not the repo — say
the word if you want the video re-cut with different copy/pacing and I'll
rebuild it from there.
