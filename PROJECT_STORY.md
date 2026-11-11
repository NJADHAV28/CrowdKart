# CrowdKart — Project Story

> **Order from any shop near you, share one rider with your neighbours, and pay less, privately.**

## Inspiration

In the hostels and housing societies around our college, we kept seeing the same thing: at 8 pm, three or four delivery riders pull up at the **same gate**, minutes apart, each carrying one small order. Someone ordered pizza, someone ordered groceries, someone ordered a phone charger. Each person paid a full delivery fee, and each rider made a full trip for one bag.

The demand was already there, at the same place and the same time. Nobody could **see** it, and nobody wanted strangers to see what they were ordering. That gave us the idea behind **CrowdKart**:

> Make collective demand visible without making individual shopping behaviour visible.

## What it does

CrowdKart is a quick-commerce app with a twist: **neighbours who order at the same time share one rider.**

- **Real shops, real locations.** You set your address by GPS or by typing it. CrowdKart loads the actual restaurants, kirana stores, bakeries, pharmacies and shops around you, with delivery times from real road travel times.
- **One cart, many shops.** Add bread from a bakery, milk from a kirana and medicine from a pharmacy, up to 25 items. Branded products like Lay's or Amul are routed automatically to the nearest shop that delivers to you.
- **Anonymous neighbour matching.** When people nearby order within a few minutes of each other, they're grouped. Nobody in the group sees anyone else's name, address or items, only a random nickname like *"Teal Otter"*.
- **One rider, every shop, one trip.** Our planner (*CrowdRoute*) picks up from every shop, saves hot food for last, and drops at each door. Everyone pays a smaller share of the delivery fee.
- **Pay your way.** UPI, cards and wallets through Razorpay. You can pay for just your order, or pay for the whole group, which is handy for flatmates.
- **Live tracking on real roads.** You follow your rider along the actual road route to your door.
- **Three apps in one.** A customer app, a **delivery-partner panel** (go online, receive jobs, see pickup items and drop details, navigate, mark picked up and delivered), and a **merchant dashboard** (incoming orders, menu editing, nearby demand).

## How we built it

**Stack:** React + Vite + Tailwind CSS on the frontend, Node.js + Express + Socket.IO on the backend, and Leaflet maps. The same code ships as a website (PWA), a desktop app (Electron) and Android/iOS apps (Capacitor).

**Live data:**

- Shops come from **OpenStreetMap (Overpass)**, **TomTom Search** and **Google Places**, merged and de-duplicated.
- Addresses come from **Nominatim / Google Geocoding**.
- Road routes and travel times come from **OSRM**.
- Branded products and pack photos come from **Open Food Facts**.
- Catalogue photos come from **Wikimedia Commons**.

**The matching score.** Each new order is compared with open groups nearby. For a pair of orders we compute a weighted compatibility score:

$$
S = 0.25\,L + 0.20\,T + 0.25\,M + 0.15\,D + 0.15\,E
$$

where $L$ is location closeness, $T$ is time-window overlap, $M$ is merchant compatibility (same shop, same type, or close enough for one rider), $D$ is drop-off proximity, and $E$ is the economic benefit. Each term is scaled to $[0, 100]$. For example, the time term decays linearly after five minutes:

$$
T = \begin{cases} 100, & \Delta t \le 5 \text{ min} \\[4pt] \max\!\left(0,\; 100 - \dfrac{\Delta t - 5}{25}\cdot 100\right), & \text{otherwise} \end{cases}
$$

An order joins the best group with $S \ge 60$, provided the hard rules also pass: homes within about 600 m, shops within 4 km of each other, and the group not full. Otherwise it starts a new group.

**Fair cost sharing.** If the group's rider trip costs $C$ and $n$ people share it, each person normally pays $C/n$. But nobody should ever pay **more** than ordering alone. If any equal share $C/n$ exceeds that person's solo delivery fee $s_i$, we switch to a proportional split:

$$
\text{share}_i = C \cdot \frac{s_i}{\sum_{j=1}^{n} s_j}
\qquad\Rightarrow\qquad
\text{share}_i \le s_i \;\text{ whenever }\; C \le \sum_j s_j
$$

The planner also refuses to group orders at all when one shared trip wouldn't actually be cheaper than separate deliveries.

**Privacy by architecture.** Private orders and anonymous matching signals live in separate collections. Signals carry only a location rounded to about 110 m, a shop ID and a time window, with no user ID and no items. Area activity is shown only in grid cells of about 650 m, and never when fewer than 2 people are ordering. Each customer's tracking map shows only *their own* leg of the route, so you can't infer where your neighbours live.

## Challenges we faced

- **"Real data" is harder than it sounds.** OpenStreetMap had only a handful of shops mapped around Sangli, and the public Overpass servers were frequently overloaded. We query several mirrors in parallel, retry with smaller areas, and cache results. Adding TomTom took us from **9 to over 1,000 real places within 5 km**.
- **Rate limits everywhere.** TomTom's free tier rejected most of our requests when we sent 13 at once. We built a paced request queue with retries. Open Food Facts sometimes returned `503`, so we added retries plus a fallback to their newer search service.
- **No public API has live menus or prices.** Branded products have no prices in Open Food Facts. We use the MRP printed in the product name when it exists, and otherwise estimate from pack size and product type, clearly marked **≈** so the shop confirms the final price. Merchants can edit their real menus in the dashboard.
- **Matching photos to products.** Automatically pulled images were sometimes chemical diagrams, logos or old paintings. We reviewed all 150 on a contact sheet and replaced the wrong ones.
- **Multi-shop carts broke our data model.** We first assumed one person = one order per group. Supporting several shops in one checkout meant reworking billing, payments and delivery stops, and merging same-door drops so the rider doesn't "deliver twice" to one flat.
- **Privacy versus a useful map.** Showing the rider's full route would reveal neighbours' addresses. We settled on showing each customer only the road route from the rider to *their* shop and door.

## What we learned

- How to design a system where **privacy is part of the data model**, not a settings toggle.
- That real-world APIs are messy: rate limits, outages, missing fields. Caching, fallbacks and honest labelling (≈ prices, "estimated" vs. "confirmed" savings) matter as much as features.
- Practical geospatial work: haversine distances, road routing with OSRM, grid-based aggregation, and nearest-neighbour route ordering.
- That one codebase can reach web, desktop and mobile when the frontend is built mobile-first and responsive from day one.

## What's next

- Real-time stock and prices directly from partner shops.
- A rider app with background GPS and smarter batching across multiple riders.
- Going live with Razorpay and onboarding shops in our own neighbourhood around Walchand College, Sangli.
