# Third-party notices

CrowdKart's own source code is released under the MIT License (see `LICENSE`).
The data, images and services below are **not** covered by that licence. They belong to
their respective owners and are used under their own terms.

## Content bundled in this repository

| What | Where | Source and licence |
| --- | --- | --- |
| Product photos (150 images) | `client/public/products/*.jpg` | Wikipedia / Wikimedia Commons contributors. Each image keeps its own licence (mostly CC BY-SA, CC BY or public domain). The source page for every image is listed in `client/public/products/credits.json`. If you redistribute these photos, follow the licence shown on each image's Commons page. |
| Fonts (Poppins) | via `@fontsource/poppins` | SIL Open Font License 1.1 |
| Icons | via `lucide-react` | ISC License |

## Data and services used at runtime (not bundled)

| Service | Used for | Terms |
| --- | --- | --- |
| OpenStreetMap (map tiles, Overpass, Nominatim) | Map, nearby shops, address search | Data © OpenStreetMap contributors, Open Database License (ODbL). Attribution is shown on every map. Public servers have usage policies; heavy use needs your own servers. |
| OSRM public demo server | Road routes and travel times | Demo server for light use; host your own OSRM for production. |
| Open Food Facts | Branded product data and pack photos | Database: ODbL. Images: CC BY-SA. Attribution is shown in search and brand results. |
| TomTom Search API | Nearby shops (optional key) | TomTom developer terms. |
| Ola Maps | Nearby shops (optional key) | Ola Krutrim terms. |
| Google Maps Platform | Places and geocoding (optional key) | Google Maps Platform terms. Data may not be cached or stored beyond what those terms allow. |
| Razorpay, PayPal | Payments (optional keys) | Their merchant agreements. |
| router.bynara.id | AI text (optional key) | Provider terms. |

## Open-source packages

Dependencies installed through npm (React, Vite, Tailwind CSS, Leaflet, react-leaflet,
Express, Socket.IO, Electron, Capacitor and others) are distributed under their own licences,
mostly MIT, BSD, ISC or Apache-2.0. Run `npx license-checker --summary` in the project folder
for a full list.
