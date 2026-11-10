# CrowdKart

**Order individually. Discover collectively. Deliver intelligently.**

CrowdKart is a privacy-first group-ordering app. When neighbours order from any nearby store or restaurant within a few minutes of each other, CrowdKart groups the orders anonymously. **One rider then collects from every store and drops each order at its door in a single trip**, and everyone pays a smaller share of the delivery fee.

## Real data, no demo locations

| What | Source | Key needed? |
| --- | --- | --- |
| Your delivery location | Device GPS ("Use my current location") or typed address search, with a draggable pin to fine-tune | No |
| Address search and reverse geocoding | Google Geocoding if `GOOGLE_MAPS_API_KEY` is set, otherwise OpenStreetMap Nominatim | Optional |
| Stores and restaurants near you (name, type, cuisine, location, address, hours, phone, rating) | OpenStreetMap always, plus every provider you add a key for: **TomTom** (`TOMTOM_API_KEY`, free, no card), **Ola Maps** (`OLA_MAPS_API_KEY`, India), **Google Places** (`GOOGLE_MAPS_API_KEY`). Results are merged and de-duplicated. Check yours with `npm run check:places -w server`. | Optional |
| Delivery time and distance per store | Real road travel time from OSRM, plus the store's prep time | No |
| Rider route on the map | OSRM road geometry | No |
| Products | Each real store gets the full range for its type (150 products: fruits, vegetables, dairy, staples, snacks, household, restaurant dishes by cuisine, pharmacy, stationery, electronics, clothing) with **real photos** bundled in `client/public/products` (from Wikipedia / Wikimedia Commons, sources in `credits.json`; re-download with `node tools/fetch-product-images.mjs`). Store owners edit products, prices, pack sizes and photos in Merchant → Products. | n/a |

> No public API provides live menus or stock for arbitrary local shops (Swiggy and Zomato don't offer one). Store menus therefore come from the merchant, who claims their real store in the app.

OpenStreetMap coverage in Indian towns can be thin. Adding a Google Maps key (Places API (New) + Geocoding API) gives far more stores, plus ratings and "open now".

## Features

- **Neighbour matching.** Orders are grouped when homes are within about 600 m and the orders fall in the same time window. Matching uses a weighted score of location, time, store, route and saving, computed only on anonymous, coarsened signals.
- **One rider, many stores.** CrowdRoute plans pickups (hot food last) and then each drop. It splits across riders when stores are too far apart, and never groups orders when grouping wouldn't actually save money.
- **Live tracking.** Each customer sees the rider, their own store and their own door, with a personal status such as "picking up your order", "2 drops before yours" or "heading to you".
- **Two ways to pay.** Pay for my order, or pay for everyone in one payment. PayPal Orders API v2 is used when keys are set; otherwise payments run in test mode.
- **Privacy.** Neighbours only ever see a random nickname. No names, items, stores, addresses or payment status are shared, and area activity is hidden below 2 people.
- **Merchant Connect.** Claim your real store, see incoming group orders, edit your menu, and view rounded demand nearby.

## Promo codes

Set `PROMO_CODES=WELCOME10:10,CROWD15:15` in `server/.env` (code:percent off). Customers apply them in the cart.

## Run it

```bash
npm install
npm run build
npm start            # http://localhost:4000
```

Development: `npm run dev` (client on :5173, API on :4000). Tests: `npm test -w server` (these run offline against a fixture).

Keys are optional. Copy `server/.env.example` to `server/.env` and fill in what you need: `GOOGLE_MAPS_API_KEY`, `AI_API_KEY` (router.bynara.id), and `PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET`.

## Apps

| Platform | Build | Output |
| --- | --- | --- |
| Windows | `npm run desktop:dist` | `desktop/release/CrowdKart Setup 1.0.0.exe`, `CrowdKart 1.0.0.exe` (portable) |
| macOS / Linux | `npm run build && npm run dist:mac -w desktop` / `dist:linux` (on that OS) | `.dmg` / `.AppImage`, `.deb` |
| Android | `npm run mobile:sync` then `cd client/android && gradlew assembleDebug` | `client/android/app/build/outputs/apk/debug/app-debug.apk` |
| iOS | On a Mac: `npm run mobile:sync`, then open `client/ios/App` in Xcode | |
| All platforms on CI | GitHub Actions workflow `.github/workflows/build-apps.yml` | Downloadable artifacts |

- **Desktop apps** run the server inside the app, so they work standalone. To use a shared server, set `CROWDKART_SERVER=https://…` or put the URL in `server.txt` in the app data folder.
- **The phone app** needs a reachable server. Host it (Render blueprint in `render.yaml`), or run `npm start` on your PC and enter `http://<PC-IP>:4000` under *Connection settings* on the sign-in screen (same Wi-Fi). You can also bake the URL in at build time with `VITE_API_URL=https://… npm run mobile:sync`.

## Notes

- Rider movement on the map is simulated along the real road route until a rider app or delivery-partner API is connected.
- The data store is a JSON document store whose collections mirror the planned MongoDB schema (`users`, `merchants`, `orders`, `orderSignals`, `groups`, `payments`, `deliveries`, `savings`).

## License

CrowdKart's source code is released under the [MIT License](LICENSE): free to use, copy, modify and distribute, including commercially, as long as the copyright notice is kept.

Product photos, map data and other third-party content keep their own licences. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
