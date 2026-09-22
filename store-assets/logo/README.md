# ChargeRoute logo

Hand-built vector logo (not a raster trace) — fully editable in Illustrator,
Figma, Inkscape, or any SVG-capable tool. Colors and typeface match the app
exactly: brand green gradient (`#22C55E` → `#16A34A` → `#15803D`) from
`src/constants/colors.ts`, and Inter (the app's actual UI font) for the
wordmark.

| File | Use |
|---|---|
| `chargeroute-logo-primary.svg` / `.png` | Primary lockup, dark wordmark on white — default usage |
| `chargeroute-logo-reversed.svg` / `.png` | Reversed lockup, white wordmark — for dark/green backgrounds |
| `chargeroute-icon.svg` / `chargeroute-icon-1024.png` | Icon mark alone, 1024×1024, full-bleed — app icon / favicon source |

## Editing
Open any `.svg` directly in Illustrator (File → Open). Each file has named
groups (`background`, `mark`, `wordmark`) so the mark and text can be
recolored or repositioned independently. The bolt icon is a single closed
vector path, not a font glyph or embedded image.

## Why SVG instead of a native Adobe Express document
I tried exporting this as an editable Adobe Express project first (so it'd
open directly in Express with live text/shape layers), but that operation
returned an entitlement error — `export_html_to_express` needs a higher
Adobe plan tier than this account currently has, and so does the font
look-up step (`find_fonts`) that precedes it. Hand-built SVG is the most
genuinely editable format achievable without that tier — it's already a
clean vector, not a trace of a raster image. If you upgrade the Adobe
account, say so and I'll redo the export straight into Express.
