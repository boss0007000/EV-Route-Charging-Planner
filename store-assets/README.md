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
        ├── chargeroute_walkthrough_sri_lanka.mp4 48.9s vertical (1080×2400) — real screen recording of the app in use, captioned
        └── chargeroute_3d_sri_lanka.mp4          18.0s vertical (1080×2400) — stylized 3D motion-graphic ad: tilted 3D phone mockups, a 3D map with the route drawing itself and a charging pin popping up, glossy 3D logo/CTA
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
Three different videos, for three different jobs:

- **`chargeroute_sri_lanka_ad.mp4`** (15.5s) — a flat motion-graphic ad:
  static screenshots + brand copy + Ken Burns pans + crossfades. Punchy,
  simple, cheap to reskin.
- **`chargeroute_walkthrough_sri_lanka.mp4`** (48.9s) — a real screen
  recording of the actual app running on a device: picking a Nissan Leaf,
  typing Colombo → Trincomalee, watching it calculate, the route drawing
  itself on the real Google map, and the real Ceylon Electricity Board
  stop with real LKR pricing. Captioned, crossfaded intro/CTA bookends.
  Best for "watch it actually work" — proof over pitch.
- **`chargeroute_3d_sri_lanka.mp4`** (18.0s) — the "fancy" version: a
  stylized 3D motion-graphic spot. 3D-tilted phone mockups (real app
  screenshots on the screen face) float in with perspective and glow; a
  3D tilted map card draws the Colombo → Trincomalee route stroke-by-
  stroke, the Dambulla charging pin pops up with a pulse ring, and a
  charging-stop info card flies in; closes on a glossy 3D logo spin and a
  bouncing "Get it on Google Play" button. Built frame-by-frame from CSS
  3D transforms (perspective + rotateX/Y/Z + translateZ), not WebGL —
  each frame independently computed from a time value and rendered via
  headless Chromium, then assembled into 30fps clips and crossfaded.

All three are silent (no narration/music) — safe for autoplay/muted feeds.
Source scenes (HTML) and rendered frame sequences live in the session
scratchpad, not the repo — say the word if you want any of them re-cut
with different copy, pacing, or a different route/vehicle and I'll
rebuild from there.
