// Live stores & restaurants near a location, plus real road travel times.
// Providers: Google Places (New) when GOOGLE_MAPS_API_KEY is set, otherwise OpenStreetMap Overpass.
import fs from 'node:fs';
import { config } from './config.js';
import { tomtom, ola } from './providers.js';
import { col } from './store.js';
import { haversineKm, cellOf } from './geo.js';
import { buildMenu, menuKind, prepFor, CATALOG_VERSION } from './catalog.js';

const areaCache = new Map(); // area key -> fetchedAt
const etaCache = new Map(); // userCell|storeId -> { km, min, at }
const inflight = new Map();
const AREA = 0.02; // ~2 km fetch tiles

const GROUP_DISCOUNT = [{ minOrders: 2, pct: 5 }, { minOrders: 3, pct: 8 }, { minOrders: 5, pct: 12 }];

async function fetchJson(url, opts = {}, ms = 25000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const res = await fetch(url, { ...opts, headers: { 'User-Agent': config.places.userAgent, ...(opts.headers || {}) }, signal: ctl.signal });
    if (!res.ok) throw new Error(`${new URL(url).host} ${res.status}`);
    return await res.json();
  } finally { clearTimeout(t); }
}

// ---------- OpenStreetMap / Overpass ----------
const SHOP_CAT = {
  supermarket: 'grocery', convenience: 'grocery', greengrocer: 'grocery', general: 'grocery', department_store: 'grocery', dairy: 'grocery', kiosk: 'grocery',
  butcher: 'grocery', seafood: 'grocery', beverages: 'grocery', deli: 'grocery', frozen_food: 'grocery', farm: 'grocery', health_food: 'grocery',
  variety_store: 'grocery', wholesale: 'grocery', spices: 'grocery', water: 'grocery', mall: 'grocery',
  bakery: 'food', confectionery: 'food', pastry: 'food', chocolate: 'food',
  chemist: 'pharmacy', medical_supply: 'pharmacy', cosmetics: 'pharmacy', herbalist: 'pharmacy', optician: 'pharmacy',
  stationery: 'stationery', books: 'stationery', copyshop: 'stationery', gift: 'stationery', toys: 'stationery',
  electronics: 'electronics', mobile_phone: 'electronics', computer: 'electronics', hardware: 'electronics', electrical: 'electronics', appliance: 'electronics',
  clothes: 'fashion', shoes: 'fashion', boutique: 'fashion', tailor: 'fashion', fabric: 'fashion', bag: 'fashion', jewelry: 'fashion', sports: 'fashion',
};
const TOURISM_CAT = { hotel: 'hotel', guest_house: 'hotel', hostel: 'hotel', motel: 'hotel', apartment: 'hotel' };
const AMENITY_CAT = { restaurant: 'food', fast_food: 'food', cafe: 'food', ice_cream: 'food', food_court: 'food', canteen: 'food', juice_bar: 'food', pharmacy: 'pharmacy', chemist: 'pharmacy' };

async function overpass(loc, radiusM) {
  try {
    return await overpassQuery(loc, radiusM);
  } catch (e) {
    // Public servers are often overloaded: retry once with a lighter query (smaller area).
    if (radiusM <= 3500) throw e;
    console.warn('[places] OpenStreetMap busy, retrying with a smaller area');
    return overpassQuery(loc, 3500);
  }
}

async function overpassQuery([lat, lng], radiusM) {
  const shops = Object.keys(SHOP_CAT).join('|');
  const amen = Object.keys(AMENITY_CAT).join('|');
  const q = `[out:json][timeout:25];(nwr(around:${radiusM},${lat},${lng})["amenity"~"^(${amen})$"]["name"];nwr(around:${radiusM},${lat},${lng})["shop"~"^(${shops})$"]["name"];nwr(around:${radiusM},${lat},${lng})["tourism"~"^(${Object.keys(TOURISM_CAT).join('|')})$"]["name"];);out center 800;`;
  // Race every mirror; the first good answer wins (public Overpass servers are often slow or blocked).
  const j = await Promise.any(config.places.overpassUrls.map((url) => fetchJson(url, {
    method: 'POST', body: `data=${encodeURIComponent(q)}`, headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  }, 45000).then((r) => { if (!Array.isArray(r.elements)) throw new Error('bad response'); return r; })));
  return j.elements.map((e) => {
    const t = e.tags || {};
    const category = AMENITY_CAT[t.amenity] || SHOP_CAT[t.shop] || TOURISM_CAT[t.tourism];
    const cuisine = t.cuisine || (t.amenity === 'cafe' ? 'cafe' : t.amenity === 'ice_cream' ? 'ice_cream' : t.shop === 'bakery' || t.shop === 'confectionery' ? 'bakery' : '');
    const location = e.type === 'node' ? [e.lat, e.lon] : e.center ? [e.center.lat, e.center.lon] : null;
    const street = [t['addr:housenumber'], t['addr:street']].filter(Boolean).join(' ');
    return location && category && {
      id: `osm_${e.type[0]}${e.id}`, source: 'osm', name: t.name, category, cuisine, location,
      address: street || t['addr:suburb'] || t['addr:city'] || '',
      openingHours: t.opening_hours || null, phone: t.phone || t['contact:phone'] || null,
    };
  }).filter(Boolean);
}

// ---------- Google Places (New) ----------
// Google returns at most 20 places per request, so each category is split into several requests.
const G_TYPES = [
  ['food', ['restaurant']],
  ['food', ['indian_restaurant', 'vegetarian_restaurant', 'chinese_restaurant']],
  ['food', ['fast_food_restaurant', 'pizza_restaurant', 'hamburger_restaurant', 'sandwich_shop']],
  ['food', ['cafe', 'coffee_shop', 'tea_house', 'juice_shop']],
  ['food', ['bakery', 'dessert_shop', 'ice_cream_shop', 'confectionery']],
  ['grocery', ['grocery_store', 'supermarket']],
  ['grocery', ['convenience_store', 'market', 'food_store']],
  ['pharmacy', ['pharmacy', 'drugstore']],
  ['electronics', ['electronics_store', 'cell_phone_store', 'hardware_store']],
  ['fashion', ['clothing_store', 'shoe_store', 'jewelry_store']],
  ['stationery', ['book_store', 'gift_shop']],
  ['hotel', ['lodging']],
];
async function google([lat, lng], radiusM) {
  const out = [];
  const results = await Promise.allSettled(G_TYPES.map(([category, includedTypes]) => fetchJson('https://places.googleapis.com/v1/places:searchNearby', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': config.places.googleKey,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.location,places.primaryType,places.types,places.rating,places.userRatingCount,places.currentOpeningHours.openNow,places.shortFormattedAddress,places.nationalPhoneNumber,places.businessStatus',
      },
      body: JSON.stringify({ includedTypes, maxResultCount: 20, rankPreference: 'DISTANCE', locationRestriction: { circle: { center: { latitude: lat, longitude: lng }, radius: radiusM } } }),
    }).then((j) => ({ category, j }))));
  const failed = results.filter((r) => r.status === 'rejected');
  if (failed.length === results.length) throw failed[0].reason;
  for (const r of results) {
    if (r.status !== 'fulfilled') continue;
    const { category, j } = r.value;
    for (const p of j.places || []) {
      if (p.businessStatus && p.businessStatus !== 'OPERATIONAL') continue;
      out.push({
        id: `g_${p.id}`, source: 'google', name: p.displayName?.text, category, cuisine: (p.primaryType || '').replace(/_restaurant|_shop|_store/g, ''),
        location: [p.location.latitude, p.location.longitude], address: p.shortFormattedAddress || '',
        rating: p.rating || null, ratingCount: p.userRatingCount || null, openNow: p.currentOpeningHours?.openNow ?? null, phone: p.nationalPhoneNumber || null,
      });
    }
  }
  return out;
}

/** Every configured provider in parallel, plus OpenStreetMap. Succeeds if any one works. */
export async function fetchAllProviders(loc, radiusM) {
  const jobs = [['openstreetmap', () => overpass(loc, radiusM)]];
  if (config.places.googleKey) jobs.push(['google', () => google(loc, Math.min(radiusM, 50000))]);
  if (config.places.olaKey) jobs.push(['ola', () => ola(loc, radiusM)]);
  if (config.places.tomtomKey) jobs.push(['tomtom', () => tomtom(loc, radiusM)]);
  const results = await Promise.allSettled(jobs.map(([, fn]) => fn()));
  const out = [];
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') { out.push(...r.value); lastRun[jobs[i][0]] = { ok: true, count: r.value.length, at: Date.now() }; }
    else { lastRun[jobs[i][0]] = { ok: false, error: r.reason?.message, at: Date.now() }; console.warn(`[places] ${jobs[i][0]} failed:`, r.reason?.message); }
  });
  if (!out.length && results.every((r) => r.status === 'rejected')) throw results[0].reason;
  return out;
}
export const lastRun = {};

function fixture() {
  return JSON.parse(fs.readFileSync(config.places.fixture, 'utf8'));
}

function upsert(raw) {
  const existing = col('merchants').get(raw.id);
  if (raw.category === 'hotel') {
    // Hotels / lodging are shown on the map but don't take delivery orders.
    const doc = { ...raw, kind: 'hotel', items: [], acceptsGroupOrders: false, menuSource: 'none', prepMin: 0 };
    if (existing) col('merchants').update(raw.id, doc); else col('merchants').insert({ ...doc, createdAt: Date.now() });
    return;
  }
  const kind = menuKind(raw.category, raw.cuisine, raw.name);
  if (existing) {
    // Never overwrite a menu the merchant edited.
    const stale = existing.menuSource === 'catalogue' && existing.catalogVersion !== CATALOG_VERSION;
    col('merchants').update(raw.id, { ...raw, kind, items: stale ? buildMenu(raw.id, kind) : existing.items, catalogVersion: stale ? CATALOG_VERSION : existing.catalogVersion, menuSource: existing.menuSource, groupDiscount: existing.groupDiscount, prepMin: existing.prepMin });
    return;
  }
  col('merchants').insert({
    ...raw, kind, prepMin: prepFor(kind), acceptsGroupOrders: true, groupDiscount: GROUP_DISCOUNT,
    items: buildMenu(raw.id, kind), menuSource: 'catalogue', catalogVersion: CATALOG_VERSION, createdAt: Date.now(),
  });
}

/** Stores that can actually take a delivery order (hotels/lodging are view-only). */
export const deliverable = (m) => m.category !== 'hotel' && m.items?.length > 0;

/** Link to the place on Google Maps (works without any API key). */
export function googleMapsUrl(m) {
  const q = encodeURIComponent(`${m.name} ${m.address || ''}`.trim());
  if (m.source === 'google') return `https://www.google.com/maps/search/?api=1&query=${q}&query_place_id=${m.id.slice(2)}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(m.name)}%20${m.location[0]},${m.location[1]}`;
}

/** Ensure live places around `loc` are loaded, then return stores within the delivery radius. */
export async function nearbyStores(loc, radiusKm = config.places.radiusKm) {
  const key = `${Math.round(loc[0] / AREA)}:${Math.round(loc[1] / AREA)}`;
  const fresh = areaCache.get(key) && Date.now() - areaCache.get(key) < config.places.cacheMin * 60000;
  if (!fresh) {
    if (!inflight.has(key)) {
      const p = (async () => {
        const radiusM = Math.round((radiusKm + 1) * 1000);
        const list = config.places.fixture ? fixture() : await fetchAllProviders(loc, radiusM);
        const seen = new Set();
        for (const r of list) {
          if (!r.name || seen.has(r.id)) continue;
          seen.add(r.id);
          upsert(r);
        }
        areaCache.set(key, Date.now());
      })().finally(() => inflight.delete(key));
      inflight.set(key, p);
    }
    const cached = col('merchants').find((m) => haversineKm(m.location, loc) <= radiusKm);
    // Serve saved places instantly only if we already have a decent list; otherwise wait for the fresh one.
    if (cached.length >= 25) {
      // Stale-while-revalidate: answer instantly from saved stores, refresh in the background.
      inflight.get(key)?.catch((e) => console.warn('[places] background refresh failed:', e.message));
      return dedupe(cached);
    }
    try {
      await inflight.get(key);
    } catch (e) {
      console.warn('[places] provider failed:', e.message);
      if (cached.length) return dedupe(cached);
      throw Object.assign(new Error('Could not load stores near you right now. Please try again in a moment.'), { status: 503 });
    }
  }
  return dedupe(col('merchants').find((m) => haversineKm(m.location, loc) <= radiusKm));
}

// OpenStreetMap often maps the same shop twice (a point and a building). Keep one.
function dedupe(list) {
  const norm = (n) => n.toLowerCase().replace(/[^a-z0-9]/g, '');
  const out = [];
  for (const m of [...list].sort((a, b) => (b.address ? 1 : 0) - (a.address ? 1 : 0))) {
    if (!out.some((x) => norm(x.name) === norm(m.name) && haversineKm(x.location, m.location) < 0.2)) out.push(m);
  }
  return out;
}

/** Real road distance/time from each store to the customer (OSRM table), cached per ~650 m cell. */
export async function travelTimes(userLoc, stores) {
  const cell = cellOf(userLoc);
  const out = new Map();
  const missing = [];
  for (const s of stores) {
    const c = etaCache.get(`${cell}|${s.id}`);
    if (c && Date.now() - c.at < 30 * 60000) out.set(s.id, c);
    else missing.push(s);
  }
  for (let i = 0; i < missing.length; i += 80) {
    const chunk = missing.slice(i, i + 80);
    let rows = null;
    if (!config.places.fixture) {
      try {
        const coords = [userLoc, ...chunk.map((s) => s.location)].map(([la, ln]) => `${ln},${la}`).join(';');
        const j = await fetchJson(`${config.places.osrmUrl}/table/v1/driving/${coords}?sources=0&annotations=duration,distance`, {}, 8000);
        if (j.code === 'Ok') rows = { d: j.durations[0], m: j.distances[0] };
      } catch { /* fall back below */ }
    }
    chunk.forEach((s, k) => {
      const straight = haversineKm(userLoc, s.location);
      const km = rows?.m?.[k + 1] != null ? rows.m[k + 1] / 1000 : straight * 1.35;
      const driveMin = rows?.d?.[k + 1] != null ? rows.d[k + 1] / 60 : (km / 20) * 60;
      const v = { km: Math.round(km * 10) / 10, min: Math.round(driveMin * 1.3), at: Date.now(), road: Boolean(rows) };
      etaCache.set(`${cell}|${s.id}`, v);
      out.set(s.id, v);
    });
  }
  return out;
}

export const deliveryEta = (store, tt) => Math.round((store.prepMin || 10) + (tt?.min ?? 10) + 4);
