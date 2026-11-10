// Extra store / restaurant providers: TomTom Search API and Ola Maps (Krutrim).
// Each returns raw places in the shape places.js expects:
// { id, source, name, category, cuisine, location:[lat,lng], address, phone?, rating?, openNow? }
import { config } from './config.js';

async function getJson(url, headers = {}, ms = 15000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const res = await fetch(url, { headers: { 'User-Agent': config.places.userAgent, ...headers }, signal: ctl.signal });
    const text = await res.text();
    if (!res.ok) throw new Error(`${new URL(url).host} ${res.status}: ${text.slice(0, 160)}`);
    return JSON.parse(text);
  } finally { clearTimeout(t); }
}

/** Run requests in parallel; succeed if at least one works. */
async function settle(tasks, label) {
  const results = await Promise.allSettled(tasks);
  const ok = results.filter((r) => r.status === 'fulfilled').flatMap((r) => r.value);
  const failed = results.filter((r) => r.status === 'rejected');
  if (failed.length) console.warn(`[places] ${label}: ${failed.length}/${results.length} requests failed (${failed[0].reason?.message})`);
  if (failed.length === results.length) throw failed[0].reason;
  return ok;
}

// ---------------------------------------------------------------- TomTom
// Category Search: /search/2/categorySearch/{query}.json  (max 100 results per request)
const TT_QUERIES = ['restaurant', 'fast food', 'dhaba', 'cafe', 'bakery', 'sweet shop', 'hotel', 'lodge', 'guest house', 'general store', 'kirana store', 'shop', 'supermarket', 'grocery', 'pharmacy', 'electronics', 'mobile phone shop', 'clothing', 'shoes', 'books'];

function ttCategory(poi) {
  const codes = (poi.classifications || []).map((c) => c.code);
  const names = (poi.classifications || []).flatMap((c) => (c.names || []).map((n) => n.name.toLowerCase())).join(' ')
    + ' ' + (poi.categories || []).join(' ').toLowerCase();
  if (codes.includes('HOTEL_MOTEL')) return ['hotel', names];
  if (codes.includes('RESTAURANT')) return ['food', names];
  if (codes.includes('CAFE_PUB')) return ['food', `cafe ${names}`];
  if (codes.includes('PHARMACY')) return ['pharmacy', names];
  if (codes.includes('MARKET') || codes.includes('DEPARTMENT_STORE')) return ['grocery', names];
  if (codes.includes('SHOP') || codes.includes('SHOPPING_CENTER')) {
    // The shop's own name is the most reliable signal for Indian shops
    const nm = (poi.name || '').toLowerCase();
    if (/bakery|bakers|cake|sweet|mithai/.test(nm)) return ['food', 'bakery'];
    if (/medical|pharma|chemist|drug/.test(nm)) return ['pharmacy', names];
    if (/stationer|xerox|book|copier|print/.test(nm)) return ['stationery', names];
    if (/cloth|garment|saree|sari|fashion|textile|tailor|footwear|shoe|boutique|collection|dresses/.test(nm)) return ['fashion', names];
    if (/general|kirana|provision|mart|super ?market|grocer|dairy|vegetable|fruit|traders/.test(nm)) return ['grocery', names];
    if (/baker|cake|sweet|confection/.test(names)) return ['food', 'bakery'];
    if (/grocer|convenience|supermarket|food drinks|dairy|fruit|vegetable|butcher/.test(names)) return ['grocery', names];
    if (/drug|chemist|pharm|cosmetic/.test(names)) return ['pharmacy', names];
    if (/electr|computer|mobile|phone|camera|it\b/.test(names)) return ['electronics', names];
    if (/cloth|shoe|footwear|fashion|jewel|textile|bag/.test(names)) return ['fashion', names];
    if (/book|stationer|gift|toy|newsagent/.test(names)) return ['stationery', names];
    if (/general|variety|kirana|provision|store|mart/.test(`${names} ${(poi.name || '').toLowerCase()}`)) return ['grocery', names];
  }
  return [null, names];
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** TomTom's free plan allows only a few requests per second: run 2 at a time and retry on 429. */
async function paced(fns, concurrency = 2, gapMs = 350) {
  const out = new Array(fns.length);
  let next = 0;
  async function worker() {
    while (next < fns.length) {
      const i = next++;
      for (let attempt = 0; ; attempt++) {
        try { out[i] = { status: 'fulfilled', value: await fns[i]() }; break; } catch (e) {
          if (/ 429/.test(e.message) && attempt < 4) { await sleep(1200 * (attempt + 1)); continue; }
          out[i] = { status: 'rejected', reason: e }; break;
        }
      }
      await sleep(gapMs);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  return out;
}

export async function tomtom([lat, lng], radiusM) {
  const key = encodeURIComponent(config.places.tomtomKey);
  const tasks = TT_QUERIES.map((q) => () => getJson(
    `https://api.tomtom.com/search/2/categorySearch/${encodeURIComponent(q)}.json?key=${key}&lat=${lat}&lon=${lng}&radius=${Math.min(radiusM, 50000)}&limit=100&language=en-GB`,
  ).then((j) => (j.results || []).map((r) => {
    const poi = r.poi || {};
    const [category, names] = ttCategory(poi);
    if (!category || !poi.name || !r.position) return null;
    const a = r.address || {};
    return {
      id: `tt_${r.id}`, source: 'tomtom', name: poi.name, category, cuisine: names,
      location: [r.position.lat, r.position.lon],
      address: [a.streetNumber, a.streetName, a.municipalitySubdivision].filter(Boolean).join(' ') || a.freeformAddress || '',
      phone: poi.phone || null,
    };
  }).filter(Boolean)));
  const results = await paced(tasks);
  const failed = results.filter((r) => r.status === 'rejected');
  if (failed.length) console.warn(`[places] TomTom: ${failed.length}/${results.length} searches failed (${failed[0].reason?.message})`);
  if (failed.length === results.length) throw failed[0].reason;
  return results.filter((r) => r.status === 'fulfilled').flatMap((r) => r.value);
}

// ---------------------------------------------------------------- Ola Maps
// Nearby Search: https://api.olamaps.io/places/v1/nearbysearch?layers=venue&types=...&location=lat,lng
// Coordinates are read from whichever field the response provides; if a result has none,
// Place Details is used to fetch them.
const OLA_TYPES = [
  ['food', 'restaurant'], ['food', 'cafe'], ['food', 'bakery'], ['food', 'meal_takeaway'],
  ['grocery', 'supermarket'], ['grocery', 'grocery_or_supermarket'], ['grocery', 'convenience_store'],
  ['pharmacy', 'pharmacy'], ['electronics', 'electronics_store'], ['fashion', 'clothing_store'], ['stationery', 'book_store'], ['hotel', 'lodging'],
];
const OLA = 'https://api.olamaps.io/places/v1';
const olaKey = () => encodeURIComponent(config.places.olaKey);
const olaHeaders = () => ({ 'X-Request-Id': `ck-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` });

function olaPoint(r) {
  const g = r.geometry?.location || r.location || r.centroid || r.geometry;
  if (g && Number.isFinite(Number(g.lat)) && Number.isFinite(Number(g.lng ?? g.lon))) return [Number(g.lat), Number(g.lng ?? g.lon)];
  if (Number.isFinite(Number(r.latitude)) && Number.isFinite(Number(r.longitude))) return [Number(r.latitude), Number(r.longitude)];
  if (Array.isArray(g?.coordinates)) return [Number(g.coordinates[1]), Number(g.coordinates[0])];
  return null;
}

const OLA_CAT = [
  [/restaurant|cafe|bakery|meal_|food_court|fast_food|dhaba|sweet/, 'food'],
  [/pharmacy|drugstore|chemist|medical/, 'pharmacy'],
  [/supermarket|grocery|convenience|kirana|market|dairy/, 'grocery'],
  [/electronics|mobile|phone|computer|hardware/, 'electronics'],
  [/clothing|shoe|apparel|jewel|fashion/, 'fashion'],
  [/book|stationery|gift/, 'stationery'],
  [/lodging|hotel|guest_house|hostel|resort/, 'hotel'],
];
const olaCategory = (types) => { const t = types.join(' '); return OLA_CAT.find(([re]) => re.test(t))?.[1] || null; };

async function olaDetails(placeId) {
  const j = await getJson(`${OLA}/details?place_id=${encodeURIComponent(placeId)}&api_key=${olaKey()}`, olaHeaders(), 10000);
  return j.result || j;
}

export async function ola([lat, lng], radiusM) {
  const tasks = OLA_TYPES.map(([category, type]) => getJson(
    `${OLA}/nearbysearch?layers=venue&types=${type}&location=${lat},${lng}&radius=${Math.min(radiusM, 10000)}&limit=50&withCentroid=true&api_key=${olaKey()}`,
    olaHeaders(),
  ).then((j) => (j.predictions || j.results || []).map((r) => ({ r, category, type }))));
  const raw = await settle(tasks, 'Ola Maps');

  // Fill in missing coordinates (bounded, to stay within free-tier limits)
  const missing = raw.filter((x) => !olaPoint(x.r) && x.r.place_id).slice(0, 40);
  await Promise.allSettled(missing.map(async (x) => { x.details = await olaDetails(x.r.place_id); }));

  return raw.map(({ r, category: asked, type, details }) => {
    const d = details || {};
    const category = olaCategory([...(r.types || []), ...(d.types || [])]) || asked;
    const location = olaPoint(r) || olaPoint(d);
    const name = r.structured_formatting?.main_text || r.name || d.name || (r.description || '').split(',')[0];
    if (!location || !name) return null;
    return {
      id: `ola_${r.place_id || `${location[0].toFixed(5)},${location[1].toFixed(5)}`}`, source: 'ola', name, category,
      cuisine: [type, ...(r.types || [])].join(' '),
      location,
      address: r.structured_formatting?.secondary_text || d.formatted_address || r.description || '',
      rating: r.rating ?? d.rating ?? null,
      openNow: d.opening_hours?.open_now ?? r.opening_hours?.open_now ?? null,
      phone: d.formatted_phone_number || d.international_phone_number || null,
    };
  }).filter(Boolean);
}
