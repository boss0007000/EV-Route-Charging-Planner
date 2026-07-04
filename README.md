# EV Route & Charging Planner

**ChargeRoute** — Plan your EV journey with smart charging stop recommendations.

## Features
- **Route Planning** — Enter start/destination, vehicle, battery level to get a route with charging stops
- **Charger Map** — Browse nearby EV chargers with real-time filtering
- **Vehicle Database** — 20+ EVs with accurate range/efficiency data
- **Smart Caching** — Geo-tile caching for Open Charge Map data (24-48h TTL)
- **Google Maps Integration** — Deep-link to native Google Maps with all waypoints

## Tech Stack
- **React Native** (iOS + Android shared codebase)
- **TypeScript** (strict mode)
- **SQLite** — local vehicle DB + charger cache
- **Google Maps Directions & Places API** — routing + autocomplete
- **Open Charge Map API** — charger data

## Project Structure
```
src/
├── screens/
│   ├── RoutePlanner/     # Screen 1: plan a journey
│   ├── ChargerMap/       # Screen 2: browse chargers
│   ├── Settings/         # Reserve %, charge targets
│   └── Admin/            # Vehicle database entry tool
├── components/
│   ├── VehicleSelector/
│   ├── LocationInput/
│   ├── BatterySlider/
│   ├── ChargerCard/
│   └── RouteResultCard/
├── services/
│   ├── googleMaps.ts
│   ├── openChargeMap.ts
│   ├── routeCalculation.ts
│   └── chargingCalculation.ts
├── database/
│   ├── schema.ts
│   ├── vehicleDb.ts
│   └── chargerCache.ts
├── utils/
│   ├── rangeCalculations.ts
│   ├── geoTileCache.ts
│   └── deepLinking.ts
├── types/index.ts
└── constants/config.ts
```

## Getting Started

### Prerequisites
- Node.js 18+
- React Native CLI
- Android Studio (Android) / Xcode (iOS)
- Google Maps API key (Directions + Places)
- Open Charge Map API key

### Installation
```bash
npm install
# iOS
cd ios && pod install
# Android
npx react-native run-android
```

### API Keys
Copy `.env.example` to `.env` and fill in your keys:
```
GOOGLE_MAPS_API_KEY=your_key_here
OPEN_CHARGE_MAP_API_KEY=your_key_here
```

## Architecture Notes

### Units
All efficiency values use **Wh/km** consistently throughout the app and database.

### Range Calculation
```
usable_range_km = (battery_percent / 100 × usable_capacity_kWh × 1000) / efficiency_wh_per_km
buffered_range_km = usable_range_km × 0.90   // 10% safety buffer
```

### Charging Decision
- If `buffered_range ≥ route_distance`: no charging stop needed
- Else: find point on route where battery reaches reserve%, query Open Charge Map for compatible chargers nearby

### Geo-Tile Caching
Map divided into 0.1° grid tiles. Tiles cached in SQLite with 24-48h TTL. Only missing/expired tiles are fetched from Open Charge Map API on map pan.

### Route Settings (Defaults)
| Setting | Default |
|---|---|
| Reserve battery % | 15% |
| Min arrival battery % | 10% |
| Max charge target % | 80% |
| Min charger power (kW) | 22 kW |
| Charger cache TTL | 24 hours |

## Vehicle Database

The app ships with 20+ pre-populated EVs. New vehicles can be added via the in-app Admin screen (accessible from Settings).

### Admin Tool
- Web-based companion tool: `cd admin && npm install && npm start`
- Exports JSON that can be bundled with the app or imported at runtime

## Out of Scope (v1)
- Multi-destination / multi-day trips
- Real-time traffic re-routing
- In-app charger payment
- Social features / trip sharing
- Eco/Normal/Aggressive driving mode presets (manual Wh/km entry only)