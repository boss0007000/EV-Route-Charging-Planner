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
        ├── chargeroute_sri_lanka_ad.mp4          15.5s vertical (1080×1920) — motion-graphic ad, static screenshots + Ken Burns + copy
        └── chargeroute_walkthrough_sri_lanka.mp4 48.9s vertical (1080×2400) — real screen recording of the app in use, captioned
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
Two different videos, for two different jobs:

- **`chargeroute_sri_lanka_ad.mp4`** (15.5s) — a motion-graphic ad: static
  screenshots + brand copy + Ken Burns pans + crossfades. Best for a feed
  ad / sponsored post where you want a punchy pitch.
- **`chargeroute_walkthrough_sri_lanka.mp4`** (48.9s) — a real screen
  recording of the actual app running on a device: picking a Nissan Leaf,
  typing Colombo → Trincomalee, watching it calculate, the route drawing
  itself on the real Google map, and the real Ceylon Electricity Board
  stop with real LKR pricing. Captioned, crossfaded intro/CTA bookends.
  Best for "watch it actually work" — community group posts, replies to
  "does this really work here?", or anywhere skepticism needs proof over
  a pitch.

Both are silent (no narration/music) — safe for autoplay/muted feeds.
Source scenes (HTML) and the raw screen recording live in the session
scratchpad, not the repo — say the word if you want either re-cut with
different copy, pacing, or a different route/vehicle and I'll rebuild
from there.
